// src/routes/campaign/campaignCategory.routes.js

const express = require('express');
const router = express.Router();
const campaignCategoryController = require('../../controllers/campaign/campaignCategory.controller');

// ─────────────────────────────────────────────
// Public Category Routes (No authentication required)
// Base route prefix: /api/v1/campaigns/categories
// ─────────────────────────────────────────────

/**
 * @route   GET /api/v1/campaigns/categories/sub-categories
 * @desc    Get sub-categories for MIXED content type
 * @access  Public
 * ⚠️ Note: Must be defined BEFORE / route to prevent route collision
 */
router.get('/sub-categories', campaignCategoryController.getSubCategories);

/**
 * @route   GET /api/v1/campaigns/categories
 * @desc    Get all campaign categories with details
 * @access  Public
 */
router.get('/', campaignCategoryController.getCategories);

module.exports = router;