// src/controllers/creator/creatorPreferences.controller.js
// المالك: الشخص B — HTTP handlers لتفضيلات المبدع.
// المرجع: API_CONTRACT_Sprint4.md §2.2-2.3

const creatorPreferencesService = require('../../services/creator/creatorPreferences.service');
const { sendError } = require('../../utils/errors');

// ============================================
// GET /api/v1/creator/preferences
// ============================================
const get = async (req, res) => {
  try {
    const data = await creatorPreferencesService.getPreferences(req.user._id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'creatorPreferences.get');
  }
};

// ============================================
// PUT /api/v1/creator/preferences
// ============================================
const update = async (req, res) => {
  try {
    const body = req.validated?.body || req.body;
    const data = await creatorPreferencesService.upsertPreferences(
      req.user._id,
      body
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error, 'creatorPreferences.update');
  }
};

module.exports = {
  get,
  update,
};