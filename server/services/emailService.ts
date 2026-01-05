import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const APP_URL = process.env.APP_URL || 'https://liquid-encrypted.com';
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@liquidencrypted.com';

export async function sendQuotaWarning(
  email: string,
  usagePercent: number,
  usedGb: string,
  quotaGb: string
): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `⚠️ Storage ${usagePercent}% Full - Liquid Encrypted`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">⚠️ Storage Warning</h2>
          <p>Your Liquid Encrypted storage is <strong>${usagePercent}% full</strong>.</p>
          <p>You're currently using <strong>${usedGb} GB</strong> of your <strong>${quotaGb} GB</strong> allocation.</p>
          <p>To avoid interruption to your secure document storage, consider:</p>
          <ul>
            <li>Upgrading your plan for more storage</li>
            <li>Removing unused documents</li>
          </ul>
          <p style="margin-top: 20px;">
            <a href="${APP_URL}/billing" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Upgrade Now
            </a>
          </p>
        </div>
      `,
    });
    console.log(`[Email] Sent ${usagePercent}% quota warning to ${email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send quota warning to ${email}:`, error);
    return false;
  }
}

export async function sendGracePeriodReminder(
  email: string,
  daysRemaining: number,
  overageGb: string
): Promise<boolean> {
  try {
    const urgency = daysRemaining <= 2 ? '🚨' : '⏰';
    const urgencyColor = daysRemaining <= 2 ? '#ef4444' : '#f59e0b';
    
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `${urgency} ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} Left to Resolve Quota - Liquid Encrypted`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${urgencyColor};">${urgency} Grace Period Ending Soon</h2>
          <p>You have <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong> remaining to resolve your storage quota.</p>
          <p>You are currently <strong>${overageGb} GB over</strong> your quota limit.</p>
          <p style="color: #ef4444;">After the grace period expires, you will not be able to upload new documents until you resolve your storage situation.</p>
          <p><strong>Options to resolve:</strong></p>
          <ul>
            <li>Upgrade your plan for more storage</li>
            <li>Delete some existing documents</li>
            <li>Purchase additional storage</li>
          </ul>
          <p style="margin-top: 20px;">
            <a href="${APP_URL}/billing" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Take Action Now
            </a>
          </p>
        </div>
      `,
    });
    console.log(`[Email] Sent grace period reminder (${daysRemaining} days) to ${email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send grace period reminder to ${email}:`, error);
    return false;
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified');
    return true;
  } catch (error) {
    console.warn('[Email] SMTP connection not configured:', error);
    return false;
  }
}
