const express = require('express');
const { searchPass, markEntry, getEntryLogs, getGateBookings } = require('../controllers/gateController');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/bookings', auth, authorize('Gate Staff', 'Admin'), getGateBookings);
router.post('/search', auth, authorize('Gate Staff', 'Admin'), searchPass);
router.post('/checkin', auth, authorize('Gate Staff', 'Admin'), markEntry);
router.get('/logs', auth, authorize('Admin'), getEntryLogs);

module.exports = router;