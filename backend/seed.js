require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding demo data...');
  const hash = await bcrypt.hash('password', 12);

  // Upsert demo users
  const [patient, doctorUser, admin, govt] = await Promise.all([
    prisma.user.upsert({ where: { email: 'emma.patel007@gmail.com' }, update: { password: hash, status: 'active' }, create: { name: 'Emma Patel', email: 'emma.patel007@gmail.com', password: hash, role: 'patient', status: 'active', nhsId: 'NHS123456', phone: '07700900001', dateOfBirth: new Date('1990-03-15'), gender: 'female', bloodType: 'A+' } }),
    prisma.user.upsert({ where: { email: 'doctor@healthsphere.com' }, update: { password: hash, status: 'active' }, create: { name: 'Dr Emma Hall', email: 'doctor@healthsphere.com', password: hash, role: 'doctor', status: 'active', nhsId: 'NHS789012', phone: '07700900002', dateOfBirth: new Date('1982-07-22'), gender: 'female', bloodType: 'O+' } }),
    prisma.user.upsert({ where: { email: 'admin@healthsphere.com' }, update: { password: hash, status: 'active' }, create: { name: 'Admin User', email: 'admin@healthsphere.com', password: hash, role: 'admin', status: 'active', nhsId: 'NHS000001' } }),
    prisma.user.upsert({ where: { email: 'govt@healthsphere.com' }, update: { password: hash, status: 'active' }, create: { name: 'William Jayson', email: 'govt@healthsphere.com', password: hash, role: 'government', status: 'active', nhsId: 'NHS000002' } }),
  ]);

  // Doctor profile
  await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: { userId: doctorUser.id, specialization: 'General Practice', hospital: 'St Thomas Hospital', hcpcNumber: 'GP12345', hcpcVerified: true, rating: 4.8, bio: 'Experienced GP with 15 years of practice.' },
  });

  // Patient data
  await prisma.allergy.createMany({ data: [{ userId: patient.id, allergen: 'Peanuts', severity: 'severe' }, { userId: patient.id, allergen: 'Shellfish', severity: 'moderate' }], skipDuplicates: true });

  await prisma.healthMetric.createMany({
    data: [
      { userId: patient.id, systolic: 118, diastolic: 76, heartRate: 68, oxygenSaturation: 98.5, temperature: 36.6, steps: 8543, sleepHours: 7.5, weight: 62.0, bmi: 22.4 },
      { userId: patient.id, systolic: 122, diastolic: 78, heartRate: 72, oxygenSaturation: 98.0, temperature: 36.7, steps: 9200, sleepHours: 8.0, weight: 62.2, bmi: 22.5 },
    ],
    skipDuplicates: true,
  });

  const apptDate1 = new Date(); apptDate1.setDate(apptDate1.getDate() + 3);
  const apptDate2 = new Date(); apptDate2.setDate(apptDate2.getDate() + 7);
  const apptDate3 = new Date(); apptDate3.setDate(apptDate3.getDate() - 5);
  await prisma.appointment.createMany({
    data: [
      { patientId: patient.id, doctorId: doctorUser.id, appointmentDate: apptDate1, appointmentTime: new Date('1970-01-01T10:00:00'), reason: 'Annual check-up', type: 'general', status: 'confirmed' },
      { patientId: patient.id, doctorId: doctorUser.id, appointmentDate: apptDate2, appointmentTime: new Date('1970-01-01T14:30:00'), reason: 'Blood pressure review', type: 'follow_up', status: 'pending' },
      { patientId: patient.id, doctorId: doctorUser.id, appointmentDate: apptDate3, appointmentTime: new Date('1970-01-01T09:00:00'), reason: 'Flu symptoms', type: 'general', status: 'completed' },
    ],
    skipDuplicates: true,
  });

  await prisma.prescription.createMany({
    data: [
      { patientId: patient.id, doctorId: doctorUser.id, medicationName: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: '30 days', status: 'active' },
      { patientId: patient.id, doctorId: doctorUser.id, medicationName: 'Atorvastatin', dosage: '20mg', frequency: 'Once at night', duration: '90 days', status: 'active' },
    ],
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: [
      { userId: patient.id, type: 'appointment', title: 'Appointment Confirmed', message: 'Your appointment with Dr Emma Hall has been confirmed.' },
      { userId: patient.id, type: 'medication', title: 'Medication Reminder', message: 'Time to take your Lisinopril 10mg.' },
      { userId: patient.id, type: 'system', title: 'Welcome to HealthSphere', message: 'Your account is active. Explore your dashboard!' },
    ],
    skipDuplicates: true,
  });

  // Food database
  await prisma.foodDatabase.createMany({
    data: [
      { name: 'Apple', calories: 95, protein: 0.5, carbs: 25.0, fat: 0.3, fiber: 4.4, allergens: 'None', healthRating: 'excellent' },
      { name: 'Grilled Chicken', calories: 335, protein: 62.5, carbs: 0.0, fat: 7.2, fiber: 0.0, allergens: 'None', healthRating: 'excellent' },
      { name: 'Greek Yogurt', calories: 100, protein: 10.0, carbs: 6.0, fat: 0.7, fiber: 0.0, allergens: 'Milk', healthRating: 'excellent' },
      { name: 'Brown Rice', calories: 216, protein: 5.0, carbs: 45.0, fat: 1.8, fiber: 3.5, allergens: 'None', healthRating: 'good' },
      { name: 'Salmon Fillet', calories: 367, protein: 39.0, carbs: 0.0, fat: 22.0, fiber: 0.0, allergens: 'Fish', healthRating: 'excellent' },
      { name: 'Banana', calories: 105, protein: 1.3, carbs: 27.0, fat: 0.4, fiber: 3.1, allergens: 'None', healthRating: 'good' },
      { name: 'Oatmeal', calories: 158, protein: 6.0, carbs: 27.0, fat: 3.6, fiber: 4.0, allergens: 'Oats', healthRating: 'excellent' },
      { name: 'Mixed Nuts', calories: 173, protein: 5.0, carbs: 6.0, fat: 16.0, fiber: 2.0, allergens: 'Tree Nuts, Peanuts', healthRating: 'good' },
    ],
    skipDuplicates: true,
  });

  // Genetic diseases
  await prisma.geneticDisease.createMany({
    data: [
      { name: 'Familial Hypercholesterolaemia', inheritanceType: 'Autosomal Dominant', symptoms: 'High LDL cholesterol, chest pain, xanthomas', foodTriggers: 'Saturated fats, trans fats', exerciseGuidance: 'Regular aerobic exercise 30 min/day', carePlan: 'Statins, dietary changes, regular monitoring' },
      { name: 'Type 2 Diabetes Predisposition', inheritanceType: 'Polygenic', symptoms: 'Insulin resistance, fatigue, frequent urination', foodTriggers: 'High glycemic index foods, sugary drinks', exerciseGuidance: 'Moderate intensity exercise, weight management', carePlan: 'Blood glucose monitoring, dietary management' },
      { name: 'Coeliac Disease', inheritanceType: 'HLA-linked', symptoms: 'Abdominal pain, diarrhoea, nutrient malabsorption', foodTriggers: 'Wheat, barley, rye', exerciseGuidance: 'All exercises safe on gluten-free diet', carePlan: 'Strict gluten-free diet, supplementation' },
    ],
    skipDuplicates: true,
  });

  console.log('\n✅ Seed complete!');
  console.log('Demo accounts (password: "password"):');
  ['emma.patel007@gmail.com','doctor@healthsphere.com','admin@healthsphere.com','govt@healthsphere.com'].forEach(e => console.log(' ', e));
  await prisma.$disconnect();
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
