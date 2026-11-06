// src/controllers/submission/submissionVerify.controller.js
// POST /api/v1/submissions/verify-link  (CLIPPER)
// لا ينشئ شيئاً: يفحص الرابط ويعيد المعاينة وتقييم المتطلبات (العقد §4.3).
//
// ⚠️ لا نرمي CONTENT_REQUIREMENTS_NOT_MET هنا: هاشتاق ناقص يرجع 200 مع canSubmit:false
//    (الواجهة تعرض الهاشتاقات الناقصة بالأحمر). ذلك الخطأ يرميه submit فقط.
const { sendError } = require('../../utils/errors');
const { verifyPost } = require('../../services/submission/submissionVerify.service');
const { buildVerifyLinkResponse } = require('../../utils/submission/verifyLinkResponse.utils');

const verifyLink = async (req, res) => {
  try {
    // req.body مُنظَّف من validate (platform بأحرف كبيرة، url مقصوص، حقول مجهولة محذوفة)
    const { campaignId, platform, url } = req.body;

    const result = await verifyPost({
      creatorId: req.user._id,
      campaignId,
      platform,
      url,
    });

    return res.status(200).json({
      success: true,
      data: buildVerifyLinkResponse(result),
    });
  } catch (error) {
    return sendError(res, error, 'submissionVerify.controller.verifyLink');
  }
};

module.exports = { verifyLink };