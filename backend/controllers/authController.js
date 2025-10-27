const db = require('../config/database');
// const twilio = require('twilio');
// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendOtp = async (req, res) => {
  try {
    const { phone, cell_phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const [results] = await db.query('SELECT * FROM customers WHERE cell_phone = ?', [phone]);
    if (results.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      'DELETE FROM otps WHERE phone = ?',
      [phone]
    );

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
    //   console.log(`✅ OTP sent via SMS to ${formattedPhone}`);
    // } catch (twilioError) {
    //   console.error('❌ Twilio SMS failed:', twilioError.message);
    //   return res.status(500).json({ error: 'Failed to send OTP via SMS' });
    // }

    console.log(`OTP for ${phone}: ${otp}`);

    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const [otps] = await db.query(
      'SELECT * FROM otps WHERE phone = ? AND otp = ? AND expires_at > NOW()',
      [phone, otp]
    );

    if (otps.length === 0) {
      return res.status(400).json({ 
        authenticated: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    await db.query('DELETE FROM otps WHERE phone = ?', [phone]);

    res.json({ 
      authenticated: true, 
      message: 'OTP verified successfully' 
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

module.exports = {
  sendOtp,
  verifyOtp
};
