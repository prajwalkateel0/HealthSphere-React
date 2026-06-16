require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_DUMP = 'C:\\Users\\DELL\\Downloads\\dbs15649976.sql';
const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const dumpPath = path.resolve(positionalArgs[0] || process.env.PHP_DUMP_PATH || DEFAULT_DUMP);
const shouldReplace = process.argv.includes('--replace');
const isDryRun = process.argv.includes('--dry-run');

const VALID = {
  role: new Set(['patient', 'doctor', 'admin', 'government', 'pharmacy']),
  userStatus: new Set(['active', 'inactive', 'pending', 'suspended']),
  gender: new Set(['male', 'female', 'other']),
  appointmentStatus: new Set(['pending', 'confirmed', 'arrived', 'waiting', 'completed', 'cancelled', 'late', 'no_show']),
  appointmentType: new Set(['general', 'follow_up', 'emergency', 'specialist']),
  recordStatus: new Set(['normal', 'elevated', 'low', 'critical', 'pending']),
  prescriptionStatus: new Set(['active', 'completed', 'cancelled', 'expired']),
  severity: new Set(['mild', 'moderate', 'severe']),
  mealType: new Set(['breakfast', 'lunch', 'dinner', 'snack']),
  noteType: new Set(['general', 'follow_up', 'diagnosis', 'prescription', 'referral']),
  notificationType: new Set(['appointment', 'medication', 'lab_result', 'message', 'alert', 'system']),
  scanResult: new Set(['safe', 'warning', 'danger']),
  alertSeverity: new Set(['info', 'warning', 'critical']),
  healthRating: new Set(['excellent', 'good', 'moderate', 'poor']),
  deliveryMethod: new Set(['collection', 'delivery']),
  prescriptionOrderStatus: new Set(['pending', 'approved', 'preparing', 'dispatched', 'delivered', 'rejected', 'cancelled']),
};

function cleanEnum(value, valid, fallback) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return valid.has(normalized) ? normalized : fallback;
}

