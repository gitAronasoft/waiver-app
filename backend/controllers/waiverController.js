const db = require("../config/database");
const addToMailchimp = require("../utils/mailchimp");
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

/**
 * Creates a new waiver for a customer
 * Handles both new and existing customers
 * Uses transaction to ensure data consistency
 *
 * Index suggestions:
 * - CREATE INDEX idx_customers_cell_phone ON customers(cell_phone)
 * - CREATE INDEX idx_minors_customer_id ON minors(customer_id)
 */
const createWaiver = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      first_name,
      last_name,
      email,
      dob,     
      address,
      city,
      province,
      postal_code,
      country_code,
      cell_phone,
      cc_cell_phone,
      minors,
      send_otp,
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !cell_phone) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        error: "Missing required fields",
        details: "First name, last name, and cell phone are required",
      });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    let customerId;

    const [existingCustomer] = await connection.query(
      "SELECT id FROM customers WHERE cell_phone = ?",
      [cell_phone],
    );

    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;

      await connection.query(
        `UPDATE customers SET 
          first_name = ?, last_name = ?, email = ?, 
          dob = ?, address = ?, city = ?, province = ?, 
          postal_code = ?, country_code = ?, updated_at = NOW()
        WHERE id = ?`,
        [
          first_name,
          last_name,
          email,
          dob,      
          address,
          city,
          province,
          postal_code,
          country_code,
          customerId,
        ],
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO customers 
        (first_name, last_name, email, dob, address, city, 
         province, postal_code, country_code, cell_phone, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          first_name,
          last_name,
          email,
          dob, 
          address,
          city,
          province,
          postal_code,
          country_code,
          cell_phone,
        ],
      );
      customerId = result.insertId;
    }

    // Delete existing minors for this customer
    await connection.query("DELETE FROM minors WHERE customer_id = ?", [
      customerId,
    ]);

    // Batch insert minors if any
    if (minors && minors.length > 0) {
      const minorValues = minors.map((minor) => [
        customerId,
        minor.first_name,
        minor.last_name,
        minor.dob,
        1,
      ]);

      await connection.query(
        "INSERT INTO minors (customer_id, first_name, last_name, dob, status) VALUES ?",
        [minorValues],
      );
    }

    // Create waiver form entry
    const [waiverResult] = await connection.query(
      "INSERT INTO waiver_forms (customer_id, signed_at, completed, verified_by_staff, staff_id) VALUES (?, NULL, 0, 0, 0)",
      [customerId],
    );

    const waiverId = waiverResult.insertId;

    // SEND OTP TO NEW CUSTOMERS via SMS
    // Only send OTP if this is a NEW customer and send_otp is true
    if (send_otp && existingCustomer.length === 0) {
      try {
        // Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

        // Delete any existing OTPs for this phone number
        await connection.query("DELETE FROM otps WHERE phone = ?", [
          cell_phone,
        ]);

        // Insert new OTP
        await connection.query(
          "INSERT INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)",
          [cell_phone, otp, expiresAt],
        );

        console.log(
          `📝 OTP stored in database for new customer - Phone: ${cell_phone}, OTP: ${otp}`,
        );

        // Send OTP via SMS
        let formattedPhone = cc_cell_phone || `${country_code}${cell_phone}`;
        if (!formattedPhone.startsWith("+")) {
          formattedPhone = `+1${formattedPhone}`;
        }

        try {
          await client.messages.create({
            body: `Your verification code is ${otp} for your Skate & Play waiver. Enjoy your roller skating session.`,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: formattedPhone,
          });
          console.log(
            `✅ OTP SMS sent to new customer ${formattedPhone}: ${otp}`,
          );
        } catch (twilioError) {
          console.error(
            `⚠️ Twilio SMS failed for new customer:`,
            twilioError.message,
          );
          // Don't fail the request if SMS fails
        }

        // Log OTP in development
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] OTP for new customer ${cell_phone}: ${otp}`);
        }
      } catch (otpError) {
        console.error(
          "⚠️ Error generating OTP for new customer:",
          otpError.message,
        );
        // Don't fail the waiver creation if OTP fails
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: send_otp
        ? "Waiver created and OTP sent successfully"
        : "Waiver created successfully",
      customerId,
      waiverId,
    });
  } catch (error) {
    await connection.rollback();

    // Log error details for debugging
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error creating waiver:`, {
      message: error.message,
      stack: error.stack,
    });

    // Send sanitized error to client
    res.status(500).json({
      error: "Failed to create waiver",
      errorId,
      message: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Gets customer information by phone number
 * Includes associated minors
 */
const getCustomerInfo = async (req, res) => {
  try {
    const { phone } = req.query;

    // Validate phone parameter
    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required",
      });
    }

    const [customers] = await db.query(
      "SELECT * FROM customers WHERE cell_phone = ?",
      [phone],
    );

    if (customers.length === 0) {
      return res.status(404).json({
        error: "Customer not found",
      });
    }

    const customer = customers[0];

    const [minors] = await db.query(
      "SELECT * FROM minors WHERE customer_id = ? AND status = 1",
      [customer.id],
    );

    res.json({ customer, minors });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching customer info:`, {
      message: error.message,
      phone: req.query.phone,
    });

    res.status(500).json({
      error: "Failed to fetch customer information",
      errorId,
    });
  }
};

/**
 * Updates customer information and associated minors
 */
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
      minors,
    } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({
        error: "Customer ID is required",
      });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Check if customer exists
    const [existingCustomer] = await db.query(
      "SELECT id FROM customers WHERE id = ?",
      [id],
    );

    if (existingCustomer.length === 0) {
      return res.status(404).json({
        error: "Customer not found",
      });
    }

    await db.query(
      `UPDATE customers SET 
        first_name = ?, last_name = ?, email = ?, dob = ?, 
        address = ?, city = ?, province = ?, postal_code = ?, 
        cell_phone = ?, updated_at = NOW()
      WHERE id = ?`,
      [
        first_name,
        last_name,
        email,
        dob,
        address,
        city,
        province,
        postal_code,
        cell_phone,       
        id,
      ],
    );

    // Update minors if provided
    if (minors && minors.length > 0) {
      for (const minor of minors) {
        if (minor.isNew) {
          await db.query(
            "INSERT INTO minors (customer_id, first_name, last_name, dob, status) VALUES (?, ?, ?, ?, ?)",
            [
              id,
              minor.first_name,
              minor.last_name,
              minor.dob,
              minor.checked ? 1 : 0,
            ],
          );
        } else {
          await db.query(
            "UPDATE minors SET first_name = ?, last_name = ?, dob = ?, status = ? WHERE id = ?",
            [
              minor.first_name,
              minor.last_name,
              minor.dob,
              minor.checked ? 1 : 0,
              minor.id,
            ],
          );
        }
      }
    }

    res.json({
      success: true,
      message: "Customer updated successfully",
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error updating customer:`, {
      message: error.message,
      customerId: req.body.id,
    });

    res.status(500).json({
      error: "Failed to update customer",
      errorId,
    });
  }
};

