const prisma = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    const id = req.user.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [todaysAppts, totalPatients, criticalLabs, pendingRefills, recentMessages] = await Promise.all([
      prisma.appointment.findMany({
        where: { doctorId: id, appointmentDate: { gte: today, lt: tomorrow } },
        include: { patient: { select: { name: true, dateOfBirth: true, bloodType: true } } },
        orderBy: { appointmentTime: 'asc' },
      }),
      prisma.appointment.groupBy({ by: ['patientId'], where: { doctorId: id } }).then(r => r.length),
      prisma.medicalRecord.findMany({
        where: { status: 'critical', patient: { patientAppts: { some: { doctorId: id } } } },
        include: { patient: { select: { name: true } } },
        orderBy: { testDate: 'desc' },
        take: 5,
      }),
      prisma.prescription.findMany({
        where: { doctorId: id, refillRequested: true, status: 'active' },
        include: { patient: { select: { name: true } } },
        take: 5,
      }),
      prisma.message.findMany({
        where: { receiverId: id, isRead: false },
        include: { sender: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const appts = todaysAppts.map(a => ({ ...a, patient_name: a.patient.name, date_of_birth: a.patient.dateOfBirth, blood_type: a.patient.bloodType }));
    const labs = criticalLabs.map(l => ({ ...l, patient_name: l.patient.name }));
    const refills = pendingRefills.map(p => ({ ...p, patient_name: p.patient.name }));
    const msgs = recentMessages.map(m => ({ ...m, sender_name: m.sender.name }));

    res.json({ todaysAppts: appts, totalPatients, criticalLabs: labs, pendingRefills: refills, recentMessages: msgs });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPatients = async (req, res) => {
  try {
    const { search } = req.query;
    const patientIds = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { doctorId: req.user.id },
    }).then(r => r.map(x => x.patientId));

    const patients = await prisma.user.findMany({
      where: {
        id: { in: patientIds },
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: { id: true, name: true, email: true, dateOfBirth: true, gender: true, bloodType: true, phone: true, nhsId: true, profileImage: true },
    });
    res.json(patients);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPatientDetails = async (req, res) => {
  try {
    const patientId = +req.params.patientId;
    const [patient, labs, prescriptions, allergies, vitals, notes] = await Promise.all([
      prisma.user.findUnique({ where: { id: patientId } }),
      prisma.medicalRecord.findMany({ where: { patientId }, orderBy: { testDate: 'desc' } }),
      prisma.prescription.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
      prisma.allergy.findMany({ where: { userId: patientId } }),
      prisma.healthMetric.findMany({ where: { userId: patientId }, orderBy: { recordedAt: 'desc' }, take: 10 }),
      prisma.clinicalNote.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    ]);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const { password: _, ...patientData } = patient;
    res.json({ patient: patientData, labs, prescriptions, allergies, vitals, notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAppointments = async (req, res) => {
  try {
    const { status, date } = req.query;
    const where = { doctorId: req.user.id };
    if (status) where.status = status;
    if (date) { const d = new Date(date); d.setHours(0,0,0,0); where.appointmentDate = d; }

    const rows = await prisma.appointment.findMany({
      where,
      include: { patient: { select: { name: true, dateOfBirth: true, bloodType: true, profileImage: true } } },
      orderBy: [{ appointmentDate: 'desc' }, { appointmentTime: 'asc' }],
    });
    res.json(rows.map(a => ({ ...a, patient_name: a.patient.name, date_of_birth: a.patient.dateOfBirth, blood_type: a.patient.bloodType })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    await prisma.appointment.updateMany({
      where: { id: +req.params.id, doctorId: req.user.id },
      data: { status: req.body.status },
    });
    res.json({ message: 'Status updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLabResults = async (req, res) => {
  try {
    const patientIds = await prisma.appointment.groupBy({ by: ['patientId'], where: { doctorId: req.user.id } }).then(r => r.map(x => x.patientId));
    const rows = await prisma.medicalRecord.findMany({
      where: { patientId: { in: patientIds } },
      include: { patient: { select: { name: true } } },
      orderBy: { testDate: 'desc' },
    });
    res.json(rows.map(r => ({ ...r, patient_name: r.patient.name })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addLabResult = async (req, res) => {
  try {
    const { patient_id, test_type, result, status, notes, test_date } = req.body;
    const filePath = req.file?.filename || null;
    const rec = await prisma.medicalRecord.create({
      data: {
        patientId: +patient_id, doctorId: req.user.id,
        testType: test_type, result, status, notes,
        testDate: test_date ? new Date(test_date) : null,
        filePath,
      },
    });
    res.status(201).json(rec);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPrescriptions = async (req, res) => {
  try {
    const rows = await prisma.prescription.findMany({
      where: { doctorId: req.user.id },
      include: { patient: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(p => ({ ...p, patient_name: p.patient.name })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.issuePrescription = async (req, res) => {
  try {
    const { patient_id, medication_name, dosage, frequency, duration, start_date, end_date, instructions } = req.body;
    const p = await prisma.prescription.create({
      data: {
        patientId: +patient_id, doctorId: req.user.id,
        medicationName: medication_name, dosage, frequency, duration, instructions,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
      },
    });
    res.status(201).json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addClinicalNote = async (req, res) => {
  try {
    const { patient_id, note_type, content } = req.body;
    const note = await prisma.clinicalNote.create({
      data: { patientId: +patient_id, doctorId: req.user.id, noteType: note_type, content },
    });
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getSchedule = async (req, res) => {
  try {
    const doc = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doc) return res.json([]);
    const rows = await prisma.doctorSchedule.findMany({ where: { doctorId: doc.id }, orderBy: { dayOfWeek: 'asc' } });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { schedules } = req.body;
    const doc = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doc) return res.status(404).json({ error: 'Doctor profile not found' });
    await prisma.doctorSchedule.deleteMany({ where: { doctorId: doc.id } });
    await prisma.doctorSchedule.createMany({
      data: schedules.map(s => ({
        doctorId: doc.id,
        dayOfWeek: s.day_of_week,
        startTime: s.start_time ? new Date(`1970-01-01T${s.start_time}`) : null,
        endTime: s.end_time ? new Date(`1970-01-01T${s.end_time}`) : null,
        isAvailable: s.is_available,
      })),
    });
    res.json({ message: 'Schedule updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAlerts = async (req, res) => {
  try {
    const rows = await prisma.healthAlert.findMany({
      where: { doctorId: req.user.id },
      include: { patient: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(a => ({ ...a, patient_name: a.patient.name })));
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

exports.getDoctorProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { doctor: true } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password: _, ...data } = user;
    res.json({ ...data, ...user.doctor });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateDoctorProfile = async (req, res) => {
  try {
    const { name, phone, address, specialization, hospital, bio, availability } = req.body;
    await prisma.user.update({ where: { id: req.user.id }, data: { name, phone, address } });
    await prisma.doctor.updateMany({ where: { userId: req.user.id }, data: { specialization, hospital, bio, availability } });
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
