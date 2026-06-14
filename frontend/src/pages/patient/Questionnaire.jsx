import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import '../../assets/questionnaire.css';

const SECTIONS = {
  1: { name: 'You and your household', time: '4 – 6 minutes', icon: '🏠',
    desc: 'This first set of questions is designed to collect important information about you and your home. This information will help us understand the differences between people and how that affects health.' },
  2: { name: 'Work and education', time: '3 – 5 minutes', icon: '💼',
    desc: 'This section is about your work, education and physical activity at work. Understanding your working environment helps us assess health risks.' },
  3: { name: 'Lifestyle', time: '10 – 15 minutes', icon: '🌿',
    desc: 'This section is about your lifestyle, including physical activity, tobacco and alcohol use, and sleep. These factors play a major role in long-term health outcomes.' },
  4: { name: 'Family health', time: '8 – 10 minutes', icon: '👨‍👩‍👧',
    desc: 'This section is about health conditions in your blood relatives. Family history is one of the strongest predictors of your own health risk.' },
  5: { name: 'Your health', time: '10 – 12 minutes', icon: '🩺',
    desc: 'This final section is about your own health, including any diagnosed conditions, medications and your general wellbeing.' },
};

const QUESTIONS = [
  // ── Section 1 ──────────────────────────────────────────────────────
  { s: 1, key: 'sex_at_birth', type: 'radio', label: 'What sex were you registered with at birth?',
    hint: 'A question about gender identity will follow later in the questionnaire.',
    help: 'Biological sex (as registered at birth) may differ from gender identity. Both are important for health research.',
    opts: ['Female', 'Male', 'Intersex', 'Prefer not to answer'] },

  { s: 1, key: 'height_unit', type: 'radio', label: 'How would you prefer to enter your height?',
    hint: 'If you are not sure about your height, please provide a best guess on the next page.',
    opts: ['Feet and inches', 'Centimeters', 'Do not know my height', 'Prefer not to provide my height'] },

  { s: 1, key: 'height_value', type: 'height', label: 'What is your height?',
    hint: 'Without shoes.',
    help: 'Stand without shoes and measure from the floor to the top of your head.',
    show_if: ['height_unit', 'Feet and inches|Centimeters'] },

  { s: 1, key: 'weight_unit', type: 'radio', label: 'How would you prefer to enter your weight?',
    hint: 'If you are not sure about your weight, please provide a best guess on the next page.',
    opts: ['Kilograms', 'Stones and pounds', 'Do not know my weight', 'Prefer not to provide my weight'] },

  { s: 1, key: 'weight_value', type: 'weight', label: 'What is your weight?',
    hint: 'Without shoes or heavy clothing.',
    help: 'Weigh yourself in the morning, without clothes if possible.',
    show_if: ['weight_unit', 'Kilograms|Stones and pounds'] },

  { s: 1, key: 'main_language', type: 'select', label: 'What is your main language?',
    opts: ['English', 'Punjabi', 'Urdu', 'Bengali', 'Gujarati', 'Welsh', 'Polish', 'Arabic', 'Somali', 'Tamil', 'Hindi', 'French', 'Spanish', 'Portuguese', 'Mandarin', 'Cantonese', 'Other', 'Prefer not to answer'] },

  { s: 1, key: 'ethnicity', type: 'radio', label: 'What is your ethnic group?',
    opts: ['White – British', 'White – Irish', 'White – Other', 'Mixed – White and Black Caribbean', 'Mixed – White and Black African', 'Mixed – White and Asian', 'Mixed – Other', 'Asian or Asian British – Indian', 'Asian or Asian British – Pakistani', 'Asian or Asian British – Bangladeshi', 'Asian or Asian British – Other', 'Black or Black British – Caribbean', 'Black or Black British – African', 'Black or Black British – Other', 'Chinese', 'Arab', 'Any other ethnic group', 'Prefer not to answer'] },

  { s: 1, key: 'housing_type', type: 'radio', label: 'What type of accommodation do you live in?',
    opts: ['House (detached or semi-detached)', 'Terraced house', 'Flat or apartment', 'Bungalow', 'Mobile or temporary accommodation', 'Other', 'Prefer not to answer'] },

  { s: 1, key: 'household_size', type: 'number', label: 'How many people (including yourself) live in your household?',
    hint: 'Include all people who usually live here — count children too.',
    min: 1, max: 20, unit: 'people' },

  // ── Section 2 ──────────────────────────────────────────────────────
  { s: 2, key: 'manual_work', type: 'radio', label: 'Does your work involve heavy manual or very physical work?',
    help: 'Heavy manual work includes jobs such as building, farm work, moving heavy loads or mining.',
    opts: ['Never / rarely', 'Sometimes', 'Often', 'Always / almost always', 'Not currently working'] },

  { s: 2, key: 'walk_days', type: 'radio', label: 'Thinking about the last 4 weeks, in a typical week, on how many days did you walk for at least 10 minutes at a time?',
    hint: 'Include walking at work, travelling to/from work, and for sport or leisure.',
    opts: ['0 days', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', 'Do not know', 'Unable to walk'] },

  { s: 2, key: 'education', type: 'radio', label: 'What is your highest level of education?',
    opts: ['No formal qualifications', 'GCSEs or O-levels (or equivalent)', 'A-levels or equivalent', 'Vocational qualification (NVQ, HND, etc.)', 'Undergraduate degree (BA, BSc, etc.)', 'Postgraduate degree (MA, MSc, PhD, etc.)', 'Professional qualification (e.g. medical, legal)', 'Prefer not to answer'] },

  { s: 2, key: 'employment', type: 'radio', label: 'What is your current employment status?',
    opts: ['Working full-time (30+ hours/week)', 'Working part-time (under 30 hours/week)', 'Self-employed', 'Retired', 'In full-time education or training', 'Looking for work / unemployed', 'Long-term sick or disabled', 'Carer (unpaid)', 'Prefer not to answer'] },

  // ── Section 3 ──────────────────────────────────────────────────────
  { s: 3, key: 'moderate_days', type: 'radio', label: 'Thinking about the last 4 weeks, in a typical week, on how many days did you do 10 minutes or more of moderate physical activities?',
    hint: 'Moderate activities include carrying light loads, cycling at normal pace. Do not include walking.',
    opts: ['0 days', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days', 'Do not know', 'Prefer not to answer'] },

  { s: 3, key: 'moderate_minutes', type: 'number', label: 'How many minutes did you usually spend doing moderate physical activities on a typical day?',
    hint: 'Think about the last 4 weeks.',
    min: 0, max: 600, unit: 'minutes', extra_opts: ['Do not know'] },

  { s: 3, key: 'tobacco_products', type: 'checkbox', label: 'Have you ever used any of these tobacco products, even once?',
    hint: 'Select all that apply.',
    opts: ['Cigarettes (manufactured or hand-rolled)', 'Electronic cigarettes / vaping devices', 'Cigars, cigarillos or little filtered cigars', 'Chewing tobacco, snus, snuff or dip', 'Shisha, hookah or water pipe', 'Tobacco pipe', 'I have not used any of these tobacco products', 'Prefer not to answer'] },

  { s: 3, key: 'smoking_status', type: 'radio', label: 'Do you currently smoke?',
    opts: ['Yes, I smoke daily', 'Yes, I smoke occasionally', 'No, but I used to smoke', 'I have never smoked', 'Prefer not to answer'] },

  { s: 3, key: 'alcohol_frequency', type: 'radio', label: 'How often do you drink alcohol?',
    opts: ['Daily or almost daily', '3–4 times a week', '1–2 times a week', '2–3 times a month', 'Once a month or less', 'Never', 'Prefer not to answer'] },

  { s: 3, key: 'sleep_hours', type: 'radio', label: 'On a typical night, how many hours of sleep do you usually get?',
    opts: ['Less than 5 hours', '5 hours', '6 hours', '7 hours', '8 hours', '9 hours', '10 or more hours', 'Prefer not to answer'] },

  // ── Section 4 ──────────────────────────────────────────────────────
  { s: 4, key: 'family_heart', type: 'radio', label: 'Has any of your blood relatives been diagnosed with heart disease or had a heart attack before the age of 60?',
    hint: 'Blood relatives include parents, brothers, sisters, children, grandparents, aunts and uncles.',
    opts: ['Yes', 'No', 'Do not know', 'Prefer not to answer'] },

  { s: 4, key: 'family_heart_who', type: 'checkbox', label: 'Which blood relatives have had heart disease or a heart attack?',
    opts: ['Father', 'Mother', 'Brother / sister', 'Grandparent', 'Uncle / aunt', 'Other', 'Prefer not to answer'],
    show_if: ['family_heart', 'Yes'] },

  { s: 4, key: 'family_diabetes', type: 'radio', label: 'Has any blood relative been diagnosed with diabetes?',
    opts: ['Yes – Type 1', 'Yes – Type 2', 'Yes – type not known', 'No', 'Do not know', 'Prefer not to answer'] },

  { s: 4, key: 'family_cancer', type: 'radio', label: 'Has any blood relative been diagnosed with cancer?',
    opts: ['Yes', 'No', 'Do not know', 'Prefer not to answer'] },

  { s: 4, key: 'family_cancer_type', type: 'checkbox', label: 'Which type(s) of cancer?',
    hint: 'Select all that apply.',
    opts: ['Breast cancer', 'Bowel cancer', 'Lung cancer', 'Prostate cancer', 'Ovarian cancer', 'Skin cancer (melanoma)', 'Other cancer', 'Do not know the type', 'Prefer not to answer'],
    show_if: ['family_cancer', 'Yes'] },

  { s: 4, key: 'family_stroke', type: 'radio', label: 'Has any blood relative had a stroke?',
    opts: ['Yes', 'No', 'Do not know', 'Prefer not to answer'] },

  { s: 4, key: 'family_mental_health', type: 'radio', label: 'Has any blood relative been diagnosed with a mental health condition?',
    hint: 'For example: depression, anxiety, bipolar disorder, schizophrenia.',
    opts: ['Yes', 'No', 'Do not know', 'Prefer not to answer'] },

  { s: 4, key: 'family_high_bp', type: 'radio', label: 'Has any blood relative been diagnosed with high blood pressure?',
    opts: ['Yes', 'No', 'Do not know', 'Prefer not to answer'] },

  // ── Section 5 ──────────────────────────────────────────────────────
  { s: 5, key: 'existing_conditions', type: 'checkbox', label: 'Have you ever been diagnosed by a doctor with any of the following conditions?',
    hint: 'Select all that apply.',
    opts: ['Type 1 diabetes', 'Type 2 diabetes', 'High blood pressure (hypertension)', 'Heart disease (angina, heart attack, heart failure)', 'Stroke or TIA (mini-stroke)', 'Asthma', 'Chronic obstructive pulmonary disease (COPD)', 'Arthritis (osteo or rheumatoid)', 'Osteoporosis', 'Cancer (any type)', 'Chronic kidney disease', 'Thyroid condition (over or underactive)', 'Depression or anxiety', 'Other mental health condition', 'Irritable bowel syndrome (IBS)', 'None of the above', 'Prefer not to answer'] },

  { s: 5, key: 'current_medications', type: 'radio', label: 'Are you currently taking any prescribed or regular medications?',
    opts: ['Yes', 'No', 'Prefer not to answer'] },

  { s: 5, key: 'medication_types', type: 'checkbox', label: 'Which of the following types of medication do you take regularly?',
    hint: 'Select all that apply.',
    opts: ['Blood pressure medication', 'Diabetes medication (tablets or insulin)', 'Cholesterol-lowering medication (statins, etc.)', 'Antidepressants or anti-anxiety medication', 'Thyroid medication', 'Asthma inhalers', 'Pain relief (regular/daily use)', 'Blood thinners (warfarin, aspirin, etc.)', 'Contraceptive pill or HRT', 'Other prescribed medication', 'Prefer not to answer'],
    show_if: ['current_medications', 'Yes'] },

  { s: 5, key: 'general_health', type: 'radio', label: 'In general, would you say your health is:',
    opts: ['Excellent', 'Very good', 'Good', 'Fair', 'Poor', 'Very poor', 'Prefer not to answer'] },

  { s: 5, key: 'mh_interest', type: 'radio', label: 'Over the last 2 weeks, how often have you had little interest or pleasure in doing things?',
    hint: 'This helps us understand the mental health of the population.',
    help: 'These questions are about your mental wellbeing. Your answers are completely confidential.',
    opts: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day', 'Prefer not to answer'] },

  { s: 5, key: 'mh_mood', type: 'radio', label: 'Over the last 2 weeks, how often have you been feeling down, depressed or hopeless?',
    opts: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day', 'Prefer not to answer'] },

  { s: 5, key: 'long_term_condition', type: 'radio', label: 'Do you have any physical or mental health conditions or illnesses lasting or expected to last 12 months or more?',
    opts: ['Yes', 'No', 'Prefer not to answer'] },
];

function isVisible(q, saved) {
  if (!q.show_if) return true;
  const [depKey, depVals] = q.show_if;
  const current = (saved[depKey] || '').toLowerCase();
  return depVals.split('|').some(v => current.includes(v.trim().toLowerCase()));
}

function prevLink(curS, curQ) {
  if (curQ > 1) return { s: curS, q: curQ - 1 };
  if (curQ === 1 || curQ === 0) {
    if (curS === 1) return null;
    return { s: curS - 1, q: 0 };
  }
  return { s: curS, q: Math.max(0, curQ - 1) };
}

function nextSQ(curS, curQ, totalQ) {
  if (curQ < totalQ) return [curS, curQ + 1];
  if (curS < 5) return [curS + 1, 0];
  return [5, totalQ + 1];
}

export default function Questionnaire() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const curS = Math.max(1, Math.min(5, parseInt(searchParams.get('s') || '1', 10)));
  const curQ = parseInt(searchParams.get('q') || '0', 10);
  const review = searchParams.get('review');

  useEffect(() => {
    api.get('/patient/questionnaire').then(r => {
      setSaved(r.data.answers || {});
      if (r.data.completed && !review) {
        navigate('/patient/dashboard', { replace: true });
      }
      setLoaded(true);
    });
  }, []);

  const sectionQs = useMemo(() =>
    QUESTIONS.filter(q => q.s === curS && isVisible(q, saved)),
    [curS, saved]);

  const currentQ = curQ > 0 ? sectionQs[curQ - 1] : null;

  const sectionDone = useMemo(() => {
    const result = {};
    [1, 2, 3, 4, 5].forEach(s => {
      const qs = QUESTIONS.filter(q => q.s === s && isVisible(q, saved));
      const answered = qs.filter(q => saved[q.key] !== undefined).length;
      result[s] = qs.length > 0 && answered === qs.length;
    });
    return result;
  }, [saved]);

  // Reset help box + draft when question changes
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    setHelpOpen(false);
    if (!currentQ) { setDraft(null); return; }
    const savedVal = saved[currentQ.key] || '';
    const heightUnit = saved.height_unit || 'Centimeters';
    const weightUnit = saved.weight_unit || 'Kilograms';
    if (currentQ.type === 'checkbox') {
      setDraft({ values: savedVal ? savedVal.split('|') : [] });
    } else if (currentQ.type === 'height') {
      if (/Feet/i.test(heightUnit)) {
        const m = savedVal.match(/(\d+)ft\s*(\d+)in/);
        setDraft({ ft: m?.[1] || '', in: m?.[2] || '' });
      } else {
        const m = savedVal.match(/(\d+\.?\d*)/);
        setDraft({ cm: m?.[1] || '' });
      }
    } else if (currentQ.type === 'weight') {
      if (/Stones/i.test(weightUnit)) {
        const m = savedVal.match(/(\d+)st\s*(\d+)lb/);
        setDraft({ st: m?.[1] || '', lb: m?.[2] || '' });
      } else {
        const m = savedVal.match(/(\d+\.?\d*)/);
        setDraft({ kg: m?.[1] || '', extra: false });
      }
    } else if (currentQ.type === 'number') {
      const m = savedVal.match(/(\d+)/);
      setDraft({ value: m?.[1] || '', extra: '' });
    } else {
      setDraft({ value: savedVal });
    }
  }, [currentQ?.key, curS]);

  if (!loaded) {
    return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner" /></div>;
  }

  const goTo = (s, q) => setSearchParams({ s: String(s), q: String(q), ...(review ? { review: '1' } : {}) });

  const buildValue = () => {
    if (!currentQ) return '';
    const heightUnit = saved.height_unit || 'Centimeters';
    const weightUnit = saved.weight_unit || 'Kilograms';
    switch (currentQ.type) {
      case 'checkbox':
        return (draft.values || []).join('|');
      case 'height':
        if (/Feet/i.test(heightUnit)) return `${(draft.ft || '').trim()}ft ${(draft.in || '').trim()}in`;
        return `${(draft.cm || '').trim()} cm`;
      case 'weight':
        if (/Stones/i.test(weightUnit)) return `${(draft.st || '').trim()}st ${(draft.lb || '').trim()}lb`;
        if (draft.extra) return '';
        return `${(draft.kg || '').trim()} kg`;
      case 'number':
        if (draft.extra) return '';
        return draft.value || '';
      default:
        return draft.value || '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = buildValue();
    const key = currentQ.key;
    const newSaved = { ...saved };
    if (val !== '') newSaved[key] = val;

    if (val !== '') {
      await api.post('/patient/questionnaire/answer', { key, value: val });
    }
    setSaved(newSaved);

    const [nextS, nextQ] = nextSQ(curS, curQ, sectionQs.length);
    const isFinal = curS === 5 && curQ === sectionQs.length;
    if (isFinal) {
      await api.post('/patient/questionnaire/complete');
      navigate('/patient/dashboard?welcome=1');
      return;
    }
    goTo(nextS, nextQ);
  };

  const startSection = () => goTo(curS, 1);

  const handleLogout = () => { logout(); navigate('/login'); };

  const userName = `${user?.name || ''}`.trim();

  return (
    <div className="qn-page">
      {/* NHS Header */}
      <div className="nhs-header">
        <div className="nhs-header-inner">
          <span className="nhs-logo">NHS</span>
          <span className="nhs-header-title">HealthSphere — Health Questionnaire</span>
        </div>
      </div>

      {/* User bar */}
      <div className="nhs-userbar">
        <div className="nhs-userbar-inner">
          Completing questionnaire for: <strong>{userName}</strong>
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Not you? Sign out</a>
          &nbsp;·&nbsp;
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/patient/dashboard'); }}>Skip for now →</a>
        </div>
      </div>

      <div className="nhs-wrap">
        {curQ === 0 ? (
          <>
            {/* Progress bar */}
            <div className="nhs-progress">
              <div className="nhs-progress-track">
                {[1, 2, 3, 4, 5].map(sNum => {
                  const cls = sNum === curS ? 'current' : (sectionDone[sNum] ? 'done' : '');
                  return (
                    <div className={`nhs-step ${cls}`} key={sNum}>
                      <div className="nhs-step-dot">
                        {sectionDone[sNum] && sNum !== curS ? <i className="fas fa-check" style={{ fontSize: 12 }}></i> : sNum}
                      </div>
                      <div className="nhs-step-label">{SECTIONS[sNum].name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section intro */}
            <div className="sec-intro">
              <h1>{curS}. About {SECTIONS[curS].name.toLowerCase()}</h1>
              <div className="sec-meta">
                <i className="fas fa-clock"></i>
                <span>{SECTIONS[curS].time}</span>
              </div>

              <div className="sec-body">
                <div className="sec-image">{SECTIONS[curS].icon}</div>
                <div>
                  <p className="sec-desc">{SECTIONS[curS].desc}</p>
                  <div className="sec-notice">
                    Your answers will be saved as you go along. If you leave at any point, you can come back and complete the questionnaire from where you left off.
                  </div>
                  <button type="button" className="start-btn" onClick={startSection}>
                    <i className="fas fa-arrow-right"></i>
                    {sectionQs.length > 0 && saved[sectionQs[0].key] !== undefined ? 'Continue section' : 'Start section'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Progress bar */}
            <div className="nhs-progress">
              <div className="nhs-progress-track">
                {[1, 2, 3, 4, 5].map(sNum => {
                  const cls = sNum === curS ? 'current' : (sectionDone[sNum] ? 'done' : '');
                  return (
                    <div className={`nhs-step ${cls}`} key={sNum}>
                      <div className="nhs-step-dot">
                        {sectionDone[sNum] && sNum !== curS ? <i className="fas fa-check" style={{ fontSize: 12 }}></i> : sNum}
                      </div>
                      <div className="nhs-step-label">{SECTIONS[sNum].name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {currentQ && draft && (
              <QuestionForm
                q={currentQ}
                draft={draft}
                setDraft={setDraft}
                curS={curS}
                curQ={curQ}
                sectionQs={sectionQs}
                helpOpen={helpOpen}
                setHelpOpen={setHelpOpen}
                onSubmit={handleSubmit}
                onPrev={() => { const p = prevLink(curS, curQ); if (p) goTo(p.s, p.q); }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuestionForm({ q, draft, setDraft, curS, curQ, sectionQs, helpOpen, setHelpOpen, onSubmit, onPrev }) {
  const prev = prevLink(curS, curQ);
  const isLast = curS === 5 && curQ === sectionQs.length;

  return (
    <form onSubmit={onSubmit} id="qform">
      <div className="q-section-label">{curS}. {SECTIONS[curS].name}</div>
      <hr className="nhs-divider" style={{ marginTop: 6, marginBottom: 20 }} />

      <h2 className="q-title">{q.label}</h2>

      {q.hint && <p className="q-hint">{q.hint}</p>}

      {q.help && (
        <>
          <button type="button" className="q-help-toggle" onClick={() => setHelpOpen(!helpOpen)}>
            <i className={`fas fa-caret-${helpOpen ? 'down' : 'right'}`}></i> How to answer this question
          </button>
          <div className={`q-help-box${helpOpen ? ' show' : ''}`}>{q.help}</div>
        </>
      )}

      {q.type === 'radio' && (
        <div className="opt-list">
          {q.opts.map(opt => (
            <div key={opt} className={`opt-item${draft.value === opt ? ' selected' : ''}`}
              onClick={() => setDraft({ ...draft, value: opt })}>
              <input type="radio" name="answer" checked={draft.value === opt} onChange={() => setDraft({ ...draft, value: opt })} />
              <label>{opt}</label>
            </div>
          ))}
        </div>
      )}

      {q.type === 'checkbox' && (
        <div className="opt-list">
          {q.opts.map(opt => {
            const checked = (draft.values || []).includes(opt);
            return (
              <div key={opt} className={`opt-item${checked ? ' selected' : ''}`}
                onClick={() => {
                  const values = checked ? draft.values.filter(v => v !== opt) : [...(draft.values || []), opt];
                  setDraft({ ...draft, values });
                }}>
                <input type="checkbox" checked={checked} onChange={() => {}} />
                <label>{opt}</label>
              </div>
            );
          })}
        </div>
      )}

      {q.type === 'select' && (
        <div style={{ marginBottom: 28 }}>
          <select className="nhs-select" value={draft.value || ''} onChange={e => setDraft({ ...draft, value: e.target.value })}>
            <option value="">Select one from the list</option>
            {q.opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )}

      {q.type === 'number' && (
        <>
          <div className="input-row">
            <input type="number" className="nhs-input" value={draft.value || ''}
              min={q.min ?? 0} max={q.max ?? 999}
              onChange={e => setDraft({ ...draft, value: e.target.value, extra: '' })} />
            <span className="input-unit">{q.unit || ''}</span>
          </div>
          {q.extra_opts?.map(eopt => (
            <div key={eopt} className={`opt-item${draft.extra === eopt ? ' selected' : ''}`} style={{ width: 'fit-content', marginBottom: 8 }}
              onClick={() => setDraft({ ...draft, value: '', extra: draft.extra === eopt ? '' : eopt })}>
              <input type="radio" checked={draft.extra === eopt} onChange={() => {}} />
              <label>{eopt}</label>
            </div>
          ))}
          <div style={{ marginBottom: 20 }}></div>
        </>
      )}

      {q.type === 'height' && (
        <>
          {'ft' in draft ? (
            <div className="input-row" style={{ marginBottom: 20 }}>
              <input type="number" className="nhs-input" value={draft.ft || ''} min={3} max={8} placeholder="4"
                onChange={e => setDraft({ ...draft, ft: e.target.value })} /> <span className="input-unit">Feet</span>
              <input type="number" className="nhs-input" value={draft.in || ''} min={0} max={11} placeholder="0"
                onChange={e => setDraft({ ...draft, in: e.target.value })} /> <span className="input-unit">Inches</span>
            </div>
          ) : (
            <div className="input-row" style={{ marginBottom: 20 }}>
              <input type="number" className="nhs-input" value={draft.cm || ''} min={50} max={250} placeholder="170"
                onChange={e => setDraft({ ...draft, cm: e.target.value })} /> <span className="input-unit">Centimeters</span>
            </div>
          )}
        </>
      )}

      {q.type === 'weight' && (
        <>
          {'st' in draft ? (
            <div className="input-row" style={{ marginBottom: 20 }}>
              <input type="number" className="nhs-input" value={draft.st || ''} min={4} max={50} placeholder="10"
                onChange={e => setDraft({ ...draft, st: e.target.value })} /> <span className="input-unit">Stones</span>
              <input type="number" className="nhs-input" value={draft.lb || ''} min={0} max={13} placeholder="0"
                onChange={e => setDraft({ ...draft, lb: e.target.value })} /> <span className="input-unit">Pounds</span>
            </div>
          ) : (
            <>
              <div className="input-row" style={{ marginBottom: 20 }}>
                <input type="number" className="nhs-input" value={draft.kg || ''} min={20} max={300} step="0.1" placeholder="70"
                  onChange={e => setDraft({ ...draft, kg: e.target.value, extra: false })} /> <span className="input-unit">Kilograms</span>
              </div>
              <div className={`opt-item${draft.extra ? ' selected' : ''}`} style={{ width: 'fit-content', marginBottom: 8 }}
                onClick={() => setDraft({ ...draft, kg: '', extra: !draft.extra })}>
                <input type="radio" checked={!!draft.extra} onChange={() => {}} />
                <label>Prefer not to provide my weight</label>
              </div>
            </>
          )}
        </>
      )}

      <hr className="nhs-divider" />

      <div className="nhs-nav">
        {prev ? (
          <button type="button" className="nav-btn prev" onClick={onPrev}><i className="fas fa-arrow-left"></i> Previous question</button>
        ) : <span></span>}

        {isLast ? (
          <button type="submit" className="nav-btn-complete"><i className="fas fa-check"></i> Submit questionnaire</button>
        ) : (
          <button type="submit" className="nav-btn next">Next question <i className="fas fa-arrow-right"></i></button>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#768692' }}>
        Question {curQ} of {sectionQs.length} in this section
      </div>
    </form>
  );
}
