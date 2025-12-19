const Booking = require('../models/Booking');
const PassType = require('../models/PassType');

// Helper function to generate booking number based on pass type
const generateBookingNumber = async (passTypeName) => {
  let prefix;
  let startNumber;
  
  switch (passTypeName.toLowerCase()) {
    case 'teens':
      prefix = '';
      startNumber = 2001;
      break;
    case 'couple':
      prefix = '';
      startNumber = 1;
      break;
    case 'family':
      prefix = '';
      startNumber = 1001;
      break;
    default:
      prefix = 'NY2025-';
      startNumber = 1;
  }
  
  // Find the highest booking number for this pass type
  const lastBooking = await Booking.findOne({
    booking_number: { $regex: `^${startNumber}` }
  }).sort({ booking_number: -1 });
  
  let nextNumber;
  if (lastBooking && lastBooking.booking_number) {
    const lastNum = parseInt(lastBooking.booking_number.replace(prefix, ''));
    nextNumber = lastNum + 1;
  } else {
    nextNumber = startNumber;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

exports.createBooking = async (req, res) => {
  try {
    const passType = await PassType.findById(req.body.pass_type_id);
    if (!passType) {
      return res.status(400).json({ message: 'Invalid pass type' });
    }

    // Generate custom booking number
    const bookingNumber = await generateBookingNumber(passType.name);

    const totalPasses = req.body.total_passes || 1;
    const calculatedAmount = passType.price * totalPasses;
    
    console.log('Creating booking with total_amount:', calculatedAmount);
    
    const bookingData = {
      pass_type_id: req.body.pass_type_id,
      buyer_name: req.body.buyer_name,
      buyer_phone: req.body.buyer_phone,
      pass_holders: req.body.pass_holders || [],
      people_entered: 0,
      total_people: parseInt(req.body.total_people) || passType.max_people,
      total_amount: calculatedAmount,
      payment_status: req.body.payment_status || (req.body.mark_as_paid ? 'Paid' : 'Pending'),
      payment_mode: req.body.payment_mode || 'Cash',
      notes: req.body.notes || '',
      payment_screenshot: req.body.payment_screenshot || null,
      booking_number: bookingNumber
    };
    
    console.log('Booking data before save:', bookingData);
    const booking = new Booking(bookingData);

    const savedBooking = await booking.save();
    console.log('Saved booking total_amount:', savedBooking.total_amount);
    
    // Force update total_amount if not saved
    await Booking.findByIdAndUpdate(savedBooking._id, { total_amount: calculatedAmount });
    
    const response = savedBooking.toJSON();
    response.pass_type_name = passType.name;
    response.pass_type_price = passType.price;
    response.total_amount = calculatedAmount;
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('pass_type_id')
      .sort({ createdAt: -1 })
      .lean();
    
    const bookingsWithId = bookings.map(booking => ({
      ...booking,
      booking_id: booking.booking_number || `NY2025-${booking._id.toString().slice(-6)}`,
      pass_holders: booking.pass_holders || [],
      people_entered: booking.people_entered || 0,
      total_amount: booking.total_amount || 0,
      payment_screenshot: booking.payment_screenshot || null,
      notes: booking.notes || ''
    }));
    
    res.json(bookingsWithId);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('pass_type_id').lean();
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const bookingWithId = {
      ...booking,
      booking_id: booking.booking_number || `NY2025-${booking._id.toString().slice(-6)}`,
      pass_holders: booking.pass_holders || [],
      people_entered: booking.people_entered || 0,
      total_amount: booking.total_amount || 0,
      payment_screenshot: booking.payment_screenshot || null,
      notes: booking.notes || ''
    };
    
    res.json(bookingWithId);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(404).json({ message: 'Booking not found' });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('pass_type_id').lean();
    const bookingWithId = {
      ...booking,
      booking_id: booking.booking_number || `NY2025-${booking._id.toString().slice(-6)}`,
      pass_holders: booking.pass_holders || [],
      people_entered: booking.people_entered || 0,
      total_amount: booking.total_amount || 0,
      payment_screenshot: booking.payment_screenshot || null,
      notes: booking.notes || ''
    };
    res.json(bookingWithId);
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

exports.getNextBookingNumber = async (req, res) => {
  try {
    const { passType } = req.query;
    
    let startNumber;
    switch (passType.toLowerCase()) {
      case 'teens':
        startNumber = 2001;
        break;
      case 'couple':
        startNumber = 1;
        break;
      case 'family':
        startNumber = 1001;
        break;
      default:
        startNumber = 1;
    }
    
    const lastBooking = await Booking.findOne({
      booking_number: { $regex: `^${startNumber}` }
    }).sort({ booking_number: -1 });
    
    let nextNumber;
    if (lastBooking && lastBooking.booking_number) {
      const lastNum = parseInt(lastBooking.booking_number);
      nextNumber = lastNum + 1;
    } else {
      nextNumber = startNumber;
    }
    
    res.json({ nextNumber: nextNumber.toString().padStart(4, '0') });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.debugData = async (req, res) => {
  try {
    const passTypes = await PassType.find({});
    const bookings = await Booking.find({}).limit(3);
    
    res.json({
      passTypes: passTypes,
      sampleBookings: bookings,
      message: 'Debug data'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

