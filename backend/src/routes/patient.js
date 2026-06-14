const router = require('express').Router();
const ctrl = require('../controllers/patientController');
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate, requireRole('patient'));

router.get('/dashboard', ctrl.getDashboard);
router.get('/metrics', ctrl.getMetrics);
router.post('/metrics', ctrl.addMetric);
router.get('/appointments', ctrl.getAppointments);
router.get('/appointments/calendar', ctrl.getAppointmentsCalendar);
router.post('/appointments', ctrl.bookAppointment);
router.put('/appointments/:id/cancel', ctrl.cancelAppointment);
router.put('/appointments/:id/move', ctrl.moveAppointment);
router.get('/medical-records', ctrl.getMedicalRecords);
router.get('/diet', ctrl.getDietLogs);
router.post('/diet', ctrl.addDietLog);
router.delete('/diet/:id', ctrl.deleteDietLog);
router.post('/water', ctrl.addWaterLog);
router.get('/notifications', ctrl.getNotifications);
router.put('/notifications/:id/read', ctrl.markNotificationRead);
router.put('/notifications/read-all', ctrl.markAllNotificationsRead);
router.get('/documents', ctrl.getDocuments);
router.post('/documents', upload.single('doc_file'), ctrl.uploadDocument);
router.delete('/documents/:id', ctrl.deleteDocument);
router.get('/nhs-search', ctrl.nhsSearch);
router.get('/nhs-condition', ctrl.nhsCondition);
router.get('/doctors', ctrl.getDoctors);
router.get('/doctors/:id/slots', ctrl.getDoctorSlots);
router.get('/family-history', ctrl.getFamilyHistory);
router.post('/family-history', ctrl.addFamilyHistory);
router.delete('/family-history/:id', ctrl.deleteFamilyHistory);
router.get('/prescriptions', ctrl.getPrescriptionsWithOrders);
router.get('/prescription-orders', ctrl.getPrescriptionOrders);
router.post('/prescriptions/payment-intent', ctrl.createPrescriptionPaymentIntent);
router.post('/prescription-orders', ctrl.placePrescriptionOrder);
router.put('/prescription-orders/:id/cancel', ctrl.cancelPrescriptionOrder);
router.get('/questionnaire', ctrl.getQuestionnaire);
router.post('/questionnaire/answer', ctrl.saveQuestionnaireAnswer);
router.post('/questionnaire/complete', ctrl.completeQuestionnaire);
router.get('/safe-appetite', ctrl.getSafeAppetiteProfile);
router.post('/safe-appetite/preferences', ctrl.saveSafeAppetitePreferences);
router.post('/safe-appetite/scan', ctrl.scanSafeAppetiteIngredients);
router.delete('/safe-appetite/scan/:id', ctrl.deleteSafeAppetiteScan);
router.get('/wearable', ctrl.getWearableStatus);
router.post('/wearable/connect', ctrl.connectWearable);
router.delete('/wearable/connect', ctrl.disconnectWearable);
router.post('/wearable/sync', ctrl.syncWearable);

module.exports = router;
