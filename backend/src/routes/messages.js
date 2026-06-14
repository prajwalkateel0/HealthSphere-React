const router = require('express').Router();
const ctrl = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/conversations', ctrl.getConversations);
router.get('/:userId', ctrl.getMessages);
router.post('/', ctrl.sendMessage);

module.exports = router;
