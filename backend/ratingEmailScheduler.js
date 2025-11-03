const cron = require("node-cron");
const db = require("./config/database");
const { randomUUID } = require("crypto");
const sendRatingEmail = require("./utils/sendRatingEmail");
const sendRatingSMS = require("./utils/sendRatingSMS");

// ⏰ RATING EMAIL/SMS SCHEDULER
// Runs every hour at 0 minutes
// Sends rating requests 3 hours after waiver is signed

cron.schedule("0 * * * *", async () => {
  console.log("🔍 Checking for waivers needing rating messages...");

  try {
    // Get waivers signed 3+ hours ago and not fully sent
    const [waivers] = await db.query(`
      SELECT w.id AS waiver_id, w.*, u.* 
      FROM waivers w
      JOIN users u ON w.user_id = u.id
      WHERE w.signed_at IS NOT NULL
        AND w.completed = 1
        AND TIMESTAMPDIFF(HOUR, w.signed_at, UTC_TIMESTAMP()) >= 3
        AND (w.rating_email_sent != 1 OR w.rating_sms_sent != 1)
    `);

    console.log(`📋 Found ${waivers.length} waivers pending rating messages.`);

    if (waivers.length === 0) {
      console.log("✅ No waivers pending — all caught up!");
      return;
    }

    for (const waiver of waivers) {
      // Skip completely sent (both 1)
      if (waiver.rating_email_sent === 1 && waiver.rating_sms_sent === 1) {
        console.log(
          `⏭️ Skipping waiver ID ${waiver.waiver_id} — already sent both.`
        );
        continue;
      }

      // 🎫 Generate or fetch existing token
      let token;
      try {
        const [existingTokens] = await db.query(
          "SELECT token FROM rating_tokens WHERE waiver_id = ?",
          [waiver.waiver_id]
        );

        if (existingTokens.length > 0) {
          token = existingTokens[0].token;
          console.log(`🔑 Using existing token for waiver ID ${waiver.waiver_id}`);
        } else {
          token = randomUUID();
          await db.query(
            "INSERT INTO rating_tokens (waiver_id, token, used) VALUES (?, ?, 0)",
            [waiver.waiver_id, token]
          );
          console.log(`🆕 Generated new token for waiver ID ${waiver.waiver_id}`);
        }
      } catch (err) {
        console.error(`❌ Token generation failed (waiver ${waiver.waiver_id}): ${err.message}`);
        continue;
      }

      waiver.ratingToken = token;

      // 📧 EMAIL HANDLING
      if (waiver.rating_email_sent !== 1) {
        try {
          if (waiver.email && waiver.email.trim() !== "") {
            await sendRatingEmail(waiver);
            await db.query(
              "UPDATE waivers SET rating_email_sent = 1 WHERE id = ?",
              [waiver.waiver_id]
            );
            console.log(`📨 Email sent to ${waiver.email}`);
          } else {
            await db.query(
              "UPDATE waivers SET rating_email_sent = 2 WHERE id = ?",
              [waiver.waiver_id]
            );
            console.warn(`⚠️ No valid email for waiver ${waiver.waiver_id}, marked failed.`);
          }
        } catch (err) {
          console.error(`❌ Email send failed (waiver ${waiver.waiver_id}): ${err.message}`);
          await db.query(
            "UPDATE waivers SET rating_email_sent = 2 WHERE id = ?",
            [waiver.waiver_id]
          );
        }
      }

      // 📲 SMS HANDLING
      if (waiver.rating_sms_sent !== 1) {
        try {
          if (waiver.cell_phone && waiver.cell_phone.trim() !== "") {
            await sendRatingSMS(waiver);
            await db.query(
              "UPDATE waivers SET rating_sms_sent = 1 WHERE id = ?",
              [waiver.waiver_id]
            );
            console.log(`📲 SMS sent to ${waiver.cell_phone}`);
          } else {
            await db.query(
              "UPDATE waivers SET rating_sms_sent = 2 WHERE id = ?",
              [waiver.waiver_id]
            );
            console.warn(`⚠️ No valid phone for waiver ${waiver.waiver_id}, marked failed.`);
          }
        } catch (err) {
          console.error(`❌ SMS send failed (waiver ${waiver.waiver_id}): ${err.message}`);
          await db.query(
            "UPDATE waivers SET rating_sms_sent = 2 WHERE id = ?",
            [waiver.waiver_id]
          );
        }
      }
    }

    console.log("🏁 Scheduler run complete — all pending waivers processed.");

  } catch (err) {
    console.error("🚨 Rating scheduler query failed:", err.message);
  }
});

console.log("⏰ Rating email/SMS scheduler initialized — runs hourly.");
