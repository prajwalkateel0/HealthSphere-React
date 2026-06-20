// Unauthenticated routes for server-only logic the Power Apps code app can't
// perform itself (Stripe secret-key calls, etc). The code app now authenticates
// against Dataverse directly, not this backend, so these endpoints can't rely
// on the `authenticate` JWT middleware.
const router = require('express').Router();
const ctrl = require('../controllers/patientController');

router.post('/prescriptions/payment-intent', ctrl.createPrescriptionPaymentIntent);

module.exports = router;