/**
 * Saves customer signature to waiver form and updates minors
 */
const saveSignature = async (req, res) => {
  try {
    const {
      id,
      phone,
      signature,
      fullName,
      date,
      minors,
      subscribed,
      consented,
    } = req.body;

    // Validate required fields
    if (!id || !signature) {
      return res.status(400).json({
        error: "Customer ID and signature are required",
      });
    }

    // Handle minors: add, update, and remove
    // Get existing minors from database
    const [existingMinors] = await db.query(
      "SELECT id FROM minors WHERE customer_id = ?",
      [id],
    );
    
    const existingMinorIds = existingMinors.map(m => m.id);
    const submittedMinorIds = [];

    // Process submitted minors (add new or update existing)
    if (minors && minors.length > 0) {
      for (const minor of minors) {
        if (minor.isNew) {
          // Insert new minor
          await db.query(
            "INSERT INTO minors (customer_id, first_name, last_name, dob, status) VALUES (?, ?, ?, ?, ?)",
            [
              id,
              minor.first_name,
              minor.last_name,
              minor.dob,
              minor.checked ? 1 : 0,
            ],
          );
        } else if (minor.id) {
          // Update existing minor
          submittedMinorIds.push(minor.id);
          await db.query(
            "UPDATE minors SET first_name = ?, last_name = ?, dob = ?, status = ? WHERE id = ?",
            [
              minor.first_name,
              minor.last_name,
              minor.dob,
              minor.checked ? 1 : 0,
              minor.id,
            ],
          );
        }
      }
    }

    // Delete minors that were removed (exist in DB but not in submitted list)
    const minorsToDelete = existingMinorIds.filter(id => !submittedMinorIds.includes(id));
    if (minorsToDelete.length > 0) {
      await db.query(
        "DELETE FROM minors WHERE id IN (?)",
        [minorsToDelete],
      );
      console.log(`🗑️ Deleted ${minorsToDelete.length} minor(s) from customer ${id}`);
    }

    // Get or create waiver form
    const [waivers] = await db.query(
      "SELECT id FROM waiver_forms WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1",
      [id],
    );

    let waiverId;
    if (waivers.length > 0) {
      waiverId = waivers[0].id;
      await db.query(
        "UPDATE waiver_forms SET signature_image = ?, signed_at = NOW() WHERE id = ?",
        [signature, waiverId],
      );
    } else {
      const [result] = await db.query(
        "INSERT INTO waiver_forms (customer_id, signature_image, signed_at, completed) VALUES (?, ?, NOW(), 0)",
        [id, signature],
      );
      waiverId = result.insertId;
    }

    res.json({
      success: true,
      message: "Signature saved successfully",
      waiverId,
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error saving signature:`, {
      message: error.message,
      customerId: req.body.id,
    });

    res.status(500).json({
      error: "Failed to save signature",
      errorId,
    });
  }
};

/**
 * Marks waiver rules as accepted and completes the waiver
 */
const acceptRules = async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const [waivers] = await db.query(
      "SELECT id FROM waiver_forms WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1",
      [userId],
    );

    if (waivers.length === 0) {
      return res.status(404).json({
        error: "No waiver form found for this user",
      });
    }

    await db.query(
      "UPDATE waiver_forms SET rules_accepted = 1, completed = 1 WHERE id = ?",
      [waivers[0].id],
    );

    // MAILCHIMP INTEGRATION - Auto-subscribe to mailing list
    const [customers] = await db.query("SELECT * FROM customers WHERE id = ?", [
      userId,
    ]);
    if (customers.length > 0) {
      const customer = customers[0];
      try {
        await addToMailchimp(
          customer.email,
          customer.cell_phone,
          customer.first_name,
          customer.last_name,
          customer.dob,
          customer.city,
          customer.address,
        );
        console.log(`✅ Customer ${customer.email} added to Mailchimp`);
      } catch (mailchimpError) {
        console.error(
          "⚠️ Mailchimp integration error:",
          mailchimpError.message,
        );
        // Don't fail the waiver completion if Mailchimp fails
      }
    }

    res.json({
      success: true,
      message: "Rules accepted successfully",
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error accepting rules:`, {
      message: error.message,
      userId: req.body.userId,
    });

    res.status(500).json({
      error: "Failed to accept rules",
      errorId,
    });
  }
};

/**
 * Gets customer information and associated minors by phone number
 * Used by signature page to display customer data and minors
 */
const getMinors = async (req, res) => {
  try {
    const { phone } = req.query;

    // Validate phone parameter
    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required",
      });
    }

    // Fetch complete customer data
    const [customers] = await db.query(
      "SELECT * FROM customers WHERE cell_phone = ?",
      [phone],
    );

    if (customers.length === 0) {
      return res.status(404).json({ 
        error: "Customer not found",
        minors: [] 
      });
    }

    const customer = customers[0];

    // Fetch associated minors
    const [minors] = await db.query(
      "SELECT * FROM minors WHERE customer_id = ?",
      [customer.id],
    );

    // Return customer data with minors (matching what signature page expects)
    res.json({ 
      ...customer,
      minors 
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching customer and minors:`, {
      message: error.message,
      phone: req.query.phone,
    });

    res.status(500).json({
      error: "Failed to fetch customer information",
      errorId,
    });
  }
};

/**
 * Gets all completed waivers with customer and minor information
 * Optimized to avoid N+1 query problem using LEFT JOIN and GROUP_CONCAT
 *
 * Index suggestions:
 * - CREATE INDEX idx_waiver_forms_completed ON waiver_forms(completed, created_at)
 * - CREATE INDEX idx_waiver_forms_user_id ON waiver_forms(user_id)
 * - CREATE INDEX idx_minors_customer_status ON minors(customer_id, status)
 */
const getAllCustomers = async (req, res) => {
  try {
    // Optimized query to fetch all data in a single query using LEFT JOIN
    // GROUP_CONCAT aggregates minors data to avoid N+1 query problem
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
        wf.completed,
        GROUP_CONCAT(
          CONCAT(m.first_name, '|', m.last_name) 
          ORDER BY m.id 
          SEPARATOR '@@'
        ) as minors_data
      FROM waiver_forms wf
      JOIN customers c ON wf.customer_id = c.id
      LEFT JOIN minors m ON m.customer_id = c.id AND m.status = 1
      WHERE wf.completed = 1
      GROUP BY wf.id, c.id, c.first_name, c.last_name, c.cell_phone, c.email, 
               c.address, c.city, c.province, c.postal_code, wf.signed_at, 
               wf.verified_by_staff, wf.rating_email_sent, wf.rating_sms_sent, wf.completed
      ORDER BY wf.created_at DESC
    `);

    // Parse minors data from GROUP_CONCAT result
    const result = waivers.map((waiver) => {
      const minors = [];
      if (waiver.minors_data) {
        const minorEntries = waiver.minors_data.split("@@");
        minorEntries.forEach((entry) => {
          const [first_name, last_name] = entry.split("|");
          if (first_name && last_name) {
            minors.push({ first_name, last_name });
          }
        });
      }

      // Remove minors_data field and add parsed minors array
      const { minors_data, ...waiverData } = waiver;
      return { ...waiverData, minors };
    });

    res.json(result);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching customers:`, {
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to fetch customers",
      errorId,
    });
  }
};

/**
 * Updates waiver verification status
 */
const verifyWaiver = async (req, res) => {
  try {
    const { id } = req.params;
    const { staff_id, verified_by_staff } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({
        error: "Waiver ID is required",
      });
    }

    // Check if waiver exists
    const [existingWaiver] = await db.query(
      "SELECT id FROM waiver_forms WHERE id = ?",
      [id],
    );

    if (existingWaiver.length === 0) {
      return res.status(404).json({
        error: "Waiver not found",
      });
    }

    await db.query(
      "UPDATE waiver_forms SET verified_by_staff = ?, staff_id = ? WHERE id = ?",
      [verified_by_staff, staff_id, id],
    );

    res.json({
      success: true,
      message: "Waiver verification updated",
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error verifying waiver:`, {
      message: error.message,
      waiverId: req.params.id,
    });

    res.status(500).json({
      error: "Failed to verify waiver",
      errorId,
    });
  }
};

