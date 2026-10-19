// src/routes/creator/favorite.routes.js
// المالك: الشخص B — المفضلة (API_CONTRACT_Sprint4.md §3)
// مُركَّب في app.js على /api/v1/favorites ← المسارات هنا نسبية (/ و /bulk-delete و /:id).
// كل المسارات تحتاج CLIPPER فقط، فيمكنك استعمال router.use(protect, requireClipperRole) هنا.
// ترتيب: /bulk-delete قبل /:id
const express = require('express');
const router = express.Router();

const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const favoriteController = require('../../controllers/creator/favorite.controller');
const favoriteValidator = require('../../validators/creator/favorite.validator');

// All routes require authentication and CLIPPER role
router.use(protect, requireClipperRole);

// POST / - Add to favorites (idempotent)
router.post(
  '/',
  favoriteValidator.validateAddFavorite,
  favoriteController.addFavorite
);

// GET / - List favorites
router.get(
  '/',
  favoriteValidator.validateGetFavorites,
  favoriteController.getFavorites
);

// POST /bulk-delete - Bulk remove favorites
router.post(
  '/bulk-delete',
  favoriteValidator.validateBulkRemoveFavorites,
  favoriteController.bulkRemoveFavorites
);

// DELETE /:id - Remove from favorites
router.delete(
  '/:id',
  favoriteValidator.validateRemoveFavorite,
  favoriteController.removeFavorite
);

module.exports = router;