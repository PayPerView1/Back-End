// src/controllers/campaign/campaignCategory.controller.js

const campaignCategoryService = require('../../services/campaign/campaignCategory.service');

/**
 * 1. getCategories
 * Handles GET /api/v1/campaigns/categories
 * Returns all campaign categories with descriptions and icons
 */
const getCategories = async (req, res) => {
  try {
    const categories = campaignCategoryService.getAllCategories();

    return res.status(200).json({
      status: 'success',
      data: {
        categories,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * 2. getSubCategories
 * Handles GET /api/v1/campaigns/categories/sub-categories
 * Returns available sub-categories for MIXED category
 */
const getSubCategories = async (req, res) => {
  try {
    const subCategories = campaignCategoryService.getSubCategories();

    return res.status(200).json({
      status: 'success',
      data: {
        subCategories,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = {
  getCategories,
  getSubCategories,
};