/**
 * Gets detailed information about a specific waiver
 * Includes customer and minor information
 */
const getWaiverDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate waiver ID
    if (!id) {
      return res.status(400).json({
        error: "Waiver ID is required",
      });
    }

    const [waivers] = await db.query(
      `
      SELECT 
        c.*,
        wf.id as waiver_id,
        wf.signed_at,
        wf.signature_image,
        wf.rules_accepted,
        wf.verified_by_staff
      FROM waiver_forms wf
      JOIN customers c ON wf.customer_id = c.id
      WHERE wf.id = ?
    `,
      [id],
    );

    if (waivers.length === 0) {
      return res.status(404).json({
        error: "Waiver not found",
      });
    }

    const waiver = waivers[0];

    const [minors] = await db.query(
      "SELECT * FROM minors WHERE customer_id = ?",
      [waiver.id],
    );

    waiver.minors = minors;

    res.json(waiver);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching waiver details:`, {
      message: error.message,
      waiverId: req.params.id,
    });

    res.status(500).json({
      error: "Failed to fetch waiver details",
      errorId,
    });
  }
};

/**
 * Gets waiver history for a customer by phone number
 * Optimized to fetch minors only once instead of in a loop
 */
const getUserHistory = async (req, res) => {
  try {
    const { phone } = req.params;

    // Validate phone parameter
    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required",
      });
    }

    const [customers] = await db.query(
      "SELECT id FROM customers WHERE cell_phone = ?",
      [phone],
    );

    if (customers.length === 0) {
      return res.json({ waivers: [] });
    }

    const customerId = customers[0].id;

    // Fetch waivers and minors in parallel for better performance
    const [waiversResult, minorsResult] = await Promise.all([
      db.query(
        `
        SELECT 
          wf.id,
          wf.signed_at,
          wf.verified_by_staff,
          wf.completed,
          wf.created_at
        FROM waiver_forms wf
        WHERE wf.customer_id = ?
        ORDER BY wf.created_at DESC
      `,
        [customerId],
      ),
      db.query(
        "SELECT first_name, last_name FROM minors WHERE customer_id = ? AND status = 1",
        [customerId],
      ),
    ]);

    const [waivers] = waiversResult;
    const [minors] = minorsResult;

    // Attach same minors list to all waivers (they belong to the customer)
    const waiversWithMinors = waivers.map((waiver) => ({
      ...waiver,
      minors,
    }));

    res.json({ waivers: waiversWithMinors });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching user history:`, {
      message: error.message,
      phone: req.params.phone,
    });

    res.status(500).json({
      error: "Failed to fetch user history",
      errorId,
    });
  }
};

