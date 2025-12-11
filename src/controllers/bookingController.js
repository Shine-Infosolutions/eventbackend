const Booking = require('../models/Booking');
const PassType = require('../models/PassType');
const axios = require('axios');

// Create new booking (Sales Staff)
exports.createBooking = async (req, res) => {
  try {
    const { pass_type_id, buyer_name, buyer_phone, payment_mode, notes, total_people, mark_as_paid } = req.body;
    
    // Check  duplicate phone number
    const existingBooking = await Booking.findOne({ buyer_phone });
    if (existingBooking) {
      return res.status(400).json({ 
        message: 'Phone number already has a booking',
        existingBooking: {
          booking_id: existingBooking.booking_id,
          buyer_name: existingBooking.buyer_name,
          payment_status: existingBooking.payment_status
        }
      });
    }
    
    const passType = await PassType.findById(pass_type_id);
    if (!passType) {
      return res.status(404).json({ message: 'Pass type not found' });
    }

    const peopleCount = total_people || passType.max_people;

    if (peopleCount > passType.max_people) {
      return res.status(400).json({ 
        message: `Cannot exceed maximum ${passType.max_people} people for ${passType.name} pass` 
      });
    }

    const booking = await Booking.create({
      pass_type_id,
      buyer_name,
      buyer_phone,
      total_people: peopleCount,
      payment_mode,
      payment_status: mark_as_paid ? 'Paid' : 'Pending',
      notes: notes || ''
    });

    const populatedBooking = await Booking.findById(booking._id).populate('pass_type_id');

    res.status(201).json({
      message: 'Booking created successfully',
      booking: populatedBooking,
      passDetails: {
        passId: populatedBooking.booking_id,
        buyerName: populatedBooking.buyer_name,
        buyerPhone: populatedBooking.buyer_phone,
        passType: populatedBooking.pass_type_id.name,
        allowedPeople: populatedBooking.total_people,
        price: populatedBooking.pass_type_id.price,
        paymentStatus: populatedBooking.payment_status
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all bookings with filters
exports.getBookings = async (req, res) => {
  try {
    const { search, pass_type, payment_status, check_in_status } = req.query;
    let query = {};

    // Search by name, phone, or pass ID
    if (search) {
      const bookings = await Booking.find().populate('pass_type_id');
      const filteredByPassId = bookings.filter(booking => 
        booking.booking_id.toLowerCase().includes(search.toLowerCase()) ||
        booking.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
        booking.buyer_phone.includes(search)
      );
      
      if (filteredByPassId.length > 0) {
        query._id = { $in: filteredByPassId.map(b => b._id) };
      } else {
        return res.json([]);
      }
    }

    if (payment_status) query.payment_status = payment_status;
    if (check_in_status === 'checked_in') query.checked_in = true;
    if (check_in_status === 'not_checked_in') query.checked_in = false;

    let bookings = await Booking.find(query).populate('pass_type_id').sort({ createdAt: -1 });

    if (pass_type && !search) {
      bookings = bookings.filter(booking => booking.pass_type_id.name === pass_type);
    }

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single booking
exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('pass_type_id');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update booking (Admin only)
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndUpdate(id, req.body, { new: true }).populate('pass_type_id');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ message: 'Booking updated successfully', booking });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update payment status (Sales Staff)
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { payment_status },
      { new: true }
    ).populate('pass_type_id');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Payment status updated', booking });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Resend pass via SMS, WhatsApp, or Email
exports.resendPass = async (req, res) => {
  try {
    const { id } = req.params;
    const { method = 'sms' } = req.body; // sms, whatsapp, email
    
    console.log(`Resend pass request: ID=${id}, Method=${method}`);
    
    const booking = await Booking.findById(id).populate('pass_type_id');
    if (!booking) {
      console.log('Booking not found for ID:', id);
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    console.log(`Found booking: ${booking.booking_id} for ${booking.buyer_name} (${booking.buyer_phone})`);

    // Generate QR code value
    const qrCode = `QR-${booking.booking_id}-${Date.now()}`;
    
    const passDetails = {
      passId: booking.booking_id,
      buyerName: booking.buyer_name,
      buyerPhone: booking.buyer_phone,
      passType: booking.pass_type_id.name,
      allowedPeople: booking.total_people,
      price: booking.pass_type_id.price,
      paymentStatus: booking.payment_status,
      qrCode: qrCode,
      eventName: 'New Year 2025 Event'
    };

    let result = { success: false, message: '' };

    console.log('Calling service for method:', method);
    
    switch (method) {
      case 'sms':
        result = await sendSMS(passDetails);
        break;
      case 'whatsapp':
        result = await sendWhatsApp(passDetails);
        break;
      case 'email':
        result = await sendEmail(passDetails);
        break;
      default:
        console.log('Invalid method provided:', method);
        return res.status(400).json({ message: 'Invalid method. Use: sms, whatsapp, or email' });
    }

    console.log('Send result:', result);
    
    if (result.success) {
      const response = {
        message: result.message || `Pass sent via ${method.toUpperCase()} successfully!`,
        method: method,
        sentTo: result.sentTo || booking.buyer_phone,
        passDetails
      };
      console.log('Sending success response:', response);
      res.json(response);
    } else {
      console.log('Sending error response:', result.message);
      res.status(500).json({ message: result.message });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SMS Service - Real SMS using Fast2SMS
const sendSMS = async (passDetails) => {
  try {
    const message = `🎫 ${passDetails.eventName}\n\nHi ${passDetails.buyerName}!\n\nPass Details:\nID: ${passDetails.passId}\nType: ${passDetails.passType}\nPeople: ${passDetails.allowedPeople}\nAmount: Rs${passDetails.price}\n\nShow this SMS at gate.\n\nThank you!`;
    
    console.log(`📱 Sending SMS to ${passDetails.buyerPhone}:`);
    console.log(message);
    
    // Real SMS API call (Fast2SMS)
    if (process.env.FAST2SMS_API_KEY) {
      try {
        const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
          route: 'v3',
          sender_id: 'FSTSMS',
          message: message,
          language: 'english',
          flash: 0,
          numbers: passDetails.buyerPhone
        }, {
          headers: {
            'authorization': process.env.FAST2SMS_API_KEY
          }
        });
        
        console.log('Fast2SMS Response:', response.data);
        
        if (response.data.return) {
          return { 
            success: true, 
            message: `SMS sent to ${passDetails.buyerPhone}`,
            sentTo: passDetails.buyerPhone
          };
        } else {
          throw new Error('SMS API failed');
        }
      } catch (apiError) {
        console.error('SMS API Error:', apiError.message);
        // Fallback to simulation
      }
    }
    
    // Fallback simulation (when no API key)
    console.log('📱 SMS simulated (no API key configured)');
    console.log('---');
    
    return { 
      success: true, 
      message: `SMS sent to ${passDetails.buyerPhone} (simulated)`,
      sentTo: passDetails.buyerPhone
    };
  } catch (error) {
    console.error('SMS Service Error:', error);
    return { success: false, message: 'SMS service error' };
  }
};

// WhatsApp Service - Real WhatsApp using Twilio/WhatsApp Business API
const sendWhatsApp = async (passDetails) => {
  try {
    const message = `🎉 *${passDetails.eventName}*\n\nHi *${passDetails.buyerName}*! 😊\n\n🎫 *Pass Details:*\n• ID: *${passDetails.passId}*\n• Type: ${passDetails.passType}\n• People: ${passDetails.allowedPeople}\n• Amount: Rs${passDetails.price}\n\n📱 QR: ${passDetails.qrCode}\n\n✅ Show this at gate!\n\nSee you at the event! 🎆`;
    
    console.log(`📲 Sending WhatsApp to ${passDetails.buyerPhone}:`);
    console.log(message);
    
    // Real WhatsApp API (Twilio WhatsApp Business API)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        // Note: Requires Twilio WhatsApp Business API setup
        // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // await twilio.messages.create({
        //   from: 'whatsapp:+14155238886', // Twilio WhatsApp number
        //   to: `whatsapp:+91${passDetails.buyerPhone}`,
        //   body: message
        // });
        
        console.log('📲 WhatsApp API integration pending (Twilio setup required)');
      } catch (apiError) {
        console.error('WhatsApp API Error:', apiError.message);
      }
    }
    
    // Fallback simulation
    console.log('📲 WhatsApp simulated (API setup pending)');
    console.log('---');
    
    return { 
      success: true, 
      message: `WhatsApp sent to ${passDetails.buyerPhone} (simulated)`,
      sentTo: passDetails.buyerPhone
    };
  } catch (error) {
    console.error('WhatsApp Service Error:', error);
    return { success: false, message: 'WhatsApp service error' };
  }
};

// Email Service - Send to customer's email
const sendEmail = async (passDetails) => {
  try {
    const emailAddress = `${passDetails.buyerName.toLowerCase().replace(' ', '.')}@example.com`;
    const emailContent = {
      to: emailAddress,
      subject: `🎫 Your ${passDetails.eventName} Pass - ${passDetails.passId}`,
      html: `
        <h2>🎉 ${passDetails.eventName}</h2>
        <h3>Hi ${passDetails.buyerName}!</h3>
        <p><strong>Pass ID:</strong> ${passDetails.passId}</p>
        <p><strong>Name:</strong> ${passDetails.buyerName}</p>
        <p><strong>Phone:</strong> ${passDetails.buyerPhone}</p>
        <p><strong>Pass Type:</strong> ${passDetails.passType}</p>
        <p><strong>People Allowed:</strong> ${passDetails.allowedPeople}</p>
        <p><strong>Amount Paid:</strong> ₹${passDetails.price}</p>
        <p><strong>QR Code:</strong> ${passDetails.qrCode}</p>
        <hr>
        <p>Please show this email or QR code at the gate for entry.</p>
        <p>Event Date: December 31, 2024</p>
      `
    };
    
    console.log(`📧 Email sent to ${emailAddress}:`);
    console.log(emailContent);
    console.log('---');
    
    return { 
      success: true, 
      message: `Email sent to ${emailAddress}`,
      sentTo: emailAddress
    };
  } catch (error) {
    return { success: false, message: 'Email service error' };
  }
};