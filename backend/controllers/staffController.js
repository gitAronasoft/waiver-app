const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [staff] = await db.query(
      'SELECT * FROM staff WHERE email = ?',
      [email]
    );

    if (staff.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = staff[0];

    if (user.status !== 1) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

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
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const [staff] = await db.query(
      'SELECT id, name FROM staff WHERE email = ?',
      [email]
    );

    if (staff.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const resetToken = jwt.sign(
      { id: staff[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'Password reset link sent to email',
      token: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    console.error('Error in forget password:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, decoded.id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    res.status(500).json({ error: 'Failed to update password' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;

    const [staff] = await db.query('SELECT password FROM staff WHERE id = ?', [id]);

    if (staff.length === 0) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, staff[0].password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const [staff] = await db.query(
      'SELECT id, name, email, role, status, profile_image, created_at FROM staff ORDER BY created_at DESC'
    );

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const [staff] = await db.query(
      'SELECT id, name, email, role, status, profile_image FROM staff WHERE id = ?',
      [id]
    );

    if (staff.length === 0) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    res.json(staff[0]);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff details' });
  }
};

const addStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const [existing] = await db.query('SELECT id FROM staff WHERE email = ?', [email]);

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
    console.error('Error adding staff:', error);
    res.status(500).json({ error: 'Failed to add staff member' });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM staff WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    if (password) {
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

    res.json({ success: true, message: 'Staff member updated successfully' });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { id, name, email } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM staff WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    await db.query(
      'UPDATE staff SET name = ?, email = ?, updated_at = NOW() WHERE id = ?',
      [name, email, id]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.query(
      'UPDATE staff SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM staff WHERE id = ?', [id]);

    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
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
