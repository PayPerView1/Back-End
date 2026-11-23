const config = require('./aiServiceConfig');
const transport = require('./aiServiceTransport');

const timeoutMs = () => Math.min(60000, config.getTimeoutMs(45000, 'AI_INTELLIGENCE_TIMEOUT_MS'));
const makeError = transport.makeError;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const isNullableNonnegativeNumber = (value) => value === null || (Number.isFinite(value) && value >= 0);
const invalidResponse = (message) => { throw makeError('AI_SERVICE_BAD_RESPONSE', message); };

const request = async (path, payload, requiredFields, requestTimeoutMs = timeoutMs()) => {
  const data = await transport.postJson(path, payload, { timeoutMs: requestTimeoutMs });
  if (!data || typeof data !== 'object' || requiredFields.some((field) => !(field in data))) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI intelligence service returned an invalid response');
  }
  return data;
};

const analyzeDraft = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/campaign/draft-analysis',
    payload,
    ['policyDecision', 'qualityScore', 'category', 'subCategories', 'feedback', 'checks', 'suggestions', 'duplicateDrafts', 'expiryPrediction']
  );
  const duplicate = data.duplicateDrafts;
  const expiry = data.expiryPrediction;
  if (
    !['APPROVED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED'].includes(data.policyDecision) ||
    !(data.qualityScore === null || (Number.isSafeInteger(data.qualityScore) && data.qualityScore >= 0 && data.qualityScore <= 100)) ||
    !(data.category === null || ['CLIPPING', 'UGC', 'SLIDESHOW', 'AUDIO', 'LOGO', 'MIXED'].includes(data.category)) ||
    !Array.isArray(data.subCategories) || typeof data.feedback !== 'string' || !data.feedback.trim() ||
    !Array.isArray(data.checks) || !Array.isArray(data.suggestions) || !isRecord(duplicate) ||
    !['INSUFFICIENT_DATA', 'AVAILABLE', 'UNAVAILABLE'].includes(duplicate.status) || !Array.isArray(duplicate.matches) ||
    !isRecord(expiry) || !['INSUFFICIENT_DATA', 'EXPIRING_SOON', 'NOT_EXPIRING_SOON', 'EXPIRED'].includes(expiry.status) ||
    typeof expiry.notify !== 'boolean' || typeof expiry.basis !== 'string' ||
    !(expiry.daysUntilExpiry === null || Number.isSafeInteger(expiry.daysUntilExpiry))
  ) invalidResponse('AI draft analysis response is invalid');
  return data;
};

const analyzeCampaign = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/campaign/performance',
    payload,
    ['performancePrediction', 'similarCampaigns', 'categoryAnalytics', 'archivedCampaignAnalysis', 'successfulCampaignPatterns', 'policyAcceptanceAnalytics']
  );
  const performance = data.performancePrediction;
  const similar = data.similarCampaigns;
  const categories = data.categoryAnalytics;
  const archived = data.archivedCampaignAnalysis;
  const successful = data.successfulCampaignPatterns;
  const policy = data.policyAcceptanceAnalytics;
  if (
    !isRecord(performance) || !['INSUFFICIENT_DATA', 'ESTIMATED'].includes(performance.status) ||
    !isNonnegativeInteger(performance.sampleSize) ||
    !(performance.predictedViews === null || isNonnegativeInteger(performance.predictedViews)) ||
    !['LOW', 'MEDIUM'].includes(performance.confidence) || !Array.isArray(performance.recommendations) ||
    !isRecord(similar) || !['INSUFFICIENT_DATA', 'AVAILABLE', 'UNAVAILABLE'].includes(similar.status) || !Array.isArray(similar.matches) ||
    !isRecord(categories) || !['AVAILABLE', 'INSUFFICIENT_DATA'].includes(categories.status) || !Array.isArray(categories.categories) ||
    !isRecord(archived) || !['AVAILABLE', 'INSUFFICIENT_DATA'].includes(archived.status) ||
    !isNonnegativeInteger(archived.archivedCampaigns) || !isNonnegativeInteger(archived.archivedCampaignsWithMeasuredOutcomes) ||
    !isNullableNonnegativeNumber(archived.medianArchivedViewsPerDollar) ||
    !isRecord(successful) || !['AVAILABLE', 'INSUFFICIENT_DATA'].includes(successful.status) ||
    !isNonnegativeInteger(successful.sampleSize) || !Array.isArray(successful.patterns) || typeof successful.basis !== 'string' ||
    !isRecord(policy) || !['AVAILABLE', 'INSUFFICIENT_DATA'].includes(policy.status) ||
    !isNonnegativeInteger(policy.totalSubmissions) || !isNonnegativeInteger(policy.acceptedSubmissions) ||
    policy.acceptedSubmissions > policy.totalSubmissions || !isNullableNonnegativeNumber(policy.acceptanceRate) ||
    (policy.acceptanceRate !== null && policy.acceptanceRate > 1) || !Array.isArray(policy.recommendations)
  ) invalidResponse('AI campaign analysis response is invalid');
  return data;
};

