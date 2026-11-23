const Campaign = require('../../models/campaign');
const CampaignDraft = require('../../models/CampaignDraft');
const CampaignBudgetSnapshot = require('../../models/CampaignBudgetSnapshot');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const RefundRequest = require('../../models/refundRequest');
const Submission = require('../../models/submission');
const aiIntelligence = require('../../services/ai/aiIntelligence.client');
const { AppError, sendError } = require('../../utils/errors');
const { PAYMENT_METHOD } = require('../../constants/payment.constants');
const { parsePaymentMethodsByCountry } = require('../../services/ai/paymentMethodsByCountry');

const draftText = (draft) => {
  const brief = draft.brief || {};
  return [draft.name, brief.mainIdea, brief.tone, brief.keyMessages, ...(brief.keywords || []), brief.visualReferences]
    .filter((item) => typeof item === 'string' && item.trim())
    .join('\n')
    .slice(0, 8000);
};

const toIso = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : value || null;

const campaignForAI = (campaign) => ({
  id: String(campaign._id),
  name: campaign.name,
  contentType: campaign.contentType,
  category: campaign.category,
  subCategories: campaign.subCategories || [],
  brief: campaign.brief || {},
  targetCountries: campaign.targetCountries || [],
  halalDeclaration: campaign.halalDeclaration ? {
    noGambling: campaign.halalDeclaration.noGambling === true,
    noSexualContent: campaign.halalDeclaration.noSexualContent === true,
    noExplicitMusic: campaign.halalDeclaration.noExplicitMusic === true,
    noAlcohol: campaign.halalDeclaration.noAlcohol === true,
    noSuspiciousCurrencies: campaign.halalDeclaration.noSuspiciousCurrencies === true,
    noUnrealisticProfit: campaign.halalDeclaration.noUnrealisticProfit === true,
  } : null,
  totalBudget: campaign.totalBudget,
  remainingBudget: campaign.remainingBudget,
  dailyBudgetLimit: campaign.dailyBudgetLimit,
  endDate: toIso(campaign.endDate),
  status: campaign.status,
  stats: campaign.stats || {},
  isArchived: campaign.isArchived === true,
  archivedAt: toIso(campaign.archivedAt),
});

const run = (label, operation) => async (req, res) => {
  try {
    const data = await operation(req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, `ai.intelligence.${label}`);
  }
};

const analyzeDraft = run('draft', async (req) => {
  const draft = req.draft;
  const peerDrafts = await CampaignDraft.find({ advertiserId: req.user._id, _id: { $ne: draft._id }, status: 'DRAFT' })
    .sort({ updatedAt: -1 }).limit(50).select('_id name contentType category brief targetCountries').lean();
  const draftPlain = draft.toObject ? draft.toObject() : draft;
  const halal = draftPlain.halalDeclaration || {};
  const payload = {
    draft: {
      name: draftPlain.name,
      contentType: draftPlain.contentType,
      category: draftPlain.category,
      subCategories: draftPlain.subCategories || [],
      totalBudget: draftPlain.totalBudget,
      cpm: draftPlain.cpm,
      dailyBudgetLimit: draftPlain.dailyBudgetLimit,
      brief: draftPlain.brief || {},
      targetCountries: draftPlain.targetCountries || [],
      halalDeclaration: {
        noGambling: halal.noGambling === true,
        noSexualContent: halal.noSexualContent === true,
        noExplicitMusic: halal.noExplicitMusic === true,
        noAlcohol: halal.noAlcohol === true,
        noSuspiciousCurrencies: halal.noSuspiciousCurrencies === true,
        noUnrealisticProfit: halal.noUnrealisticProfit === true,
      },
      lastSavedAt: toIso(draftPlain.lastSavedAt),
      expiresAt: toIso(draftPlain.expiresAt),
    },
    peerDrafts: peerDrafts.map((item) => ({ id: String(item._id), content: draftText(item) })),
  };
  return aiIntelligence.analyzeDraft(payload);
});

const analyzeCampaign = run('campaign', async (req) => {
  const campaign = req.campaign.toObject ? req.campaign.toObject() : req.campaign;
  const history = await Campaign.find({
    advertiserId: req.user._id,
    $or: [{ status: { $in: ['COMPLETED', 'ARCHIVED'] } }, { isArchived: true }],
    _id: { $ne: campaign._id },
  }).sort({ completedAt: -1 }).limit(100)
    .select('_id name contentType category subCategories brief targetCountries totalBudget stats status isArchived archivedAt').lean();
  const ownedCampaignIds = [campaign._id, ...history.map((item) => item._id)];
  const acceptance = await Submission.aggregate([
    { $match: { campaignId: { $in: ownedCampaignIds } } },
    { $group: {
      _id: null,
      totalSubmissions: { $sum: 1 },
      acceptedSubmissions: { $sum: { $cond: [{ $eq: ['$halalPledge.accepted', true] }, 1, 0] } },
    } },
  ]);
  return aiIntelligence.analyzeCampaign({
    campaign: campaignForAI({ ...campaign, _id: campaign._id }),
    history: history.map(campaignForAI),
    policyAcceptance: {
      totalSubmissions: Number(acceptance[0]?.totalSubmissions || 0),
      acceptedSubmissions: Number(acceptance[0]?.acceptedSubmissions || 0),
    },
  });
});

