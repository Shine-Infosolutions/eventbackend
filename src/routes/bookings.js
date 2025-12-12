const express = require('express');
const { 
  createBooking, 
  getBookings, 
  getBooking,
  updateBooking,
  updatePaymentStatus,
  resendPass
} = require('../controllers/bookingController');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, authorize('Admin', 'Sales Staff'), createBooking);
router.post('/force', auth, authorize('Admin', 'Sales Staff'), (req, res) => {
  const Booking = require('../models/Booking');
  const { pass_type_id, buyer_name, buyer_phone, payment_mode, notes, total_people, mark_as_paid, pass_holders } = req.body;
  
  const booking = new Booking({
    pass_type_id,
    buyer_name,
    buyer_phone,
    total_people: total_people || 1,
    pass_holders: pass_holders || [],
    payment_mode: payment_mode || 'Cash',
    payment_status: mark_as_paid ? 'Paid' : 'Pending',
    notes: notes || ''
  });
  
  booking.save({ validateBeforeSave: false })
    .then(saved => Booking.findById(saved._id).populate('pass_type_id'))
    .then(populated => res.status(201).json(populated))
    .catch(error => res.status(400).json({ message: error.message }));
});
router.get('/', auth, getBookings);
router.get('/:id/public', getBooking); // Public route for pass viewing
router.get('/:id', auth, getBooking);
router.put('/:id', auth, authorize('Admin'), updateBooking);
router.put('/:id/payment', auth, authorize('Admin', 'Sales Staff'), updatePaymentStatus);
router.post('/:id/resend', auth, authorize('Admin', 'Sales Staff'), resendPass);

module.exports = router;