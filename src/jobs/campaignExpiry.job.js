// src/jobs/campaignExpiry.job.js
const cron = require('node-cron');
const Campaign = require('../models/campaign');
const { logActivity } = require('../services/campaign/activityLog.service');
const { CAMPAIGN_ACTION, CAMPAIGN_STATUS } = require('../constants/campaign.constants');

// Schedule to run daily at midnight
const CRON_SCHEDULE = '0 0 * * *';

/**
 * Starts the campaign expiry job - runs daily to check for expired campaigns
 */
function startCampaignExpiryJob() {
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[campaignExpiry.job] Running daily campaign expiry check...');

    try {
      const now = new Date();

      // Find active campaigns whose end date has passed
      const expiredCampaigns = await Campaign.find({
        status: CAMPAIGN_STATUS.ACTIVE,
        endDate: { $lt: now },
      });

      if (expiredCampaigns.length === 0) {
        console.log('[campaignExpiry.job] No campaigns to expire.');
        return;
      }

      let expiredCount = 0;

      for (const campaign of expiredCampaigns) {
        try {
          // Update campaign status to EXPIRED
          campaign.status = CAMPAIGN_STATUS.EXPIRED;
          await campaign.save();

          // Log the activity
          await logActivity(
            campaign._id,
            CAMPAIGN_ACTION.EXPIRED,
            null,
            { endDate: campaign.endDate }
          );

          expiredCount++;
        } catch (error) {
          console.error(`[campaignExpiry.job] Failed to expire campaign ${campaign._id}: ${error.message}`);
        }
      }

      console.log(`[campaignExpiry.job] Done. ${expiredCount} campaign(s) marked as EXPIRED.`);
    } catch (error) {
      console.error(`[campaignExpiry.job] Failed to run: ${error.message}`);
    }
  });

  console.log(`[campaignExpiry.job] Scheduled to run daily at midnight (cron: "${CRON_SCHEDULE}")`);
}

module.exports = startCampaignExpiryJob;