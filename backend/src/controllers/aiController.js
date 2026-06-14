const axios = require('axios');
const prisma = require('../config/db');
const { buildSystemPrompt, extractDrugName, fetchFdaContext, getRuleBasedResponse } = require('../utils/aiAssistant');

const ALLERGEN_SYNONYMS = {
  milk: ['milk','dairy','lactose','casein','whey','lactalbumin','lactoglobulin','butter','cream','cheese','ghee'],
  wheat: ['wheat','gluten','flour','semolina','spelt','kamut','durum','bulgur','farro','triticale'],
  eggs: ['egg','albumin','globulin','lysozyme','mayonnaise','meringue','ovalbumin'],
  peanuts: ['peanut','groundnut','arachis','monkey nuts'],
  nuts: ['almond','cashew','walnut','pecan','pistachio','hazelnut','macadamia','brazil nut','pine nut'],
  soy: ['soy','soya','tofu','miso','tempeh','edamame','textured vegetable protein','tvp'],
  fish: ['fish','cod','salmon','tuna','halibut','anchovies','sardines','bass','flounder'],
  shellfish: ['shrimp','crab','lobster','crawfish','scallop','clam','oyster','mussel','squid'],
  sesame: ['sesame','tahini','til','gingelly'],
};

exports.scanIngredients = async (req, res) => {
  try {
    const { ingredients, product_name } = req.body;
    const userId = req.user.id;

    const userAllergies = await prisma.allergy.findMany({ where: { userId }, select: { allergen: true } });
    const allergyList = userAllergies.map(a => a.allergen.toLowerCase());
    const ingredientText = ingredients.toLowerCase();
    const alerts = [];
    let result = 'safe';

    for (const allergen of allergyList) {
      const synonyms = ALLERGEN_SYNONYMS[allergen] || [allergen];
      for (const syn of synonyms) {
        if (ingredientText.includes(syn)) {
          alerts.push(`Contains ${syn} (${allergen} allergen)`);
          result = 'danger';
          break;
        }
      }
    }

    if (result === 'safe') {
      for (const [category, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
        for (const syn of synonyms) {
          if (ingredientText.includes(syn)) {
            alerts.push(`May contain ${syn} — check if you have ${category} sensitivity`);
            result = 'warning';
            break;
          }
        }
      }
    }

    await prisma.ingredientScan.create({
      data: { userId, productName: product_name || 'Unknown Product', ingredients, result, alerts: JSON.stringify(alerts) },
    }).catch(() => {});

    res.json({ result, alerts, product_name });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id;
    const trimmed = (message || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Empty message' });

    const [user, metrics, allergies, meds, nextAppt] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.healthMetric.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
      prisma.allergy.findMany({ where: { userId } }),
      prisma.prescription.findMany({ where: { patientId: userId, status: 'active' }, take: 5 }),
      prisma.appointment.findFirst({
        where: { patientId: userId, status: { in: ['confirmed', 'pending'] }, appointmentDate: { gte: new Date() } },
        orderBy: { appointmentDate: 'asc' },
        include: { doctor: { include: { doctor: true } } },
      }),
    ]);

    const docStr = nextAppt
      ? `${/^dr\.?\s/i.test(nextAppt.doctor.name) ? '' : 'Dr. '}${nextAppt.doctor.name}${nextAppt.doctor.doctor?.specialization ? ` (${nextAppt.doctor.doctor.specialization})` : ''}`
      : 'your registered GP';

    const systemPrompt = buildSystemPrompt({ user, meds, allergies, metrics, docStr });

    // Inject FDA drug context if the message mentions a drug
    const drugName = extractDrugName(trimmed, meds);
    let fullPrompt = systemPrompt;
    if (drugName) {
      const fdaContext = await fetchFdaContext(drugName);
      if (fdaContext) {
        fullPrompt += `\n\n${fdaContext}\n\nUse the FDA data above to give accurate, evidence-based information about this drug. Always add a disclaimer to consult their doctor.`;
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (apiKey) {
      try {
        const geminiContents = history
          .filter(h => ['user', 'assistant'].includes(h.role) && h.content)
          .map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(h.content) }] }));
        geminiContents.push({ role: 'user', parts: [{ text: trimmed }] });

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            system_instruction: { parts: [{ text: fullPrompt }] },
            contents: geminiContents,
            generationConfig: { maxOutputTokens: 900 },
          },
          { timeout: 30000 }
        );

        const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return res.json({ reply, source: 'gemini', model });
      } catch {
        // fall through to rule-based
      }
    }

    const reply = getRuleBasedResponse(trimmed, { user, meds, allergies, metrics, docStr });
    res.json({ reply, source: 'local', model: 'HealthSphere AI (built-in)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getContext = async (req, res) => {
  try {
    const userId = req.user.id;
    const [user, metrics, allergies, meds] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, bloodType: true, nhsId: true } }),
      prisma.healthMetric.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
      prisma.allergy.findMany({ where: { userId }, take: 3 }),
      prisma.prescription.findMany({ where: { patientId: userId, status: 'active' }, take: 4 }),
    ]);
    res.json({ user, metrics, allergies, medications: meds });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── OpenFDA drug lookup proxy ────────────────────────────────────────
