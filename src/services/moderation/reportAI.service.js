const Report = require('../../models/report');
const { AppError } = require('../../utils/errors');
const aiIntelligence = require('../ai/aiIntelligence.client');

const redactPrivateText = (value) => String(value || '')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
  .replace(/https?:\/\/[^\s]+/gi, '[redacted link]')
  .replace(/\+?\d[\d\s().-]{6,}\d/g, '[redacted phone]')
  .slice(0, 1000);

const triageReport = async (reportId) => {
  const report = await Report.findOne({ _id: reportId, isConfirmed: true })
    .select('_id campaignId clipId reason details')
    .lean();
  if (!report) throw new AppError('Report not found', 'NOT_FOUND');

  const targetFilter = report.campaignId ? { campaignId: report.campaignId } : { clipId: report.clipId };
  const candidateReports = await Report.find({
    ...targetFilter,
    _id: { $ne: report._id },
    isConfirmed: true,
    status: { $ne: 'DISMISSED' },
    details: { $type: 'string', $ne: '' },
  }).sort({ createdAt: -1 }).limit(50).select('_id reason details').lean();

  return aiIntelligence.classifyReport({
    targetType: report.campaignId ? 'CAMPAIGN' : 'CLIP',
    reason: report.reason,
    details: redactPrivateText(report.details),
    candidateReports: candidateReports.map((item) => ({
      id: String(item._id),
      reason: item.reason,
      details: redactPrivateText(item.details),
    })),
  });
};

module.exports = { triageReport, redactPrivateText };
