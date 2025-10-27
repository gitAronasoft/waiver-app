const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

/**
 * Authenticates staff member and returns JWT token
 * 
 * Index suggestions:
 * - CREATE INDEX idx_staff_email ON staff(email)
 * - CREATE INDEX idx_staff_email_status ON staff(email, status)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      const errorId = `ERR_${Date.now()}`;
      console.error(`[${errorId}] JWT_SECRET not configured`);
      return res.status(500).json({ 
        error: 'Server configuration error',
        errorId 
      });
    }

    const [staff] = await db.query(
      'SELECT * FROM staff WHERE email = ?',
      [email]
    );

    // Use same error message for security (don't reveal if email exists)
    if (staff.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const user = staff[0];

    // Check if account is active
    if (user.status !== 1) {
      return res.status(403).json({ 
        error: 'Account is inactive. Please contact administrator' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      staff: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile_image: user.profile_image
      }
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error during login:`, {
      message: error.message,
      email: req.body.email
    });
    
    res.status(500).json({ 
      error: 'Login failed',
      errorId 
    });
  }
};

/**
 * Initiates password reset for staff member
 * Generates JWT token for password reset
 */
const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    const [staff] = await db.query(
      'SELECT id, name FROM staff WHERE email = ?',
      [email]
    );

    if (staff.length === 0) {
      return res.status(404).json({ 
        error: 'Email not found' 
      });
    }

    const user = staff[0];
    const encodedId = Buffer.from(user.id.toString()).toString('base64');
    const encodedEmail = Buffer.from(email).toString('base64');
    const resetBase = process.env.REACT_LINK_BASE || 'http://localhost:3000';
    const resetLink = `${resetBase}/admin/reset-password?id=${encodedId}&email=${encodedEmail}`;

    // Send password reset email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: { rejectUnauthorized: false }
    });

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reset Your Admin Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 0; margin: 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #002244; color: white; padding: 20px; text-align: center;">
                    <h2>Skate & Play Admin Portal</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <p>Hi ${user.name || "Admin"},</p>
                    <p>We received a request to reset your admin portal password.</p>
                    <p style="text-align: center; margin: 30px 0;">
                      <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">Reset Your Password</a>
                    </p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                    <p>Stay safe,<br/>Skate & Play Admin Team</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; background-color: #f1f1f1; padding: 10px; font-size: 12px; color: #888;">
                    &copy; 2025 Skate & Play. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Reset Your Admin Password - Skate & Play',
      html: htmlTemplate
    });

    res.json({
      success: true,
      message: 'Password reset link sent to email'
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error in forget password:`, {
      message: error.message,
      email: req.body.email
    });
    
    res.status(500).json({ 
      error: 'Failed to process password reset request',
      errorId 
    });
  }
};

/**
 * Updates password using reset token
 */
const updatePassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate required fields
    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }

    // Validate password strength (minimum 6 characters)
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Verify and decode JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Password reset link has expired' 
        });
      }
      return res.status(401).json({ 
        error: 'Invalid password reset link' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    const [result] = await db.query(
      'UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, decoded.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error updating password:`, {
      message: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to update password',
      errorId 
    });
  }
};

/**
 * Changes password for authenticated staff member
 */
const changePassword = async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!id || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Staff ID, current password, and new password are required' 
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters long' 
      });
    }

    // Prevent using same password
    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        error: 'New password must be different from current password' 
      });
    }

    const [staff] = await db.query(
      'SELECT password FROM staff WHERE id = ?', 
      [id]
    );

    if (staff.length === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found' 
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, staff[0].password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query(
      'UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error changing password:`, {
      message: error.message,
      staffId: req.body.id
    });
    
    res.status(500).json({ 
      error: 'Failed to change password',
      errorId 
    });
  }
};

/**
 * Gets list of all staff members (excludes passwords)
 */
const getAllStaff = async (req, res) => {
  try {
    const [staff] = await db.query(
      'SELECT id, name, email, role, status, profile_image, created_at FROM staff ORDER BY created_at DESC'
    );

    res.json(staff);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching staff:`, {
      message: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch staff list',
      errorId 
    });
  }
};

/**
 * Gets staff member by ID (excludes password)
 */
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate staff ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Valid staff ID is required' 
      });
    }

    const [staff] = await db.query(
      'SELECT id, name, email, role, status, profile_image FROM staff WHERE id = ?',
      [id]
    );

    if (staff.length === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found' 
      });
    }

    res.json(staff[0]);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching staff:`, {
      message: error.message,
      staffId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch staff details',
      errorId 
    });
  }
};

/**
 * Adds a new staff member and sends setup email
 */
