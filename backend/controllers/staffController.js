const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

    // Generate password reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      { id: staff[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Development mode logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
    }

    // TODO: Send email with reset link when email service is configured
    // await sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: 'Password reset link sent to email',
      // Only expose token in development for testing
      token: process.env.NODE_ENV === 'development' ? resetToken : undefined
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
 * Adds a new staff member
 */
const addStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        error: 'Name, email, password, and role are required' 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new staff member
    const [result] = await db.query(
      'INSERT INTO staff (name, email, password, role, status, profile_image) VALUES (?, ?, ?, ?, 1, "")',
      [name, email, hashedPassword, role]
    );

    res.status(201).json({
      success: true,
      message: 'Staff member added successfully',
      staffId: result.insertId
    });
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
