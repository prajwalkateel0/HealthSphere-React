const router = require('express').Router();
const ctrl = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.post('/scan', ctrl.scanIngredients);
router.post('/chat', ctrl.chat);
router.get('/food-search', ctrl.foodSearch);
router.get('/insights', ctrl.getHealthInsights);
router.get('/context', ctrl.getContext);
router.get('/drug-lookup', ctrl.drugLookup);
router.get('/nhs-medicine', ctrl.nhsMedicine);

module.exports = router;
