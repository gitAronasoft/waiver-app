const db = require('../config/database');

const createWaiver = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const {
      first_name,
      last_name,
      middle_initial,
      email,
      dob,
      age,
      address,
      city,
      province,
      postal_code,
      country_code,
      cell_phone,
      cc_cell_phone,
      can_email,
      minors,
      send_otp
    } = req.body;

    let customerId;
    
    const [existingCustomer] = await connection.query(
      'SELECT id FROM customers WHERE cell_phone = ?',
      [cell_phone]
    );

    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;
      
      await connection.query(
        `UPDATE customers SET 
          first_name = ?, last_name = ?, middle_initial = ?, email = ?, 
          dob = ?, age = ?, address = ?, city = ?, province = ?, 
          postal_code = ?, country_code = ?, can_email = ?, updated_at = NOW()
        WHERE id = ?`,
        [first_name, last_name, middle_initial, email, dob, age, address, city, 
         province, postal_code, country_code, can_email, customerId]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO customers 
        (first_name, last_name, middle_initial, email, dob, age, address, city, 
         province, postal_code, country_code, cell_phone, can_email, signature, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0)`,
        [first_name, last_name, middle_initial, email, dob, age, address, city, 
         province, postal_code, country_code, cell_phone, can_email]
      );
      customerId = result.insertId;
    }

    await connection.query(
      'DELETE FROM minors WHERE customer_id = ?',
      [customerId]
    );

    if (minors && minors.length > 0) {
      for (const minor of minors) {
        await connection.query(
          'INSERT INTO minors (customer_id, first_name, last_name, dob, status) VALUES (?, ?, ?, ?, 1)',
          [customerId, minor.first_name, minor.last_name, minor.dob]
        );
      }
    }

    const [waiverResult] = await connection.query(
      'INSERT INTO waiver_forms (user_id, signed_at, completed, verified_by_staff, staff_id) VALUES (?, NULL, 0, 0, 0)',
      [customerId]
    );
    
    const waiverId = waiverResult.insertId;

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Waiver created successfully',
      customerId,
      waiverId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating waiver:', error);
    res.status(500).json({ error: 'Failed to create waiver' });
  } finally {
    connection.release();
  }
};

const getCustomerInfo = async (req, res) => {
  try {
    const { phone } = req.query;

    const [customers] = await db.query(
      'SELECT * FROM customers WHERE cell_phone = ?',
      [phone]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customer = customers[0];

    const [minors] = await db.query(
      'SELECT * FROM minors WHERE customer_id = ? AND status = 1',
      [customer.id]
    );

    res.json({ customer, minors });
  } catch (error) {
    console.error('Error fetching customer info:', error);
    res.status(500).json({ error: 'Failed to fetch customer info' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const {
      id,
      first_name,
      last_name,
      email,
      dob,
      address,
      city,
      province,
      postal_code,
      cell_phone,
      can_email,
      minors
    } = req.body;

    await db.query(
      `UPDATE customers SET 
        first_name = ?, last_name = ?, email = ?, dob = ?, 
        address = ?, city = ?, province = ?, postal_code = ?, 
        cell_phone = ?, can_email = ?, updated_at = NOW()
      WHERE id = ?`,
      [first_name, last_name, email, dob, address, city, province, 
       postal_code, cell_phone, can_email, id]
    );

    if (minors && minors.length > 0) {
      for (const minor of minors) {
        if (minor.isNew) {
          await db.query(
            'INSERT INTO minors (customer_id, first_name, last_name, dob, status) VALUES (?, ?, ?, ?, ?)',
            [id, minor.first_name, minor.last_name, minor.dob, minor.checked ? 1 : 0]
          );
        } else {
          await db.query(
            'UPDATE minors SET first_name = ?, last_name = ?, dob = ?, status = ? WHERE id = ?',
            [minor.first_name, minor.last_name, minor.dob, minor.checked ? 1 : 0, minor.id]
          );
        }
      }
    }

    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

const saveSignature = async (req, res) => {
  try {
    const { id, phone, signature, fullName, date, minors, subscribed, consented } = req.body;

    await db.query(
      'UPDATE customers SET signature = ?, updated_at = NOW() WHERE id = ?',
      [signature, id]
    );

    const [waivers] = await db.query(
      'SELECT id FROM waiver_forms WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    let waiverId;
    if (waivers.length > 0) {
      waiverId = waivers[0].id;
      await db.query(
        'UPDATE waiver_forms SET signature_image = ?, signed_at = NOW() WHERE id = ?',
        [signature, waiverId]
      );
    } else {
      const [result] = await db.query(
        'INSERT INTO waiver_forms (user_id, signature_image, signed_at, completed) VALUES (?, ?, NOW(), 0)',
        [id, signature]
      );
      waiverId = result.insertId;
    }

    res.json({ 
      success: true, 
      message: 'Signature saved successfully',
      waiverId
    });
  } catch (error) {
    console.error('Error saving signature:', error);
    res.status(500).json({ error: 'Failed to save signature' });
  }
};

const acceptRules = async (req, res) => {
  try {
    const { userId } = req.body;

    const [waivers] = await db.query(
      'SELECT id FROM waiver_forms WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (waivers.length > 0) {
      await db.query(
        'UPDATE waiver_forms SET rules_accepted = 1, completed = 1 WHERE id = ?',
        [waivers[0].id]
      );
    }

    res.json({ success: true, message: 'Rules accepted successfully' });
  } catch (error) {
    console.error('Error accepting rules:', error);
    res.status(500).json({ error: 'Failed to accept rules' });
  }
};

const getMinors = async (req, res) => {
  try {
    const { phone } = req.query;

    const [customers] = await db.query(
      'SELECT id FROM customers WHERE cell_phone = ?',
      [phone]
    );

    if (customers.length === 0) {
      return res.json({ minors: [] });
    }

    const [minors] = await db.query(
      'SELECT * FROM minors WHERE customer_id = ? AND status = 1',
      [customers[0].id]
    );

    res.json({ minors });
  } catch (error) {
    console.error('Error fetching minors:', error);
    res.status(500).json({ error: 'Failed to fetch minors' });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const [waivers] = await db.query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.cell_phone as phone_number,
        c.email,
        c.address,
        c.city,
        c.province,
        c.postal_code,
        wf.id as waiver_id,
        wf.signed_at,
        wf.verified_by_staff,
        wf.rating_email_sent,
        wf.rating_sms_sent,
        wf.completed
      FROM waiver_forms wf
      JOIN customers c ON wf.user_id = c.id
      WHERE wf.completed = 1
      ORDER BY wf.created_at DESC
    `);

    for (let waiver of waivers) {
      const [minors] = await db.query(
        'SELECT first_name, last_name FROM minors WHERE customer_id = ? AND status = 1',
        [waiver.id]
      );
      waiver.minors = minors;
    }

    res.json(waivers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

const verifyWaiver = async (req, res) => {
  try {
    const { id } = req.params;
    const { staff_id, verified_by_staff } = req.body;

    await db.query(
      'UPDATE waiver_forms SET verified_by_staff = ?, staff_id = ? WHERE id = ?',
      [verified_by_staff, staff_id, id]
    );

    res.json({ success: true, message: 'Waiver verification updated' });
  } catch (error) {
    console.error('Error verifying waiver:', error);
    res.status(500).json({ error: 'Failed to verify waiver' });
  }
};

const getWaiverDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [waivers] = await db.query(`
      SELECT 
        c.*,
        wf.id as waiver_id,
        wf.signed_at,
        wf.signature_image,
        wf.rules_accepted,
        wf.verified_by_staff
      FROM waiver_forms wf
      JOIN customers c ON wf.user_id = c.id
      WHERE wf.id = ?
    `, [id]);

    if (waivers.length === 0) {
      return res.status(404).json({ message: 'Waiver not found' });
    }

    const waiver = waivers[0];

    const [minors] = await db.query(
      'SELECT * FROM minors WHERE customer_id = ?',
      [waiver.id]
    );

    waiver.minors = minors;

    res.json(waiver);
  } catch (error) {
    console.error('Error fetching waiver details:', error);
    res.status(500).json({ error: 'Failed to fetch waiver details' });
  }
};

const getUserHistory = async (req, res) => {
  try {
    const { phone } = req.params;

    const [customers] = await db.query(
      'SELECT id FROM customers WHERE cell_phone = ?',
      [phone]
    );

    if (customers.length === 0) {
      return res.json({ waivers: [] });
    }

    const customerId = customers[0].id;

    const [waivers] = await db.query(`
      SELECT 
        wf.id,
        wf.signed_at,
        wf.verified_by_staff,
        wf.completed,
        wf.created_at
      FROM waiver_forms wf
      WHERE wf.user_id = ?
      ORDER BY wf.created_at DESC
    `, [customerId]);

    for (let waiver of waivers) {
      const [minors] = await db.query(
        'SELECT first_name, last_name FROM minors WHERE customer_id = ?',
        [customerId]
      );
      waiver.minors = minors;
    }

    res.json({ waivers });
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
};

module.exports = {
  createWaiver,
  getCustomerInfo,
  updateCustomer,
  saveSignature,
  acceptRules,
  getMinors,
  getAllCustomers,
  verifyWaiver,
  getWaiverDetails,
  getUserHistory
};