const analyzeBudget = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/budget/analyze',
    payload,
    ['paymentFraud', 'paymentMethodRecommendation', 'depositAmountPrediction', 'dailyBudgetRecommendation', 'budgetExhaustionPrediction', 'spendingAnomaly', 'refundFraud', 'refundMethodRecommendation', 'refundLikelihoodPrediction']
  );
  const [paymentFraud, paymentMethod, deposit, dailyBudget, exhaustion, spending, refundFraud, refundMethod, refundLikelihood] = [
    data.paymentFraud, data.paymentMethodRecommendation, data.depositAmountPrediction, data.dailyBudgetRecommendation,
    data.budgetExhaustionPrediction, data.spendingAnomaly, data.refundFraud, data.refundMethodRecommendation,
    data.refundLikelihoodPrediction,
  ];
  const fraudValid = (value) => isRecord(value) && ['ASSESSED', 'INSUFFICIENT_DATA'].includes(value.status) &&
    ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'].includes(value.risk) && Array.isArray(value.reasonCodes);
  const methodValid = (value) => isRecord(value) && ['RECOMMENDED', 'INSUFFICIENT_DATA'].includes(value.status) &&
    (value.method === null || ['PAYPAL', 'BANK_TRANSFER', 'MOYASAR'].includes(value.method)) &&
    (value.basis === null || typeof value.basis === 'string');
  if (
    !fraudValid(paymentFraud) || !methodValid(paymentMethod) || !methodValid(refundMethod) ||
    !isRecord(deposit) || !['INSUFFICIENT_DATA', 'ESTIMATED'].includes(deposit.status) ||
    !isNullableNonnegativeNumber(deposit.amount) || !isNonnegativeInteger(deposit.sampleSize) ||
    !isRecord(dailyBudget) || !['INSUFFICIENT_DATA', 'ESTIMATED'].includes(dailyBudget.status) ||
    !isNullableNonnegativeNumber(dailyBudget.recommendedLimit) ||
    !isRecord(exhaustion) || !['INSUFFICIENT_DATA', 'ESTIMATED'].includes(exhaustion.status) ||
    !isNullableNonnegativeNumber(exhaustion.daysRemaining) ||
    !(exhaustion.estimatedExhaustionAt === null || typeof exhaustion.estimatedExhaustionAt === 'string') ||
    !isRecord(spending) || !['ASSESSED', 'INSUFFICIENT_DATA'].includes(spending.status) ||
    !['UNKNOWN', 'LOW', 'HIGH'].includes(spending.risk) || !Array.isArray(spending.reasonCodes) || !fraudValid(refundFraud) ||
    !isRecord(refundLikelihood) || !['INSUFFICIENT_DATA', 'ESTIMATED'].includes(refundLikelihood.status) ||
    !isNullableNonnegativeNumber(refundLikelihood.probability) ||
    (refundLikelihood.probability !== null && refundLikelihood.probability > 1) || !isNonnegativeInteger(refundLikelihood.sampleSize)
  ) invalidResponse('AI budget analysis response is invalid');
  return data;
};

