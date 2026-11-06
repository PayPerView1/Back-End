// src/services/submission/submissionDraft.service.js
const SubmissionDraft = require('../../models/submissionDraft');
const { getAcceptedApplication } = require('../../utils/submission/submissionGuards.utils');

/**
 * Get the submission draft for a creator in a specific campaign
 * @param {ObjectId|string} creatorId
 * @param {ObjectId|string} campaignId
 * @returns {Promise<Object|null>}
 */
const getDraft = async (creatorId, campaignId) => {
  // Verify the creator has an accepted application for this campaign
  await getAcceptedApplication(creatorId, { campaignId });

  const draft = await SubmissionDraft.findOne({ creatorId, campaignId }).lean();
  return draft;
};

/**
 * Create or update a submission draft (upsert)
 * @param {ObjectId|string} creatorId
 * @param {ObjectId|string} campaignId
 * @param {Object} data - { platform, url, notes, halalPledge }
 * @returns {Promise<Object>}
 */
const upsertDraft = async (creatorId, campaignId, data) => {
  // Verify the creator has an accepted application for this campaign
  await getAcceptedApplication(creatorId, { campaignId });

  const { platform, url, notes, halalPledge } = data;

  const filter = { creatorId, campaignId };
  const update = {
    platform: platform || null,
    postUrl: url || '',
    notes: notes || '',
    halalPledge: halalPledge || false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  };

  const options = {
    new: true, // Return the updated document
    upsert: true, // Create if doesn't exist
    lean: true,
  };

  const draft = await SubmissionDraft.findOneAndUpdate(filter, update, options);
  return draft;
};

/**
 * Delete a submission draft
 * @param {ObjectId|string} creatorId
 * @param {ObjectId|string} campaignId
 * @returns {Promise<boolean>}
 */
const deleteDraft = async (creatorId, campaignId) => {
  // Verify the creator has an accepted application for this campaign
  await getAcceptedApplication(creatorId, { campaignId });

  const result = await SubmissionDraft.deleteOne({ creatorId, campaignId });
  return result.deletedCount > 0;
};

module.exports = {
  getDraft,
  upsertDraft,
  deleteDraft,
};