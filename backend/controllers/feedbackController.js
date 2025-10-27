const db = require('../config/database');

/**
 * Submits customer feedback
 * 
 * Index suggestions:
 * - CREATE INDEX idx_feedback_user_id ON feedback(user_id)
 * - CREATE INDEX idx_feedback_created_at ON feedback(created_at)
 * - CREATE INDEX idx_feedback_rating ON feedback(rating)
 */
const sendFeedback = async (req, res) => {
  try {
    const { user_id, rating, message, issue, staff_name } = req.body;

    // Validate required fields
    if (!user_id || !rating) {
      return res.status(400).json({ 
        error: 'User ID and rating are required' 
      });
    }

    // Validate rating range (1-5)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        error: 'Rating must be between 1 and 5' 
      });
    }

    // Verify user exists
    const [userCheck] = await db.query(
      'SELECT id FROM customers WHERE id = ?',
      [user_id]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    // Insert feedback
    await db.query(
      'INSERT INTO feedback (user_id, rating, message, issue, staff_name) VALUES (?, ?, ?, ?, ?)',
      [user_id, rating, message || null, issue || null, staff_name || null]
    );

    res.json({ 
      success: true, 
      message: 'Feedback submitted successfully' 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error sending feedback:`, {
      message: error.message,
      userId: req.body.user_id
    });
    
    res.status(500).json({ 
      error: 'Failed to submit feedback',
      errorId 
    });
  }
};

/**
 * Gets customer information for rating page
 */
const getRatingInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ 
        error: 'Valid user ID is required' 
      });
    }

    const [customers] = await db.query(
      'SELECT first_name, last_name, email FROM customers WHERE id = ?',
      [userId]
    );

    if (customers.length === 0) {
      return res.status(404).json({ 
        error: 'Customer not found' 
      });
    }

    res.json(customers[0]);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching rating info:`, {
      message: error.message,
      userId: req.params.userId
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch customer information',
      errorId 
    });
  }
};

/**
 * Gets all feedback with customer information
 * Optimized with single JOIN query
 */
const getAllFeedback = async (req, res) => {
  try {
    const [feedback] = await db.query(`
      SELECT 
        f.id,
        f.user_id,
        f.rating,
        f.message,
        f.issue,
        f.staff_name,
        f.created_at,
        c.first_name,
        c.last_name,
        c.email,
        c.cell_phone
      FROM feedback f
      JOIN customers c ON f.user_id = c.id
      ORDER BY f.created_at DESC
    `);

    res.json(feedback);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching feedback:`, {
      message: error.message
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch feedback',
      errorId 
    });
  }
};

module.exports = {
  sendFeedback,
  getRatingInfo,
  getAllFeedback
};
