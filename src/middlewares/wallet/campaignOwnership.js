const Campaign = require('../../models/campaign');

const verifyCampaignOwnership = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id).select('advertiserId');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
        code: 'NOT_FOUND',
      });
    }

    if (campaign.advertiserId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This campaign does not belong to you.',
        code: 'FORBIDDEN',
      });
    }

    // نحفظ الحملة في req لتجنب query ثانية في الـ controller
    req.campaign = campaign;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = verifyCampaignOwnership;