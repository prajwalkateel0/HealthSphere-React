const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const safe = (user) => {
  const { password, ...rest } = user;
  return rest;
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'active') return res.status(401).json({ error: 'Account is not active' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: generateToken(user), user: safe(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role = 'patient', phone, date_of_birth, gender } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const nhsId = 'NHS' + Math.random().toString(36).substring(2, 9).toUpperCase();

    const user = await prisma.user.create({
      data: {
        name, email, password: hashed,
        role, phone,
        dateOfBirth: date_of_birth ? new Date(date_of_birth) : null,
        gender: gender || null,
        nhsId,
        status: role === 'doctor' ? 'pending' : 'active',
      },
    });

    res.status(201).json({ token: generateToken(user), user: safe(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(safe(req.user));
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, date_of_birth, gender, address, blood_type, allergies_summary } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name, phone,
        dateOfBirth: date_of_birth ? new Date(date_of_birth) : undefined,
        gender: gender || undefined,
        address, bloodType: blood_type,
        allergiesSummary: allergies_summary,
      },
    });
    res.json(safe(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const valid = await bcrypt.compare(currentPassword, req.user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