const analyzeWallet = run('wallet', async (req) => {
  const wallet = await Wallet.findOne({ advertiserId: req.user._id }).select('_id').lean();
  const campaigns = await Campaign.find({ advertiserId: req.user._id })
    .sort({ createdAt: -1 }).limit(1000)
    .select('_id name contentType category totalBudget remainingBudget dailyBudgetLimit stats status').lean();
  const campaignIds = campaigns.map((campaign) => campaign._id);
  const historicalCampaigns = await Campaign.find({ advertiserId: req.user._id, status: 'COMPLETED' })
    .sort({ completedAt: -1 }).limit(100)
    .select('_id name contentType category totalBudget remainingBudget dailyBudgetLimit stats status').lean();
  const fromDay = new Date();
  fromDay.setUTCHours(0, 0, 0, 0);
  fromDay.setUTCDate(fromDay.getUTCDate() - 90);
  let targetCampaign = null;
  if (req.body?.campaignId) {
    targetCampaign = await Campaign.findOne({ _id: req.body.campaignId, advertiserId: req.user._id })
      .select('_id name contentType category totalBudget remainingBudget dailyBudgetLimit stats status').lean();
    if (!targetCampaign) throw new AppError('Campaign not found', 'NOT_FOUND');
  }
  let refundOriginalMethod = null;
  if (req.body?.transactionId && !wallet) throw new AppError('Transaction not found', 'NOT_FOUND');
  if (req.body?.transactionId && wallet) {
    const originalTransaction = await Transaction.findOne({
      _id: req.body.transactionId,
      walletId: wallet._id,
      type: 'CREDIT',
      status: 'COMPLETED',
    }).select('paymentMethod').lean();
    if (!originalTransaction) throw new AppError('Transaction not found', 'NOT_FOUND');
    refundOriginalMethod = originalTransaction.paymentMethod || null;
  }
  const [transactions, refunds, dailyTotals] = wallet ? await Promise.all([
    Transaction.find({ walletId: wallet._id }).sort({ createdAt: -1 }).limit(500)
      .select('grossAmount netAmount type status paymentMethod createdAt').lean(),
    RefundRequest.find({ walletId: wallet._id }).sort({ createdAt: -1 }).limit(200)
      .select('amount status refundMethod createdAt').lean(),
    targetCampaign
      ? CampaignBudgetSnapshot.find({ campaignId: targetCampaign._id, day: { $gte: fromDay } })
        .sort({ day: 1 }).limit(90).select('dailySpend day').lean()
      : CampaignBudgetSnapshot.aggregate([
        { $match: { campaignId: { $in: campaignIds }, day: { $gte: fromDay } } },
        { $group: { _id: '$day', amount: { $sum: '$dailySpend' } } },
        { $sort: { _id: 1 } },
      ]),
  ]) : [[], [], []];

  const configuredMethods = [];
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) configuredMethods.push(PAYMENT_METHOD.PAYPAL);
  if (process.env.BANK_IBAN) configuredMethods.push(PAYMENT_METHOD.BANK_TRANSFER);
  if (process.env.MOYASAR_SECRET_KEY && process.env.MOYASAR_BASE_URL) configuredMethods.push(PAYMENT_METHOD.MOYASAR);

  return aiIntelligence.analyzeBudget({
    availablePaymentMethods: configuredMethods,
    country: req.user.country || null,
    paymentMethodsByCountry: parsePaymentMethodsByCountry(),
    refundOriginalMethod,
    candidateDeposit: req.body?.amount ? { amount: req.body.amount, method: req.body.paymentMethod || null } : null,
    transactions: transactions.map((item) => ({
      amount: Number(item.grossAmount || item.netAmount || 0),
      type: item.type,
      status: item.status,
      paymentMethod: item.paymentMethod || null,
      createdAt: toIso(item.createdAt),
    })),
    refunds: refunds.map((item) => ({ status: item.status, amount: Number(item.amount || 0), refundMethod: item.refundMethod || null, createdAt: toIso(item.createdAt) })),
    campaigns: historicalCampaigns.map((item) => ({ ...campaignForAI(item), totalBudget: Number(item.totalBudget || 0) })),
    dailySpending: dailyTotals.map((item) => Number(item.dailySpend ?? item.amount ?? 0)),
    campaign: targetCampaign ? campaignForAI(targetCampaign) : null,
  });
});

const detectLanguage = run('language.detect', async (req) => aiIntelligence.detectLanguage(req.validated.body));
const translateText = run('language.translate', async (req) => aiIntelligence.translateText(req.validated.body));

module.exports = { analyzeDraft, analyzeCampaign, analyzeWallet, detectLanguage, translateText };
