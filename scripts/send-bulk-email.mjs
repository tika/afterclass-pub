#!/usr/bin/env node
/**
 * Send bulk emails from a file containing email addresses (one per line).
 *
 * Usage:
 *   node scripts/send-bulk-email.mjs <emails-file> --subject "Subject" --body "Body text"
 *   node scripts/send-bulk-email.mjs <emails-file> --subject "Subject" --html "<p>HTML body</p>"
 *   node scripts/send-bulk-email.mjs <emails-file> --subject "Subject" --template waitlist
 *
 * Options:
 *   --subject, -s   Email subject (required)
 *   --body, -b      Plain text body
 *   --html, -h      HTML body
 *   --template, -t  Use a predefined template (waitlist, announcement)
 *   --from, -f      From email (default: noreply@afterclass.rsvp)
 *   --dry-run       Preview emails without sending
 *   --delay         Delay between emails in ms (default: 100)
 *
 * Environment:
 *   RESEND_API_KEY  Required. Your Resend API key.
 *
 * Example:
 *   RESEND_API_KEY=re_xxx node scripts/send-bulk-email.mjs emails.txt -s "Hello!" -b "Test email"
 */

import { readFileSync } from "node:fs";
import { Resend } from "resend";

// Parse command line arguments
function parseArgs(args) {
  const result = {
    file: null,
    subject: null,
    body: null,
    html: null,
    template: null,
    from: "noreply@afterclass.rsvp",
    dryRun: false,
    delay: 100,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--subject" || arg === "-s") {
      result.subject = next;
      i++;
    } else if (arg === "--body" || arg === "-b") {
      result.body = next;
      i++;
    } else if (arg === "--html" || arg === "-h") {
      result.html = next;
      i++;
    } else if (arg === "--template" || arg === "-t") {
      result.template = next;
      i++;
    } else if (arg === "--from" || arg === "-f") {
      result.from = next;
      i++;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--delay") {
      result.delay = parseInt(next, 10);
      i++;
    } else if (!arg.startsWith("-") && !result.file) {
      result.file = arg;
    }
  }

  return result;
}

// Predefined templates
const templates = {
  waitlist: {
    subject: "Afterclass is now available at your school!",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #000;">Afterclass is here!</h1>
  <p>Great news - Afterclass is now available at your university!</p>
  <p>You signed up for our waitlist, and we're excited to let you know that you can now download the app and start discovering events on campus.</p>
  <p style="margin: 24px 0;">
    <a href="https://afterclass.rsvp" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Get Started</a>
  </p>
  <p>See you on Afterclass!</p>
  <p style="color: #666; font-size: 14px; margin-top: 32px;">
    If you didn't sign up for the Afterclass waitlist, you can safely ignore this email.
  </p>
</body>
</html>
    `.trim(),
    text: `
Afterclass is here!

Great news - Afterclass is now available at your university!

You signed up for our waitlist, and we're excited to let you know that you can now download the app and start discovering events on campus.

Get started: https://afterclass.rsvp

See you on Afterclass!

If you didn't sign up for the Afterclass waitlist, you can safely ignore this email.
    `.trim(),
  },
  announcement: {
    subject: "An update from Afterclass",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #000;">Hello from Afterclass</h1>
  <p>We have an update to share with you.</p>
  <p style="margin: 24px 0;">
    <a href="https://afterclass.rsvp" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Learn More</a>
  </p>
  <p>Best,<br>The Afterclass Team</p>
</body>
</html>
    `.trim(),
    text: `
Hello from Afterclass

We have an update to share with you.

Learn more: https://afterclass.rsvp

Best,
The Afterclass Team
    `.trim(),
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validate inputs
  if (!args.file) {
    console.error("Error: Please provide an email file as the first argument");
    console.error(
      "Usage: node scripts/send-bulk-email.mjs <emails-file> --subject 'Subject' --body 'Body'",
    );
    process.exit(1);
  }

  if (!args.subject && !args.template) {
    console.error("Error: Please provide --subject or --template");
    process.exit(1);
  }

  if (!args.body && !args.html && !args.template) {
    console.error("Error: Please provide --body, --html, or --template");
    process.exit(1);
  }

  // Check for API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey && !args.dryRun) {
    console.error("Error: RESEND_API_KEY environment variable is required");
    console.error("Set it with: RESEND_API_KEY=re_xxx node scripts/send-bulk-email.mjs ...");
    process.exit(1);
  }

  // Read email file
  let emails;
  try {
    const content = readFileSync(args.file, "utf-8");
    emails = content
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && line.includes("@") && !line.startsWith("#"));
  } catch (err) {
    console.error(`Error reading file ${args.file}:`, err.message);
    process.exit(1);
  }

  if (emails.length === 0) {
    console.error("Error: No valid email addresses found in file");
    process.exit(1);
  }

  // Resolve template if specified
  let subject = args.subject;
  let html = args.html;
  let text = args.body;

  if (args.template) {
    const template = templates[args.template];
    if (!template) {
      console.error(`Error: Unknown template '${args.template}'`);
      console.error(`Available templates: ${Object.keys(templates).join(", ")}`);
      process.exit(1);
    }
    subject = args.subject || template.subject;
    html = args.html || template.html;
    text = args.body || template.text;
  }

  // If only body provided, use it as text
  if (text && !html) {
    html = `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap;">${text}</pre>`;
  }

  console.log("\n=== Bulk Email Send ===\n");
  console.log(`From:     ${args.from}`);
  console.log(`Subject:  ${subject}`);
  console.log(`Emails:   ${emails.length} recipients`);
  console.log(`Dry run:  ${args.dryRun ? "YES (no emails will be sent)" : "NO"}`);
  console.log(`Delay:    ${args.delay}ms between emails`);
  console.log("");

  if (args.dryRun) {
    console.log("Recipients:");
    emails.forEach((email, i) => console.log(`  ${i + 1}. ${email}`));
    console.log("\n[DRY RUN] No emails sent.");
    return;
  }

  // Confirm before sending
  console.log("Recipients (first 10):");
  emails.slice(0, 10).forEach((email, i) => console.log(`  ${i + 1}. ${email}`));
  if (emails.length > 10) {
    console.log(`  ... and ${emails.length - 10} more`);
  }
  console.log("");

  // Send emails
  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  const errors = [];

  console.log("Sending emails...\n");

  for (const email of emails) {
    try {
      const result = await resend.emails.send({
        from: args.from,
        to: email,
        subject,
        html,
        text,
      });

      if (result.error) {
        failed++;
        errors.push({ email, error: result.error.message });
        console.log(`  [FAIL] ${email}: ${result.error.message}`);
      } else {
        sent++;
        console.log(`  [OK]   ${email}`);
      }
    } catch (err) {
      failed++;
      errors.push({ email, error: err.message });
      console.log(`  [FAIL] ${email}: ${err.message}`);
    }

    if (args.delay > 0) {
      await sleep(args.delay);
    }
  }

  console.log("\n=== Summary ===\n");
  console.log(`Sent:   ${sent}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(({ email, error }) => console.log(`  ${email}: ${error}`));
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
