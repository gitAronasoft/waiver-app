const db = require('../config/database');

const sendFeedback = async (req, res) => {
  try {
    const { user_id, rating, message, issue, staff_name } = req.body;

    await db.query(
      'INSERT INTO feedback (user_id, rating, message, issue, staff_name) VALUES (?, ?, ?, ?, ?)',
      [user_id, rating, message, issue, staff_name]
    );

    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error sending feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

const getRatingInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    const [customers] = await db.query(
      'SELECT first_name, last_name, email FROM customers WHERE id = ?',
      [userId]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customers[0]);
  } catch (error) {
    console.error('Error fetching rating info:', error);
    res.status(500).json({ error: 'Failed to fetch customer info' });
  }
};

const getAllFeedback = async (req, res) => {
  try {
    const [feedback] = await db.query(`
      SELECT 
        f.*,
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
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

module.exports = {
  sendFeedback,
  getRatingInfo,
  getAllFeedback
};