function int(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function bool(value) {
  if (value === null || value === undefined || value === '') return false;
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function text(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function date(value) {
  const t = text(value);
  if (!t || t === '0000-00-00' || t.startsWith('0000-00-00')) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00.000Z` : t.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? '' : 'Z');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function time(value) {
  const t = text(value);
  if (!t) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(t)) return new Date(`1970-01-01T${t.length === 5 ? `${t}:00` : t}.000Z`);
  return date(t);
}

function combineDateTime(day, clock, fallback) {
  const d = text(day);
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const t = text(clock);
    const hhmmss = t && /^\d{2}:\d{2}(:\d{2})?$/.test(t) ? (t.length === 5 ? `${t}:00` : t) : '12:00:00';
    return date(`${d} ${hhmmss}`);
  }
  return date(fallback) || new Date();
}

function findStatementEnd(sql, start) {
  let inString = false;
  for (let i = start; i < sql.length; i += 1) {
    const ch = sql[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === "'") inString = false;
    } else if (ch === "'") {
      inString = true;
    } else if (ch === ';') {
      return i;
    }
  }
  return -1;
}

function parseSqlValue(raw) {
  const value = raw.trim();
  if (/^NULL$/i.test(value)) return null;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
      .replace(/\\0/g, '\0')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
}

function parseTuple(tupleText) {
  const values = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < tupleText.length; i += 1) {
    const ch = tupleText[i];
    if (inString) {
      current += ch;
      if (ch === '\\') {
        i += 1;
        current += tupleText[i] || '';
      } else if (ch === "'") {
        inString = false;
      }
    } else if (ch === "'") {
      inString = true;
      current += ch;
    } else if (ch === ',') {
      values.push(parseSqlValue(current));
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(parseSqlValue(current));
  return values;
}

function parseTuples(valuesSql) {
  const tuples = [];
  let inString = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < valuesSql.length; i += 1) {
    const ch = valuesSql[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === "'") inString = false;
      continue;
    }

    if (ch === "'") inString = true;
    else if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) tuples.push(parseTuple(valuesSql.slice(start, i)));
    }
  }
  return tuples;
}

function parseDump(sql) {
  const data = {};
  let offset = 0;
  const insertToken = 'INSERT INTO `';

  while (offset < sql.length) {
    const start = sql.indexOf(insertToken, offset);
    if (start === -1) break;

    const end = findStatementEnd(sql, start);
    if (end === -1) break;

    const statement = sql.slice(start, end);
    const match = statement.match(/^INSERT INTO `([^`]+)` \(([\s\S]+?)\) VALUES\s*([\s\S]*)$/);
    if (match) {
      const [, table, rawColumns, rawValues] = match;
      const columns = rawColumns.split(',').map((column) => column.trim().replace(/^`|`$/g, ''));
      const tuples = parseTuples(rawValues);
      data[table] ||= [];
      for (const tuple of tuples) {
        data[table].push(Object.fromEntries(columns.map((column, index) => [column, tuple[index]])));
      }
    }

    offset = end + 1;
  }

  return data;
}

function mapUser(row) {
  const role = cleanEnum(row.role, VALID.role, 'patient');
  let status = bool(row.is_active) ? 'active' : 'inactive';
  const approval = cleanEnum(row.approval_status, VALID.userStatus, null);
  if (approval === 'pending') status = 'pending';
  if (approval === 'suspended') status = 'suspended';

  const first = text(row.first_name);
  const last = text(row.last_name);
  const name = text([first, last].filter(Boolean).join(' ')) || text(row.name) || text(row.email) || `User ${row.id}`;

  return {
    id: int(row.id),
    name,
    email: text(row.email),
    password: text(row.password) || '',
    role,
    status,
    nhsId: text(row.nhs_id),
    phone: text(row.phone),
    dateOfBirth: date(row.date_of_birth),
    gender: row.gender ? cleanEnum(row.gender, VALID.gender, null) : null,
    address: text([row.address, row.city, row.postcode].filter(Boolean).join(', ')),
    bloodType: text(row.blood_type),
    profileImage: text(row.profile_photo),
    createdAt: date(row.created_at) || new Date(),
    updatedAt: date(row.updated_at) || date(row.created_at) || new Date(),
  };
}

const maps = {
  users: (row) => mapUser(row),
  doctors: (row) => ({
    id: int(row.id),
    userId: int(row.user_id),
    specialization: text(row.specialization),
    hospital: text(row.hospital_name || row.hospital),
    hcpcNumber: text(row.hcpc_number),
    hcpcVerified: bool(row.is_verified || row.hcpc_verified),
    rating: num(row.rating) || 0,
    experienceYears: int(row.experience_years),
    bio: text(row.bio),
    availability: text(row.available_days),
    createdAt: date(row.created_at) || new Date(),
  }),
  appointments: (row) => ({
    id: int(row.id),
    patientId: int(row.patient_id),
    doctorId: int(row.doctor_id),
    appointmentDate: date(row.appointment_date) || new Date(),
    appointmentTime: time(row.appointment_time) || time('09:00:00'),
    reason: text(row.reason),
    type: cleanEnum(row.type, VALID.appointmentType, 'general'),
    status: cleanEnum(row.status, VALID.appointmentStatus, 'pending'),
    notes: text(row.notes),
    createdAt: date(row.created_at) || new Date(),
  }),
  medical_records: (row) => ({
    id: int(row.id),
    patientId: int(row.patient_id),
    doctorId: int(row.doctor_id),
    testType: text(row.record_type || row.test_type || row.title) || 'Medical record',
    result: text(row.result || row.description),
    status: cleanEnum(row.result_status || row.status, VALID.recordStatus, 'pending'),
    notes: text(row.notes || row.description),
    testDate: date(row.test_date),
    filePath: text(row.file_path),
    createdAt: date(row.created_at) || new Date(),
  }),
  prescriptions: (row) => ({
    id: int(row.id),
    patientId: int(row.patient_id),
    doctorId: int(row.doctor_id),
    medicationName: text(row.medication_name) || 'Medication',
    dosage: text(row.dosage),
    frequency: text(row.frequency),
    duration: text(row.duration),
    startDate: date(row.start_date),
    endDate: date(row.end_date),
    instructions: text(row.instructions),
    status: bool(row.is_active) ? 'active' : 'completed',
    filePath: text(row.file_path),
    createdAt: date(row.created_at) || new Date(),
  }),
  prescription_orders: (row) => ({
    id: int(row.id),
    prescriptionId: int(row.prescription_id),
    patientId: int(row.patient_id),
    doctorId: int(row.doctor_id),
    status: cleanEnum(row.status, VALID.prescriptionOrderStatus, 'pending'),
    deliveryMethod: cleanEnum(row.delivery_method, VALID.deliveryMethod, 'collection'),
    deliveryAddress: text(row.delivery_address),
    pharmacyName: text(row.pharmacy_name),
    patientNotes: text(row.patient_notes),
    doctorNotes: text(row.doctor_notes),
    estimatedReady: date(row.estimated_ready),
    paymentIntentId: text(row.payment_intent_id),
    orderedAt: date(row.ordered_at) || new Date(),
    updatedAt: date(row.updated_at) || date(row.ordered_at) || new Date(),
  }),
  allergies: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    allergen: text(row.allergen) || 'Unknown',
    reaction: text(row.symptoms || row.reaction),
    severity: cleanEnum(row.severity, VALID.severity, 'moderate'),
    notes: text(row.notes),
    allergyType: text(row.allergy_type) || 'food',
    isActive: row.is_active === null || row.is_active === undefined ? true : bool(row.is_active),
    createdAt: date(row.created_at || row.diagnosed_date) || new Date(),
  }),
  food_intolerances: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    intolerance: text(row.intolerance) || 'Unknown',
    severity: cleanEnum(row.severity, VALID.severity, 'moderate'),
    isActive: row.is_active === null || row.is_active === undefined ? true : bool(row.is_active),
    createdAt: date(row.created_at) || new Date(),
  }),
  diet_preferences: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    preference: text(row.preference) || 'Unknown',
    isActive: row.is_active === null || row.is_active === undefined ? true : bool(row.is_active),
    createdAt: date(row.created_at) || new Date(),
  }),
  ingredient_dislikes: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    ingredient: text(row.ingredient) || 'Unknown',
    isActive: row.is_active === null || row.is_active === undefined ? true : bool(row.is_active),
    createdAt: date(row.created_at) || new Date(),
  }),
  vaccinations: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    vaccineName: text(row.vaccine_name) || 'Vaccine',
    doseNumber: int(row.dose_number) || 1,
    dateAdministered: date(row.administered_date || row.date_administered),
    nextDueDate: date(row.next_due_date),
    batchNumber: text(row.batch_number),
    administeredBy: text(row.administered_by),
    createdAt: date(row.created_at) || new Date(),
  }),
  health_metrics: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    systolic: int(row.blood_pressure_systolic || row.systolic),
    diastolic: int(row.blood_pressure_diastolic || row.diastolic),
    heartRate: int(row.heart_rate),
    oxygenSaturation: num(row.spo2 || row.oxygen_saturation),
    temperature: num(row.temperature),
    steps: int(row.steps_count || row.steps),
    sleepHours: num(row.sleep_hours),
    weight: num(row.weight_kg || row.weight),
    bmi: num(row.bmi),
    stressLevel: int(row.stress_level),
    caloriesBurned: int(row.calories_burned),
    distanceKm: num(row.distance_km),
    source: text(row.source) || 'manual',
    recordedAt: combineDateTime(row.metric_date, row.metric_time, row.created_at),
  }),
  diet_logs: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    foodName: text(row.food_name) || 'Food',
    mealType: cleanEnum(row.meal_type, VALID.mealType, 'snack'),
    calories: int(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fats || row.fat),
    fiber: num(row.fiber),
    logDate: combineDateTime(row.log_date, null, row.created_at),
  }),
  water_logs: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    glasses: int(row.glasses_count || row.glasses) || 0,
    ml: int(row.total_ml || row.ml),
    logDate: date(row.log_date) || date(row.created_at) || new Date(),
  }),
  messages: (row) => ({
    id: int(row.id),
    senderId: int(row.sender_id),
    receiverId: int(row.receiver_id),
    content: text(row.message || row.content) || '',
    isRead: bool(row.is_read),
    isEmergency: bool(row.is_emergency),
    createdAt: date(row.created_at) || new Date(),
  }),
  notifications: (row) => ({
    id: int(row.id),
    userId: int(row.user_id),
    type: cleanEnum(row.notification_type || row.type, VALID.notificationType, 'system'),
    title: text(row.title) || 'Notification',
    message: text(row.message),
    isRead: bool(row.is_read),
    createdAt: date(row.created_at) || new Date(),
  }),
  clinical_notes: (row) => ({
    id: int(row.id),
    patientId: int(row.patient_id),
    doctorId: int(row.doctor_id),
    noteType: cleanEnum(row.note_type, VALID.noteType, 'general'),
    content: text(row.note_text || row.content) || '',
    createdAt: date(row.created_at) || new Date(),
  }),
  family_history: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    relation: text(row.relation),
    relationName: text(row.relation_name),
    conditionName: text(row.condition_name) || 'Condition',
    diagnosisYear: int(row.year_diagnosed || row.diagnosis_year),
    yearDeceased: int(row.year_deceased),
    notes: text(row.notes),
    createdAt: date(row.created_at) || new Date(),
  }),
  patient_questionnaire: (row) => ({
    id: int(row.id),
    patientId: int(row.patient_id),
    completed: bool(row.completed),
    completedAt: date(row.completed_at),
    startedAt: date(row.started_at) || new Date(),
  }),
  patient_questionnaire_answers: (row) => ({
    id: int(row.id),
    patientId: int(row.patient_id),
    questionKey: text(row.question_key) || `question_${row.id}`,
    answer: text(row.answer),
    updatedAt: date(row.updated_at) || new Date(),
  }),
  documents: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    title: text(row.title),
    description: text(row.description),
    docType: text(row.doc_type) || 'other',
    filePath: text(row.file_path),
    fileName: text(row.file_name),
    fileType: text(row.file_type),
    fileSize: int(row.file_size),
    createdAt: date(row.created_at) || new Date(),
  }),
  ingredient_scans: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    productName: text(row.product_name),
    ingredients: text(row.ingredients_raw || row.ingredients),
    result: cleanEnum(row.scan_result || row.result, VALID.scanResult, 'safe'),
    alerts: text(row.alerts_json || row.alerts),
    aiSummary: text(row.ai_summary),
    createdAt: date(row.scanned_at || row.created_at) || new Date(),
  }),
  access_logs: (row) => ({
    id: int(row.id),
    userId: int(row.user_id),
    accessedPatientId: int(row.accessed_patient_id),
    action: text(row.action_type || row.action),
    ipAddress: text(row.ip_address),
    createdAt: date(row.created_at) || new Date(),
  }),
  food_database: (row) => ({
    id: int(row.id),
    name: text(row.food_name || row.name) || 'Food',
    calories: int(row.calories_per_100g || row.calories),
    protein: num(row.protein_g || row.protein),
    carbs: num(row.carbs || row.carbohydrates),
    fat: num(row.fats_g || row.fat),
    fiber: num(row.fiber_g || row.fiber),
    allergens: text(row.allergy_risk || row.allergens || row.avoid_if),
    healthRating: cleanEnum(row.health_rating, VALID.healthRating, 'moderate'),
    createdAt: date(row.created_at) || new Date(),
  }),
  genetic_diseases: (row) => ({
    id: int(row.id),
    name: text(row.disease_name || row.name) || 'Disease',
    inheritanceType: text(row.inheritance_type),
    symptoms: text(row.key_symptoms || row.symptoms),
    foodTriggers: text(row.food_triggers),
    exerciseGuidance: text(row.exercise_guidance),
    carePlan: text(row.care_plan),
    createdAt: date(row.created_at) || new Date(),
  }),
  doctor_availability: (row) => ({
    id: int(row.id),
    doctorId: int(row.doctor_id),
    dayOfWeek: int(row.day_of_week) || 0,
    startTime: time(row.start_time),
    endTime: time(row.end_time),
    isAvailable: row.is_active === null || row.is_active === undefined ? true : bool(row.is_active),
    slotDuration: int(row.slot_duration) || 30,
  }),
  wearable_tokens: (row) => ({
    id: int(row.id),
    userId: int(row.user_id),
    provider: text(row.provider) || 'google_fit',
    accessToken: text(row.access_token),
    refreshToken: text(row.refresh_token),
    expiresAt: date(row.expires_at),
    lastSync: date(row.last_sync),
    connectedAt: date(row.connected_at) || new Date(),
  }),
  google_fit_drive_imports: (row) => ({
    id: int(row.id),
    userId: int(row.patient_id || row.user_id),
    driveFileId: text(row.drive_file_id) || `legacy-${row.id}`,
    fileName: text(row.file_name) || 'Legacy import',
    modifiedTime: text(row.modified_time),
    importedRows: int(row.imported_rows) || 0,
    latestDate: date(row.latest_date),
    createdAt: date(row.created_at) || new Date(),
  }),
};

const importOrder = [
  ['users', prisma.user],
  ['doctors', prisma.doctor],
  ['appointments', prisma.appointment],
  ['medical_records', prisma.medicalRecord],
  ['prescriptions', prisma.prescription],
  ['prescription_orders', prisma.prescriptionOrder],
  ['allergies', prisma.allergy],
  ['food_intolerances', prisma.foodIntolerance],
  ['diet_preferences', prisma.dietPreference],
  ['ingredient_dislikes', prisma.ingredientDislike],
  ['vaccinations', prisma.vaccination],
  ['health_metrics', prisma.healthMetric],
  ['diet_logs', prisma.dietLog],
  ['water_logs', prisma.waterLog],
  ['messages', prisma.message],
  ['notifications', prisma.notification],
  ['clinical_notes', prisma.clinicalNote],
  ['family_history', prisma.familyHistory],
  ['patient_questionnaire', prisma.patientQuestionnaire],
  ['patient_questionnaire_answers', prisma.questionnaireAnswer],
  ['documents', prisma.document],
  ['ingredient_scans', prisma.ingredientScan],
  ['access_logs', prisma.accessLog],
  ['food_database', prisma.foodDatabase],
  ['genetic_diseases', prisma.geneticDisease],
  ['doctor_availability', prisma.doctorSchedule],
  ['wearable_tokens', prisma.wearableToken],
  ['google_fit_drive_imports', prisma.googleFitDriveImport],
];

const deleteOrder = [...importOrder].reverse().map(([, model]) => model);

function compact(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

async function resetSequences(tableNames) {
  for (const table of tableNames) {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`);
  }
}

async function main() {
  if (!fs.existsSync(dumpPath)) throw new Error(`Dump file not found: ${dumpPath}`);

  const dump = fs.readFileSync(dumpPath, 'utf8');
  const parsed = parseDump(dump);
  const summary = {};

  if (isDryRun) {
    console.log(`Parsed dump: ${dumpPath}`);
    for (const [table] of importOrder) {
      const sourceRows = parsed[table] || [];
      if (!sourceRows.length) continue;
      const mappedRows = sourceRows.map(maps[table]).map(compact).filter((row) => row.id !== null && row.id !== undefined);
      summary[table] = { source: sourceRows.length, mapped: mappedRows.length };
    }
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (shouldReplace) {
    console.log('Clearing existing HealthSphere data...');
    for (const model of deleteOrder) {
      await model.deleteMany();
    }
  } else {
    console.log('Importing without clearing. Duplicate primary keys or unique values may be skipped.');
  }

  for (const [table, model] of importOrder) {
    const mapper = maps[table];
    const rows = (parsed[table] || []).map(mapper).map(compact);
    const validRows = rows.filter((row) => row.id !== null && row.id !== undefined);
    if (!validRows.length) continue;

    try {
      const result = await model.createMany({ data: validRows, skipDuplicates: true });
      summary[table] = result.count;
      console.log(`${table}: ${result.count}/${validRows.length}`);
    } catch (error) {
      summary[table] = `failed: ${error.message}`;
      console.error(`${table}: failed - ${error.message}`);
    }
  }

  await resetSequences(importOrder.map(([table]) => table === 'doctor_availability' ? 'doctor_schedule' : table));
  console.log('\nImport summary:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