const rankRecommendations = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/recommendations/rank',
    payload,
    ['status', 'method', 'data'],
    Math.min(1500, timeoutMs())
  );
  if (!['AVAILABLE', 'INSUFFICIENT_DATA'].includes(data.status) || typeof data.method !== 'string' || !data.method ||
    !Array.isArray(data.data) || data.data.some((item) => (
    !item || typeof item.campaignId !== 'string' || !Number.isFinite(item.score) || item.score < 0 || item.score > 1
  ))) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI recommendation response is invalid');
  }
  return data;
};

const rankApplicants = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/campaign/applicants/rank',
    payload,
    ['status', 'method', 'data']
  );
  const validComponent = (value) => value === null || value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1);
  const ids = new Set();
  if (
    !['AVAILABLE', 'INSUFFICIENT_DATA'].includes(data.status) ||
    !['GEMINI_EMBEDDINGS', 'TOKEN_OVERLAP_FALLBACK', 'NONE'].includes(data.method) ||
    !Array.isArray(data.data) || data.data.some((item, index) => {
      if (!item || typeof item.applicantId !== 'string' || ids.has(item.applicantId) ||
        !Number.isSafeInteger(item.rank) || item.rank !== index + 1 ||
        !Number.isFinite(item.compatibilityScore) || item.compatibilityScore < 0 || item.compatibilityScore > 1 ||
        !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1 ||
        !Array.isArray(item.reasonCodes) || !item.breakdown ||
        !['AVAILABLE', 'INSUFFICIENT_DATA'].includes(item.dataStatus) ||
        !['contentCompatibility', 'audienceCountryMatch', 'categoryMatch', 'historicalPerformance'].every((key) => validComponent(item.breakdown[key]))) return true;
      ids.add(item.applicantId);
      return false;
    }) ||
    data.data.length > payload.applicants.length
  ) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI applicant ranking response is invalid');
  }
  return data;
};

const classifyReport = async (payload) => {
  const data = await request('/api/v1/ai/intelligence/reports/classify', payload, [
    'status', 'category', 'severity', 'confidence', 'explanation', 'needsHumanReview',
    'suggestedActions', 'duplicateStatus', 'duplicateMethod', 'duplicateDetected', 'similarReports',
  ]);
  const categories = ['SEXUAL_CONTENT', 'GAMBLING', 'EXPLICIT_MUSIC', 'SUSPICIOUS_CURRENCIES', 'FALSE_CLAIMS', 'OTHER'];
  const severities = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const actions = ['REVIEW_EVIDENCE', 'CHECK_POLICY', 'REQUEST_CONTEXT', 'ESCALATE_PRIORITY', 'COMPARE_DUPLICATE'];
  if (
    !['CLASSIFIED', 'NEEDS_REVIEW'].includes(data.status) || !categories.includes(data.category) ||
    !severities.includes(data.severity) || !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1 ||
    typeof data.explanation !== 'string' || typeof data.needsHumanReview !== 'boolean' || data.needsHumanReview !== true ||
    !Array.isArray(data.suggestedActions) || data.suggestedActions.some((action) => !actions.includes(action)) ||
    !['ASSESSED', 'INSUFFICIENT_DATA', 'UNAVAILABLE'].includes(data.duplicateStatus) ||
    !['GEMINI_EMBEDDINGS', 'TOKEN_OVERLAP', 'NONE'].includes(data.duplicateMethod) ||
    typeof data.duplicateDetected !== 'boolean' || !Array.isArray(data.similarReports) ||
    data.similarReports.some((item) => !item || typeof item.reportId !== 'string' || !Number.isFinite(item.similarity) || item.similarity < 0 || item.similarity > 1 || typeof item.isDuplicateCandidate !== 'boolean')
  ) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI report triage response is invalid');
  }
  return data;
};

