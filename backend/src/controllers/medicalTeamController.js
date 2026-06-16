const prisma = require('../config/db');

const ACTIVE_STATUSES = ['approved', 'preparing', 'dispatched'];
const COMPLETED_STATUSES = ['delivered', 'rejected', 'cancelled'];
const ACTION_MAP = { preparing: 'preparing', dispatch: 'dispatched', deliver: 'delivered' };

const mapOrder = (o) => ({
  ...o,
  medication_name: o.prescription.medicationName,
  dosage: o.prescription.dosage,
  frequency: o.prescription.frequency,
  instructions: o.prescription.instructions,
  patient_name: o.patient.name,
  nhs_id: o.patient.nhsId,
  date_of_birth: o.patient.dateOfBirth,
  phone: o.patient.phone,
  doc_name: o.doctor.name,
  delivery_method: o.deliveryMethod,
  delivery_address: o.deliveryAddress,
  pharmacy_name: o.pharmacyName,
  patient_notes: o.patientNotes,
  doctor_notes: o.doctorNotes,
  ordered_at: o.orderedAt,
});

exports.getDashboard = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [awaiting, preparing, dispatched, delivered, today, urgent] = await Promise.all([
      prisma.prescriptionOrder.count({ where: { status: 'approved' } }),
      prisma.prescriptionOrder.count({ where: { status: 'preparing' } }),
      prisma.prescriptionOrder.count({ where: { status: 'dispatched' } }),
      prisma.prescriptionOrder.count({ where: { status: 'delivered' } }),
      prisma.prescriptionOrder.count({ where: { orderedAt: { gte: todayStart } } }),
      prisma.prescriptionOrder.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        include: {
          prescription: { select: { medicationName: true, dosage: true, frequency: true, instructions: true } },
          patient: { select: { name: true, nhsId: true, dateOfBirth: true, phone: true } },
          doctor: { select: { name: true } },
        },
        orderBy: { orderedAt: 'asc' },
        take: 8,
      }),
    ]);

    res.json({
      stats: { awaiting, preparing, dispatched, delivered, today },
      urgent: urgent.map(mapOrder),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getQueue = async (req, res) => {
  try {
    const tab = req.query.tab === 'history' ? 'history' : 'active';
    const statuses = tab === 'active' ? ACTIVE_STATUSES : COMPLETED_STATUSES;

    const [orders, activeCount] = await Promise.all([
      prisma.prescriptionOrder.findMany({
        where: { status: { in: statuses } },
        include: {
          prescription: { select: { medicationName: true, dosage: true, frequency: true, instructions: true } },
          patient: { select: { name: true, nhsId: true, dateOfBirth: true, phone: true } },
          doctor: { select: { name: true } },
        },
        orderBy: { orderedAt: 'asc' },
      }),
      prisma.prescriptionOrder.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    ]);

    res.json({ activeCount, orders: orders.map(mapOrder) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { action, order_id, doctor_notes, pharmacy_name } = req.body;
    const nextStatus = ACTION_MAP[action];
    if (!nextStatus) return res.status(400).json({ error: 'Invalid action' });

    const order = await prisma.prescriptionOrder.findUnique({ where: { id: +order_id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await prisma.prescriptionOrder.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        ...(doctor_notes ? { doctorNotes: doctor_notes } : {}),
        ...(pharmacy_name ? { pharmacyName: pharmacy_name } : {}),
      },
    });

    const messages = {
      preparing: 'Order marked as being prepared.',
      dispatched: 'Order marked as dispatched.',
      delivered: 'Order marked as delivered.',
    };
    res.json({ success: true, message: messages[nextStatus] });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getProfile = async (req, res) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ name: u.name, email: u.email, phone: u.phone, nhsId: u.nhsId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    await prisma.user.update({ where: { id: req.user.id }, data: { name: name.trim(), phone } });
    res.json({ message: 'Profile updated successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