const addStaff = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    // Validate required fields (password is NOT required - sent via email)
    if (!name || !email || !role) {
      return res.status(400).json({ 
        error: 'Name, email, and role are required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'staff'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be admin, manager, or staff' 
      });
    }

    // Check if email already exists
    const [existing] = await db.query(
      'SELECT id FROM staff WHERE email = ?', 
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Email already exists' 
      });
    }

    // Insert new staff member without password (will be set via email link)
    const [result] = await db.query(
      'INSERT INTO staff (name, email, role, status, profile_image, password) VALUES (?, ?, ?, 0, "", "")',
      [name, email, role]
    );

    const insertedId = result.insertId;

    // Generate password setup link
    const encodedId = Buffer.from(insertedId.toString()).toString('base64');
    const encodedEmail = Buffer.from(email).toString('base64');
    const resetBase = process.env.REACT_LINK_BASE || 'http://localhost:3000';
    const setupLink = `${resetBase}/admin/reset-password?id=${encodedId}&email=${encodedEmail}`;

    console.log('📧 Preparing to send welcome email to:', email);
    console.log('🔗 Setup link:', setupLink);
    console.log('📮 SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER
    });

    // Setup nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    // HTML email template with "Set Up Your Account" link
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Welcome to Skate & Play</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 0; margin: 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #fff; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #002244; color: white; padding: 20px; text-align: center;">
                    <h2>Skate & Play Admin Portal</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    <p>Hi ${name},</p>
                    <p>You have been invited to join the Skate & Play admin portal as <b>${role == 1 ? "Admin" : "Staff"}</b>.</p>
                    <p>Click the button below to set your account password:</p>
                    <p style="text-align: center; margin: 30px 0;">
                      <a href="${setupLink}" target="_blank" style="background-color: #f19d39; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
                        Set Up Your Account
                      </a>
                    </p>
                    <p>Welcome aboard!<br/>Skate & Play Admin Team</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; background-color: #f1f1f1; padding: 10px; font-size: 12px; color: #888;">
                    &copy; 2025 Skate & Play. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      console.log('📤 Attempting to send email...');
      const info = await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "Set Up Your Skate & Play Admin Account",
        html: htmlTemplate,
      });

      console.log('✅ Email sent successfully!', info.messageId);
      res.status(201).json({
        success: true,
        message: 'Staff member added successfully. Setup email sent.',
        staffId: insertedId
      });
    } catch (emailError) {
      console.error("❌ Email sending failed:", {
        error: emailError.message,
        code: emailError.code,
        command: emailError.command,
        response: emailError.response,
        responseCode: emailError.responseCode
      });
      // Rollback inserted staff
      await db.query("DELETE FROM staff WHERE id = ?", [insertedId]);
      return res.status(500).json({ 
        error: 'Email sending failed. Staff not added.',
        details: emailError.message
      });
    }
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error adding staff:`, {
      message: error.message,
      email: req.body.email
    });
    
    res.status(500).json({ 
      error: 'Failed to add staff member',
      errorId 
    });
  }
};

/**
 * Updates staff member information
 */
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    // Validate staff ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Valid staff ID is required' 
      });
    }

    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).json({ 
        error: 'Name, email, and role are required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Check if email already exists for different staff member
    const [existing] = await db.query(
      'SELECT id FROM staff WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Email already exists' 
      });
    }

    // Update with or without password
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'Password must be at least 6 characters long' 
        });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE staff SET name = ?, email = ?, role = ?, password = ?, updated_at = NOW() WHERE id = ?',
        [name, email, role, hashedPassword, id]
      );
    } else {
      await db.query(
        'UPDATE staff SET name = ?, email = ?, role = ?, updated_at = NOW() WHERE id = ?',
        [name, email, role, id]
      );
    }

    res.json({ 
      success: true, 
      message: 'Staff member updated successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error updating staff:`, {
      message: error.message,
      staffId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to update staff member',
      errorId 
    });
  }
};

/**
 * Updates staff member's own profile (name and email only)
 */
const updateProfile = async (req, res) => {
  try {
    const { id, name, email } = req.body;

    // Validate required fields
    if (!id || !name || !email) {
      return res.status(400).json({ 
        error: 'Staff ID, name, and email are required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Check if email already exists for different staff member
    const [existing] = await db.query(
      'SELECT id FROM staff WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Email already exists' 
      });
    }

    // Update profile
    const [result] = await db.query(
      'UPDATE staff SET name = ?, email = ?, updated_at = NOW() WHERE id = ?',
      [name, email, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error updating profile:`, {
      message: error.message,
      staffId: req.body.id
    });
    
    res.status(500).json({ 
      error: 'Failed to update profile',
      errorId 
    });
  }
};

/**
 * Updates staff member's status (active/inactive)
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate staff ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Valid staff ID is required' 
      });
    }

    // Validate status
    if (status === undefined || status === null) {
      return res.status(400).json({ 
        error: 'Status is required' 
      });
    }

    if (![0, 1, '0', '1'].includes(status)) {
      return res.status(400).json({ 
        error: 'Status must be 0 (inactive) or 1 (active)' 
      });
    }

    // Update status
    const [result] = await db.query(
      'UPDATE staff SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Status updated successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error updating status:`, {
      message: error.message,
      staffId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to update status',
      errorId 
    });
  }
};

/**
 * Deletes a staff member
 * Note: Consider soft delete instead of hard delete for audit purposes
 */
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate staff ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Valid staff ID is required' 
      });
    }

    // Check if staff member exists
    const [existing] = await db.query(
      'SELECT id FROM staff WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found' 
      });
    }

    // Delete staff member
    await db.query('DELETE FROM staff WHERE id = ?', [id]);

    res.json({ 
      success: true, 
      message: 'Staff member deleted successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error deleting staff:`, {
      message: error.message,
      staffId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to delete staff member',
      errorId 
    });
  }
};

module.exports = {
  login,
  forgetPassword,
  updatePassword,
  changePassword,
  getAllStaff,
  getStaffById,
  addStaff,
  updateStaff,
  updateProfile,
  updateStatus,
  deleteStaff
};