const analyzeViews = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/views/analyze',
    payload,
    ['campaignId', 'windowDays', 'observedViews', 'validatedViewsInWindow', 'suspiciousPatterns', 'futureViewPrediction', 'geographicAudience', 'earningsPrediction'],
    Math.min(8000, timeoutMs())
  );
  const grossEstimate = data.earningsPrediction?.estimatedGrossAmountCents;
  const netEstimate = data.earningsPrediction?.estimatedCreatorNetAmountCents;
  const validAmount = (amount) => amount === null || amount === undefined || (Number.isSafeInteger(amount) && amount >= 0);
  if (
    data.campaignId !== payload.campaignId || data.windowDays !== 7 ||
    !Number.isSafeInteger(data.observedViews) || data.observedViews < 0 ||
    !Number.isSafeInteger(data.validatedViewsInWindow) || data.validatedViewsInWindow < 0 ||
    !Number.isSafeInteger(data.pendingValidationViewsInWindow) || data.pendingValidationViewsInWindow < 0 ||
    !Number.isSafeInteger(data.flaggedViewsPendingReview) || data.flaggedViewsPendingReview < 0 ||
    !Number.isSafeInteger(data.maturedValidatedViews) || data.maturedValidatedViews < 0 ||
    !Number.isSafeInteger(data.confirmedGrossEarningsCents) || data.confirmedGrossEarningsCents < 0 ||
    !Number.isSafeInteger(data.confirmedCreatorNetEarningsCents) || data.confirmedCreatorNetEarningsCents < 0 ||
    !Array.isArray(data.suspiciousPatterns) ||
    !data.futureViewPrediction || !['ESTIMATED', 'INSUFFICIENT_DATA'].includes(data.futureViewPrediction.status) ||
    !Number.isSafeInteger(data.futureViewPrediction.predictedNext7DaysViews) && data.futureViewPrediction.status === 'ESTIMATED' ||
    !data.earningsPrediction || !['ESTIMATED', 'INSUFFICIENT_DATA'].includes(data.earningsPrediction.status) ||
    !validAmount(grossEstimate) || !validAmount(netEstimate) ||
    (grossEstimate !== null && netEstimate !== null && netEstimate > grossEstimate) ||
    !data.nonTargetGeographicAnomaly || data.nonTargetGeographicAnomaly.isFraud !== false ||
    !Array.isArray(data.geographicAudience?.countries)
  ) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI view intelligence response is invalid');
  }
  return data;
};

const predictCreatorEarnings = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/creator-earnings/predict',
    payload,
    ['status', 'windowDays', 'currency', 'method', 'estimatedGrossAmountCents', 'estimatedCreatorNetAmountCents', 'predictedNext7DaysViews', 'confidence', 'campaignsAnalyzed', 'campaignsEstimated', 'campaigns'],
    Math.min(8000, timeoutMs())
  );
  const amount = (value) => value === null || (Number.isSafeInteger(value) && value >= 0);
  const requestedCampaigns = new Set((payload.campaigns || []).map((item) => item.campaignId));
  const estimated = Array.isArray(data.campaigns) ? data.campaigns.filter((item) => item?.status === 'ESTIMATED') : [];
  if (
    !['ESTIMATED', 'INSUFFICIENT_DATA'].includes(data.status) || data.windowDays !== 7 || data.currency !== 'USD' ||
    data.method !== 'MATURED_VIEW_TREND_AND_REALIZED_CPM' ||
    !amount(data.estimatedGrossAmountCents) || !amount(data.estimatedCreatorNetAmountCents) ||
    !amount(data.predictedNext7DaysViews) || !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1 ||
    !Array.isArray(data.campaigns) || data.campaigns.length > requestedCampaigns.size ||
    data.campaigns.some((item) => !item || !requestedCampaigns.has(item.campaignId) || !['ESTIMATED', 'INSUFFICIENT_DATA'].includes(item.status) ||
      !Number.isSafeInteger(item.historicalDays) || item.historicalDays < 0 || item.historicalDays > 7 ||
      !Number.isSafeInteger(item.maturedValidatedViews) || item.maturedValidatedViews < 0 ||
      !amount(item.predictedNext7DaysViews) || !amount(item.estimatedGrossAmountCents) || !amount(item.estimatedCreatorNetAmountCents) ||
      !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1 || typeof item.explanation !== 'string' ||
      item.status === 'ESTIMATED' && (item.historicalDays < 4 || item.predictedNext7DaysViews === null || item.estimatedGrossAmountCents === null || item.estimatedCreatorNetAmountCents === null || item.estimatedCreatorNetAmountCents > item.estimatedGrossAmountCents) ||
      item.status === 'INSUFFICIENT_DATA' && (item.predictedNext7DaysViews !== null || item.estimatedGrossAmountCents !== null || item.estimatedCreatorNetAmountCents !== null)) ||
    !Number.isSafeInteger(data.campaignsAnalyzed) || data.campaignsAnalyzed !== data.campaigns.length ||
    !Number.isSafeInteger(data.campaignsEstimated) || data.campaignsEstimated !== estimated.length ||
    typeof data.explanation !== 'string' ||
    data.status === 'ESTIMATED' && (!estimated.length || data.estimatedGrossAmountCents === null || data.estimatedCreatorNetAmountCents === null || data.predictedNext7DaysViews === null || data.estimatedCreatorNetAmountCents > data.estimatedGrossAmountCents ||
      data.estimatedGrossAmountCents !== estimated.reduce((sum, item) => sum + item.estimatedGrossAmountCents, 0) ||
      data.estimatedCreatorNetAmountCents !== estimated.reduce((sum, item) => sum + item.estimatedCreatorNetAmountCents, 0) ||
      data.predictedNext7DaysViews !== estimated.reduce((sum, item) => sum + item.predictedNext7DaysViews, 0)) ||
    data.status === 'INSUFFICIENT_DATA' && (data.estimatedGrossAmountCents !== null || data.estimatedCreatorNetAmountCents !== null || data.predictedNext7DaysViews !== null)
  ) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI creator earnings prediction is invalid');
  }
  return data;
};

