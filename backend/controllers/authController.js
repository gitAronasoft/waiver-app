const db = require('../config/database');
// const twilio = require('twilio');
// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Sends OTP to customer's phone for verification
 * 
 * Index suggestions:
 * - CREATE INDEX idx_otps_phone_otp ON otps(phone, otp, expires_at)
 * - CREATE INDEX idx_otps_phone ON otps(phone)
 */
const sendOtp = async (req, res) => {
  try {
    const { phone, cell_phone } = req.body;
    
    // Validate phone number
    if (!phone || phone.trim() === '') {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format' 
      });
    }

    // Check if customer exists
    const [results] = await db.query(
      'SELECT id FROM customers WHERE cell_phone = ?', 
      [phone]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Delete any existing OTPs for this phone number
    await db.query(
      'DELETE FROM otps WHERE phone = ?',
      [phone]
    );

    // Insert new OTP
    await db.query(
      'INSERT INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)',
      [phone, otp, expiresAt]
    );

    // TWILIO SMS - Uncomment when credentials are added
    // let formattedPhone = phone;
    // if (!formattedPhone.startsWith('+')) {
    //   formattedPhone = cell_phone || `+1${phone}`;
    // }
    // 
    // try {
    //   await client.messages.create({
    //     body: `Your verification code is ${otp} for your Skate & Play waiver. Enjoy your roller skating session.`,
    //     messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    //     to: formattedPhone
    //   });
    // } catch (twilioError) {
    //   const errorId = `ERR_${Date.now()}`;
    //   console.error(`[${errorId}] Twilio SMS failed:`, twilioError.message);
    //   return res.status(500).json({ 
    //     error: 'Failed to send OTP via SMS',
    //     errorId 
    //   });
    // }

    // Development mode logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }

    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // Only expose OTP in development for testing
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error sending OTP:`, {
      message: error.message,
      phone: req.body.phone
    });
    
    res.status(500).json({ 
      error: 'Failed to send OTP',
      errorId 
    });
  }
};

/**
 * Verifies OTP entered by customer
 */
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Validate required fields
    if (!phone || !otp) {
      return res.status(400).json({ 
        error: 'Phone number and OTP are required' 
      });
    }

    // Validate OTP format (4 digits)
    if (!/^\d{4}$/.test(otp)) {
      return res.status(400).json({ 
        error: 'Invalid OTP format. Must be 4 digits' 
      });
    }

    // Check OTP validity
    const [otps] = await db.query(
      'SELECT * FROM otps WHERE phone = ? AND otp = ? AND expires_at > NOW()',
      [phone, otp]
    );

    if (otps.length === 0) {
      return res.status(400).json({ 
        authenticated: false, 
        error: 'Invalid or expired OTP' 
      });
    }

    // Delete used OTP
    await db.query('DELETE FROM otps WHERE phone = ?', [phone]);

    res.json({ 
      authenticated: true, 
      message: 'OTP verified successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error verifying OTP:`, {
      message: error.message,
      phone: req.body.phone
    });
    
    res.status(500).json({ 
      error: 'Failed to verify OTP',
      errorId 
    });
  }
};

module.exports = {
  sendOtp,
  verifyOtp
};
