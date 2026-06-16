const router = require('express').Router();
const ctrl = require('../controllers/medicalTeamController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('pharmacy'));

router.get('/dashboard', ctrl.getDashboard);
router.get('/queue', ctrl.getQueue);
router.put('/queue', ctrl.updateOrderStatus);
router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);

module.exports = router;