const analyzeWithdrawals = async (payload) => {
  const data = await request(
    '/api/v1/ai/intelligence/withdrawals/analyze',
    payload,
    ['status', 'risk', 'confidence', 'requiresHumanReview', 'signals', 'historySampleSize', 'requestsLast24Hours', 'processingTimePrediction', 'paymentMethodRecommendation']
  );
  const allowedRisk = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'];
  const prediction = data.processingTimePrediction;
  const recommendation = data.paymentMethodRecommendation;
  if (
    !['ASSESSED', 'INSUFFICIENT_DATA'].includes(data.status) ||
    !allowedRisk.includes(data.risk) ||
    !['LOW', 'MEDIUM'].includes(data.confidence) ||
    typeof data.requiresHumanReview !== 'boolean' ||
    !Array.isArray(data.signals) ||
    !Number.isSafeInteger(data.historySampleSize) || data.historySampleSize < 0 ||
    !Number.isSafeInteger(data.requestsLast24Hours) || data.requestsLast24Hours < 0 ||
    !prediction || !['ESTIMATED', 'INSUFFICIENT_DATA'].includes(prediction.status) ||
    !isNonnegativeInteger(prediction.sampleSize) ||
    prediction.status === 'ESTIMATED' && (!Number.isFinite(prediction.medianHours) || prediction.medianHours < 0 || prediction.sampleSize < 3) ||
    !recommendation || !['RECOMMENDED', 'INSUFFICIENT_DATA'].includes(recommendation.status) ||
    !Array.isArray(recommendation.methods) || recommendation.methods.some((method) => !['PAYPAL', 'BANK_TRANSFER', 'STC_PAY', 'MADA', 'OTHER'].includes(method))
  ) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI withdrawal analysis response is invalid');
  }
  return data;
};

const detectLanguage = async (payload) => {
  const data = await request('/api/v1/ai/intelligence/language/detect', payload, ['language', 'confidence', 'method'], Math.min(8000, timeoutMs()));
  if (!['ar', 'en', 'unknown'].includes(data.language) || !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI language detection response is invalid');
  }
  return data;
};

const translateText = async (payload) => {
  const data = await request('/api/v1/ai/intelligence/language/translate', payload, ['translation', 'sourceLanguage', 'targetLanguage']);
  if (typeof data.translation !== 'string' || !data.translation.trim() || !['ar', 'en', 'unknown'].includes(data.sourceLanguage) || data.targetLanguage !== payload.targetLanguage) {
    throw makeError('AI_SERVICE_BAD_RESPONSE', 'AI translation response is invalid');
  }
  return data;
};

module.exports = { analyzeDraft, analyzeCampaign, analyzeBudget, rankRecommendations, rankApplicants, classifyReport, analyzeViews, predictCreatorEarnings, analyzeWithdrawals, detectLanguage, translateText };
