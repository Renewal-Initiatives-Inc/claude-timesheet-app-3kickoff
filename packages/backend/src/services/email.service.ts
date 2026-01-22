import { ServerClient } from 'postmark';
import { env } from '../config/env.js';

// Initialize Postmark client (only if API key is configured)
let postmarkClient: ServerClient | null = null;
if (env.POSTMARK_API_KEY) {
  postmarkClient = new ServerClient(env.POSTMARK_API_KEY);
}

/**
 * Log email to console in development mode.
 */
function logEmail(to: string, subject: string, htmlBody: string): void {
  console.log('\n========== EMAIL (dev mode) ==========');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:');
  console.log(htmlBody.replace(/<[^>]*>/g, '')); // Strip HTML for readability
  console.log('======================================\n');
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  recipientName: string
): Promise<void> {
  const subject = 'Reset Your Password - Renewal Initiatives';
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>
    <p>Hello ${recipientName},</p>
    <p>We received a request to reset your password for your Renewal Initiatives Timesheet account.</p>
    <p>Click the button below to reset your password:</p>
    <a href="${resetLink}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p><strong>This link will expire in ${env.PASSWORD_RESET_EXPIRES_HOURS} hours.</strong></p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    <div class="footer">
      <p>Renewal Initiatives Timesheet System</p>
      <p>This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;

  // In development without Postmark, log to console
  if (!postmarkClient) {
    logEmail(to, subject, htmlBody);
    return;
  }

  try {
    await postmarkClient.sendEmail({
      From: env.EMAIL_FROM,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `
Hello ${recipientName},

We received a request to reset your password for your Renewal Initiatives Timesheet account.

Click the link below to reset your password:
${resetLink}

This link will expire in ${env.PASSWORD_RESET_EXPIRES_HOURS} hours.

If you didn't request a password reset, you can safely ignore this email.

Renewal Initiatives Timesheet System
      `.trim(),
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    // Don't throw - email failures shouldn't block the user flow
    // In production, this should be logged to a monitoring service
  }
}

/**
 * Send a welcome email with temporary credentials.
 */
export async function sendWelcomeEmail(
  to: string,
  recipientName: string,
  tempPassword: string
): Promise<void> {
  const subject = 'Welcome to Renewal Initiatives Timesheet';
  const loginUrl = `${env.APP_URL}/login`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .credentials {
      background-color: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
    .warning { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to Renewal Initiatives!</h2>
    <p>Hello ${recipientName},</p>
    <p>Your account has been created for the Renewal Initiatives Timesheet System.</p>
    <div class="credentials">
      <p><strong>Your login credentials:</strong></p>
      <p>Email: ${to}</p>
      <p>Temporary Password: <code>${tempPassword}</code></p>
    </div>
    <p class="warning">Please change your password after your first login.</p>
    <a href="${loginUrl}" class="button">Log In Now</a>
    <div class="footer">
      <p>Renewal Initiatives Timesheet System</p>
      <p>This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;

  // In development without Postmark, log to console
  if (!postmarkClient) {
    logEmail(to, subject, htmlBody);
    return;
  }

  try {
    await postmarkClient.sendEmail({
      From: env.EMAIL_FROM,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `
Welcome to Renewal Initiatives!

Hello ${recipientName},

Your account has been created for the Renewal Initiatives Timesheet System.

Your login credentials:
Email: ${to}
Temporary Password: ${tempPassword}

Please change your password after your first login.

Log in at: ${loginUrl}

Renewal Initiatives Timesheet System
      `.trim(),
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - email failures shouldn't block the user flow
  }
}
