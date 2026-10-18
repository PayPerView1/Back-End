// src/routes/creator/creatorPreferences.routes.js
// المالك: الشخص B — تفضيلات المبدع (API_CONTRACT_Sprint4.md §2.2, §2.3)
// مُركَّب في app.js على /api/v1/creator/preferences ← المسارات هنا نسبية.
// كل المسارات CLIPPER فقط → router.use(protect, requireClipperRole) مسموح هنا.

// const express = require('express');
// const router = express.Router();

// TODO(B): GET /     ← GET /api/v1/creator/preferences
// TODO(B): PUT /     ← PUT /api/v1/creator/preferences



// module.exports = router;




// src/routes/creator/creatorPreferences.routes.js
// المالك: الشخص B — تفضيلات المبدع (API_CONTRACT_Sprint4.md §2.2-2.3)
//
// ⚠️ هذا الـ router مُركَّب على /api/v1/creator/preferences (بادئة واحدة).
//    فيجوز استخدام router.use(protect, ...) هنا (خلافاً للـ routers الممتدة على بادئات متعددة).

const express = require('express');
const router = express.Router();

const creatorPreferencesController = require('../../controllers/creator/creatorPreferences.controller');
const { protect } = require('../../middlewares/authMiddleware');
const { requireClipperRole } = require('../../middlewares/campaign/campaignValidationMiddleware');
const { validate } = require('../../middlewares/validate.middleware');
const { updatePreferencesSchema } = require('../../validators/creator/creatorPreferences.validator');

// كل مسارات هذا الملف تتطلب مبدع مسجل
router.use(protect, requireClipperRole);

// @route   GET /api/v1/creator/preferences
// @desc    جلب تفضيلات المبدع (أو الافتراضيات)
router.get('/', creatorPreferencesController.get);

// @route   PUT /api/v1/creator/preferences
// @desc    استبدال تفضيلات المبدع بالكامل
router.put(
  '/',
  validate({ body: updatePreferencesSchema }),
  creatorPreferencesController.update
);

module.exports = router;