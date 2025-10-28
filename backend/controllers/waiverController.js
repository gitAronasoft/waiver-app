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

    // ALWAYS create a NEW customer record (even if phone number exists)
    // This allows multiple customers with same phone but different names/addresses
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
    const customerId = result.insertId;
    console.log(`✅ Created new customer (ID: ${customerId}) - Phone: ${cell_phone}`);
    
    // Insert minors for this customer
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
      
      console.log(`✅ Added ${minors.length} minor(s) for customer ${customerId}`);
    }

    // Create waiver form entry
    const [waiverResult] = await connection.query(
      "INSERT INTO waiver_forms (customer_id, signed_at, completed, verified_by_staff, staff_id) VALUES (?, NULL, 0, 0, 0)",
      [customerId],
    );

    const waiverId = waiverResult.insertId;
    console.log(`✅ Created waiver (ID: ${waiverId}) for customer ${customerId}`)

    // SEND OTP via SMS for all new customer signups
    if (send_otp) {
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

    // Order by created_at DESC to get the most recent customer record
    // This ensures that when the same phone number is used for multiple signups,
    // we return the newest customer data instead of the oldest
    const [customers] = await db.query(
      "SELECT * FROM customers WHERE cell_phone = ? ORDER BY created_at DESC LIMIT 1",
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
 * Gets customer information by customer ID
 * Includes associated minors
 */
const getCustomerInfoById = async (req, res) => {
  try {
    const { customerId } = req.query;

    // Validate customerId parameter
    if (!customerId) {
      return res.status(400).json({
        error: "Customer ID is required",
      });
    }

    const [customers] = await db.query(
      "SELECT * FROM customers WHERE id = ? LIMIT 1",
      [customerId],
    );

    if (customers.length === 0) {
      return res.status(404).json({
        error: "Customer not found",
      });
    }

    const customer = customers[0];

    // Get ALL minors for this customer (not just status = 1)
    const [minors] = await db.query(
      "SELECT * FROM minors WHERE customer_id = ?",
      [customer.id],
    );

    res.json({ customer, minors });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching customer info by ID:`, {
      message: error.message,
      customerId: req.query.customerId,
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

    // Minors are already linked to customer via customer_id, no junction table needed
    console.log(`✅ Minors updated for customer ${id}`);

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

    // Minors are already linked to customer via customer_id, no junction table needed
    console.log(`✅ Signature saved for waiver ${waiverId}`);

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
      "SELECT * FROM customers WHERE cell_phone = ? ORDER BY created_at DESC LIMIT 1",
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
    // Filter out verified waivers (only show waivers that need verification)
    const [waivers] = await db.query(`
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.dob,
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
      WHERE wf.completed = 1 AND (wf.verified_by_staff IS NULL OR wf.verified_by_staff = 0)
      GROUP BY wf.id, c.id, c.first_name, c.last_name, c.dob, c.cell_phone, c.email, 
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
        wf.verified_by_staff,
        wf.customer_id
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
    const customerId = waiver.customer_id;

    // Get minors for this customer
    const [minors] = await db.query(
      `SELECT m.* 
       FROM minors m
       WHERE m.customer_id = ? AND m.status = 1`,
      [customerId],
    );

    // Get waiver history for this customer with customer name and staff who verified
    const { convertToEST } = require("../utils/time");
    
    const [waiverHistoryRaw] = await db.query(
      `
      SELECT 
        wf.id,
        wf.signed_at,
        wf.signature_image,
        wf.verified_by_staff,
        wf.rules_accepted,
        CONCAT(c.first_name, ' ', c.last_name) as name,
        CASE 
          WHEN wf.verified_by_staff > 0 THEN CONCAT('Marked by ', s.name)
          ELSE 'Not verified'
        END as markedBy
      FROM waiver_forms wf
      JOIN customers c ON wf.customer_id = c.id
      LEFT JOIN staff s ON wf.verified_by_staff = s.id
      WHERE wf.customer_id = ?
      ORDER BY wf.signed_at DESC
    `,
      [customerId],
    );

    // Format signed_at dates using backend timezone conversion
    const waiverHistory = waiverHistoryRaw.map(w => ({
      ...w,
      date: w.signed_at ? convertToEST(w.signed_at, "MMM DD, YYYY [at] hh:mm A") : null
    }));

    // Return data in the format expected by the frontend
    res.json({
      customer: waiver,
      minors: minors,
      waiverHistory: waiverHistory,
    });
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
    const { convertToEST } = require("../utils/time");

    const [rows] = await db.query(`
      SELECT 
        c.id AS customer_id,
        c.first_name, 
        c.last_name, 
        c.cell_phone, 
        w.id AS waiver_id, 
        w.rating_email_sent,
        w.rating_sms_sent,
        w.signed_at, 
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

    // Parse minors into array and format signed_at using backend timezone conversion
    const waivers = rows.map(r => ({
      ...r,
      id: r.customer_id,
      signed_at: r.signed_at ? convertToEST(r.signed_at, "MMM DD, YYYY [at] hh:mm A") : null,
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

/**
 * Get customer information for rating page
 */
const getRatingInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid customer ID is required' });
    }

    const [customers] = await db.query(
      'SELECT first_name, last_name FROM customers WHERE id = ?',
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({
      first_name: customers[0].first_name,
      last_name: customers[0].last_name
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching rating info:`, {
      message: error.message,
      customerId: req.params.id
    });

    res.status(500).json({
      error: 'Failed to fetch customer information',
      errorId
    });
  }
};

/**
 * Save customer rating
 */
const saveRating = async (req, res) => {
  try {
    const { rating } = req.body;
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid customer ID is required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Insert new feedback row
    const [result] = await db.query(
      'INSERT INTO feedback (user_id, rating) VALUES (?, ?)',
      [id, rating]
    );

    const feedbackId = result.insertId;

    res.json({
      message: 'Rating saved',
      feedbackId
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error saving rating:`, {
      message: error.message,
      customerId: req.params.id
    });

    res.status(500).json({
      error: 'Failed to save rating',
      errorId
    });
  }
};

/**
 * Gets dashboard data for existing customer showing all their visits
 * Returns all customer records with the given phone number
 * Each customer record includes their waivers and waiver-specific minors
 */
const getCustomerDashboard = async (req, res) => {
  try {
    const { phone } = req.query;

    // Validate phone parameter
    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required",
      });
    }

    // Get all customer records with this phone number
    const [customers] = await db.query(
      `SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.dob,
        c.address,
        c.city,
        c.province,
        c.postal_code,
        c.country_code,
        c.cell_phone,
        c.created_at
      FROM customers c
      WHERE c.cell_phone = ?
      ORDER BY c.created_at DESC`,
      [phone],
    );

    if (customers.length === 0) {
      return res.json({ 
        message: "No customer records found for this phone number",
        customers: [] 
      });
    }

    // Get customer IDs for batch queries
    const customerIds = customers.map(c => c.id);

    // Fetch all waivers for these customers
    const [waivers] = await db.query(
      `SELECT 
        wf.id as waiver_id,
        wf.customer_id,
        wf.signed_at,
        wf.signature_image,
        wf.rules_accepted,
        wf.completed,
        wf.verified_by_staff,
        wf.created_at,
        CASE 
          WHEN wf.verified_by_staff > 0 THEN s.name
          ELSE NULL
        END as verified_by_name
      FROM waiver_forms wf
      LEFT JOIN staff s ON wf.verified_by_staff = s.id
      WHERE wf.customer_id IN (?)
      ORDER BY wf.created_at DESC`,
      [customerIds],
    );

    // Get waiver IDs for batch query
    const waiverIds = waivers.map(w => w.waiver_id);

    // Fetch all minors for these customers
    let minorsByCustomerId = {};
    if (customerIds.length > 0) {
      const [minorRecords] = await db.query(
        `SELECT 
          m.customer_id,
          m.id,
          m.first_name,
          m.last_name,
          m.dob,
          m.status
        FROM minors m
        WHERE m.customer_id IN (?) AND m.status = 1`,
        [customerIds],
      );

      // Group minors by customer_id
      minorRecords.forEach(minor => {
        if (!minorsByCustomerId[minor.customer_id]) {
          minorsByCustomerId[minor.customer_id] = [];
        }
        minorsByCustomerId[minor.customer_id].push({
          id: minor.id,
          first_name: minor.first_name,
          last_name: minor.last_name,
          dob: minor.dob,
          status: minor.status
        });
      });
    }

    // Group waivers by customer_id and attach minors
    const waiversByCustomerId = {};
    waivers.forEach(waiver => {
      if (!waiversByCustomerId[waiver.customer_id]) {
        waiversByCustomerId[waiver.customer_id] = [];
      }
      waiversByCustomerId[waiver.customer_id].push({
        ...waiver,
        minors: minorsByCustomerId[waiver.customer_id] || []
      });
    });

    // Combine customers with their waivers
    const customerVisits = customers.map(customer => ({
      ...customer,
      waivers: waiversByCustomerId[customer.id] || []
    }));

    res.json({
      success: true,
      phone: phone,
      totalCustomers: customers.length,
      customers: customerVisits,
    });
  } catch (error) {
    const errorId = `ERR_${Date.now()}`;
    console.error(`[${errorId}] Error fetching customer dashboard:`, {
      message: error.message,
      phone: req.query.phone,
    });

    res.status(500).json({
      error: "Failed to fetch customer dashboard",
      errorId,
    });
  }
};

module.exports = {
  createWaiver,
  getCustomerInfo,
  getCustomerInfoById,
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
  getRatingInfo,
  saveRating,
  getCustomerDashboard,
};
