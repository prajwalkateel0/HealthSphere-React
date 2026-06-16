const prisma = require('../config/db');
const mailer = require('../utils/mailer');

exports.getDashboard = async (req, res) => {
  try {
    const [patients, doctors, appointments, pending, foodItems, diseases] = await Promise.all([
      prisma.user.count({ where: { role: 'patient' } }),
      prisma.user.count({ where: { role: 'doctor', status: 'active' } }),
      prisma.appointment.count({ where: { appointmentDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      prisma.user.count({ where: { status: 'pending' } }),
      prisma.foodDatabase.count(),
      prisma.geneticDisease.count(),
    ]);
    res.json({ patients, doctors, appointments, pending, foodItems, diseases });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true, nhsId: true, createdAt: true, phone: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateUserStatus = async (req, res) => {
  try {
    await prisma.user.update({ where: { id: +req.params.id }, data: { status: req.body.status } });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteUser = async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: +req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDoctors = async (req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: { role: 'doctor' },
      include: { doctor: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(u => ({ id: u.id, name: u.name, email: u.email, status: u.status, createdAt: u.createdAt, ...u.doctor })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.verifyDoctor = async (req, res) => {
  try {
    const { hcpc_verified } = req.body;
    await prisma.doctor.updateMany({ where: { userId: +req.params.id }, data: { hcpcVerified: hcpc_verified } });
    if (hcpc_verified) await prisma.user.update({ where: { id: +req.params.id }, data: { status: 'active' } });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPendingApprovals = async (req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: { status: 'pending' },
      select: { id: true, name: true, email: true, role: true, createdAt: true, phone: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAnalytics = async (req, res) => {
  try {
    const topDoctors = await prisma.user.findMany({
      where: { role: 'doctor', status: 'active' },
      include: {
        doctor: { select: { specialization: true, rating: true } },
        doctorAppts: { select: { id: true } },
      },
      take: 10,
    });
    const formatted = topDoctors
      .map(d => ({ name: d.name, specialization: d.doctor?.specialization, rating: d.doctor?.rating, total_appointments: d.doctorAppts.length }))
      .sort((a, b) => b.total_appointments - a.total_appointments);

    res.json({ topDoctors: formatted, userGrowth: [], apptTrends: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAccessLogs = async (req, res) => {
  try {
    const { search, role, action } = req.query;

    const logs = await prisma.accessLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      where: action ? { action: { contains: action, mode: 'insensitive' } } : {},
    });

    const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        ...(role ? { role } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const result = logs
      .map(l => {
        const u = userMap[l.userId];
        if (!u) return null;
        return { id: l.id, user_name: u.name, email: u.email, role: u.role, action: l.action, ip_address: l.ipAddress, created_at: l.createdAt, accessed_patient_id: l.accessedPatientId };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFoodDatabase = async (req, res) => {
  try {
    const { search } = req.query;
    const rows = await prisma.foodDatabase.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      take: 100,
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addFoodItem = async (req, res) => {
  try {
    const { name, calories, protein, carbs, fat, fiber, allergens, health_rating } = req.body;
    const item = await prisma.foodDatabase.create({
      data: { name, calories: calories ? +calories : null, protein: protein ? +protein : null, carbs: carbs ? +carbs : null, fat: fat ? +fat : null, fiber: fiber ? +fiber : null, allergens, healthRating: health_rating || 'good' },
    });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteFoodItem = async (req, res) => {
  try {
    await prisma.foodDatabase.delete({ where: { id: +req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getDiseases = async (req, res) => {
  try {
    const rows = await prisma.geneticDisease.findMany({ orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addDisease = async (req, res) => {
  try {
    const { name, inheritance_type, symptoms, food_triggers, exercise_guidance, care_plan } = req.body;
    const d = await prisma.geneticDisease.create({
      data: { name, inheritanceType: inheritance_type, symptoms, foodTriggers: food_triggers, exerciseGuidance: exercise_guidance, carePlan: care_plan },
    });
    res.status(201).json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteDisease = async (req, res) => {
  try {
    await prisma.geneticDisease.delete({ where: { id: +req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getSettings = async (req, res) => {
  try {
    const tables = {
      users: prisma.user.count(),
      appointments: prisma.appointment.count(),
      medical_records: prisma.medicalRecord.count(),
      allergies: prisma.allergy.count(),
      vaccinations: prisma.vaccination.count(),
      prescriptions: prisma.prescription.count(),
      diet_logs: prisma.dietLog.count(),
      health_metrics: prisma.healthMetric.count(),
      messages: prisma.message.count(),
      food_database: prisma.foodDatabase.count(),
      genetic_diseases: prisma.geneticDisease.count(),
    };
    const counts = Object.fromEntries(await Promise.all(Object.entries(tables).map(async ([k, p]) => [k, await p])));
    res.json({
      appName: 'HealthSphere',
      systemEmail: mailer.MAIL_ADMIN,
      tables: counts,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.sendTestEmail = async (req, res) => {
  try {
    const { type = 'test', to } = req.body;
    const recipient = to || mailer.MAIL_ADMIN;
    let sent = false;

    switch (type) {
      case 'test': {
        const html = mailer.hsMailTemplate(
          'Test Email ✅',
          mailer.p('This is a <strong>test email</strong> from HealthSphere.')
          + mailer.success('✅ If you received this, your email configuration is working correctly!')
          + mailer.dataTable({ 'SMTP Host': `${mailer.MAIL_HOST}:${mailer.MAIL_PORT}`, From: mailer.MAIL_FROM, 'Sent at': new Date().toLocaleString('en-GB') }),
        );
        sent = await mailer.hsSendEmail(recipient, 'Admin', 'HealthSphere — Email Test', html);
        break;
      }
      case 'welcome':
        sent = await mailer.mailPatientWelcome(recipient, 'Test Patient', 'PT123456TEST');
        break;
      case 'approval_request':
        sent = await mailer.mailAdminNewApplication('Dr. Test User', recipient, 'doctor', 'DR123456', { HCPC: 'HCPC12345678', Specialization: 'Cardiology', Hospital: 'Test Hospital' });
        break;
      case 'approved':
        sent = await mailer.mailAccountApproved(recipient, 'Dr. Test User', 'doctor');
        break;
      case 'rejected':
        sent = await mailer.mailAccountRejected(recipient, 'Test User', 'doctor', 'HCPC number could not be verified.');
        break;
      case 'appointment':
        sent = await mailer.mailAppointmentPatient(recipient, 'Test Patient', 'Emma Hall', 'Monday, 15 May 2026', '09:30', 'BP Review', 'Leicester Royal Infirmary');
        break;
      case 'emergency':
        sent = await mailer.mailEmergencyAlert(recipient, 'Test Doctor', 'Test Patient', 'PT123456', 'I am experiencing severe chest pain and shortness of breath.');
        break;
      case 'prescription':
        sent = await mailer.mailPrescriptionIssued(recipient, 'Test Patient', 'Emma Hall', 'Amlodipine', '5mg', 'Once daily (Morning)', 'Take with water for blood pressure control');
        break;
      default:
        return res.status(400).json({ error: 'Unknown email type' });
    }

    res.json({ success: sent, to: recipient });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
