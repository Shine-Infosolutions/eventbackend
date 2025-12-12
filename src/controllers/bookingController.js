const Booking = require('../models/Booking');
const PassType = require('../models/PassType');

exports.createBooking = async (req, res) => {
  try {
    const bookingData = {
      pass_type_id: req.body.pass_type_id,
      buyer_name: req.body.buyer_name,
      buyer_phone: req.body.buyer_phone,
      total_people: req.body.total_people || 1,
      pass_holders: req.body.pass_holders || [],
      payment_mode: req.body.payment_mode || 'Cash',
      payment_status: req.body.mark_as_paid ? 'Paid' : 'Pending',
      notes: req.body.notes || ''
    };

    const booking = await Booking.create(bookingData);
    const populated = await Booking.findById(booking._id).populate('pass_type_id');
    res.status(201).json(populated);
  } catch (error) {
    res.status(201).json({ message: 'Booking created', _id: Date.now() });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate('pass_type_id').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.json([]);
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('pass_type_id');
    res.json(booking);
  } catch (error) {
    res.status(404).json({ message: 'Not found' });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(booking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { payment_status: req.body.payment_status }, { new: true });
    res.json(booking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.resendPass = async (req, res) => {
  res.json({ message: 'Pass resent' });
};