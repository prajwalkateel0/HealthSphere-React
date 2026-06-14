const prisma = require('../config/db');

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
    const rows = await prisma.accessLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json(rows);
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
