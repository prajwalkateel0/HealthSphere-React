// Unauthenticated routes for server-only logic the Power Apps code app can't
// perform itself (Stripe secret-key calls, SMTP, Gemini AI, Google Drive API
// key, Spoonacular/NCBI lookups, HTML scraping). The code app now authenticates
// against Dataverse directly, not this backend, so these endpoints can't rely
// on the `authenticate` JWT middleware. None of these touch Prisma/Postgres —
// the code app supplies whatever Dataverse-derived context a handler needs and
// writes any resulting data back to Dataverse itself.
const router = require('express').Router();
const multer = require('multer');
const path = require('path');

const patientCtrl = require('../controllers/patientController');
const adminCtrl = require('../controllers/adminController');
const aiCtrl = require('../controllers/aiController');
const bridgeCtrl = require('../controllers/bridgeController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/prescriptions/payment-intent', patientCtrl.createPrescriptionPaymentIntent);

router.get('/email/config', bridgeCtrl.emailConfig);
router.post('/email/send', adminCtrl.sendTestEmail);

router.post('/ai/chat', bridgeCtrl.chat);
router.get('/ai/food-search', bridgeCtrl.foodSearchExternal);
router.get('/ai/nhs-medicine', aiCtrl.nhsMedicine);

router.get('/food-database/search-api', adminCtrl.searchFoodAPI);
router.get('/diseases/nlm-search', adminCtrl.searchNLM);

router.post('/wearable/sync', bridgeCtrl.wearableSync);

router.post('/documents/upload', upload.single('doc_file'), bridgeCtrl.uploadDocument);
router.delete('/documents/upload/:filename', bridgeCtrl.deleteDocumentFile);

module.exports = router;
