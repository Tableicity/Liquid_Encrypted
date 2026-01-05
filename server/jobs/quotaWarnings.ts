import cron from 'node-cron';
import { storage } from '../storage';
import { sendQuotaWarning, sendGracePeriodReminder, verifyEmailConnection } from '../services/emailService';

const THRESHOLDS = [
  { percent: 80, level: 'warning_80' as const },
  { percent: 90, level: 'warning_90' as const },
  { percent: 95, level: 'warning_95' as const },
];

const BYTES_PER_GB = 1024 ** 3;

async function checkThresholds(): Promise<void> {
  console.log('[Quota Job] Checking usage thresholds...');
  
  for (const threshold of THRESHOLDS) {
    try {
      const usersAtThreshold = await storage.getUsersAtThreshold(threshold.percent);
      
      for (const record of usersAtThreshold) {
        const recentWarning = await storage.getRecentQuotaWarning(
          record.userId,
          threshold.level,
          7
        );
        
        if (!recentWarning) {
          const usedGb = (record.usedBytes / BYTES_PER_GB).toFixed(2);
          const quotaGb = (record.quotaBytes / BYTES_PER_GB).toFixed(2);
          
          const sent = await sendQuotaWarning(
            record.user.email,
            threshold.percent,
            usedGb,
            quotaGb
          );
          
          if (sent) {
            await storage.recordQuotaWarning(record.userId, threshold.level);
            console.log(`[Quota Job] Sent ${threshold.percent}% warning to ${record.user.email}`);
          }
        }
      }
    } catch (error) {
      console.error(`[Quota Job] Error checking ${threshold.percent}% threshold:`, error);
    }
  }
}

async function checkGracePeriods(): Promise<void> {
  console.log('[Quota Job] Checking grace periods...');
  
  try {
    const activeGraces = await storage.getActiveGracePeriods();
    
    for (const grace of activeGraces) {
      const gracePeriodEnd = new Date(grace.gracePeriodEnd);
      const now = new Date();
      const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysRemaining > 0 && daysRemaining <= 7) {
        const storageInfo = await storage.getStorageUsageByUserId(grace.userId);
        let overageGb = '0';
        
        if (storageInfo) {
          const overage = Math.max(0, storageInfo.usedBytes - storageInfo.quotaBytes);
          overageGb = (overage / BYTES_PER_GB).toFixed(2);
        }
        
        await sendGracePeriodReminder(grace.user.email, daysRemaining, overageGb);
        
        await storage.updateGracePeriod(grace.id, {
          warningEmailsSent: (grace.warningEmailsSent || 0) + 1,
          updatedAt: new Date()
        });
      }
    }
  } catch (error) {
    console.error('[Quota Job] Error checking grace periods:', error);
  }
}

export async function runQuotaWarningCheck(): Promise<void> {
  console.log('[Quota Job] Running manual quota check...');
  await checkThresholds();
  await checkGracePeriods();
  console.log('[Quota Job] Manual check complete');
}

export function startQuotaWarningJob(): void {
  verifyEmailConnection().then(connected => {
    if (!connected) {
      console.warn('[Quota Job] Email not configured - quota warnings will be logged but not sent');
    }
  });

  cron.schedule('0 */6 * * *', async () => {
    console.log('[Quota Job] Running scheduled check...');
    await checkThresholds();
    await checkGracePeriods();
    console.log('[Quota Job] Scheduled check complete');
  });
  
  console.log('[Quota Job] Scheduled to run every 6 hours');
}
