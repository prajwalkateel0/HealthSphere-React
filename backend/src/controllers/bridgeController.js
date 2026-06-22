// Handlers for the Power Apps Code App bridge. These never touch Prisma/Postgres —
// the Code App already has its own Dataverse data, so callers pass in whatever
// context the handler needs and get back only the secret-bearing result.
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { buildSystemPrompt, extractDrugName, fetchFdaContext, getRuleBasedResponse } = require('../utils/aiAssistant');
const mailer = require('../utils/mailer');

exports.emailConfig = (req, res) => {
  res.json({
    appName: 'HealthSphere',
    systemEmail: mailer.MAIL_ADMIN,
    smtpHost: mailer.MAIL_HOST,
    smtpPort: mailer.MAIL_PORT,
    mailFrom: mailer.MAIL_FROM,
  });
};

exports.chat = async (req, res) => {
  try {
    const { message, history = [], user, meds = [], allergies = [], metrics = null, docStr = 'your registered GP' } = req.body;
    const trimmed = (message || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Empty message' });
    if (!user?.name) return res.status(400).json({ error: 'Missing user context' });

    const systemPrompt = buildSystemPrompt({ user, meds, allergies, metrics, docStr });

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

exports.foodSearchExternal = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) return res.json([]);
    const KEY = process.env.SPOONACULAR_API_KEY;
    if (!KEY) return res.json([]);
    const response = await axios.get(`https://api.spoonacular.com/food/ingredients/search?query=${encodeURIComponent(query)}&number=10&apiKey=${KEY}`);
    const spoonacular = (response.data.results || []).map(item => ({ id: null, name: item.name, calories: null, source: 'spoonacular' }));
    res.json(spoonacular);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Wearable sync: download + parse only. The Code App writes the returned
// rows into Dataverse itself and tracks the drive-file dedup state there too.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseTakeoutCsv(csvText) {
  const allRows = parseCsv(csvText);
  if (!allRows.length) return [];
  const header = allRows[0];
  const col = (name) => header.indexOf(name);

  const dateIdx = col('Date');
  const hrIdx = col('Average heart rate (bpm)');
  const stepsIdx = col('Step count');
  const distIdx = col('Distance (m)');
  const calIdx = col('Calories (kcal)');
  const weightIdx = col('Average weight (kg)');
  if (dateIdx === -1) return [];

  const num = (v) => {
    if (v === undefined) return null;
    const t = v.trim();
    return t !== '' && !isNaN(t) ? parseFloat(t) : null;
  };

  const byDate = {};
  for (let i = 1; i < allRows.length; i++) {
    const r = allRows[i];
    const date = (r[dateIdx] || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const hr = num(r[hrIdx]);
    const dist = num(r[distIdx]);
    const cal = num(r[calIdx]);
    const weight = num(r[weightIdx]);
    byDate[date] = {
      metricDate: date,
      heartRate: hr === null ? null : Math.round(hr),
      steps: Math.round(num(r[stepsIdx]) ?? 0),
      distanceKm: dist === null ? 0 : Math.round((dist / 1000) * 100) / 100,
      caloriesBurned: cal === null ? 0 : Math.round(cal),
      weight: weight === null ? null : Math.round(weight * 100) / 100,
    };
  }
  return Object.values(byDate).sort((a, b) => b.metricDate.localeCompare(a.metricDate));
}

function extractDailyActivityCsv(zipBuffer) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const csvEntry = entries.find(e => /\/Daily activity metrics\.csv$/i.test(e.entryName))
    || entries.find(e => /Daily activity metrics.*\.csv$/i.test(e.entryName));
  if (!csvEntry) {
    const sample = entries.slice(0, 20).map(e => e.entryName).join(', ');
    throw new Error(`Daily activity metrics CSV not found. ZIP contains: ${sample}`);
  }
  const csv = csvEntry.getData().toString('utf8');
  if (!csv.trim()) throw new Error('Daily activity metrics CSV is empty.');
  return csv;
}

exports.wearableSync = async (req, res) => {
  try {
    const { knownDriveFileId, knownModifiedTime } = req.body || {};
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const folderId = process.env.GOOGLE_DRIVE_TAKEOUT_FOLDER_ID;

    if (!apiKey || !folderId) {
      return res.json({ success: false, error: 'Google Drive sync is not configured. Set GOOGLE_DRIVE_API_KEY and GOOGLE_DRIVE_TAKEOUT_FOLDER_ID in the backend .env.' });
    }

    const q = `'${folderId}' in parents and trashed=false and name contains 'takeout-'`;
    const listResp = await axios.get('https://www.googleapis.com/drive/v3/files', {
      params: { q, fields: 'files(id,name,modifiedTime,size)', orderBy: 'modifiedTime desc', pageSize: 10, key: apiKey },
      timeout: 15000,
    });
    const files = listResp.data.files || [];
    if (!files.length) {
      return res.json({ success: false, error: 'No Takeout ZIPs found in the configured Google Drive folder. Ensure the folder ID is correct and the folder is shared "Anyone with the link".' });
    }

    files.sort((a, b) => {
      const sizeDiff = (parseInt(b.size) || 0) - (parseInt(a.size) || 0);
      if (Math.abs(sizeDiff) > 100000) return sizeDiff;
      return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
    });
    const file = files[0];

    if (knownDriveFileId === file.id && knownModifiedTime === file.modifiedTime) {
      return res.json({ success: true, already_current: true, file: file.name, message: 'Already up to date — this is the latest Takeout ZIP from your Drive.' });
    }

    const downloadResp = await axios.get(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`, {
      params: { alt: 'media', key: apiKey },
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024,
    });
    const buffer = Buffer.from(downloadResp.data);
    if (buffer.length < 1000) {
      return res.json({ success: false, error: 'Downloaded file is too small — check sharing permissions on the Drive folder.' });
    }

    const csvText = extractDailyActivityCsv(buffer);
    const rows = csvText ? parseTakeoutCsv(csvText) : [];
    if (!rows.length) {
      return res.json({ success: false, error: 'No daily activity rows found in this Takeout file.' });
    }

    res.json({
      success: true,
      already_current: false,
      file: file.name,
      driveFileId: file.id,
      modifiedTime: file.modifiedTime,
      rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Document storage: local disk only (matches existing app behaviour). The
// Code App creates/deletes the Dataverse hs_documents metadata row itself.
exports.uploadDocument = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.status(201).json({
    filePath: req.file.filename,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  });
};

exports.deleteDocumentFile = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../uploads', req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
