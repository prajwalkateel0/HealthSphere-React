const prisma = require('../config/db');

exports.getConversations = async (req, res) => {
  try {
    const id = req.user.id;
    const msgs = await prisma.message.findMany({
      where: { OR: [{ senderId: id }, { receiverId: id }] },
      include: {
        sender: { select: { id: true, name: true, role: true, profileImage: true, nhsId: true, doctor: { select: { specialization: true } } } },
        receiver: { select: { id: true, name: true, role: true, profileImage: true, nhsId: true, doctor: { select: { specialization: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const convMap = new Map();
    for (const m of msgs) {
      const other = m.senderId === id ? m.receiver : m.sender;
      if (!convMap.has(other.id)) {
        const unread = await prisma.message.count({ where: { senderId: other.id, receiverId: id, isRead: false } });
        convMap.set(other.id, {
          ...other,
          specialization: other.doctor?.specialization || null,
          doctor: undefined,
          last_message: m.content,
          last_message_time: m.createdAt,
          is_emergency: m.isEmergency,
          unread_count: unread,
        });
      }
    }

    if (!convMap.size && req.user.role === 'patient') {
      const doctors = await prisma.user.findMany({
        where: { role: 'doctor', status: 'active' },
        select: { id: true, name: true, role: true, profileImage: true, doctor: { select: { specialization: true } } },
        take: 5,
      });
      for (const d of doctors) {
        convMap.set(d.id, { ...d, specialization: d.doctor?.specialization || null, doctor: undefined, last_message: '', last_message_time: null, is_emergency: false, unread_count: 0 });
      }
    }

    res.json([...convMap.values()]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getMessages = async (req, res) => {
  try {
    const myId = req.user.id;
    const userId = +req.params.userId;
    const rows = await prisma.message.findMany({
      where: { OR: [{ senderId: myId, receiverId: userId }, { senderId: userId, receiverId: myId }] },
      include: { sender: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    await prisma.message.updateMany({ where: { senderId: userId, receiverId: myId, isRead: false }, data: { isRead: true } });
    res.json(rows.map(m => ({ ...m, sender_name: m.sender.name })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, content, is_emergency = false } = req.body;
    const msg = await prisma.message.create({
      data: { senderId: req.user.id, receiverId: +receiver_id, content, isEmergency: is_emergency },
      include: { sender: { select: { name: true } } },
    });
    res.status(201).json({ ...msg, sender_name: msg.sender.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