/**
 * Get all waivers with customer and minor details for admin history page
 * Returns formatted data with minors grouped by waiver
 */
const getAllWaivers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.id AS customer_id,
        c.first_name, 
        c.last_name, 
        c.cell_phone, 
        w.id AS waiver_id, 
        w.rating_email_sent,
        w.rating_sms_sent,
        DATE_FORMAT(w.signed_at, '%b %d, %Y at %h:%i %p') AS signed_at, 
        w.verified_by_staff AS status,
        GROUP_CONCAT(
          CONCAT(m.first_name, '::', m.last_name) 
          SEPARATOR '||'
        ) AS minors
      FROM customers c
      JOIN waiver_forms w ON w.customer_id = c.id
      LEFT JOIN minors m ON m.customer_id = c.id AND m.status = 1
      GROUP BY w.id
      ORDER BY w.signed_at DESC
    `);

    // Parse minors into array
    const waivers = rows.map(r => ({
      ...r,
      id: r.customer_id,
      minors: r.minors 
        ? r.minors.split('||').map(n => {
            const [first_name, last_name] = n.split('::');
            return { first_name, last_name };
          })
        : []
    }));

    res.json(waivers);
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching all waivers:`, {
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to fetch waivers",
      errorId,
    });
  }
};

/**
 * Delete a waiver by ID
 */
const deleteWaiver = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Waiver ID is required" });
  }

  try {
    const [result] = await db.query('DELETE FROM waiver_forms WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Waiver not found" });
    }

    console.log(`✅ Waiver deleted successfully: ID ${id}`);
    res.json({ message: 'Waiver deleted successfully' });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error deleting waiver:`, {
      message: error.message,
      waiverId: id,
    });

    res.status(500).json({
      error: "Failed to delete waiver",
      errorId,
    });
  }
};

/**
 * Update waiver status (confirm/unconfirm)
 */
const updateWaiverStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (![0, 1].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be 0 or 1.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE waiver_forms SET verified_by_staff = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Waiver not found" });
    }

    console.log(`✅ Waiver status updated: ID ${id}, Status ${status}`);
    res.json({ message: 'Waiver status updated successfully' });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error updating waiver status:`, {
      message: error.message,
      waiverId: id,
      status,
    });

    res.status(500).json({
      error: "Failed to update waiver status",
      errorId,
    });
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
  getUserHistory,
  getAllWaivers,
  deleteWaiver,
  updateWaiverStatus,
};
