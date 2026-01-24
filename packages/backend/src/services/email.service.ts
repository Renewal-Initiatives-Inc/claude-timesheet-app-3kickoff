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

/**
 * Send a work permit expiration alert email.
 */
export async function sendWorkPermitExpirationAlert(
  to: string,
  recipientName: string,
  employeeName: string,
  expirationDate: string,
  daysRemaining: number
): Promise<boolean> {
  const subject = 'Action Required: Work Permit Expiring - Renewal Initiatives';
  const dashboardUrl = `${env.APP_URL}/dashboard`;
  const urgencyText = daysRemaining <= 7 ? 'URGENT: ' : '';
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .urgent { background-color: #f8d7da; border-color: #dc3545; }
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
    <h2>${urgencyText}Work Permit Expiration Alert</h2>
    <p>Hello ${recipientName},</p>
    <div class="alert-box ${daysRemaining <= 7 ? 'urgent' : ''}">
      <p><strong>${employeeName}'s work permit will expire on ${expirationDate}.</strong></p>
      <p>Days remaining: <strong>${daysRemaining}</strong></p>
    </div>
    <p>Please ensure a new work permit is uploaded before the expiration date to maintain compliance.</p>
    <p>Without a valid work permit, the employee will be unable to submit timesheets.</p>
    <a href="${dashboardUrl}" class="button">View Dashboard</a>
    <div class="footer">
      <p>Renewal Initiatives Timesheet System</p>
      <p>This is an automated compliance notification.</p>
    </div>
  </div>
</body>
</html>
`;

  if (!postmarkClient) {
    logEmail(to, subject, htmlBody);
    return true;
  }

  try {
    await postmarkClient.sendEmail({
      From: env.EMAIL_FROM,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `
${urgencyText}Work Permit Expiration Alert

Hello ${recipientName},

${employeeName}'s work permit will expire on ${expirationDate}.
Days remaining: ${daysRemaining}

Please ensure a new work permit is uploaded before the expiration date to maintain compliance.
Without a valid work permit, the employee will be unable to submit timesheets.

View dashboard: ${dashboardUrl}

Renewal Initiatives Timesheet System
      `.trim(),
    });
    return true;
  } catch (error) {
    console.error('Failed to send work permit expiration alert:', error);
    return false;
  }
}

/**
 * Send an age transition alert email (employee turning 14).
 */
export async function sendAgeTransitionAlert(
  to: string,
  recipientName: string,
  employeeName: string,
  birthdayDate: string,
  daysUntilBirthday: number
): Promise<boolean> {
  const subject = 'Action Required: Employee Turning 14 - Renewal Initiatives';
  const dashboardUrl = `${env.APP_URL}/dashboard`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box {
      background-color: #d1ecf1;
      border: 1px solid #17a2b8;
      border-radius: 6px;
      padding: 15px;
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
    .requirements { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Age Transition Alert: Employee Turning 14</h2>
    <p>Hello ${recipientName},</p>
    <div class="alert-box">
      <p><strong>${employeeName} will turn 14 on ${birthdayDate}.</strong></p>
      <p>Days until birthday: <strong>${daysUntilBirthday}</strong></p>
    </div>
    <div class="requirements">
      <p><strong>New requirements starting on their 14th birthday:</strong></p>
      <ul>
        <li>Work permit required for all employment</li>
        <li>Different work hour limits apply (14-15 age band)</li>
      </ul>
    </div>
    <p>Please ensure a work permit is uploaded before the birthday to maintain compliance and prevent timesheet submission issues.</p>
    <a href="${dashboardUrl}" class="button">View Dashboard</a>
    <div class="footer">
      <p>Renewal Initiatives Timesheet System</p>
      <p>This is an automated compliance notification.</p>
    </div>
  </div>
</body>
</html>
`;

  if (!postmarkClient) {
    logEmail(to, subject, htmlBody);
    return true;
  }

  try {
    await postmarkClient.sendEmail({
      From: env.EMAIL_FROM,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `
Age Transition Alert: Employee Turning 14

Hello ${recipientName},

${employeeName} will turn 14 on ${birthdayDate}.
Days until birthday: ${daysUntilBirthday}

New requirements starting on their 14th birthday:
- Work permit required for all employment
- Different work hour limits apply (14-15 age band)

Please ensure a work permit is uploaded before the birthday to maintain compliance and prevent timesheet submission issues.

View dashboard: ${dashboardUrl}

Renewal Initiatives Timesheet System
      `.trim(),
    });
    return true;
  } catch (error) {
    console.error('Failed to send age transition alert:', error);
    return false;
  }
}

/**
 * Send a missing document alert email.
 */
export async function sendMissingDocumentAlert(
  to: string,
  recipientName: string,
  employeeName: string,
  missingDocuments: string[]
): Promise<boolean> {
  const subject = 'Action Required: Missing Employee Documents - Renewal Initiatives';
  const dashboardUrl = `${env.APP_URL}/dashboard`;
  const documentList = missingDocuments
    .map((doc) => `<li>${doc}</li>`)
    .join('\n');
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box {
      background-color: #f8d7da;
      border: 1px solid #dc3545;
      border-radius: 6px;
      padding: 15px;
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
  </style>
</head>
<body>
  <div class="container">
    <h2>Missing Documents Alert</h2>
    <p>Hello ${recipientName},</p>
    <div class="alert-box">
      <p><strong>${employeeName} is missing required compliance documents:</strong></p>
      <ul>
        ${documentList}
      </ul>
    </div>
    <p>Without these documents, the employee cannot submit timesheets. Please upload the required documents as soon as possible.</p>
    <a href="${dashboardUrl}" class="button">View Dashboard</a>
    <div class="footer">
      <p>Renewal Initiatives Timesheet System</p>
      <p>This is an automated compliance notification.</p>
    </div>
  </div>
</body>
</html>
`;

  if (!postmarkClient) {
    logEmail(to, subject, htmlBody);
    return true;
  }

  try {
    await postmarkClient.sendEmail({
      From: env.EMAIL_FROM,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `
Missing Documents Alert

Hello ${recipientName},

${employeeName} is missing required compliance documents:
${missingDocuments.map((doc) => `- ${doc}`).join('\n')}

Without these documents, the employee cannot submit timesheets. Please upload the required documents as soon as possible.

View dashboard: ${dashboardUrl}

Renewal Initiatives Timesheet System
      `.trim(),
    });
    return true;
  } catch (error) {
    console.error('Failed to send missing document alert:', error);
    return false;
  }
}
