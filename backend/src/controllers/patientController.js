const fs = require('fs');
const path = require('path');
const axios = require('axios');
const prisma = require('../config/db');
const { calculateHealthScore, generateInsights, avg } = require('../utils/healthAnalytics');
const { totalPoints, dateKey, calculateStreak, calculateBadges, calculateAchievements, calculateChallenges, metricPoints, waterPoints } = require('../utils/gamification');

exports.getDashboard = async (req, res) => {
  try {
    const id = req.user.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const todayKey = dateKey(today);

    const [allMetrics, appointments, medications, dietLogs14, waterLogs14, severeAllergies] = await Promise.all([
      prisma.healthMetric.findMany({ where: { userId: id }, orderBy: { recordedAt: 'desc' }, take: 60 }),
      prisma.appointment.findMany({
        where: { patientId: id, status: { in: ['confirmed', 'pending'] }, appointmentDate: { gte: today } },
        include: { doctor: { include: { doctor: true } } },
        orderBy: { appointmentDate: 'asc' },
        take: 3,
      }),
      prisma.prescription.findMany({
        where: { patientId: id, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      prisma.dietLog.findMany({ where: { userId: id, logDate: { gte: fourteenDaysAgo } } }),
      prisma.waterLog.findMany({ where: { userId: id, logDate: { gte: fourteenDaysAgo } } }),
      prisma.allergy.count({ where: { userId: id, severity: 'severe' } }),
    ]);

    const weekMetrics = allMetrics.filter(m => m.recordedAt >= sevenDaysAgo);
    const twoWeekMetrics = allMetrics.filter(m => m.recordedAt >= fourteenDaysAgo);
    const latest = allMetrics[0] || null;
    const isToday = latest && dateKey(latest.recordedAt) === todayKey;

    // Diet aggregation
    const dietByDate = {};
    for (const d of dietLogs14) {
      const k = dateKey(d.logDate);
      if (!dietByDate[k]) dietByDate[k] = { cal: 0, carbs: 0, fat: 0, fiber: 0 };
      dietByDate[k].cal += d.calories || 0;
      dietByDate[k].carbs += Number(d.carbs || 0);
      dietByDate[k].fat += Number(d.fat || 0);
      dietByDate[k].fiber += Number(d.fiber || 0);
    }
    const dietDays7 = Object.entries(dietByDate)
      .filter(([k]) => k >= dateKey(sevenDaysAgo))
      .map(([, v]) => v);
    const todayCal = dietByDate[todayKey]?.cal || 0;

    // Water aggregation
    const waterByDate = {};
    for (const w of waterLogs14) waterByDate[dateKey(w.logDate)] = w.glasses;
    const waterGlasses = waterByDate[todayKey] || 0;
    const waterValues7 = waterLogs14.filter(w => dateKey(w.logDate) >= dateKey(sevenDaysAgo)).map(w => w.glasses);
    const waterAvg = waterValues7.length ? waterValues7.reduce((a, b) => a + b, 0) / waterValues7.length : null;

    // Week comparison averages
    const lastWeekMetrics = allMetrics.filter(m => m.recordedAt >= fourteenDaysAgo && m.recordedAt < sevenDaysAgo);
    const thisWeekAvg = {
      steps: avg(weekMetrics.map(m => m.steps)),
      sleep: avg(weekMetrics.map(m => m.sleepHours)),
      bp: avg(weekMetrics.map(m => m.systolic)),
    };
    const lastWeekAvg = {
      steps: avg(lastWeekMetrics.map(m => m.steps)),
      sleep: avg(lastWeekMetrics.map(m => m.sleepHours)),
      bp: avg(lastWeekMetrics.map(m => m.systolic)),
    };

    // Health score & insights
    const healthScore = calculateHealthScore(weekMetrics);
    const insights = generateInsights({ metrics: twoWeekMetrics, dietDays: dietDays7, waterAvg, severeAllergies });

    // ── Gamification ──────────────────────────────────────────
    const dietDateCount = Object.keys(dietByDate).length;
    const dietDateCountWeek = Object.keys(dietByDate).filter(k => k >= dateKey(sevenDaysAgo)).length;
    const myTotalPoints = totalPoints({ healthMetrics: allMetrics, dietDateCount, waterLogs: waterLogs14 });

    const todayStepPts = isToday ? Math.min(100, Math.round((latest.steps || 0) / 10000 * 100)) : 0;
    let todayHealthPts = 0;
    if (isToday) {
      if (latest.heartRate) todayHealthPts += 27;
      if (latest.systolic) todayHealthPts += 27;
      if (latest.sleepHours) todayHealthPts += 26;
    }
    const todayDietPts = todayCal > 0 ? 80 : 0;
    const todayWaterPts = waterPoints(waterGlasses);
    const todayTotalPts = todayStepPts + todayHealthPts + todayDietPts + todayWaterPts;

    const streakDates = [...new Set(allMetrics.map(m => dateKey(m.recordedAt)))];
    const streak = calculateStreak(streakDates);

    const badges = calculateBadges({
      healthMetrics: allMetrics, dietDateCount, waterLogs: waterLogs14,
      streak, streakDateCount: streakDates.length, totalPts: myTotalPoints,
    });

    const achievements = calculateAchievements({ healthMetrics: allMetrics, dietLogs: dietLogs14 });
    const challenges = calculateChallenges({ weekMetrics, dietDateCountWeek });

    // Today's progress bars
    const stepsGoal = 8000;
    const latestSteps = latest?.steps || 0;
    const healthItems = (latest?.heartRate ? 1 : 0) + (latest?.systolic ? 1 : 0) + (latest?.sleepHours ? 1 : 0);
    const stepsPct = Math.min(100, Math.round(latestSteps / stepsGoal * 100));
    const calPct = Math.min(100, todayCal > 0 ? Math.round(todayCal / 2000 * 100) : 0);
    const waterPct = Math.min(100, Math.round(waterGlasses / 8 * 100));
    const dataLabel = isToday ? 'Today' : (latest ? `Last: ${new Date(latest.recordedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : 'No data');

    // Leaderboard
    const patients = await prisma.user.findMany({ where: { role: 'patient' }, select: { id: true, name: true } });
    const [allPatientMetrics, allPatientDiet, allPatientWater] = await Promise.all([
      prisma.healthMetric.findMany({ where: { userId: { in: patients.map(p => p.id) } }, select: { userId: true, steps: true, heartRate: true, systolic: true, sleepHours: true } }),
      prisma.dietLog.findMany({ where: { userId: { in: patients.map(p => p.id) } }, select: { userId: true, logDate: true } }),
      prisma.waterLog.findMany({ where: { userId: { in: patients.map(p => p.id) } }, select: { userId: true, glasses: true } }),
    ]);

    const leaderboard = patients.map(p => {
      const myMetrics = allPatientMetrics.filter(m => m.userId === p.id);
      const myDietDates = new Set(allPatientDiet.filter(d => d.userId === p.id).map(d => dateKey(d.logDate)));
      const myWater = allPatientWater.filter(w => w.userId === p.id);
      const pts = totalPoints({ healthMetrics: myMetrics, dietDateCount: myDietDates.size, waterLogs: myWater });
      return { id: p.id, name: p.name, pts };
    }).sort((a, b) => b.pts - a.pts);

    const userRank = (leaderboard.findIndex(p => p.id === id) + 1) || 1;
    const totalPatients = patients.length;
    const rankPct = totalPatients > 1 ? Math.max(1, Math.round((userRank / totalPatients) * 100)) : 1;

    // Charts data (oldest to newest)
    const chartMetrics = [...weekMetrics].reverse();
    const week = {
      labels: chartMetrics.map(m => new Date(m.recordedAt).toLocaleDateString('en-GB', { weekday: 'short' })),
      hr: chartMetrics.map(m => m.heartRate),
      bpSys: chartMetrics.map(m => m.systolic),
      bpDia: chartMetrics.map(m => m.diastolic),
      steps: chartMetrics.map(m => m.steps),
    };

    const appts = appointments.map(a => ({
      ...a,
      doctor_name: a.doctor.name,
      specialization: a.doctor.doctor?.specialization,
    }));

    res.json({
      today: { metric: latest, isToday, cal: todayCal, water: waterGlasses },
      week,
      thisWeekAvg, lastWeekAvg,
      healthScore,
      insights,
      appointments: appts,
      medications,
      gamification: {
        totalPoints: myTotalPoints,
        todayTotalPts,
        streak,
        leaderboard: leaderboard.slice(0, 5),
        userRank, totalPatients, rankPct,
        badges, badgeCount: badges.length,
        achievements,
        challenges,
        progress: {
          stepsGoal, latestSteps, stepsPct, healthItems, calPct, waterPct, dataLabel,
          todayCal, waterGlasses,
          todayStepPts, todayHealthPts, todayDietPts, todayWaterPts,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMetrics = async (req, res) => {
  try {
    const rows = await prisma.healthMetric.findMany({
      where: { userId: req.user.id },
      orderBy: { recordedAt: 'desc' },
      take: 30,
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addMetric = async (req, res) => {
  try {
    const { systolic, diastolic, heart_rate, oxygen_saturation, temperature,
            steps, sleep_hours, weight, bmi, blood_glucose, stress_level } = req.body;
    const m = await prisma.healthMetric.create({
      data: {
        userId: req.user.id,
        systolic: systolic ? +systolic : null,
        diastolic: diastolic ? +diastolic : null,
        heartRate: heart_rate ? +heart_rate : null,
        oxygenSaturation: oxygen_saturation ? +oxygen_saturation : null,
        temperature: temperature ? +temperature : null,
        steps: steps ? +steps : null,
        sleepHours: sleep_hours ? +sleep_hours : null,
        weight: weight ? +weight : null,
        bmi: bmi ? +bmi : null,
        bloodGlucose: blood_glucose ? +blood_glucose : null,
        stressLevel: stress_level ? +stress_level : null,
      },
    });
    res.status(201).json(m);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAppointments = async (req, res) => {
  try {
    const rows = await prisma.appointment.findMany({
      where: { patientId: req.user.id },
      include: { doctor: { include: { doctor: true } } },
      orderBy: { appointmentDate: 'desc' },
    });
    res.json(rows.map(a => ({
      ...a,
      doctor_name: a.doctor.name,
      doctor_image: a.doctor.profileImage,
      specialization: a.doctor.doctor?.specialization,
      hospital: a.doctor.doctor?.hospital,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time, reason, type = 'general' } = req.body;
    const appt = await prisma.appointment.create({
      data: {
        patientId: req.user.id,
        doctorId: +doctor_id,
        appointmentDate: new Date(appointment_date),
        appointmentTime: new Date(`1970-01-01T${appointment_time}`),
        reason, type,
      },
    });
    res.status(201).json(appt);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.cancelAppointment = async (req, res) => {
  try {
    await prisma.appointment.updateMany({
      where: { id: +req.params.id, patientId: req.user.id },
      data: { status: 'cancelled' },
    });
    res.json({ message: 'Appointment cancelled' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const STATUS_COLORS = {
  confirmed: '#1565C0', pending: '#D97706', arrived: '#0891B2',
  waiting: '#7C3AED', completed: '#16A34A', cancelled: '#94A3B8',
};

exports.getAppointmentsCalendar = async (req, res) => {
  try {
    const rows = await prisma.appointment.findMany({
      where: { patientId: req.user.id },
      include: { doctor: { include: { doctor: true } } },
    });
    const events = rows.map(a => {
      const dateStr = a.appointmentDate.toISOString().slice(0, 10);
      const t = a.appointmentTime;
      const hh = String(t.getHours()).padStart(2, '0');
      const mm = String(t.getMinutes()).padStart(2, '0');
      const color = STATUS_COLORS[a.status] || '#5E7A99';
      const docName = /^dr\.?\s/i.test(a.doctor.name) ? a.doctor.name : `Dr. ${a.doctor.name}`;
      return {
        id: a.id,
        title: docName,
        start: `${dateStr}T${hh}:${mm}:00`,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          status: a.status,
          reason: a.reason,
          specialization: a.doctor.doctor?.specialization,
          hospital: a.doctor.doctor?.hospital,
          date: dateStr,
          time: `${hh}:${mm}`,
        },
      };
    });
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.moveAppointment = async (req, res) => {
  try {
    const { date, time } = req.body;
    const updated = await prisma.appointment.updateMany({
      where: { id: +req.params.id, patientId: req.user.id, status: { notIn: ['cancelled', 'completed'] } },
      data: {
        appointmentDate: new Date(`${date}T00:00:00.000Z`),
        appointmentTime: new Date(`1970-01-01T${time}`),
      },
    });
    if (!updated.count) return res.status(400).json({ error: 'Appointment cannot be rescheduled' });
    res.json({ message: 'Appointment rescheduled' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getMedicalRecords = async (req, res) => {
  try {
    const id = req.user.id;
    const [labs, prescriptions, allergies, vaccinations, notes] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: { patientId: id },
        include: { doctor: { select: { name: true } } },
        orderBy: { testDate: 'desc' },
      }),
      prisma.prescription.findMany({
        where: { patientId: id },
        include: { doctor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.allergy.findMany({ where: { userId: id } }),
      prisma.vaccination.findMany({ where: { userId: id }, orderBy: { dateAdministered: 'desc' } }),
      prisma.clinicalNote.findMany({
        where: { patientId: id },
        include: { doctor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const labsWithDoctor = labs.map(r => ({ ...r, doctor_name: r.doctor?.name || null }));
    const prescriptionsWithDoctor = prescriptions.map(p => ({ ...p, doctor_name: p.doctor?.name || null }));
    const notesWithName = notes.map(n => ({ ...n, doctor_name: n.doctor.name }));
    res.json({ labs: labsWithDoctor, prescriptions: prescriptionsWithDoctor, allergies, vaccinations, notes: notesWithName });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDietLogs = async (req, res) => {
  try {
    const { date } = req.query;
    const where = { userId: req.user.id };
    if (date) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      where.logDate = { gte: d, lte: end };
    }
    const [logs, water] = await Promise.all([
      prisma.dietLog.findMany({ where, orderBy: { logDate: 'desc' }, take: 50 }),
      prisma.waterLog.findMany({ where: { userId: req.user.id }, orderBy: { logDate: 'desc' }, take: 7 }),
    ]);
    res.json({ logs, water });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addDietLog = async (req, res) => {
  try {
    const { food_name, meal_type, calories, protein, carbs, fat, fiber, log_date } = req.body;
    const log = await prisma.dietLog.create({
      data: {
        userId: req.user.id, foodName: food_name, mealType: meal_type,
        calories: calories ? +calories : null,
        protein: protein ? +protein : null,
        carbs: carbs ? +carbs : null,
        fat: fat ? +fat : null,
        fiber: fiber ? +fiber : null,
        logDate: log_date ? new Date(log_date) : new Date(),
      },
    });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteDietLog = async (req, res) => {
  try {
    await prisma.dietLog.deleteMany({ where: { id: +req.params.id, userId: req.user.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addWaterLog = async (req, res) => {
  try {
    const { glasses, log_date } = req.body;
    const date = log_date ? new Date(log_date) : new Date();
    date.setHours(0, 0, 0, 0);
    const existing = await prisma.waterLog.findFirst({ where: { userId: req.user.id, logDate: date } });
    if (existing) {
      await prisma.waterLog.update({ where: { id: existing.id }, data: { glasses: +glasses } });
    } else {
      await prisma.waterLog.create({ data: { userId: req.user.id, glasses: +glasses, logDate: date } });
    }
    res.json({ message: 'Water log saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getNotifications = async (req, res) => {
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { id: +req.params.id, userId: req.user.id }, data: { isRead: true } });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id }, data: { isRead: true } });
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDocuments = async (req, res) => {
  try {
    const rows = await prisma.document.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { title, doc_type, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Please enter a title.' });

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!allowed.includes(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Only PDF, JPG, PNG files allowed.' });
    }

    const doc = await prisma.document.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        docType: doc_type || 'other',
        filePath: req.file.filename,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });
    res.status(201).json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await prisma.document.findFirst({ where: { id: +req.params.id, userId: req.user.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.filePath) {
      const fullPath = path.join(__dirname, '../../uploads', doc.filePath);
      fs.unlink(fullPath, () => {});
    }
    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDoctors = async (req, res) => {
  try {
    const { specialization, search } = req.query;
    const rows = await prisma.user.findMany({
      where: {
        role: 'doctor', status: 'active',
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        doctor: specialization ? { specialization } : undefined,
      },
      include: { doctor: true },
    });
    res.json(rows.map(u => ({ id: u.id, name: u.name, email: u.email, profileImage: u.profileImage, ...u.doctor })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Default working hours used when a doctor has no explicit schedule rows
const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 17;

exports.getDoctorSlots = async (req, res) => {
  try {
    const doctorId = +req.params.id;
    const { date } = req.query;
    if (!doctorId || !date || isNaN(new Date(date).getTime())) {
      return res.json({ slots: [], error: 'Invalid parameters' });
    }

    const dow = new Date(`${date}T00:00:00`).getDay(); // 0=Sun..6=Sat

    const doctor = await prisma.doctor.findUnique({ where: { userId: doctorId }, include: { schedule: true } });
    let startTime, endTime, slotMinutes = DEFAULT_SLOT_MINUTES;

    const daySchedule = doctor?.schedule.find(s => s.dayOfWeek === dow);
    if (doctor?.schedule.length) {
      if (!daySchedule || !daySchedule.isAvailable) {
        return res.json({ slots: [], message: 'Doctor is not available on this day' });
      }
      startTime = daySchedule.startTime;
      endTime = daySchedule.endTime;
    } else {
      if (dow === 0 || dow === 6) {
        return res.json({ slots: [], message: 'Doctor is not available on this day' });
      }
      startTime = new Date(`1970-01-01T${String(DEFAULT_START_HOUR).padStart(2, '0')}:00:00.000Z`);
      endTime = new Date(`1970-01-01T${String(DEFAULT_END_HOUR).padStart(2, '0')}:00:00.000Z`);
    }

    const toMinutes = (t) => t.getUTCHours() * 60 + t.getUTCMinutes();
    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);

    const allSlots = [];
    for (let m = startMin; m < endMin; m += slotMinutes) {
      const h = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      allSlots.push(`${h}:${mm}`);
    }

    const booked = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: new Date(`${date}T00:00:00.000Z`),
        status: { notIn: ['cancelled'] },
      },
      select: { appointmentTime: true },
    });
    const bookedKeys = new Set(booked.map(b => {
      const t = b.appointmentTime;
      return t.getUTCHours() * 60 + t.getUTCMinutes();
    }));

    // bookAppointment stores appointment_time as a naive local-time Date, so a slot
    // label must go through the same local->UTC shift before comparing to bookedKeys.
    const toBookedKey = (label) => {
      const d = new Date(`1970-01-01T${label}:00`);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };

    const slots = allSlots.map(time => ({ time, available: !bookedKeys.has(toBookedKey(time)) }));
    const dayName = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });

    res.json({ slots, day: dayName, available: slots.filter(s => s.available).length });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFamilyHistory = async (req, res) => {
  try {
    const rows = await prisma.familyHistory.findMany({
      where: { userId: req.user.id },
      orderBy: [{ relation: 'asc' }, { relationName: 'asc' }, { id: 'asc' }],
    });
    // Deduplicate by relation+relationName+conditionName
    const seen = new Set();
    const deduped = rows.filter(f => {
      const key = `${f.relation}|${f.relationName || ''}|${f.conditionName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json(deduped);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addFamilyHistory = async (req, res) => {
  try {
    const { relation, relation_name, condition_name, diagnosis_year, year_deceased, notes } = req.body;
    const row = await prisma.familyHistory.create({
      data: {
        userId: req.user.id,
        relation,
        relationName: relation_name || null,
        conditionName: condition_name,
        diagnosisYear: diagnosis_year ? +diagnosis_year : null,
        yearDeceased: year_deceased ? +year_deceased : null,
        notes,
      },
    });
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteFamilyHistory = async (req, res) => {
  try {
    await prisma.familyHistory.deleteMany({ where: { id: +req.params.id, userId: req.user.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.nhsSearch = async (req, res) => {
  try {
    const postcode = (req.query.postcode || '').trim();
    const type = req.query.type || 'all';
    if (!postcode) return res.status(400).json({ error: 'Postcode required' });

    const geoUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: `${postcode}, UK`, format: 'json', limit: '1', countrycodes: 'gb' })}`;
    const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'HealthSphere/1.0 (Educational project)' } });
    const geoData = await geoRes.json();
    if (!geoData?.length) return res.json({ error: 'Postcode not found' });

    const lat = parseFloat(geoData[0].lat);
    const lng = parseFloat(geoData[0].lon);
    const radius = 5000;

    const typeFilters = {
      hospital: '["amenity"="hospital"]',
      gp: '["amenity"="doctors"]',
      pharmacy: '["amenity"="pharmacy"]',
    }[type] || '["amenity"~"hospital|doctors|pharmacy|clinic"]';

    const query = `[out:json][timeout:12];
(
  node${typeFilters}(around:${radius},${lat},${lng});
  way${typeFilters}(around:${radius},${lat},${lng});
  relation${typeFilters}(around:${radius},${lat},${lng});
);
out center tags;`;

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HealthSphere/1.0 (Educational project)' },
      body: 'data=' + encodeURIComponent(query),
    });
    const overpassData = await overpassRes.json();
    if (!overpassData?.elements?.length) {
      return res.json({ results: [], center: { lat, lng } });
    }

    const toRad = (d) => d * Math.PI / 180;
    const results = [];
    for (const el of overpassData.elements) {
      const tags = el.tags || {};
      const name = tags.name || tags.operator || '';
      if (!name) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const amenity = tags.amenity || 'other';
      const typeLabel = { hospital: 'hospital', doctors: 'gp', pharmacy: 'pharmacy', clinic: 'gp' }[amenity] || 'other';

      const R = 6371;
      const dLat = toRad(elLat - lat);
      const dLng = toRad(elLng - lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(elLat)) * Math.sin(dLng / 2) ** 2;
      const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;

      const isNHS = !!(tags.operator && tags.operator.toLowerCase().includes('nhs'));

      results.push({
        name,
        type: typeLabel,
        subtype: tags.healthcare || tags.amenity || '',
        lat: elLat,
        lng: elLng,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']].filter(Boolean).join(', '),
        phone: tags.phone || tags['contact:phone'] || '',
        hours: tags.opening_hours || '',
        website: tags.website || tags['contact:website'] || '',
        nhs: isNHS,
        distance: dist,
        operator: tags.operator || '',
      });
    }

    results.sort((a, b) => a.distance - b.distance);

    res.json({
      results: results.slice(0, 25),
      center: { lat, lng },
      postcode: postcode.toUpperCase(),
      total: results.length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.nhsCondition = async (req, res) => {
  try {
    const condition = (req.query.condition || '').trim();
    if (!condition) return res.status(400).json({ error: 'Condition required' });

    // Strip trailing "allergy"/"deficiency" etc. to find a cleaner search term
    const searchTerm = condition.replace(/\s+allergy$/i, '').trim();

    const searchUrl = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query', list: 'search', srsearch: `${searchTerm} (medical condition)`,
      format: 'json', srlimit: '1',
    })}`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'HealthSphere/1.0 (Educational project)' } });
    const searchData = await searchRes.json();
    const hit = searchData?.query?.search?.[0];
    if (!hit) return res.json({ error: 'Information not found' });

    const title = hit.title;
    const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': 'HealthSphere/1.0 (Educational project)' },
    });
    const summaryData = await summaryRes.json();
    if (!summaryData?.extract) return res.json({ error: 'Information not found' });

    res.json({
      name: summaryData.title || title,
      summary: summaryData.extract,
      url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      sections: [],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const stripe = require('../config/stripe');

const PRESCRIPTION_FEE_PENCE = 990; // £9.90 NHS prescription charge

const ORDER_STATUS_CONFIG = {
  pending:    { color: '#F59E0B', bg: '#FEF3C7', icon: 'fa-clock',          label: 'Pending Approval' },
  approved:   { color: '#1565C0', bg: '#DBEAFE', icon: 'fa-check-circle',   label: 'Approved' },
  preparing:  { color: '#0891B2', bg: '#E0F2FE', icon: 'fa-mortar-pestle',  label: 'Being Prepared' },
  dispatched: { color: '#7C3AED', bg: '#EDE9FE', icon: 'fa-truck',          label: 'Dispatched' },
  delivered:  { color: '#16A34A', bg: '#DCFCE7', icon: 'fa-check-double',   label: 'Delivered / Ready' },
  rejected:   { color: '#DC2626', bg: '#FEE2E2', icon: 'fa-times-circle',   label: 'Not Approved' },
  cancelled:  { color: '#6B7280', bg: '#F3F4F6', icon: 'fa-ban',            label: 'Cancelled' },
};

const ACTIVE_ORDER_STATUSES = ['pending', 'approved', 'preparing', 'dispatched'];

exports.getPrescriptionsWithOrders = async (req, res) => {
  try {
    const id = req.user.id;
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: id },
      include: {
        doctor: { select: { name: true, doctor: { select: { specialization: true, hospital: true } } } },
        orders: { orderBy: { orderedAt: 'desc' } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const result = prescriptions.map(p => {
      const activeOrder = p.orders.find(o => !['delivered', 'rejected', 'cancelled'].includes(o.status));
      const lastOrder = p.orders[0];
      const statusConfig = activeOrder ? (ORDER_STATUS_CONFIG[activeOrder.status] || ORDER_STATUS_CONFIG.pending) : null;
      return {
        id: p.id,
        medication_name: p.medicationName,
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
        instructions: p.instructions,
        start_date: p.startDate,
        end_date: p.endDate,
        is_active: p.status === 'active',
        doc_name: p.doctor?.name || null,
        specialization: p.doctor?.doctor?.specialization || null,
        hospital_name: p.doctor?.doctor?.hospital || null,
        active_order_id: activeOrder?.id || null,
        order_status: activeOrder?.status || null,
        status_config: statusConfig,
        pharmacy_name: lastOrder?.pharmacyName || null,
        last_doctor_notes: lastOrder?.doctorNotes || null,
      };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPrescriptionOrders = async (req, res) => {
  try {
    const id = req.user.id;
    const orders = await prisma.prescriptionOrder.findMany({
      where: { patientId: id },
      include: {
        prescription: { select: { medicationName: true, dosage: true, frequency: true } },
        doctor: { select: { name: true } },
      },
      orderBy: { orderedAt: 'desc' },
      take: 20,
    });

    res.json(orders.map(o => ({
      id: o.id,
      medication_name: o.prescription.medicationName,
      dosage: o.prescription.dosage,
      frequency: o.prescription.frequency,
      doc_name: o.doctor.name,
      delivery_method: o.deliveryMethod,
      status: o.status,
      status_config: ORDER_STATUS_CONFIG[o.status] || ORDER_STATUS_CONFIG.pending,
      pharmacy_name: o.pharmacyName,
      doctor_notes: o.doctorNotes,
      ordered_at: o.orderedAt,
      updated_at: o.updatedAt,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createPrescriptionPaymentIntent = async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRESCRIPTION_FEE_PENCE,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: { patient_id: String(req.user.id), type: 'prescription' },
    });
    res.json({ client_secret: paymentIntent.client_secret });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.placePrescriptionOrder = async (req, res) => {
  try {
    const { prescription_id, delivery_method, delivery_address, patient_notes, payment_intent_id } = req.body;

    const prescription = await prisma.prescription.findFirst({
      where: { id: +prescription_id, patientId: req.user.id },
    });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (!prescription.doctorId) return res.status(400).json({ error: 'Prescription has no assigned doctor' });

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not confirmed' });
    }

    const order = await prisma.prescriptionOrder.create({
      data: {
        prescriptionId: prescription.id,
        patientId: req.user.id,
        doctorId: prescription.doctorId,
        deliveryMethod: delivery_method === 'delivery' ? 'delivery' : 'collection',
        deliveryAddress: delivery_address || null,
        patientNotes: patient_notes || null,
        paymentIntentId: payment_intent_id,
      },
    });

    res.json({ success: true, order_id: order.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.cancelPrescriptionOrder = async (req, res) => {
  try {
    const order = await prisma.prescriptionOrder.findFirst({
      where: { id: +req.params.id, patientId: req.user.id },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled' });

    await prisma.prescriptionOrder.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Health questionnaire ──────────────────────────────────────────────
exports.getQuestionnaire = async (req, res) => {
  try {
    let q = await prisma.patientQuestionnaire.findUnique({ where: { patientId: req.user.id } });
    if (!q) {
      q = await prisma.patientQuestionnaire.create({ data: { patientId: req.user.id } });
    }
    const rows = await prisma.questionnaireAnswer.findMany({ where: { patientId: req.user.id } });
    const answers = {};
    rows.forEach(r => { answers[r.questionKey] = r.answer; });
    res.json({ completed: q.completed, answers });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.saveQuestionnaireAnswer = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined || value === '') return res.json({ success: true });
    await prisma.questionnaireAnswer.upsert({
      where: { patientId_questionKey: { patientId: req.user.id, questionKey: key } },
      update: { answer: value },
      create: { patientId: req.user.id, questionKey: key, answer: value },
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const QUESTIONNAIRE_FAMILY_MAP = {
  family_heart:         { condition: 'Heart disease / heart attack' },
  family_diabetes:      { condition: 'Diabetes' },
  family_cancer:        { condition: 'Cancer' },
  family_stroke:        { condition: 'Stroke' },
  family_mental_health: { condition: 'Mental health condition' },
  family_high_bp:       { condition: 'High blood pressure' },
};

exports.completeQuestionnaire = async (req, res) => {
  try {
    const rows = await prisma.questionnaireAnswer.findMany({ where: { patientId: req.user.id } });
    const saved = {};
    rows.forEach(r => { saved[r.questionKey] = r.answer; });

    // Update gender
    if (saved.sex_at_birth && saved.sex_at_birth !== 'Prefer not to answer') {
      const g = saved.sex_at_birth.toLowerCase() === 'male' ? 'male' : 'female';
      await prisma.user.update({ where: { id: req.user.id }, data: { gender: g } });
    }

    // Parse height -> cm
    let heightCm = null;
    if (saved.height_value) {
      const hv = saved.height_value;
      let m = hv.match(/(\d+)ft\s*(\d+)in/);
      if (m) heightCm = Math.round((parseInt(m[1]) * 30.48 + parseInt(m[2]) * 2.54) * 10) / 10;
      else { m = hv.match(/(\d+\.?\d*)\s*cm/); if (m) heightCm = parseFloat(m[1]); }
    }

    // Parse weight -> kg
    let weightKg = null;
    if (saved.weight_value) {
      const wv = saved.weight_value;
      let m = wv.match(/(\d+)st\s*(\d+)lb/);
      if (m) weightKg = Math.round((parseInt(m[1]) * 6.35029 + parseInt(m[2]) * 0.453592) * 10) / 10;
      else { m = wv.match(/(\d+\.?\d*)\s*kg/); if (m) weightKg = parseFloat(m[1]); }
    }

    // Record health metric
    if (heightCm || weightKg) {
      const bmi = (heightCm && weightKg) ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10 : null;
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const existing = await prisma.healthMetric.findFirst({
        where: { userId: req.user.id, recordedAt: { gte: startOfDay, lte: endOfDay } },
      });
      if (existing) {
        await prisma.healthMetric.update({
          where: { id: existing.id },
          data: { ...(weightKg ? { weight: weightKg } : {}), ...(bmi ? { bmi } : {}) },
        });
      } else {
        await prisma.healthMetric.create({
          data: { userId: req.user.id, weight: weightKg, bmi },
        });
      }
    }

    // Family history entries
    for (const [qKey, info] of Object.entries(QUESTIONNAIRE_FAMILY_MAP)) {
      const ans = saved[qKey] || '';
      if (!ans || /^no/i.test(ans) || /^do not/i.test(ans) || /^prefer/i.test(ans)) continue;
      const existing = await prisma.familyHistory.findFirst({
        where: { userId: req.user.id, conditionName: info.condition, notes: 'questionnaire' },
      });
      if (existing) continue;
      let condition = info.condition;
      if (qKey === 'family_diabetes' && /Type 1/i.test(ans)) condition = 'Type 1 Diabetes';
      else if (qKey === 'family_diabetes' && /Type 2/i.test(ans)) condition = 'Type 2 Diabetes';
      await prisma.familyHistory.create({
        data: { userId: req.user.id, relation: 'other', conditionName: condition, notes: 'questionnaire' },
      });
    }

    // Mark complete
    await prisma.patientQuestionnaire.upsert({
      where: { patientId: req.user.id },
      update: { completed: true, completedAt: new Date() },
      create: { patientId: req.user.id, completed: true, completedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Safe Appetite ──────────────────────────────────────────────────────

const SAFE_APPETITE_SYNONYMS = {
  peanuts: ['peanut', 'groundnut', 'arachis'],
  'tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut'],
  milk: ['milk', 'dairy', 'lactose', 'casein', 'whey', 'cream', 'cheese', 'butter', 'ghee'],
  'milk/dairy': ['milk', 'dairy', 'lactose', 'casein', 'whey', 'cream', 'cheese', 'butter', 'ghee'],
  eggs: ['egg', 'albumin', 'meringue', 'mayonnaise'],
  wheat: ['wheat', 'gluten', 'flour', 'semolina', 'spelt', 'durum'],
  'wheat/gluten': ['wheat', 'gluten', 'flour', 'semolina', 'spelt', 'durum'],
  soy: ['soy', 'soya', 'tofu', 'miso', 'tempeh', 'edamame'],
  fish: ['fish', 'cod', 'salmon', 'tuna', 'anchov', 'sardine'],
  shellfish: ['shrimp', 'crab', 'lobster', 'prawn', 'scallop', 'clam', 'oyster', 'mussel', 'squid'],
  sesame: ['sesame', 'tahini'],
  mustard: ['mustard'],
  celery: ['celery'],
  lupin: ['lupin'],
  molluscs: ['mollusc', 'snail', 'octopus', 'clam', 'mussel', 'oyster'],
  sulphites: ['sulphite', 'sulfite', 'so2'],
};

function fallbackSafeAppetiteScan(ingredientText, profile) {
  const lower = ingredientText.toLowerCase();
  const alerts = [];
  let overall = 'safe';

  for (const a of profile.allergies) {
    const key = a.allergen.toLowerCase();
    const syns = SAFE_APPETITE_SYNONYMS[key] || [key];
    const matches = syns.filter(s => lower.includes(s));
    if (matches.length) {
      alerts.push({ ingredient: matches[0], reason: `Contains ${a.allergen} - you have a ${a.severity} allergy`, type: 'DANGER', matches });
      overall = 'danger';
    }
  }
  for (const i of profile.intolerances) {
    const key = i.intolerance.toLowerCase();
    const syns = SAFE_APPETITE_SYNONYMS[key] || [key];
    const matches = syns.filter(s => lower.includes(s));
    if (matches.length) {
      alerts.push({ ingredient: matches[0], reason: `Contains ${i.intolerance} - you have a ${i.severity} intolerance`, type: 'CAUTION', matches });
      if (overall === 'safe') overall = 'caution';
    }
  }
  for (const d of profile.dislikes) {
    if (lower.includes(d.toLowerCase())) {
      alerts.push({ ingredient: d, reason: `Contains an ingredient you dislike: ${d}`, type: 'INFO', matches: [d] });
    }
  }

  const summary = alerts.length
    ? `Found ${alerts.length} item(s) of concern based on your safety profile.`
    : 'No known allergens, intolerances, or disliked ingredients detected.';
  const tip = overall === 'danger'
    ? 'Avoid this product and check with the manufacturer for full allergen information.'
    : overall === 'caution'
    ? 'Proceed with caution and check the full ingredient label before consuming.'
    : 'This looks safe based on your profile, but always double-check labels for cross-contamination warnings.';

  return { overall, alerts, summary, tip, safe_highlights: [] };
}

async function geminiSafeAppetiteScan(productName, ingredients, profile) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const profileText = [
    `Allergies: ${profile.allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') || 'none'}`,
    `Intolerances: ${profile.intolerances.map(i => `${i.intolerance} (${i.severity})`).join(', ') || 'none'}`,
    `Diet preferences: ${profile.dietPrefs.join(', ') || 'none'}`,
    `Disliked ingredients: ${profile.dislikes.join(', ') || 'none'}`,
  ].join('\n');

  const prompt = `You are a food safety assistant. A user with the following dietary safety profile wants to check a product.

${profileText}

Product name: ${productName || 'Unknown Product'}
Ingredients: ${ingredients}

Analyze the ingredients against the user's profile and respond with ONLY valid JSON (no markdown, no code fences) matching this exact shape:
{
  "overall": "safe" | "caution" | "danger",
  "alerts": [ { "ingredient": string, "reason": string, "type": "DANGER" | "CAUTION" | "INFO", "matches": [string] } ],
  "summary": string,
  "tip": string,
  "safe_highlights": [string]
}

Rules:
- "danger" if any ingredient matches an allergy.
- "caution" if any ingredient matches an intolerance, a diet preference conflict, or a disliked ingredient, but no allergy match.
- "safe" if nothing matches.
- "alerts" lists every concerning ingredient found, type DANGER for allergy matches, CAUTION for intolerance/diet conflicts, INFO for disliked ingredients.
- "safe_highlights" lists 1-4 short positive notes, only when overall is "safe".
- "summary" is 1-2 sentences summarizing the result.
- "tip" is one practical, actionable tip for the user.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, responseMimeType: 'application/json' },
      },
      { timeout: 30000 }
    );
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const cleaned = text.replace(/^```json\s*|```\s*$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.overall) return null;
    parsed.alerts = parsed.alerts || [];
    parsed.safe_highlights = parsed.safe_highlights || [];
    return parsed;
  } catch {
    return null;
  }
}

exports.getSafeAppetiteProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [allergies, intolerances, dietPrefs, dislikes, scans] = await Promise.all([
      prisma.allergy.findMany({ where: { userId, allergyType: 'food', isActive: true }, orderBy: { id: 'asc' } }),
      prisma.foodIntolerance.findMany({ where: { userId, isActive: true }, orderBy: { id: 'asc' } }),
      prisma.dietPreference.findMany({ where: { userId, isActive: true }, orderBy: { id: 'asc' } }),
      prisma.ingredientDislike.findMany({ where: { userId, isActive: true }, orderBy: { id: 'asc' } }),
      prisma.ingredientScan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    let profileScore = 0;
    if (allergies.length) profileScore += 35;
    if (intolerances.length) profileScore += 25;
    if (dietPrefs.length) profileScore += 25;
    if (dislikes.length) profileScore += 15;
    profileScore = Math.min(profileScore, 100);

    res.json({
      allergies,
      intolerances,
      dietPrefs,
      dislikes,
      scans: scans.map(s => ({ ...s, alerts: s.alerts ? JSON.parse(s.alerts) : [] })),
      profileScore,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.saveSafeAppetitePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { allergies = [], intolerances = [], diet_prefs = [], dislikes = [] } = req.body;

    await prisma.$transaction([
      prisma.allergy.deleteMany({ where: { userId, allergyType: 'food' } }),
      prisma.foodIntolerance.deleteMany({ where: { userId } }),
      prisma.dietPreference.deleteMany({ where: { userId } }),
      prisma.ingredientDislike.deleteMany({ where: { userId } }),
    ]);

    await Promise.all([
      ...allergies.filter(a => a && a.allergen).map(a => prisma.allergy.create({
        data: { userId, allergen: a.allergen, severity: a.severity || 'moderate', allergyType: 'food' },
      })),
      ...intolerances.filter(i => i && i.name).map(i => prisma.foodIntolerance.create({
        data: { userId, intolerance: i.name, severity: i.severity || 'moderate' },
      })),
      ...diet_prefs.filter(Boolean).map(p => prisma.dietPreference.create({ data: { userId, preference: p } })),
      ...dislikes.filter(Boolean).map(d => prisma.ingredientDislike.create({ data: { userId, ingredient: d } })),
    ]);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.scanSafeAppetiteIngredients = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_name, ingredients } = req.body;
    if (!ingredients || !ingredients.trim()) return res.status(400).json({ error: 'Ingredients are required' });

    const [allergies, intolerances, dietPrefs, dislikes] = await Promise.all([
      prisma.allergy.findMany({ where: { userId, allergyType: 'food', isActive: true } }),
      prisma.foodIntolerance.findMany({ where: { userId, isActive: true } }),
      prisma.dietPreference.findMany({ where: { userId, isActive: true } }),
      prisma.ingredientDislike.findMany({ where: { userId, isActive: true } }),
    ]);

    const profile = {
      allergies: allergies.map(a => ({ allergen: a.allergen, severity: a.severity })),
      intolerances: intolerances.map(i => ({ intolerance: i.intolerance, severity: i.severity })),
      dietPrefs: dietPrefs.map(d => d.preference),
      dislikes: dislikes.map(d => d.ingredient),
    };

    let result = await geminiSafeAppetiteScan(product_name, ingredients, profile);
    if (!result) result = fallbackSafeAppetiteScan(ingredients, profile);

    const scanResultEnum = result.overall === 'danger' ? 'danger' : result.overall === 'caution' ? 'warning' : 'safe';

    const scan = await prisma.ingredientScan.create({
      data: {
        userId,
        productName: product_name || 'Unknown Product',
        ingredients,
        result: scanResultEnum,
        alerts: JSON.stringify(result.alerts || []),
        aiSummary: result.summary || null,
        tip: result.tip || null,
      },
    });

    res.json({ result, scan_result: { ...scan, alerts: result.alerts || [] } });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteSafeAppetiteScan = async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id);
    await prisma.ingredientScan.deleteMany({ where: { id, userId } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Wearable & Device Sync ──────────────────────────────────────────────
exports.getWearableStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const [token, metrics] = await Promise.all([
      prisma.wearableToken.findUnique({ where: { userId_provider: { userId, provider: 'google_fit' } } }),
      prisma.healthMetric.findMany({
        where: { userId, source: 'wearable' },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const isConnected = !!(token && token.accessToken);

    const seen = new Set();
    const uniqueMetrics = [];
    for (const m of metrics) {
      const key = dateKey(m.recordedAt);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMetrics.push(m);
      }
    }

    res.json({
      isConnected,
      hasImportedData: metrics.length > 0,
      lastSync: token?.lastSync || null,
      metrics: uniqueMetrics,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.connectWearable = async (req, res) => {
  try {
    const userId = req.user.id;
    const crypto = require('crypto');
    await prisma.wearableToken.upsert({
      where: { userId_provider: { userId, provider: 'google_fit' } },
      update: { accessToken: crypto.randomBytes(24).toString('hex') },
      create: { userId, provider: 'google_fit', accessToken: crypto.randomBytes(24).toString('hex') },
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.disconnectWearable = async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.wearableToken.deleteMany({ where: { userId, provider: 'google_fit' } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Parse a CSV string (RFC4180-ish, handles quoted fields) into an array of row arrays
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

// Extract and parse the "Daily activity metrics" CSV from a Google Takeout ZIP buffer
function parseTakeoutZip(buffer) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const csvEntry = entries.find(e => /\/Daily activity metrics\.csv$/i.test(e.entryName))
    || entries.find(e => /Daily activity metrics.*\.csv$/i.test(e.entryName));
  if (!csvEntry) {
    const sample = entries.slice(0, 20).map(e => e.entryName).join(', ');
    throw new Error(`Daily activity metrics CSV not found. ZIP contains: ${sample}`);
  }

  const csv = csvEntry.getData().toString('utf8');
  if (!csv.trim()) throw new Error('Daily activity metrics CSV is empty.');

  const allRows = parseCsv(csv);
  const header = allRows[0];
  const col = (name) => header.indexOf(name);
  const dateIdx = col('Date');
  const hrIdx = col('Average heart rate (bpm)');
  const stepsIdx = col('Step count');
  const distIdx = col('Distance (m)');
  const calIdx = col('Calories (kcal)');
  const weightIdx = col('Average weight (kg)');

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

exports.syncWearable = async (req, res) => {
  try {
    const userId = req.user.id;
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const folderId = process.env.GOOGLE_DRIVE_TAKEOUT_FOLDER_ID;

    if (!apiKey || !folderId) {
      return res.json({ success: false, error: 'Google Drive sync is not configured. Set GOOGLE_DRIVE_API_KEY and GOOGLE_DRIVE_TAKEOUT_FOLDER_ID in the backend .env.' });
    }

    // 1. List Takeout ZIPs in the Drive folder (newest/largest first)
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

    // 2. Skip if this exact file was already imported
    const existing = await prisma.googleFitDriveImport.findUnique({ where: { userId_driveFileId: { userId, driveFileId: file.id } } });
    if (existing && existing.modifiedTime === file.modifiedTime) {
      return res.json({
        success: true,
        already_current: true,
        imported: existing.importedRows,
        latest_date: existing.latestDate ? dateKey(existing.latestDate) : null,
        file: file.name,
        message: 'Already up to date — this is the latest Takeout ZIP from your Drive.',
      });
    }

    // 3. Download and parse
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

    const rows = parseTakeoutZip(buffer);
    if (!rows.length) {
      return res.json({ success: false, error: 'No daily activity rows found in this Takeout file.' });
    }

    const dates = rows.map(r => new Date(r.metricDate + 'T12:00:00.000Z'));

    await prisma.healthMetric.deleteMany({ where: { userId, source: 'wearable', recordedAt: { in: dates } } });
    await prisma.healthMetric.createMany({
      data: rows.map((r, i) => ({
        userId,
        source: 'wearable',
        heartRate: r.heartRate,
        steps: r.steps,
        distanceKm: r.distanceKm,
        caloriesBurned: r.caloriesBurned,
        weight: r.weight,
        recordedAt: dates[i],
      })),
    });

    // 4. Record this import so future syncs can detect "already current"
    await prisma.googleFitDriveImport.upsert({
      where: { userId_driveFileId: { userId, driveFileId: file.id } },
      update: { fileName: file.name, modifiedTime: file.modifiedTime, importedRows: rows.length, latestDate: dates[0] },
      create: { userId, driveFileId: file.id, fileName: file.name, modifiedTime: file.modifiedTime, importedRows: rows.length, latestDate: dates[0] },
    });

    await prisma.wearableToken.upsert({
      where: { userId_provider: { userId, provider: 'google_fit' } },
      update: { lastSync: new Date() },
      create: { userId, provider: 'google_fit', accessToken: null, lastSync: new Date() },
    });

    res.json({
      success: true,
      already_current: false,
      imported: rows.length,
      latest_date: rows[0].metricDate,
      file: file.name,
      message: `Synced ${rows.length} days from Google Drive`,
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};
