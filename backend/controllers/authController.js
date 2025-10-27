const db = require('../config/database');

const sendOtp = async (req, res) => {
  try {
    const { phone, cell_phone } = req.body;
    
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'DELETE FROM otps WHERE phone = ?',
      [phone]
    );

    await db.query(
      'INSERT INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)',
      [phone, otp, expiresAt]
    );

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