exports.drugLookup = async (req, res) => {
  try {
    const q = String(req.query.q || '').replace(/[^\w\s-]/g, '').trim();
    const type = ['recall', 'event', 'label'].includes(req.query.type) ? req.query.type : 'label';
    if (!q) return res.json({ error: 'No drug name provided' });

    const enc = `"${q}"`;

    if (type === 'recall') {
      let data = await fetchFda('https://api.fda.gov/drug/recall.json', { search: `product_description:${enc}`, limit: 5 });
      if (!data?.results?.length) data = await fetchFda('https://api.fda.gov/drug/recall.json', { search: `product_description:${q}`, limit: 5 });
      const recalls = (data?.results || []).map(r => ({
        date: (r.report_date || '').slice(0, 8),
        reason: r.reason_for_recall || '',
        status: r.status || '',
        product: r.product_description || '',
        classification: r.classification || '',
      }));
      return res.json({ type: 'recall', drug: q, recalls, count: recalls.length });
    }

    let data = await fetchFda('https://api.fda.gov/drug/label.json', { search: `(openfda.brand_name:${enc}+openfda.generic_name:${enc})`, limit: 1 });
    if (!data?.results?.length) data = await fetchFda('https://api.fda.gov/drug/label.json', { search: q, limit: 1 });
    const r = data?.results?.[0];
    if (!r) return res.json({ error: `No FDA label found for "${q}". Try the generic or brand name.` });

    const openfda = r.openfda || {};
    const field = (key, max = 500) => r[key]?.length ? truncate(r[key].join(' '), max) : null;

    res.json({
      type: 'label',
      drug: q,
      brand_name: openfda.brand_name?.[0] || null,
      generic_name: openfda.generic_name?.[0] || null,
      manufacturer: openfda.manufacturer_name?.[0] || null,
      route: openfda.route?.[0] || null,
      indications: field('indications_and_usage'),
      warnings: field('warnings', 400),
      adverse_reactions: field('adverse_reactions', 400),
      dosage: field('dosage_and_administration', 300),
      drug_interactions: field('drug_interactions', 400),
      contraindications: field('contraindications', 400),
      purpose: field('purpose', 200),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── NHS Medicines proxy (HTML scrape fallback) ───────────────────────
exports.nhsMedicine = async (req, res) => {
  try {
    const drug = String(req.query.drug || '').trim();
    if (!drug) return res.json({ error: 'No drug name provided' });

    const slug = drug.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
    const url = `https://www.nhs.uk/medicines/${slug}/`;

    const { data: html, status } = await axios.get(url, {
      timeout: 8000, validateStatus: () => true,
      headers: { 'User-Agent': 'HealthSphere/1.0' },
    });

    if (status === 404 || !html) {
      return res.json({ error: `'${drug}' not found. Try searching by generic name (e.g. 'ibuprofen' instead of 'Nurofen').` });
    }

    const metaM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/i);
    const description = (metaM?.[1] || '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"');

    const sections = [];
    const sectionRe = /<h2[^>]*>(.*?)<\/h2>([\s\S]*?)(?=<h2|<\/article|$)/gi;
    let m, count = 0;
    while ((m = sectionRe.exec(html)) && count < 8) {
      const heading = stripTags(m[1]);
      const pMatches = [...m[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 3).map(p => stripTags(p[1]));
      const content = pMatches.join(' ').replace(/\s+/g, ' ').trim();
      if (heading.length > 2 && content.length > 30) { sections.push({ heading, content: content.slice(0, 450) }); count++; }
    }

    const titleM = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const name = stripTags(titleM?.[1] || slug.replace(/-/g, ' '));

    res.json({ source: 'nhs_scrape', name, description: description.slice(0, 400), url, sections });
  } catch (err) { res.json({ error: 'Failed to reach NHS medicines database.' }); }
};

async function fetchFda(url, params) {
  try {
    const { data } = await axios.get(url, { params, timeout: 10000, headers: { 'User-Agent': 'HealthSphere/1.0' } });
    return data;
  } catch { return null; }
}

function truncate(s, n = 500) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function stripTags(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

exports.foodSearch = async (req, res) => {
  try {
    const { query } = req.query;
    const local = await prisma.foodDatabase.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      take: 20,
    });
    if (local.length >= 5 || !process.env.SPOONACULAR_API_KEY) return res.json(local);

    const response = await axios.get(`https://api.spoonacular.com/food/ingredients/search?query=${query}&number=10&apiKey=${process.env.SPOONACULAR_API_KEY}`);
    const spoonacular = response.data.results.map(item => ({ id: null, name: item.name, calories: null, source: 'spoonacular' }));
    res.json([...local, ...spoonacular]);
  } catch {
    res.json([]);
  }
};

exports.getHealthInsights = async (req, res) => {
  try {
    const metrics = await prisma.healthMetric.findMany({
      where: { userId: req.user.id },
      orderBy: { recordedAt: 'desc' },
      take: 7,
    });

    const insights = [];
    if (metrics.length) {
      const l = metrics[0];
      if (l.systolic > 130) insights.push({ type: 'warning', title: 'Elevated Blood Pressure', message: 'Your blood pressure is above normal. Consider reducing sodium intake and consult your doctor.' });
      if (l.heartRate > 100) insights.push({ type: 'warning', title: 'High Heart Rate', message: 'Your resting heart rate is elevated. This may indicate stress or dehydration.' });
      if (l.oxygenSaturation && parseFloat(l.oxygenSaturation) < 95) insights.push({ type: 'danger', title: 'Low Oxygen Saturation', message: 'Your SpO2 is below 95%. Please contact your doctor immediately.' });
      if (l.sleepHours && parseFloat(l.sleepHours) < 6) insights.push({ type: 'warning', title: 'Insufficient Sleep', message: 'You are getting less than 6 hours of sleep. Aim for 7-9 hours.' });
      if (l.steps && l.steps < 5000) insights.push({ type: 'info', title: 'Low Activity', message: 'Try to reach 10,000 steps daily for better cardiovascular health.' });
      if (!insights.length) insights.push({ type: 'success', title: 'Great Health Metrics', message: 'Your recent health metrics look good. Keep maintaining your healthy lifestyle!' });
    } else {
      insights.push({ type: 'info', title: 'No Data Yet', message: 'Start logging your health metrics to get personalized insights.' });
    }
    res.json({ insights, metrics });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
