const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { getMountedRoutes } = require('./openapiRouteInventory');
const campaignConstants = require('../src/constants/campaign.constants');
const discoveryConstants = require('../src/constants/discovery.constants');
const paymentConstants = require('../src/constants/payment.constants');

const root = path.resolve(__dirname, '..');
const specPath = path.join(root, 'docs', 'openapi.yaml');
const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
const objectId = { $ref: '#/components/schemas/ObjectId' };
const contentTypeValues = Object.values(campaignConstants.CONTENT_TYPE);
const categoryValues = campaignConstants.CAMPAIGN_CATEGORIES.map(({ name }) => name);
const campaignStatusValues = Object.values(campaignConstants.CAMPAIGN_STATUS);
const discoverySortValues = Object.values(discoveryConstants.DISCOVER_SORT);
const reportReasonValues = Object.values(discoveryConstants.REPORT_REASON);
const reportStatusValues = Object.values(discoveryConstants.REPORT_STATUS);
const paymentMethodValues = Object.values(paymentConstants.PAYMENT_METHOD);
const transactionTypeValues = Object.values(paymentConstants.TRANSACTION_TYPE);
const transactionStatusValues = Object.values(paymentConstants.TRANSACTION_STATUS);
const SPECIFIC_RESPONSE_SCHEMAS = {
  'POST /campaigns/drafts/{draftId}/ai-assistance': 'CampaignDraftAIResponse',
  'GET /campaigns/{campaignId}/ai-insights': 'CampaignInsightsAIResponse',
  'POST /creator/withdrawals/intelligence': 'CreatorWithdrawalIntelligenceResponse',
  'GET /creator/earnings/prediction': 'CreatorEarningsPredictionResponse',
  'GET /campaigns/{campaignId}/report-summary': 'CampaignReportSummaryResponse',
  'POST /language/detect': 'LanguageDetectionResponse',
  'POST /language/translate': 'TranslationResponse',
  'POST /wallet/intelligence': 'WalletIntelligenceAIResponse',
  'POST /ai/wallet/intelligence': 'WalletIntelligenceAIResponse',
  'GET /campaigns/{campaignId}/analytics': 'CampaignAnalyticsResponse',
  'GET /campaigns/{campaignId}/applications/ai-ranking': 'CampaignApplicantRankingResponse',
  'POST /reports/{id}/ai-triage': 'ReportAITriageResponse',
};

const TAGS = [
  { name: 'Service', description: 'Service liveness and API entry point.' },
  { name: 'Authentication', description: 'Registration, login, verification, password, and OAuth flows.' },
  { name: 'Profile', description: 'Authenticated user profile operations.' },
  { name: 'Campaign taxonomy', description: 'Public campaign category and sub-category dictionaries.' },
  { name: 'Campaign discovery', description: 'Creator discovery, search, recommendations, and campaign details.' },
  { name: 'Campaign management', description: 'Brand campaign creation, drafts, lifecycle, and dashboard operations.' },
  { name: 'AI Campaign Intelligence', description: 'Owner-scoped draft assistance, compliance checks, category suggestions, and campaign performance insights.' },
  { name: 'AI Recommendations', description: 'Advertiser-side applicant compatibility ranking using campaign requirements and real creator data.' },
  { name: 'Campaign budget', description: 'Brand campaign budget allocation and controls.' },
  { name: 'Applications', description: 'Creator campaign applications and brand decisions.' },
  { name: 'Materials and downloads', description: 'Accepted-creator material access and download tracking.' },
  { name: 'Content submissions', description: 'Creator submission preparation, asynchronous AI checks, and review.' },
  { name: 'Analytics', description: 'Campaign analytics and verified submission-view history.' },
  { name: 'Reports and moderation', description: 'Public reports and administrator moderation.' },
  { name: 'AI Report Intelligence', description: 'Administrator-only report classification and non-binding duplicate/reviewer triage.' },
  { name: 'Notifications', description: 'Authenticated notification list and read state.' },
  { name: 'Wallet and payments', description: 'Wallet, funding, transfers, refunds, transaction history, and webhooks.' },
  { name: 'AI Budget Intelligence', description: 'Owner-scoped advisory payment, budget, spending, and refund risk analysis.' },
  { name: 'AI Wallet and Withdrawal Intelligence', description: 'Creator-scoped withdrawal risk signals, processing estimates, and country-configured payment options. Results are advisory and do not alter payouts.' },
  { name: 'AI Language Services', description: 'Authenticated Arabic-English language detection and bounded dynamic translation.' },
  { name: 'Creator earnings', description: 'Creator earnings ledger, payment methods, and withdrawals.' },
  { name: 'AI Chat', description: 'Authenticated, rate-limited PayPerView chat threads and feedback.' },
];

const BODY_SCHEMAS = {
  'PATCH /auth/interests': 'InterestsUpdateInput',
  'POST /campaigns': 'CampaignCreateMultipartInput',
  'POST /campaigns/bulk-archive': 'CampaignIdsInput',
  'POST /campaigns/bulk-delete': 'CampaignIdsInput',
  'POST /campaigns/{campaignId}/copy': 'CampaignCopyInput',
  'POST /campaigns/drafts': 'CampaignDraftCreateMultipartInput',
  'PUT /campaigns/drafts/{draftId}': 'CampaignDraftMultipartInput',
  'PATCH /campaigns/drafts/{draftId}/auto-save': 'CampaignDraftMultipartInput',
  'POST /campaigns/drafts/{draftId}/submit': 'CampaignSubmitMultipartInput',
  'POST /campaigns/{campaignId}/apply': 'ApplicationCreateInput',
  'PUT /applications/{id}/status': 'ApplicationStatusInput',
  'PATCH /admin/view-snapshots/{id}': 'ViewSnapshotDecisionInput',
  'PATCH /admin/withdrawals/{id}': 'AdminWithdrawalDecisionInput',
  'POST /chat/threads': 'ChatThreadCreateInput',
  'POST /chat/threads/{threadId}/messages': 'ChatMessageCreateInput',
  'PATCH /chat/threads/{threadId}/messages/{messageId}/feedback': 'ChatFeedbackInput',
  'PUT /creator/preferences': 'CreatorPreferencesInput',
  'POST /creator/payment-methods': 'CreatorPaymentMethodInput',
  'POST /creator/withdrawals': 'CreatorWithdrawalInput',
  'POST /creator/withdrawals/intelligence': 'CreatorWithdrawalIntelligenceInput',
  'POST /language/detect': 'LanguageDetectionInput',
  'POST /language/translate': 'TranslationInput',
  'POST /favorites': 'FavoriteInput',
  'POST /favorites/bulk-delete': 'FavoriteIdsInput',
  'POST /campaigns/{campaignId}/report': 'CampaignReportInput',
  'POST /reports/confirm': 'ConfirmReportInput',
  'PUT /reports/{id}': 'ReportDecisionInput',
  'PATCH /downloads/{logId}': 'DownloadResultInput',
  'POST /submissions/verify-link': 'VerifySubmissionLinkInput',
  'PUT /campaigns/{campaignId}/submission-draft': 'SubmissionDraftInput',
  'DELETE /campaigns/{campaignId}/submission-draft': 'SubmissionDraftInput',
  'POST /campaigns/{campaignId}/submissions': 'CreateSubmissionInput',
  'POST /campaigns/{campaignId}/submissions/bulk-approve': 'BulkApproveSubmissionsInput',
  'POST /campaigns/{campaignId}/submissions/bulk-review': 'BulkReviewSubmissionsInput',
  'PUT /submissions/{id}/link': 'UpdateSubmissionLinkInput',
  'POST /submissions/{id}/resubmit': 'ResubmitSubmissionInput',
  'PUT /submissions/{id}/review': 'AdvertiserSubmissionDecisionInput',
  'PUT /campaigns/{campaignId}/budget': 'AmountInput',
  'PUT /campaigns/{campaignId}/daily-budget': 'DailyBudgetInput',
  'POST /campaigns/{campaignId}/recharge': 'AmountInput',
  'PUT /campaigns/{campaignId}/auto-resume': 'AutoResumeInput',
  'POST /wallet/fund': 'WalletFundingInput',
  'POST /wallet/intelligence': 'PaymentRiskAssessmentInput',
  'POST /ai/wallet/intelligence': 'PaymentRiskAssessmentInput',
  'POST /wallet/paypal/capture': 'PayPalCaptureInput',
  'POST /wallet/paypal/webhook': 'ProviderWebhookInput',
  'POST /wallet/moyasar/webhook': 'ProviderWebhookInput',
  'POST /wallet/bank-transfer/upload': 'BankTransferReceiptInput',
  'POST /wallet/refund': 'RefundRequestInput',
  'POST /admin/wallet/fund': 'WalletFundingInput',
  'POST /admin/wallet/paypal/capture': 'PayPalCaptureInput',
  'POST /admin/wallet/paypal/webhook': 'ProviderWebhookInput',
  'POST /admin/wallet/moyasar/webhook': 'ProviderWebhookInput',
  'POST /admin/wallet/bank-transfer/upload': 'BankTransferReceiptInput',
};

const REQUEST_SCHEMAS = {
  ViewSnapshotDecisionInput: { type: 'object', additionalProperties: false, required: ['decision'], properties: { decision: { type: 'string', enum: ['CONFIRM', 'DISMISS'] } }, example: { decision: 'CONFIRM' } },
  AdminWithdrawalDecisionInput: { type: 'object', additionalProperties: false, required: ['decision'], properties: { decision: { type: 'string', enum: ['PROCESS', 'COMPLETE', 'FAIL'] }, note: { type: 'string', maxLength: 1000 }, externalReference: { type: 'string', maxLength: 200, description: 'Required when decision is COMPLETE.' } }, example: { decision: 'COMPLETE', note: 'Paid by bank transfer.', externalReference: 'BANK-TRANSFER-EXAMPLE' } },
  ChatThreadCreateInput: { type: 'object', additionalProperties: false, properties: { title: { type: 'string', maxLength: 255, default: '' } }, example: { title: 'Campaign setup questions' } },
  ChatMessageCreateInput: { type: 'object', additionalProperties: false, required: ['content'], properties: { content: { type: 'string', minLength: 1, maxLength: 4000 } }, example: { content: 'How do campaign applications work?' } },
  ChatFeedbackInput: { type: 'object', additionalProperties: false, required: ['rating'], properties: { rating: { type: 'string', enum: ['HELPFUL', 'NOT_HELPFUL'] }, comment: { type: 'string', maxLength: 1000, default: '' } }, example: { rating: 'HELPFUL', comment: 'The steps were clear.' } },
  CreatorPaymentMethodInput: { type: 'object', additionalProperties: false, required: ['type', 'label', 'details'], properties: { type: { type: 'string', enum: ['PAYPAL', 'BANK_TRANSFER', 'STC_PAY', 'MADA', 'OTHER'] }, label: { type: 'string', minLength: 1, maxLength: 80 }, details: { type: 'object', additionalProperties: false, required: ['accountName', 'accountIdentifier'], properties: { accountName: { type: 'string', minLength: 1, maxLength: 120 }, accountIdentifier: { type: 'string', minLength: 4, maxLength: 254 }, bankName: { type: 'string', maxLength: 120 } } }, isDefault: { type: 'boolean', default: false } }, example: { type: 'BANK_TRANSFER', label: 'Primary bank account', details: { accountName: 'Example Creator', accountIdentifier: 'SA0000000000000000000000', bankName: 'Example Bank' }, isDefault: true } },
  CreatorWithdrawalInput: { type: 'object', additionalProperties: false, required: ['amount', 'paymentMethodId'], properties: { amount: { type: 'number', exclusiveMinimum: 0, multipleOf: 0.01 }, paymentMethodId: objectId }, example: { amount: 50, paymentMethodId: '66a111111111111111111111' } },
  CreatorWithdrawalIntelligenceInput: { type: 'object', additionalProperties: false, properties: { amount: { type: 'number', exclusiveMinimum: 0, multipleOf: 0.01, description: 'Optional candidate amount; does not submit or reserve a withdrawal.' }, paymentMethodId: { ...objectId, description: 'Optional active payment method owned by the authenticated creator.' } }, example: { amount: 50, paymentMethodId: '66a111111111111111111111' } },
  LanguageDetectionInput: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string', minLength: 1, maxLength: 5000 } }, example: { text: 'مرحبا، كيف أتابع أداء حملتي؟' } },
  TranslationInput: { type: 'object', additionalProperties: false, required: ['text', 'targetLanguage'], properties: { text: { type: 'string', minLength: 1, maxLength: 5000 }, targetLanguage: { type: 'string', enum: ['ar', 'en'] }, sourceLanguage: { type: 'string', enum: ['ar', 'en'] } }, example: { text: 'Your campaign is ready for review.', targetLanguage: 'ar' } },
  BulkApproveSubmissionsInput: { type: 'object', additionalProperties: false, required: ['submissionIds'], properties: { submissionIds: { type: 'array', minItems: 1, uniqueItems: true, items: objectId } }, example: { submissionIds: ['66a222222222222222222222'] } },
  BulkReviewSubmissionsInput: { type: 'object', additionalProperties: false, required: ['submissionIds', 'decision'], properties: { submissionIds: { type: 'array', minItems: 1, uniqueItems: true, items: objectId }, decision: { type: 'string', enum: ['APPROVE', 'REJECT'] }, note: { type: 'string', maxLength: 1000, description: 'Required when decision is REJECT.' } }, example: { submissionIds: ['66a222222222222222222222'], decision: 'REJECT', note: 'The submission does not meet the brief.' } },
  ProfileUpdateInput: { type: 'object', properties: { fullName: { type: 'string', minLength: 2, maxLength: 50 }, country: { type: 'string', minLength: 2, maxLength: 2, description: 'ISO 3166-1 alpha-2 country code.' }, username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' }, phoneCountryCode: { type: 'string', pattern: '^\\+[1-9]\\d{0,3}$' }, phoneNumber: { type: 'string' }, city: { type: 'string', minLength: 2, maxLength: 50 }, profilePicture: { type: 'string', format: 'uri' }, interests: { type: 'array', items: { type: 'string', enum: ['LIFESTYLE', 'TECHNOLOGY', 'EDUCATION', 'ENTERTAINMENT', 'FINANCE', 'HEALTH'] } }, dateOfBirth: { type: 'string', format: 'date' }, bio: { type: 'string', maxLength: 300 } }, example: { fullName: 'Example Creator', country: 'JO', city: 'Amman', interests: ['TECHNOLOGY'], bio: 'Short form product creator.' } },
  ProfileUpdateMultipartInput: { type: 'object', properties: { fullName: { type: 'string', minLength: 2, maxLength: 50 }, country: { type: 'string', minLength: 2, maxLength: 2, description: 'ISO 3166-1 alpha-2 country code.' }, username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' }, phoneCountryCode: { type: 'string', pattern: '^\\+[1-9]\\d{0,3}$' }, phoneNumber: { type: 'string' }, city: { type: 'string', minLength: 2, maxLength: 50 }, profilePicture: { type: 'string', format: 'binary' }, interests: { type: 'array', items: { type: 'string', enum: ['LIFESTYLE', 'TECHNOLOGY', 'EDUCATION', 'ENTERTAINMENT', 'FINANCE', 'HEALTH'] } }, dateOfBirth: { type: 'string', format: 'date' }, bio: { type: 'string', maxLength: 300 } }, example: { fullName: 'Example Creator', country: 'JO', city: 'Amman', interests: ['TECHNOLOGY'], bio: 'Short form product creator.' } },
  InterestsUpdateInput: {
    type: 'object', additionalProperties: false, required: ['interests'],
    properties: { interests: { type: 'array', maxItems: 6, uniqueItems: true, items: { type: 'string', enum: ['LIFESTYLE', 'TECHNOLOGY', 'EDUCATION', 'ENTERTAINMENT', 'FINANCE', 'HEALTH'] } } },
    example: { interests: ['TECHNOLOGY', 'EDUCATION'] },
  },
  PaymentRiskAssessmentInput: { type: 'object', additionalProperties: false, properties: { amount: { type: 'number', minimum: paymentConstants.WALLET_CONSTRAINTS.MIN_DEPOSIT, maximum: paymentConstants.WALLET_CONSTRAINTS.MAX_DEPOSIT, multipleOf: 0.01, description: 'Optional candidate deposit amount to compare with the advertiser’s own completed payment history.' }, paymentMethod: { type: 'string', enum: paymentMethodValues, description: 'Optional candidate payment method.' }, campaignId: { ...objectId, description: 'Optional campaign owned by this brand for daily budget exhaustion analysis.' }, transactionId: { ...objectId, description: 'Optional completed deposit transaction owned by this wallet; the refund method recommendation will match its original payment method.' } }, example: { amount: 100, paymentMethod: 'PAYPAL', campaignId: '66a111111111111111111111', transactionId: '66a222222222222222222222' } },
  CampaignCreateMultipartInput: {
    type: 'object', required: ['name', 'contentType', 'category', 'totalBudget', 'cpm', 'brief', 'targetCountries', 'halalDeclaration'],
    properties: {
      name: { type: 'string', maxLength: 255 }, contentType: { type: 'string', enum: contentTypeValues },
      category: { type: 'string', enum: categoryValues }, subCategories: { type: 'string', description: 'JSON-encoded string array; required for MIXED.' },
      totalBudget: { type: 'number', exclusiveMinimum: 0 }, cpm: { type: 'number', exclusiveMinimum: 0 }, dailyBudgetLimit: { type: 'number', exclusiveMinimum: 0 },
      brief: { type: 'string', description: 'JSON-encoded brief object; mainIdea is required.' }, targetCountries: { type: 'string', description: 'JSON-encoded ISO alpha-3 country-code array.' },
      halalDeclaration: { type: 'string', description: 'JSON-encoded object; all six declaration flags must be true.' },
      requirements: { type: 'string', description: 'Optional JSON-encoded creator eligibility requirements.' }, submissionRequirements: { type: 'string', description: 'Optional JSON-encoded submission requirements.' },
      startDate: { type: 'string', format: 'date-time' }, endDate: { type: 'string', format: 'date-time' }, maxApplicants: { type: 'integer', minimum: 1 }, maxSubmissionsPerCreator: { type: 'integer', minimum: 1 },
      coverImage: { oneOf: [{ type: 'string', format: 'binary' }, { type: 'string', format: 'uri' }] }, materials: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Repeat this multipart field for each material file.' },
    },
    example: { name: 'Spring campaign', contentType: 'CLIPPING', category: 'TECHNOLOGY', totalBudget: '500', cpm: '5', brief: '{"mainIdea":"Show how the product saves time"}', targetCountries: '["SAU"]', halalDeclaration: '{"noGambling":true,"noSexualContent":true,"noExplicitMusic":true,"noAlcohol":true,"noSuspiciousCurrencies":true,"noUnrealisticProfit":true}' },
  },
  CampaignDraftCreateMultipartInput: {
    allOf: [
      { $ref: '#/components/schemas/CampaignDraftMultipartInput' },
      { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 255 } } },
    ],
    example: { name: 'Spring campaign draft' },
  },
  CampaignDraftMultipartInput: {
    type: 'object', description: 'All campaign draft fields are optional for partial updates. Structured multipart fields are JSON-encoded strings.',
    properties: { name: { type: 'string', minLength: 1, maxLength: 255 }, contentType: { type: 'string', enum: contentTypeValues }, category: { type: 'string', enum: contentTypeValues }, subCategories: { type: 'string', description: 'JSON-encoded string array; required for MIXED content.' }, totalBudget: { type: 'number', exclusiveMinimum: 0 }, cpm: { type: 'number', exclusiveMinimum: 0 }, dailyBudgetLimit: { type: 'number', exclusiveMinimum: 0 }, brief: { type: 'string', description: 'JSON-encoded object.' }, targetCountries: { type: 'string', description: 'JSON-encoded ISO alpha-3 country-code array.' }, halalDeclared: { type: 'boolean' }, halalDeclaration: { type: 'string', description: 'JSON-encoded declaration object.' }, startDate: { type: 'string', format: 'date-time' }, endDate: { type: 'string', format: 'date-time' }, maxApplicants: { type: 'integer', minimum: 1 }, requirements: { type: 'string', description: 'JSON-encoded creator eligibility requirements.' }, submissionRequirements: { type: 'string', description: 'JSON-encoded submission requirements.' }, maxSubmissionsPerCreator: { type: 'integer', minimum: 1 }, coverImage: { type: 'string', format: 'binary' }, materials: { type: 'array', items: { type: 'string', format: 'binary' } }, clientVersion: { type: 'integer', minimum: 1 } },
    example: { name: 'Spring campaign draft', contentType: 'CLIPPING', category: 'CLIPPING', targetCountries: '["JOR"]', clientVersion: '3' },
  },
  CampaignSubmitMultipartInput: {
    type: 'object', required: ['halalDeclaration'], properties: { halalDeclaration: { type: 'string', description: 'JSON-encoded object containing all six accepted declaration flags.' }, coverImage: { type: 'string', format: 'binary' }, materials: { type: 'array', items: { type: 'string', format: 'binary' } } },
    example: { halalDeclaration: '{"noGambling":true,"noSexualContent":true,"noExplicitMusic":true,"noAlcohol":true,"noSuspiciousCurrencies":true,"noUnrealisticProfit":true}' },
  },
  CampaignIdsInput: { type: 'object', required: ['campaignIds'], additionalProperties: false, properties: { campaignIds: { type: 'array', minItems: 1, uniqueItems: true, items: { $ref: '#/components/schemas/ObjectId' } } }, example: { campaignIds: ['66a111111111111111111111'] } },
  CampaignCopyInput: { type: 'object', additionalProperties: false, properties: { newName: { type: 'string', minLength: 1, maxLength: 255 }, includeMaterials: { type: 'boolean' }, includeTargetAudience: { type: 'boolean' } }, example: { newName: 'Spring campaign copy', includeMaterials: true, includeTargetAudience: true } },
  ApplicationCreateInput: { type: 'object', additionalProperties: false, properties: { message: { type: 'string', maxLength: 500 } }, example: { message: 'I create short product explainers for this audience.' } },
  ApplicationStatusInput: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] } }, example: { status: 'ACCEPTED' } },
  CreatorPreferencesInput: { type: 'object', properties: { preferredContentTypes: { type: 'array', items: { type: 'string', enum: contentTypeValues } }, preferredCountries: { type: 'array', maxItems: 30, items: { type: 'string', minLength: 2, maxLength: 3 } }, minCpm: { type: 'number', minimum: 0 } }, example: { preferredContentTypes: ['CLIPPING'], preferredCountries: ['SAU', 'JOR'], minCpm: 2.5 } },
  FavoriteInput: { type: 'object', required: ['campaignId'], properties: { campaignId: objectId }, example: { campaignId: '66a111111111111111111111' } },
  FavoriteIdsInput: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', minItems: 1, maxItems: 100, items: objectId } }, example: { ids: ['66a111111111111111111111'] } },
  CampaignReportInput: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', enum: reportReasonValues }, details: { type: 'string', maxLength: 1000, description: 'Required when reason is OTHER.' }, email: { type: 'string', format: 'email', maxLength: 254, description: 'Required for anonymous visitors; not required for authenticated users.' } }, example: { reason: 'FALSE_CLAIMS', details: 'The advertised offer differs from the campaign page.', email: 'reporter@example.com' } },
  ConfirmReportInput: { type: 'object', required: ['token'], properties: { token: { type: 'string', minLength: 64, maxLength: 64, pattern: '^[0-9a-fA-F]{64}$' } }, example: { token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
  ReportDecisionInput: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['CONFIRM_VIOLATION', 'DISMISS'] }, note: { type: 'string', maxLength: 1000, description: 'Required when action is CONFIRM_VIOLATION.' } }, example: { action: 'DISMISS', note: '' } },
  DownloadResultInput: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['COMPLETED', 'FAILED'] }, reason: { type: 'string', maxLength: 200 } }, example: { status: 'COMPLETED' } },
  VerifySubmissionLinkInput: { type: 'object', required: ['campaignId', 'platform', 'url'], properties: { campaignId: objectId, platform: { type: 'string', enum: ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'] }, url: { type: 'string', format: 'uri', maxLength: 2000 } }, example: { campaignId: '66a111111111111111111111', platform: 'YOUTUBE', url: 'https://www.youtube.com/shorts/abcdefghijk' } },
  SubmissionDraftInput: { type: 'object', properties: { platform: { type: ['string', 'null'], enum: ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', null] }, url: { type: 'string', maxLength: 500 }, notes: { type: 'string', maxLength: 500 }, halalPledge: { type: 'boolean' } }, example: { platform: 'YOUTUBE', url: 'https://www.youtube.com/shorts/abcdefghijk', notes: 'Draft caption', halalPledge: true } },
  CreateSubmissionInput: { type: 'object', required: ['platform', 'url', 'halalPledge'], properties: { platform: { type: 'string', enum: ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'] }, url: { type: 'string', format: 'uri', maxLength: 500 }, hashtags: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 100 } }, keywords: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 100 } }, notes: { type: 'string', maxLength: 500 }, halalPledge: { type: 'boolean', const: true } }, example: { platform: 'YOUTUBE', url: 'https://www.youtube.com/shorts/abcdefghijk', hashtags: ['PayPerView'], keywords: ['product'], halalPledge: true } },
  UpdateSubmissionLinkInput: { type: 'object', required: ['url'], properties: { url: { type: 'string', format: 'uri', maxLength: 500 }, reason: { type: 'string', maxLength: 300 } }, example: { url: 'https://www.youtube.com/shorts/abcdefghijk', reason: 'Corrected the published URL.' } },
  ResubmitSubmissionInput: { type: 'object', properties: { platform: { type: 'string', enum: ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'] }, url: { type: 'string', format: 'uri', maxLength: 500 }, hashtags: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 100 } }, keywords: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 100 } }, notes: { type: 'string', maxLength: 500 } }, example: { url: 'https://www.youtube.com/shorts/abcdefghijk', notes: 'Updated with the requested edits.' } },
  AdvertiserSubmissionDecisionInput: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['APPROVE', 'REJECT', 'REQUEST_EDITS'] }, note: { type: 'string', maxLength: 1000, description: 'Required for REJECT and REQUEST_EDITS.' } }, example: { decision: 'REQUEST_EDITS', note: 'Please add the required product mention.' } },
  AmountInput: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', exclusiveMinimum: 0 } }, example: { amount: 100 } },
  DailyBudgetInput: { type: 'object', properties: { dailyBudgetLimit: { type: ['number', 'null'], exclusiveMinimum: 0, description: 'Null removes the daily limit.' } }, example: { dailyBudgetLimit: 25 } },
  AutoResumeInput: { type: 'object', required: ['autoResumeOnRecharge'], properties: { autoResumeOnRecharge: { type: 'boolean' } }, example: { autoResumeOnRecharge: true } },
  WalletFundingInput: { type: 'object', required: ['amount', 'paymentMethod'], properties: { amount: { type: 'number', minimum: paymentConstants.WALLET_CONSTRAINTS.MIN_DEPOSIT, maximum: paymentConstants.WALLET_CONSTRAINTS.MAX_DEPOSIT, multipleOf: 0.01 }, paymentMethod: { type: 'string', enum: paymentMethodValues } }, example: { amount: 100, paymentMethod: 'PAYPAL' } },
  PayPalCaptureInput: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string', maxLength: 64 } }, example: { orderId: 'PAYPAL-ORDER-EXAMPLE' } },
  ProviderWebhookInput: { type: 'object', description: 'Raw JSON payload signed by the payment provider. The endpoint verifies the provider signature/token; it does not accept a user JWT.', additionalProperties: true, example: { id: 'WH-EXAMPLE', event_type: 'PAYMENT.CAPTURE.COMPLETED' } },
  BankTransferReceiptInput: { type: 'object', required: ['transactionId', 'receipt'], properties: { transactionId: objectId, receipt: { type: 'string', format: 'binary', description: 'JPG, PNG, or PDF; maximum 5 MB.' } }, example: { transactionId: '66a111111111111111111111' } },
  RefundRequestInput: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', minimum: paymentConstants.WALLET_CONSTRAINTS.MIN_REFUND } }, example: { amount: 25 } },
  BankTransferDecisionInput: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['APPROVE', 'REJECT'] }, note: { type: 'string', minLength: 3, maxLength: 500, description: 'Required when rejecting.' } }, example: { action: 'REJECT', note: 'Receipt could not be verified.' } },
  RefundDecisionInput: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['APPROVE', 'REJECT'] }, note: { type: 'string', description: 'Required when rejecting.' } }, example: { action: 'REJECT', note: 'The transaction is outside the refund window.' } },
};

const NO_BODY = new Set([
  'POST /auth/logout',
  'POST /campaigns/{campaignId}/ai-review',
  'POST /campaigns/drafts/{draftId}/ai-assistance',
  'PUT /campaigns/{campaignId}/pause',
  'PUT /campaigns/{campaignId}/resume',
  'PUT /campaigns/{campaignId}/auto-recharge',
  'PATCH /notifications/read-all',
  'PATCH /notifications/{id}/read',
  'PATCH /campaigns/{campaignId}/archive',
  'PATCH /campaigns/{campaignId}/restore',
  'POST /applications/{id}/materials/download-all',
  'POST /applications/{id}/materials/{materialId}/download-link',
  'POST /reports/{id}/ai-triage',
]);

const PUBLIC = new Set([
  'GET /',
  'POST /auth/register', 'POST /auth/login', 'POST /auth/forgot-password',
  'POST /auth/resend-verification', 'GET /auth/reset-password/{token}',
  'POST /auth/reset-password/{token}', 'GET /auth/verify-email/{token}',
  'GET /auth/google', 'GET /auth/google/callback',
  'GET /campaigns/categories', 'GET /campaigns/categories/sub-categories',
  'GET /categories', 'GET /categories/sub-categories',
  'POST /reports/confirm', 'POST /wallet/paypal/webhook', 'POST /wallet/moyasar/webhook',
  'POST /admin/wallet/paypal/webhook', 'POST /admin/wallet/moyasar/webhook',
]);

const SUMMARY = {
  'GET /': 'Check backend liveness',
  'GET /campaigns': 'List campaigns owned by the authenticated brand',
  'POST /campaigns': 'Create and submit a campaign for AI policy review',
  'GET /campaigns/statistics': 'Get brand campaign dashboard statistics',
  'POST /campaigns/bulk-delete': 'Delete multiple owned campaigns',
  'POST /campaigns/bulk-archive': 'Archive multiple owned campaigns',
  'GET /campaigns/discover': 'Discover campaigns available to creators',
  'GET /campaigns/discover/suggestions': 'Get campaign search suggestions',
  'GET /campaigns/recommendations': 'Get campaigns recommended for the creator',
  'GET /campaigns/{campaignId}/details': 'Get campaign details for a creator',
  'POST /campaigns/{campaignId}/apply': 'Apply to a campaign as a creator',
  'GET /applications/my': 'List the creator’s campaign applications',
  'GET /campaigns/{campaignId}/applications': 'List applicants for an owned campaign',
  'GET /campaigns/{campaignId}/applications/ai-ranking': 'Rank pending applicants by campaign compatibility',
  'PUT /applications/{id}/status': 'Accept or reject a campaign application',
  'POST /campaigns/{campaignId}/ai-review': 'Run the campaign AI review',
  'POST /campaigns/drafts/{draftId}/ai-assistance': 'Get AI campaign draft suggestions and checks',
  'GET /campaigns/{campaignId}/ai-insights': 'Get owner-scoped campaign performance, archive, and policy insights',
  'POST /wallet/intelligence': 'Analyze payment, budget, and refund history',
  'POST /ai/wallet/intelligence': 'Analyze payment, budget, and refund history',
  'POST /creator/withdrawals/intelligence': 'Analyze creator withdrawal behavior and processing history',
  'GET /campaigns/{campaignId}/report-summary': 'Get aggregate confirmed report counts for an owned campaign',
  'POST /reports/{id}/ai-triage': 'Classify a confirmed report and suggest reviewer triage',
  'POST /language/detect': 'Detect whether bounded text is Arabic or English',
  'POST /language/translate': 'Translate bounded text between Arabic and English',
  'GET /campaigns/{campaignId}/ai-review': 'Get campaign AI review status and result',
  'POST /campaigns/{campaignId}/submissions': 'Submit published content for asynchronous review',
  'GET /campaigns/{campaignId}/submissions': 'List submissions for an owned campaign',
  'GET /submissions/my': 'List submissions belonging to the creator',
  'POST /submissions/verify-link': 'Verify a social post link before submission',
  'PUT /submissions/{id}/review': 'Record an advertiser decision on a submission',
  'POST /submissions/{id}/resubmit': 'Create a new submission attempt after requested changes',
  'GET /admin/submissions/manual-review': 'List submissions awaiting administrator review',
  'PUT /admin/submissions/{id}/review': 'Record an administrator manual-review decision',
  'GET /submissions/{id}/views': 'Get verified view and earning history for a submission',
  'GET /campaigns/{campaignId}/analytics': 'Get campaign performance analytics',
  'GET /creator/earnings': 'Get creator wallet and earnings summary',
  'GET /creator/earnings/prediction': 'Estimate creator earnings for the next seven days',
  'GET /creator/earnings/transactions': 'List creator earning ledger records',
  'POST /creator/withdrawals': 'Request a withdrawal from available creator earnings',
  'GET /creator/withdrawals': 'List the creator’s withdrawal requests',
  'GET /admin/withdrawals': 'List withdrawal requests for administrators',
  'PATCH /admin/withdrawals/{id}': 'Process an administrator withdrawal decision',
  'POST /chat/threads/{threadId}/messages': 'Send a message and receive an AI response',
  'POST /chat/threads': 'Create an AI chat thread',
  'GET /chat/threads': 'List the authenticated user’s AI chat threads',
  'GET /chat/threads/{threadId}/messages': 'List messages from an owned AI chat thread',
  'PATCH /chat/threads/{threadId}/messages/{messageId}/feedback': 'Submit feedback for an assistant message',
  'DELETE /chat/threads/{threadId}': 'Delete an owned AI chat thread',
};

function tagFor(apiPath) {
  if (apiPath === '/') return 'Service';
  if (apiPath.includes('/ai-triage')) return 'AI Report Intelligence';
  if (apiPath.endsWith('/applications/ai-ranking')) return 'AI Recommendations';
  if (apiPath === '/creator/withdrawals/intelligence') return 'AI Wallet and Withdrawal Intelligence';
  if (apiPath.startsWith('/language/')) return 'AI Language Services';
  if (apiPath.endsWith('/report-summary')) return 'Reports and moderation';
  if (apiPath.includes('/ai-assistance') || apiPath.includes('/ai-insights') || apiPath.includes('/ai-review')) return 'AI Campaign Intelligence';
  if (apiPath === '/wallet/intelligence' || apiPath === '/ai/wallet/intelligence') return 'AI Budget Intelligence';
  if (apiPath.startsWith('/auth/')) return 'Authentication';
  if (apiPath.startsWith('/profile')) return 'Profile';
  if (apiPath.startsWith('/categories') || apiPath.startsWith('/campaigns/categories')) return 'Campaign taxonomy';
  if (apiPath.startsWith('/campaigns/discover') || apiPath.startsWith('/campaigns/recommendations') || apiPath.endsWith('/details')) return 'Campaign discovery';
  if (apiPath.startsWith('/campaigns/{campaignId}/submissions')) return 'Content submissions';
  if (apiPath.startsWith('/campaigns/drafts') || apiPath === '/campaigns' || apiPath.startsWith('/campaigns/statistics') || /\/campaigns\/\{campaignId\}(\/copy|\/archive|\/restore|\/export|\/statistics|\/ai-review)?$/.test(apiPath)) return 'Campaign management';
  if (apiPath.includes('/budget') || apiPath.includes('/recharge') || apiPath.includes('/auto-resume') || apiPath.includes('/pause') || apiPath.includes('/resume')) return 'Campaign budget';
  if (apiPath.includes('/materials') || apiPath.startsWith('/materials/') || apiPath.startsWith('/downloads/') || apiPath.endsWith('/downloads')) return 'Materials and downloads';
  if (apiPath.startsWith('/applications') || apiPath.endsWith('/apply') || /\/campaigns\/\{campaignId\}\/applications/.test(apiPath)) return 'Applications';
  if (apiPath.startsWith('/submissions') || apiPath.includes('/submission-') || apiPath.includes('/submissions/')) return 'Content submissions';
  if (apiPath.startsWith('/admin/submissions/')) return 'Content submissions';
  if (apiPath.includes('/analytics') || apiPath.includes('/view-snapshots')) return 'Analytics';
  if (apiPath.startsWith('/reports') || apiPath.endsWith('/report')) return 'Reports and moderation';
  if (apiPath.startsWith('/notifications')) return 'Notifications';
  if (apiPath.startsWith('/creator/earnings') || apiPath.startsWith('/creator/payment-methods') || apiPath.startsWith('/creator/withdrawals') || apiPath.startsWith('/admin/withdrawals')) return 'Creator earnings';
  if (apiPath.startsWith('/wallet') || apiPath.startsWith('/admin/wallet') || apiPath.startsWith('/wallet/transactions')) return 'Wallet and payments';
  if (apiPath.startsWith('/chat/')) return 'AI Chat';
  if (apiPath.startsWith('/admin/')) return 'Administration';
  if (apiPath.startsWith('/favorites') || apiPath.startsWith('/creator/preferences')) return 'Profile';
  return 'Campaign management';
}

function rolesFor(apiPath, method, key) {
  if (key === 'GET /campaigns/{campaignId}/applications/ai-ranking') return ['BRAND_OWNER'];
  if (key === 'POST /reports/{id}/ai-triage') return ['ADMIN'];
  if (key === 'GET /creator/earnings/prediction') return ['CLIPPER'];
  if (key === 'POST /wallet/intelligence' || key === 'POST /ai/wallet/intelligence') return ['BRAND'];
  if (key === 'POST /campaigns/drafts/{draftId}/ai-assistance' || key === 'GET /campaigns/{campaignId}/ai-insights') return ['BRAND'];
  if (key === 'GET /campaigns/{campaignId}/report-summary') return ['BRAND_OWNER'];
  if (key === 'POST /creator/withdrawals/intelligence') return ['CLIPPER'];
  if (apiPath.startsWith('/language/')) return ['AUTHENTICATED'];
  if (key === 'POST /campaigns/{campaignId}/report') return ['PUBLIC', 'AUTHENTICATED'];
  if (['PATCH /auth/change-password', 'PATCH /auth/interests', 'POST /auth/logout'].includes(key)) return ['AUTHENTICATED'];
  if (PUBLIC.has(key)) return [];
  if (apiPath.startsWith('/wallet/') && apiPath.endsWith('/webhook')) return [];
  if (apiPath.startsWith('/admin/wallet/') && apiPath.endsWith('/webhook')) return [];
  if (apiPath === '/admin/wallet' || apiPath.startsWith('/admin/wallet/')) return ['AUTHENTICATED'];
  if (apiPath.startsWith('/admin/')) return ['ADMIN'];
  if (apiPath.startsWith('/auth/')) return [];
  if (apiPath.startsWith('/profile')) return ['AUTHENTICATED'];
  if (apiPath === '/categories' || apiPath.startsWith('/categories/') || apiPath.startsWith('/campaigns/categories')) return [];
  if (apiPath.startsWith('/campaigns/discover') || apiPath.startsWith('/campaigns/recommendations') || apiPath.endsWith('/details')) return ['CLIPPER'];
  if (apiPath === '/applications/my' || (apiPath.startsWith('/applications/') && apiPath !== '/applications/{id}/status') || apiPath.endsWith('/apply')) return ['CLIPPER'];
  if (apiPath === '/submissions/{id}/views') return ['CLIPPER', 'BRAND_OWNER'];
  if (key === 'PUT /submissions/{id}/review') return ['BRAND_OWNER'];
  if (apiPath === '/campaigns/{campaignId}/submissions' && method === 'post') return ['CLIPPER'];
  if (apiPath.startsWith('/campaigns/{campaignId}/submission-requirements') || apiPath.startsWith('/campaigns/{campaignId}/submission-draft')) return ['CLIPPER'];
  if (apiPath.startsWith('/submissions/')) return ['CLIPPER'];
  if (apiPath.startsWith('/applications/{id}/materials')) return ['CLIPPER'];
  if (apiPath.startsWith('/materials/download/') || apiPath.startsWith('/downloads/')) return ['CLIPPER'];
  if (apiPath === '/campaigns/{campaignId}/applications' || apiPath.startsWith('/campaigns/{campaignId}/downloads') || apiPath.startsWith('/campaigns/{campaignId}/analytics') || apiPath.startsWith('/campaigns/{campaignId}/submissions')) return ['BRAND_OWNER'];
  if (apiPath === '/applications/{id}/status' || apiPath.startsWith('/campaigns/{campaignId}/ai-review')) return ['BRAND_OWNER'];
  if (apiPath.startsWith('/reports/')) return ['ADMIN'];
  if (apiPath === '/reports') return ['ADMIN'];
  if (apiPath.startsWith('/campaigns/')) return ['BRAND_OWNER'];
  if (apiPath.startsWith('/chat/')) return ['AUTHENTICATED'];
  if (apiPath.startsWith('/notifications')) return ['AUTHENTICATED'];
  if (apiPath.startsWith('/wallet/transactions') || apiPath.startsWith('/wallet')) return ['AUTHENTICATED'];
  if (apiPath.startsWith('/creator/')) return ['CLIPPER'];
  if (apiPath.startsWith('/favorites')) return ['CLIPPER'];
  if (apiPath === '/campaigns') return ['BRAND'];
  return [];
}

function descriptionFor(apiPath, method, key, roles) {
  if (key === 'GET /campaigns/{campaignId}/applications/ai-ranking') return 'Ranks only pending applicants to a campaign owned by the authenticated brand. Uses campaign requirements, declared or validated country audience, creator content categories, and matured validated-view history. Age and gender demographics are not available and are not inferred. Scores are advisory and do not accept or reject applications.';
  if (key === 'POST /reports/{id}/ai-triage') return 'For a confirmed report, returns an AI category and review-urgency assessment, similar reports on the same campaign or clip, and non-binding reviewer suggestions. Report text is redacted for common contact details before it is sent to the AI Service. Classification does not prove a violation or change report/campaign state. Provider failure returns UNKNOWN severity and NEEDS_REVIEW.';
  if (key === 'GET /creator/earnings/prediction') return 'Estimates the authenticated creator’s next-seven-day gross and net earnings from matured validated-view history, current CPMs, and confirmed creator-ledger rates. The seven-day hold is respected. Estimates are distinct from confirmed wallet balances and are not withdrawable.';
  if (key === 'POST /campaigns/drafts/{draftId}/ai-assistance') return 'Synchronous advisory analysis of an owned draft. Suggests missing fields, category, content quality, early text-policy checks, embedding-based duplicate matches against the same owner’s drafts, and expiry status. Missing Halal declarations or provider uncertainty require manual review. Does not persist or approve the draft.';
  if (key === 'GET /campaigns/{campaignId}/ai-insights') return 'Returns advisory performance estimates and category analytics for this brand’s campaign, calculated only from the brand’s own completed campaigns. Requires at least three similar completed outcomes; otherwise predictions return INSUFFICIENT_DATA.';
  if (key === 'POST /creator/withdrawals/intelligence') return 'Advisory statistical withdrawal analysis using only the authenticated creator’s own history and active payment methods. It never approves, blocks, or reserves funds. Amount anomalies require five completed withdrawals; processing-time estimates require three.';
  if (key === 'GET /campaigns/{campaignId}/report-summary') return 'Returns aggregate counts for confirmed reports on a campaign owned by the caller. Reporter identities, contact details, and report text are excluded.';
  if (key === 'POST /language/detect') return 'Detects Arabic or English using a bounded Unicode-script heuristic without a model call. Other or ambiguous scripts return unknown.';
  if (key === 'POST /language/translate') return 'Translates bounded text between Arabic and English with Gemini structured output. The endpoint preserves placeholders and does not add claims. Requires an authenticated bearer token.';
  if (key === 'POST /wallet/intelligence' || key === 'POST /ai/wallet/intelligence') return 'Analyzes only the authenticated brand’s transaction, refund, campaign, and recorded daily spend history. Fraud indicators are advisory and do not block payment. Recommendations return INSUFFICIENT_DATA when samples are too small. Refund methods follow the original-payment-method rule. Country method eligibility depends on the backend PAYMENT_METHODS_BY_COUNTRY deployment configuration.';
  const roleText = roles.length === 0
    ? 'Public endpoint.'
    : roles.includes('PUBLIC')
      ? 'May be called anonymously or with a valid bearer token.'
    : roles.length > 1 && roles.includes('CLIPPER') && roles.includes('BRAND_OWNER')
      ? 'Requires an authenticated CLIPPER who owns the submission or a BRAND who owns its campaign.'
      : roles.includes('BRAND_OWNER')
        ? 'Requires a BRAND account that owns the referenced campaign.'
        : roles.includes('CLIPPER')
          ? 'Requires a CLIPPER account; resource ownership is enforced by the backend.'
          : roles.includes('ADMIN')
            ? 'Requires an authenticated ADMIN account.'
            : 'Requires a valid PayPerView bearer token; data is scoped to the authenticated user where applicable.';
  let detail = roleText;
  if (apiPath === '/campaigns/{campaignId}/ai-review') detail += ' The request waits for the campaign review and returns the resulting campaign AI status. Poll GET /campaigns/{campaignId}/ai-review to retrieve the persisted result later.';
  if (apiPath === '/campaigns/{campaignId}/submissions') detail += ' Submission creation begins asynchronous processing. The response may initially report PROCESSING; poll GET /submissions/{id} until displayStatus is AI_REJECTED, MANUAL_REVIEW, AWAITING_ADVERTISER, APPROVED, REJECTED, or WITHDRAWN.';
  if (apiPath === '/admin/submissions/manual-review') detail += ' Items in this queue require a human decision after automated checks return MANUAL_REVIEW_REQUIRED.';
  if (apiPath.startsWith('/wallet/') && apiPath.endsWith('/webhook')) detail = 'Provider-to-server webhook. No user JWT is used; the backend verifies provider authentication/signature against the raw request body. Invalid signatures receive 400; transient processing failures receive 500 for provider retry.';
  if (apiPath === '/campaigns/{campaignId}/auto-recharge') detail += ' This route is currently a deferred stub and returns 501 NOT_IMPLEMENTED.';
  if (apiPath.startsWith('/campaigns/drafts/{draftId}/auto-save')) detail += ' Auto-save uses clientVersion for optimistic concurrency; a conflict must be resolved by fetching the latest draft.';
  return detail;
}

function pathParameters(apiPath) {
  return [...apiPath.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1], in: 'path', required: true,
    description: match[1].toLowerCase().includes('token') ? 'Single-use or verification token issued by the server.' : 'Resource identifier from a previous API response.',
    schema: match[1].toLowerCase().includes('token') ? { type: 'string', minLength: 1 } : objectId,
    example: match[1].toLowerCase().includes('token') ? 'example-token' : '66a111111111111111111111',
  }));
}

function queryParameters(apiPath, method) {
  if (method !== 'get') return [];
  const params = [];
  const add = (name, schema, description) => params.push({ name, in: 'query', required: false, description, schema });
  const pagination = (maximum = 100) => {
    add('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number.');
    add('perPage', { type: 'integer', minimum: 1, maximum, default: 20 }, 'Items per page.');
  };
  if (apiPath === '/campaigns') {
    add('status', { type: 'string', enum: [...campaignStatusValues, 'ALL'] }, 'Campaign lifecycle status filter.');
    add('category', { type: 'string', enum: contentTypeValues }, 'Campaign content category filter.');
    add('dateFrom', { type: 'string', format: 'date' }, 'Include campaigns starting on or after this date.');
    add('dateTo', { type: 'string', format: 'date' }, 'Include campaigns ending on or before this date.');
    add('search', { type: 'string', minLength: 1, maxLength: 100 }, 'Search campaign names and descriptions.');
    add('sortBy', { type: 'string', enum: ['createdAt', 'name', 'totalBudget'] }, 'Sort field.');
    add('sortOrder', { type: 'string', enum: ['asc', 'desc'] }, 'Sort direction.');
    add('isArchived', { type: 'boolean' }, 'Include archived campaigns when true.');
    add('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number.');
    add('limit', { type: 'integer', minimum: 1, maximum: 50 }, 'Items per page.');
  } else if (apiPath === '/campaigns/discover') {
    add('search', { type: 'string', maxLength: 100 }, 'Campaign search text.');
    add('contentType', { type: 'string', enum: contentTypeValues }, 'Filter by content type.');
    add('countries', { type: 'string', maxLength: 500 }, 'Comma-separated ISO alpha-3 country codes.');
    add('minCpm', { type: 'number', minimum: 0 }, 'Minimum CPM.');
    add('maxCpm', { type: 'number', minimum: 0 }, 'Maximum CPM.');
    add('sort', { type: 'string', enum: discoverySortValues, default: 'newest' }, 'Discovery sort order.');
    pagination(50);
  } else if (apiPath === '/campaigns/discover/suggestions') {
    add('q', { type: 'string', minLength: 2, maxLength: 50 }, 'Required search prefix.');
  } else if (apiPath === '/campaigns/recommendations') {
    add('limit', { type: 'integer', minimum: 1, maximum: 20, default: 10 }, 'Maximum recommendations to return.');
  } else if (apiPath === '/notifications') {
    add('unread', { type: 'boolean' }, 'When true, only unread notifications are returned.');
    pagination(50);
  } else if (apiPath === '/reports') {
    add('status', { type: 'string', enum: [...reportStatusValues, 'ALL'] }, 'Report status filter; defaults to PENDING.');
    add('reason', { type: 'string', enum: reportReasonValues }, 'Report reason filter.');
    add('campaignId', objectId, 'Filter by campaign.');
    pagination(50);
  } else if (apiPath === '/applications/my') {
    add('status', { type: 'string' }, 'Application status filter.');
    pagination(50);
  } else if (apiPath === '/campaigns/{campaignId}/applications') {
    add('status', { type: 'string' }, 'Application status filter.');
    pagination(50);
  } else if (apiPath === '/campaigns/{campaignId}/submissions') {
    add('displayStatus', { type: 'string', enum: ['ALL', 'AWAITING_ADVERTISER', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'AI_REJECTED', 'WITHDRAWN'], default: 'AWAITING_ADVERTISER' }, 'Computed review status filter.');
    pagination(50);
  } else if (apiPath === '/submissions/my') {
    add('displayStatus', { type: 'string', enum: ['PROCESSING', 'AI_REJECTED', 'MANUAL_REVIEW', 'AWAITING_ADVERTISER', 'APPROVED', 'REJECTED', 'WITHDRAWN'] }, 'Computed submission status filter.');
    add('campaignId', objectId, 'Filter by campaign.');
    pagination(50);
  } else if (apiPath === '/wallet/transactions') {
    add('type', { type: 'string', enum: transactionTypeValues }, 'Wallet transaction type filter.');
    add('status', { type: 'string', enum: transactionStatusValues }, 'Transaction processing status filter.');
    add('paymentMethod', { type: 'string', enum: paymentMethodValues }, 'Funding payment method filter.');
    add('dateFrom', { type: 'string', format: 'date-time' }, 'Include transactions at or after this UTC timestamp.');
    add('dateTo', { type: 'string', format: 'date-time' }, 'Include transactions at or before this UTC timestamp.');
    add('search', { type: 'string' }, 'Search supported transaction fields.');
    pagination(100);
  } else if (['/wallet/transactions/export', '/wallet/transactions/export/pdf'].includes(apiPath)) {
    add('type', { type: 'string', enum: transactionTypeValues }, 'Wallet transaction type filter.');
    add('status', { type: 'string', enum: transactionStatusValues }, 'Transaction processing status filter.');
    add('paymentMethod', { type: 'string', enum: paymentMethodValues }, 'Funding payment method filter.');
    add('dateFrom', { type: 'string', format: 'date-time' }, 'Include transactions at or after this UTC timestamp.');
    add('dateTo', { type: 'string', format: 'date-time' }, 'Include transactions at or before this UTC timestamp.');
    add('search', { type: 'string' }, 'Search supported transaction fields.');
  } else if (apiPath === '/campaigns/{campaignId}/downloads' || apiPath === '/admin/view-snapshots/review' || apiPath === '/admin/submissions/manual-review' || apiPath === '/creator/earnings/transactions' || apiPath === '/creator/withdrawals') {
    pagination(apiPath.startsWith('/campaigns/') || apiPath.startsWith('/admin/submissions/') ? 50 : 100);
  } else if (apiPath === '/admin/withdrawals') {
    add('status', { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] }, 'Withdrawal status filter.');
    pagination(100);
  } else if (apiPath === '/submissions/{id}/views') {
    pagination(100);
  } else if (apiPath === '/favorites') {
    pagination(50);
    add('sort', { type: 'string', enum: ['newest', 'oldest', 'highestCpm'], default: 'newest' }, 'Sort order.');
    add('availability', { type: 'string', enum: ['ALL', 'AVAILABLE', 'UNAVAILABLE'], default: 'ALL' }, 'Campaign availability filter.');
    add('contentType', { type: 'string', enum: contentTypeValues }, 'Content type filter.');
  }
  return params;
}

function responseExample(apiPath, method) {
  if (apiPath === '/campaigns/{campaignId}/analytics') return { success: true, data: {
    campaignId: '66a111111111111111111111', status: 'ACTIVE', totalViews: 1200, approvedVideos: 3,
    participatingCreators: 2, amountSpent: 6, remainingBudget: 94, viewsAvailable: true,
    geographyAvailable: true, viewsByCountry: [{ countryCode: 'JOR', views: 1180 }],
    viewIntelligence: { status: 'AVAILABLE', windowDays: 7, observedViews: 1200, validatedViewsInWindow: 300, pendingValidationViewsInWindow: 600, flaggedViewsPendingReview: 300, maturedValidatedViews: 4000, confirmedGrossEarningsCents: 2000,
      futureViewPrediction: { status: 'ESTIMATED', predictedNext7DaysViews: 1300, confidence: 0.63, explanation: 'Estimate from the seven-day trend.' },
      earningsPrediction: { status: 'ESTIMATED', estimatedGrossAmountCents: 650, estimatedCreatorNetAmountCents: 618, currency: 'USD', confidence: 0.5, explanation: 'Estimated only; not confirmed or withdrawable.' },
      nonTargetGeographicAnomaly: { status: 'ASSESSED', detected: false, outOfTargetViews: 0, isFraud: false, confidence: 0, explanation: 'Geographic mismatch is not proof of fraud.' } },
    generatedAt: '2026-11-10T10:00:00.000Z',
  } };
  if (apiPath === '/campaigns/drafts/{draftId}/ai-assistance') return { success: true, data: { policyDecision: 'MANUAL_REVIEW_REQUIRED', qualityScore: 78, category: 'UGC', subCategories: [], feedback: 'The draft is clear. Verify all compliance declarations before submission.', checks: [], suggestions: [{ field: 'brief.keyMessages', suggestion: 'Add the product benefit that creators should demonstrate.' }], duplicateDrafts: { status: 'INSUFFICIENT_DATA', matches: [] }, expiryPrediction: { status: 'NOT_EXPIRING_SOON', notify: false, daysUntilExpiry: 28, basis: 'SCHEDULED_EXPIRY_AND_LAST_SAVE' } } };
  if (apiPath === '/campaigns/{campaignId}/ai-insights') return { success: true, data: { performancePrediction: { status: 'INSUFFICIENT_DATA', sampleSize: 0, predictedViews: null, confidence: 'LOW', recommendations: [] }, similarCampaigns: { status: 'INSUFFICIENT_DATA', matches: [] }, categoryAnalytics: { status: 'INSUFFICIENT_DATA', categories: [] }, archivedCampaignAnalysis: { status: 'INSUFFICIENT_DATA', archivedCampaigns: 0, archivedCampaignsWithMeasuredOutcomes: 0, medianArchivedViewsPerDollar: null }, successfulCampaignPatterns: { status: 'INSUFFICIENT_DATA', sampleSize: 0, patterns: [], basis: 'Insufficient campaign history.' }, policyAcceptanceAnalytics: { status: 'INSUFFICIENT_DATA', totalSubmissions: 0, acceptedSubmissions: 0, acceptanceRate: null, recommendations: [] } } };
  if (apiPath === '/creator/withdrawals/intelligence') return { success: true, data: { status: 'INSUFFICIENT_DATA', risk: 'UNKNOWN', confidence: 'LOW', requiresHumanReview: false, signals: [], historySampleSize: 0, requestsLast24Hours: 0, processingTimePrediction: { status: 'INSUFFICIENT_DATA', medianHours: null, sampleSize: 0 }, paymentMethodRecommendation: { status: 'INSUFFICIENT_DATA', country: null, methods: [], basis: null } } };
  if (apiPath === '/campaigns/{campaignId}/report-summary') return { success: true, data: { campaignId: '66a111111111111111111111', totalReports: 0, statusCounts: {}, reasonCounts: {} } };
  if (apiPath === '/campaigns/{campaignId}/applications/ai-ranking') return { success: true, data: { campaignId: '66a111111111111111111111', status: 'AVAILABLE', method: 'GEMINI_EMBEDDINGS', data: [{ applicationId: '66a222222222222222222222', status: 'PENDING', message: '', appliedAt: '2026-11-10T10:00:00Z', creator: { id: '66a333333333333333333333', fullName: 'Creator Example', profilePicture: null }, aiMatch: { applicantId: '66a222222222222222222222', rank: 1, compatibilityScore: 0.82, confidence: 0.68, reasonCodes: ['CONTENT_COMPATIBILITY', 'CATEGORY_MATCH'], breakdown: { contentCompatibility: 0.87, audienceCountryMatch: 0.5, categoryMatch: 1, historicalPerformance: 0.75 }, dataStatus: 'AVAILABLE' } }], meta: { sampleSize: 1, rankedCount: 1, truncated: false, audienceCountryCoverage: 1, validatedPerformanceCoverage: 1, audienceDemographicsAvailable: ['COUNTRY'], unavailableDemographics: ['AGE', 'GENDER'] } } };
  if (apiPath === '/reports/{id}/ai-triage') return { success: true, data: { status: 'CLASSIFIED', category: 'FALSE_CLAIMS', severity: 'MEDIUM', confidence: 0.82, explanation: 'The supplied report describes a potentially misleading campaign claim and should be checked against campaign evidence.', needsHumanReview: true, suggestedActions: ['REVIEW_EVIDENCE', 'CHECK_POLICY'], duplicateStatus: 'ASSESSED', duplicateMethod: 'GEMINI_EMBEDDINGS', duplicateDetected: false, similarReports: [] } };
  if (apiPath === '/creator/earnings/prediction') return { success: true, data: { status: 'ESTIMATED', windowDays: 7, currency: 'USD', method: 'MATURED_VIEW_TREND_AND_REALIZED_CPM', estimatedGrossAmountCents: 1420, estimatedCreatorNetAmountCents: 1278, predictedNext7DaysViews: 3200, confidence: 0.51, campaignsAnalyzed: 1, campaignsEstimated: 1, explanation: 'Estimate only; it does not change or represent the confirmed wallet balance.', campaigns: [{ campaignId: '66a111111111111111111111', status: 'ESTIMATED', historicalDays: 4, maturedValidatedViews: 3900, predictedNext7DaysViews: 3200, estimatedGrossAmountCents: 1420, estimatedCreatorNetAmountCents: 1278, confidence: 0.51, explanation: 'Estimated from matured validated views and confirmed creator ledger history. Not withdrawable.' }] } };
  if (apiPath === '/language/detect') return { success: true, data: { language: 'ar', confidence: 0.99, method: 'UNICODE_SCRIPT_HEURISTIC' } };
  if (apiPath === '/language/translate') return { success: true, data: { translation: 'حملتك جاهزة للمراجعة.', sourceLanguage: 'en', targetLanguage: 'ar' } };
  if (apiPath === '/wallet/intelligence' || apiPath === '/ai/wallet/intelligence') return { success: true, data: { paymentFraud: { status: 'INSUFFICIENT_DATA', risk: 'UNKNOWN', reasonCodes: [], requiresHumanReview: false }, paymentMethodRecommendation: { status: 'INSUFFICIENT_DATA', method: null, basis: null }, depositAmountPrediction: { status: 'INSUFFICIENT_DATA', amount: null, sampleSize: 0, basis: null }, dailyBudgetRecommendation: { status: 'INSUFFICIENT_DATA', recommendedLimit: null, basis: null }, budgetExhaustionPrediction: { status: 'INSUFFICIENT_DATA', daysRemaining: null, estimatedExhaustionAt: null }, spendingAnomaly: { status: 'INSUFFICIENT_DATA', risk: 'UNKNOWN', reasonCodes: [] }, refundFraud: { status: 'INSUFFICIENT_DATA', risk: 'UNKNOWN', reasonCodes: [] }, refundMethodRecommendation: { status: 'INSUFFICIENT_DATA', method: null, basis: 'REFUND_METHOD_MUST_MATCH_ORIGINAL_PAYMENT_METHOD' }, refundLikelihoodPrediction: { status: 'INSUFFICIENT_DATA', probability: null, sampleSize: 0 } } };
  if (apiPath === '/campaigns' && method === 'post') return { success: true, message: 'Campaign created and reviewed', campaign: { id: '66a111111111111111111111', status: 'MANUAL_REVIEW', aiReview: { status: 'MANUAL_REVIEW_REQUIRED', score: 62 } } };
  if (apiPath === '/campaigns/{campaignId}/ai-review') return { success: true, aiReview: { status: 'APPROVED', score: 92, feedback: 'The supplied campaign brief passed policy review.' } };
  if (apiPath === '/campaigns/{campaignId}/submissions' && method === 'post') return { success: true, data: { id: '66a222222222222222222222', displayStatus: 'PROCESSING', aiReview: { status: 'PENDING' } } };
  if (apiPath.includes('/export')) return undefined;
  if (method === 'get' && (apiPath.endsWith('/my') || apiPath.endsWith('/threads') || apiPath.endsWith('/notifications') || apiPath.endsWith('/favorites') || apiPath.endsWith('/transactions') || apiPath.endsWith('/withdrawals'))) return { success: true, data: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 } };
  return { success: true, data: { id: '66a111111111111111111111' } };
}

function requestBodyFor(key, apiPath, method) {
  if (key === 'PUT /profile') {
    return {
      required: false,
      description: 'Send profile fields as JSON. Use multipart/form-data when uploading a profile picture file.',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ProfileUpdateInput' } },
        'multipart/form-data': { schema: { $ref: '#/components/schemas/ProfileUpdateMultipartInput' } },
      },
    };
  }
  const schemaName = BODY_SCHEMAS[key];
  if (schemaName) {
    const multipart = schemaName.includes('Multipart') || schemaName === 'BankTransferReceiptInput';
    const requestRequired = !['ApplicationCreateInput', 'CampaignCopyInput', 'CampaignDraftMultipartInput', 'ResubmitSubmissionInput', 'CreatorPreferencesInput', 'PaymentRiskAssessmentInput', 'CreatorWithdrawalIntelligenceInput'].includes(schemaName);
    return {
      required: requestRequired,
      description: schemaName.includes('Multipart') ? 'Send as multipart/form-data; nested JSON fields are serialized as strings before submission.' : undefined,
      content: { [multipart ? 'multipart/form-data' : 'application/json']: { schema: { $ref: `#/components/schemas/${schemaName}` } } },
    };
  }
  if (NO_BODY.has(key)) return undefined;
  return undefined;
}

function buildOperation(route) {
  const { method, path: apiPath } = route;
  const key = `${method.toUpperCase()} ${apiPath}`;
  const roles = rolesFor(apiPath, method, key);
  const operation = {
    tags: [tagFor(apiPath)],
    summary: SUMMARY[key] || `${({ get: 'Get', post: 'Create or process', put: 'Replace or update', patch: 'Update', delete: 'Delete' })[method]} ${apiPath.split('/').filter(Boolean).slice(-1)[0]?.replace(/[{}]/g, '').replace(/[-_]/g, ' ') || 'resource'}`,
    description: descriptionFor(apiPath, method, key, roles),
    operationId: `${method}_${apiPath.replace(/[{}]/g, '').split('/').filter(Boolean).join('_') || 'root'}`,
    'x-roles': roles,
    parameters: [...pathParameters(apiPath), ...queryParameters(apiPath, method)],
    responses: {},
  };
  if (PUBLIC.has(key)) operation.security = [];
  else if (key === 'POST /campaigns/{campaignId}/report') operation.security = [{ BearerAuth: [] }, {}];
  const body = requestBodyFor(key, apiPath, method);
  if (body) operation.requestBody = body;

  if (apiPath === '/' && method === 'get') {
    operation.servers = [{ url: '/', description: 'Main Backend root' }];
    operation.responses['200'] = { description: 'Plain text liveness response.', content: { 'text/plain': { schema: { type: 'string', example: 'Halal Clipping API is Running...' } } } };
    return operation;
  }
  if (apiPath === '/auth/reset-password/{token}' && method === 'get') {
    operation.responses['200'] = { description: 'HTML password reset page.', content: { 'text/html': { schema: { type: 'string' } } } };
    operation.responses['400'] = { $ref: '#/components/responses/ValidationError' };
    return operation;
  }
  if (apiPath === '/auth/google' || apiPath === '/auth/google/callback') {
    operation.responses['302'] = { description: 'Redirects to Google OAuth or the configured frontend callback.' };
    operation.responses['400'] = { description: 'OAuth callback failed.' };
    return operation;
  }

  const successStatus = ['POST /auth/register', 'POST /campaigns', 'POST /campaigns/drafts', 'POST /campaigns/{campaignId}/copy', 'POST /campaigns/{campaignId}/apply', 'POST /applications/{id}/materials/download-all', 'POST /applications/{id}/materials/{materialId}/download-link', 'POST /campaigns/{campaignId}/submissions', 'POST /creator/payment-methods', 'POST /creator/withdrawals'].includes(key) ? '201' : '200';
  const success = responseExample(apiPath, method);
  if (apiPath === '/materials/download/{token}') {
    operation.responses['200'] = { description: 'Single-use material download stream.', headers: { 'Content-Disposition': { schema: { type: 'string' } }, 'Cache-Control': { schema: { type: 'string', example: 'no-store' } } }, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } };
  } else if (apiPath === '/wallet/transactions/export') {
    operation.responses['200'] = { description: 'Excel transaction export.', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } };
  } else if (apiPath === '/wallet/transactions/export/pdf') {
    operation.responses['200'] = { description: 'PDF transaction export.', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } };
  } else if (apiPath === '/campaigns/{campaignId}/export') {
    operation.responses['200'] = { description: 'Campaign CSV export.', content: { 'text/csv': { schema: { type: 'string' }, example: 'creator,submission,status\nExample Creator,66a222222222222222222222,APPROVED' } } };
  } else {
    const successResponse = { description: successStatus === '201' ? 'Resource created.' : 'Request completed.' };
    if (success !== undefined) successResponse.content = { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccessEnvelope' }, examples: { response: { summary: 'Example successful response', value: success } } } };
    operation.responses[successStatus] = successResponse;
  }

  if (SPECIFIC_RESPONSE_SCHEMAS[key] && operation.responses[successStatus].content?.['application/json']) {
    operation.responses[successStatus].content['application/json'].schema = { $ref: `#/components/schemas/${SPECIFIC_RESPONSE_SCHEMAS[key]}` };
  }

  if (['post', 'put', 'patch', 'delete'].includes(method) || apiPath.includes('{')) operation.responses['400'] = { $ref: '#/components/responses/ApiValidationError' };
  if (!PUBLIC.has(key) && key !== 'POST /campaigns/{campaignId}/report') operation.responses['401'] = { $ref: '#/components/responses/ApiUnauthorized' };
  if (roles.includes('ADMIN') || roles.includes('BRAND') || roles.includes('BRAND_OWNER') || roles.includes('CLIPPER')) operation.responses['403'] = { $ref: '#/components/responses/ApiForbidden' };
  if (apiPath.includes('{') || apiPath.includes('/campaigns') || apiPath.includes('/applications') || apiPath.includes('/submissions') || apiPath.includes('/reports') || apiPath.includes('/wallet')) operation.responses['404'] = { $ref: '#/components/responses/ApiNotFound' };
  if (['POST /campaigns/{campaignId}/apply', 'PUT /applications/{id}/status', 'POST /campaigns/{campaignId}/submissions', 'POST /submissions/{id}/resubmit', 'PUT /submissions/{id}/review', 'PUT /reports/{id}', 'POST /creator/withdrawals'].includes(key)) operation.responses['409'] = { $ref: '#/components/responses/ApiConflict' };
  if (apiPath.includes('/ai-review') || apiPath.includes('/ai-assistance') || apiPath.includes('/ai-insights') || apiPath.includes('/ai-ranking') || apiPath.includes('/ai-triage') || apiPath.includes('/earnings/prediction') || apiPath === '/wallet/intelligence' || apiPath === '/ai/wallet/intelligence' || apiPath.startsWith('/chat/')) operation.responses['502'] = { $ref: '#/components/responses/ApiBadGateway' };
  if (apiPath.startsWith('/chat/') || apiPath === '/campaigns/{campaignId}/report' || apiPath.startsWith('/auth/')) operation.responses['429'] = { $ref: '#/components/responses/ApiRateLimited' };
  if (apiPath.startsWith('/creator/') || apiPath.includes('/ai-assistance') || apiPath.includes('/ai-insights') || apiPath.includes('/ai-ranking') || apiPath.includes('/ai-triage') || apiPath === '/wallet/intelligence' || apiPath === '/ai/wallet/intelligence') operation.responses['503'] = { $ref: '#/components/responses/ApiServiceUnavailable' };
  if (key === 'PUT /campaigns/{campaignId}/auto-recharge') operation.responses['501'] = { description: 'Auto-recharge is a deferred stub.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Auto-recharge is not available yet.', code: 'NOT_IMPLEMENTED' } } } };
  operation.responses['500'] = { $ref: '#/components/responses/ApiServerError' };
  return operation;
}

function addSchemas() {
  const schemas = spec.components.schemas;
  schemas.ApiSuccessEnvelope = {
    type: 'object', required: ['success'], additionalProperties: true,
    properties: { success: { oneOf: [{ type: 'boolean', const: true }, { type: 'string', enum: ['true'] }] }, message: { type: 'string' }, data: {}, campaign: { type: 'object', additionalProperties: true }, pagination: { $ref: '#/components/schemas/Pagination' } },
  };
  schemas.ApiErrorEnvelope = {
    type: 'object', required: ['success', 'message'], additionalProperties: true,
    properties: { success: { oneOf: [{ type: 'boolean', const: false }, { type: 'string', enum: ['false'] }] }, message: { type: 'string' }, code: { type: 'string' }, details: { type: 'object', additionalProperties: true }, errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } } },
  };
  schemas.Pagination = { type: 'object', properties: { page: { type: 'integer', minimum: 1 }, perPage: { type: 'integer', minimum: 1 }, total: { type: 'integer', minimum: 0 }, totalPages: { type: 'integer', minimum: 0 } } };
  schemas.AICheck = { type: 'object', properties: { code: { type: 'string' }, status: { type: 'string', enum: ['PASSED', 'FAILED', 'NEEDS_REVIEW'] }, message: { type: 'string' }, score: { type: ['integer', 'null'], minimum: 0, maximum: 100 } } };
  schemas.CampaignDraftAIData = { type: 'object', required: ['policyDecision', 'qualityScore', 'category', 'subCategories', 'feedback', 'checks', 'suggestions', 'duplicateDrafts', 'expiryPrediction'], properties: { policyDecision: { type: 'string', enum: ['APPROVED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED'] }, qualityScore: { type: ['integer', 'null'], minimum: 0, maximum: 100 }, category: { type: ['string', 'null'], enum: [...contentTypeValues, null] }, subCategories: { type: 'array', items: { type: 'string' } }, feedback: { type: 'string' }, checks: { type: 'array', items: { $ref: '#/components/schemas/AICheck' } }, suggestions: { type: 'array', items: { type: 'object', required: ['field', 'suggestion'], properties: { field: { type: 'string' }, suggestion: { type: 'string' } } } }, duplicateDrafts: { type: 'object', required: ['status', 'matches'], properties: { status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_DATA'] }, matches: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, similarity: { type: 'number', minimum: 0, maximum: 1 } } } } } }, expiryPrediction: { type: 'object', required: ['status', 'notify', 'daysUntilExpiry', 'basis'], properties: { status: { type: 'string', enum: ['INSUFFICIENT_DATA', 'EXPIRING_SOON', 'NOT_EXPIRING_SOON', 'EXPIRED'] }, notify: { type: 'boolean' }, daysUntilExpiry: { type: ['integer', 'null'] }, basis: { type: 'string' } } } } };
  schemas.CampaignInsightsAIData = { type: 'object', required: ['performancePrediction', 'similarCampaigns', 'categoryAnalytics'], properties: { performancePrediction: { type: 'object', properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, sampleSize: { type: 'integer', minimum: 0 }, predictedViews: { type: ['integer', 'null'], minimum: 0 }, viewsPerDollarMedian: { type: ['number', 'null'], minimum: 0 }, confidence: { type: 'string', enum: ['LOW', 'MEDIUM'] }, recommendations: { type: 'array', items: { type: 'string' } } } }, similarCampaigns: { type: 'object', properties: { status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE', 'INSUFFICIENT_DATA'] }, matches: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, similarity: { type: 'number', minimum: 0, maximum: 1 } } } } } }, categoryAnalytics: { type: 'object', properties: { status: { type: 'string', enum: ['AVAILABLE', 'INSUFFICIENT_DATA'] }, categories: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, sampleSize: { type: 'integer' }, medianViewsPerDollar: { type: 'number' } } } } } } } };
  schemas.WalletIntelligenceAIData = { type: 'object', required: ['paymentFraud', 'paymentMethodRecommendation', 'depositAmountPrediction', 'dailyBudgetRecommendation', 'budgetExhaustionPrediction', 'spendingAnomaly', 'refundFraud', 'refundMethodRecommendation', 'refundLikelihoodPrediction'], properties: { paymentFraud: { type: 'object', properties: { status: { type: 'string', enum: ['ASSESSED', 'INSUFFICIENT_DATA'] }, risk: { type: 'string', enum: ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'] }, reasonCodes: { type: 'array', items: { type: 'string' } }, requiresHumanReview: { type: 'boolean' } } }, paymentMethodRecommendation: { type: 'object', properties: { status: { type: 'string', enum: ['RECOMMENDED', 'INSUFFICIENT_DATA'] }, method: { type: ['string', 'null'], enum: [...paymentMethodValues, null] }, basis: { type: ['string', 'null'] } } }, depositAmountPrediction: { type: 'object', properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, amount: { type: ['number', 'null'], minimum: 0 }, sampleSize: { type: 'integer', minimum: 0 }, basis: { type: ['string', 'null'] } } }, dailyBudgetRecommendation: { type: 'object', properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, recommendedLimit: { type: ['number', 'null'], minimum: 0 }, basis: { type: ['string', 'null'] } } }, budgetExhaustionPrediction: { type: 'object', properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, daysRemaining: { type: ['number', 'null'], minimum: 0 }, estimatedExhaustionAt: { type: ['string', 'null'], format: 'date' } } }, spendingAnomaly: { type: 'object', properties: { status: { type: 'string', enum: ['ASSESSED', 'INSUFFICIENT_DATA'] }, risk: { type: 'string', enum: ['UNKNOWN', 'LOW', 'HIGH'] }, reasonCodes: { type: 'array', items: { type: 'string' } } } }, refundFraud: { type: 'object', properties: { status: { type: 'string', enum: ['ASSESSED', 'INSUFFICIENT_DATA'] }, risk: { type: 'string', enum: ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'] }, reasonCodes: { type: 'array', items: { type: 'string' } } } }, refundMethodRecommendation: { type: 'object', properties: { status: { type: 'string', enum: ['RECOMMENDED', 'INSUFFICIENT_DATA'] }, method: { type: ['string', 'null'], enum: [...paymentMethodValues, null] }, basis: { type: ['string', 'null'] } } }, refundLikelihoodPrediction: { type: 'object', properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, probability: { type: ['number', 'null'], minimum: 0, maximum: 1 }, sampleSize: { type: 'integer', minimum: 0 } } } } };
  schemas.CampaignDraftAIResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { $ref: '#/components/schemas/CampaignDraftAIData' } } };
  schemas.CampaignInsightsAIData = {
    type: 'object',
    required: ['performancePrediction', 'similarCampaigns', 'categoryAnalytics', 'archivedCampaignAnalysis', 'successfulCampaignPatterns', 'policyAcceptanceAnalytics'],
    properties: {
      ...schemas.CampaignInsightsAIData.properties,
      archivedCampaignAnalysis: { type: 'object', required: ['status', 'archivedCampaigns', 'archivedCampaignsWithMeasuredOutcomes', 'medianArchivedViewsPerDollar'], properties: { status: { type: 'string', enum: ['AVAILABLE', 'INSUFFICIENT_DATA'] }, archivedCampaigns: { type: 'integer', minimum: 0 }, archivedCampaignsWithMeasuredOutcomes: { type: 'integer', minimum: 0 }, medianArchivedViewsPerDollar: { type: ['number', 'null'], minimum: 0 } } },
      successfulCampaignPatterns: { type: 'object', required: ['status', 'sampleSize', 'patterns', 'basis'], properties: { status: { type: 'string', enum: ['AVAILABLE', 'INSUFFICIENT_DATA'] }, sampleSize: { type: 'integer', minimum: 0 }, patterns: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, sampleSize: { type: 'integer', minimum: 0 }, medianViewsPerDollar: { type: 'number', minimum: 0 } } } }, basis: { type: 'string' } } },
      policyAcceptanceAnalytics: { type: 'object', required: ['status', 'totalSubmissions', 'acceptedSubmissions', 'acceptanceRate', 'recommendations'], properties: { status: { type: 'string', enum: ['AVAILABLE', 'INSUFFICIENT_DATA'] }, totalSubmissions: { type: 'integer', minimum: 0 }, acceptedSubmissions: { type: 'integer', minimum: 0 }, acceptanceRate: { type: ['number', 'null'], minimum: 0, maximum: 1 }, recommendations: { type: 'array', items: { type: 'string' } } } },
    },
  };
  schemas.CreatorWithdrawalIntelligenceData = { type: 'object', required: ['status', 'risk', 'confidence', 'requiresHumanReview', 'signals', 'historySampleSize', 'requestsLast24Hours', 'processingTimePrediction', 'paymentMethodRecommendation'], properties: { status: { type: 'string', enum: ['ASSESSED', 'INSUFFICIENT_DATA'] }, risk: { type: 'string', enum: ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'] }, confidence: { type: 'string', enum: ['LOW', 'MEDIUM'] }, requiresHumanReview: { type: 'boolean' }, signals: { type: 'array', items: { type: 'object', required: ['code', 'severity', 'explanation'], properties: { code: { type: 'string' }, severity: { type: 'string', enum: ['MEDIUM', 'HIGH'] }, explanation: { type: 'string' } } } }, historySampleSize: { type: 'integer', minimum: 0 }, requestsLast24Hours: { type: 'integer', minimum: 0 }, processingTimePrediction: { type: 'object', required: ['status', 'medianHours', 'sampleSize'], properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, medianHours: { type: ['number', 'null'], minimum: 0 }, sampleSize: { type: 'integer', minimum: 0 } } }, paymentMethodRecommendation: { type: 'object', required: ['status', 'country', 'methods', 'basis'], properties: { status: { type: 'string', enum: ['RECOMMENDED', 'INSUFFICIENT_DATA'] }, country: { type: ['string', 'null'] }, methods: { type: 'array', items: { type: 'string', enum: ['PAYPAL', 'BANK_TRANSFER', 'STC_PAY', 'MADA', 'OTHER'] } }, basis: { type: ['string', 'null'] } } } } };
  schemas.CreatorWithdrawalIntelligenceResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { $ref: '#/components/schemas/CreatorWithdrawalIntelligenceData' } } };
  schemas.CreatorEarningsPredictionResponse = {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', const: true },
      data: {
        type: 'object',
        required: ['status', 'windowDays', 'currency', 'method', 'estimatedGrossAmountCents', 'estimatedCreatorNetAmountCents', 'predictedNext7DaysViews', 'confidence', 'campaignsAnalyzed', 'campaignsEstimated', 'explanation', 'campaigns'],
        properties: {
          status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] },
          windowDays: { type: 'integer', const: 7 },
          currency: { type: 'string', const: 'USD' },
          method: { type: 'string', const: 'MATURED_VIEW_TREND_AND_REALIZED_CPM' },
          estimatedGrossAmountCents: { type: ['integer', 'null'], minimum: 0 },
          estimatedCreatorNetAmountCents: { type: ['integer', 'null'], minimum: 0 },
          predictedNext7DaysViews: { type: ['integer', 'null'], minimum: 0 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          campaignsAnalyzed: { type: 'integer', minimum: 0, maximum: 100 },
          campaignsEstimated: { type: 'integer', minimum: 0, maximum: 100 },
          explanation: { type: 'string', maxLength: 500 },
          campaigns: {
            type: 'array', maxItems: 100,
            items: {
              type: 'object',
              required: ['campaignId', 'status', 'historicalDays', 'maturedValidatedViews', 'predictedNext7DaysViews', 'estimatedGrossAmountCents', 'estimatedCreatorNetAmountCents', 'confidence', 'explanation'],
              properties: {
                campaignId: { type: 'string' },
                status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] },
                historicalDays: { type: 'integer', minimum: 0, maximum: 7 },
                maturedValidatedViews: { type: 'integer', minimum: 0 },
                predictedNext7DaysViews: { type: ['integer', 'null'], minimum: 0 },
                estimatedGrossAmountCents: { type: ['integer', 'null'], minimum: 0 },
                estimatedCreatorNetAmountCents: { type: ['integer', 'null'], minimum: 0 },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                explanation: { type: 'string', maxLength: 500 },
              },
            },
          },
        },
      },
    },
  };
  schemas.CampaignReportSummaryResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { type: 'object', required: ['campaignId', 'totalReports', 'statusCounts', 'reasonCounts'], properties: { campaignId: objectId, totalReports: { type: 'integer', minimum: 0 }, statusCounts: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } }, reasonCounts: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } } } } } };
  schemas.LanguageDetectionResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { type: 'object', required: ['language', 'confidence', 'method'], properties: { language: { type: 'string', enum: ['ar', 'en', 'unknown'] }, confidence: { type: 'number', minimum: 0, maximum: 1 }, method: { type: 'string', const: 'UNICODE_SCRIPT_HEURISTIC' } } } } };
  schemas.TranslationResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { type: 'object', required: ['translation', 'sourceLanguage', 'targetLanguage'], properties: { translation: { type: 'string', minLength: 1, maxLength: 10000 }, sourceLanguage: { type: 'string', enum: ['ar', 'en', 'unknown'] }, targetLanguage: { type: 'string', enum: ['ar', 'en'] } } } } };
  schemas.ApplicantMatchBreakdown = {
    type: 'object',
    required: ['contentCompatibility', 'audienceCountryMatch', 'categoryMatch', 'historicalPerformance'],
    properties: {
      contentCompatibility: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      audienceCountryMatch: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      categoryMatch: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      historicalPerformance: { type: ['number', 'null'], minimum: 0, maximum: 1 },
    },
  };
  schemas.ApplicantCompatibility = {
    type: 'object',
    required: ['applicantId', 'rank', 'compatibilityScore', 'confidence', 'reasonCodes', 'breakdown', 'dataStatus'],
    properties: {
      applicantId: objectId,
      rank: { type: 'integer', minimum: 1 },
      compatibilityScore: { type: 'number', minimum: 0, maximum: 1 },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      reasonCodes: { type: 'array', items: { type: 'string', enum: ['CONTENT_COMPATIBILITY', 'AUDIENCE_COUNTRY_MATCH', 'CATEGORY_MATCH', 'VALIDATED_PERFORMANCE_HISTORY'] } },
      breakdown: { $ref: '#/components/schemas/ApplicantMatchBreakdown' },
      dataStatus: { type: 'string', enum: ['AVAILABLE', 'INSUFFICIENT_DATA'] },
    },
  };
  schemas.CampaignApplicantRankingResponse = {
    type: 'object', required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', const: true },
      data: {
        type: 'object', required: ['campaignId', 'status', 'method', 'data', 'meta'],
        properties: {
          campaignId: objectId,
          status: { type: 'string', enum: ['AVAILABLE', 'INSUFFICIENT_DATA'] },
          method: { type: 'string', enum: ['GEMINI_EMBEDDINGS', 'TOKEN_OVERLAP_FALLBACK', 'NONE'] },
          data: {
            type: 'array',
            items: {
              type: 'object', required: ['applicationId', 'status', 'message', 'appliedAt', 'creator', 'aiMatch'],
              properties: {
                applicationId: objectId,
                status: { type: 'string', const: 'PENDING' },
                message: { type: 'string' },
                appliedAt: { type: ['string', 'null'], format: 'date-time' },
                creator: { type: 'object', required: ['id', 'fullName', 'profilePicture'], properties: { id: objectId, fullName: { type: 'string' }, profilePicture: { type: ['string', 'null'] } } },
                aiMatch: { anyOf: [{ $ref: '#/components/schemas/ApplicantCompatibility' }, { type: 'null' }] },
              },
            },
          },
          meta: {
            type: 'object', required: ['sampleSize', 'rankedCount', 'truncated', 'audienceCountryCoverage', 'validatedPerformanceCoverage', 'audienceDemographicsAvailable', 'unavailableDemographics'],
            properties: {
              sampleSize: { type: 'integer', minimum: 0 },
              rankedCount: { type: 'integer', minimum: 0 },
              truncated: { type: 'boolean' },
              audienceCountryCoverage: { type: 'integer', minimum: 0 },
              validatedPerformanceCoverage: { type: 'integer', minimum: 0 },
              audienceDemographicsAvailable: { type: 'array', items: { type: 'string' } },
              unavailableDemographics: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  };
  schemas.ReportAITriageResponse = {
    type: 'object', required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', const: true },
      data: {
        type: 'object',
        required: ['status', 'category', 'severity', 'confidence', 'explanation', 'needsHumanReview', 'suggestedActions', 'duplicateStatus', 'duplicateMethod', 'duplicateDetected', 'similarReports'],
        properties: {
          status: { type: 'string', enum: ['CLASSIFIED', 'NEEDS_REVIEW'] },
          category: { type: 'string', enum: reportReasonValues },
          severity: { type: 'string', enum: ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          explanation: { type: 'string', maxLength: 800 },
          needsHumanReview: { type: 'boolean', const: true },
          suggestedActions: { type: 'array', maxItems: 5, items: { type: 'string', enum: ['REVIEW_EVIDENCE', 'CHECK_POLICY', 'REQUEST_CONTEXT', 'ESCALATE_PRIORITY', 'COMPARE_DUPLICATE'] } },
          duplicateStatus: { type: 'string', enum: ['ASSESSED', 'INSUFFICIENT_DATA', 'UNAVAILABLE'] },
          duplicateMethod: { type: 'string', enum: ['GEMINI_EMBEDDINGS', 'TOKEN_OVERLAP', 'NONE'] },
          duplicateDetected: { type: 'boolean' },
          similarReports: {
            type: 'array', maxItems: 10,
            items: {
              type: 'object', required: ['reportId', 'similarity', 'isDuplicateCandidate'],
              properties: {
                reportId: objectId,
                similarity: { type: 'number', minimum: 0, maximum: 1 },
                isDuplicateCandidate: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  };
  schemas.CampaignInsightsAIResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { $ref: '#/components/schemas/CampaignInsightsAIData' } } };
  schemas.WalletIntelligenceAIResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { $ref: '#/components/schemas/WalletIntelligenceAIData' } } };
  schemas.CampaignAnalyticsData = {
    type: 'object', required: ['campaignId', 'status', 'totalViews', 'approvedVideos', 'participatingCreators', 'amountSpent', 'remainingBudget', 'viewsAvailable', 'geographyAvailable', 'viewsByCountry', 'viewIntelligence', 'generatedAt'],
    properties: {
      campaignId: { $ref: '#/components/schemas/ObjectId' }, status: { type: 'string' }, totalViews: { type: 'integer', minimum: 0 },
      approvedVideos: { type: 'integer', minimum: 0 }, participatingCreators: { type: 'integer', minimum: 0 }, amountSpent: { type: 'number', minimum: 0 },
      remainingBudget: { type: 'number', minimum: 0 }, viewsAvailable: { type: 'boolean' }, geographyAvailable: { type: 'boolean' },
      viewsByCountry: { type: 'array', items: { type: 'object', required: ['countryCode', 'views'], properties: { countryCode: { type: 'string', pattern: '^[A-Z]{3}$' }, views: { type: 'integer', minimum: 0 } } } },
      viewIntelligence: { $ref: '#/components/schemas/CampaignViewIntelligence' }, generatedAt: { type: 'string', format: 'date-time' },
    },
  };
  schemas.CampaignViewIntelligence = {
    type: 'object', required: ['status', 'windowDays', 'futureViewPrediction', 'earningsPrediction'],
    properties: {
      status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] }, windowDays: { type: 'integer', const: 7 },
      observedViews: { type: 'integer', minimum: 0 }, validatedViewsInWindow: { type: 'integer', minimum: 0 }, pendingValidationViewsInWindow: { type: 'integer', minimum: 0 }, flaggedViewsPendingReview: { type: 'integer', minimum: 0 },
      maturedValidatedViews: { type: 'integer', minimum: 0 }, confirmedGrossEarningsCents: { type: 'integer', minimum: 0 }, confirmedCreatorNetEarningsCents: { type: 'integer', minimum: 0 },
      suspiciousPatterns: { type: 'array', items: { type: 'object', additionalProperties: true } },
      botAndFakeViewAssessment: { type: 'object', additionalProperties: true },
      abnormalViewSpike: { type: 'object', additionalProperties: true }, suddenViewDrop: { type: 'object', additionalProperties: true },
      futureViewPrediction: { type: 'object', required: ['status', 'predictedNext7DaysViews', 'confidence', 'explanation'], properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, predictedNext7DaysViews: { type: ['integer', 'null'], minimum: 0 }, confidence: { type: 'number', minimum: 0, maximum: 1 }, explanation: { type: 'string' } } },
      geographicAudience: { type: 'object', additionalProperties: true }, countryGrowthPrediction: { type: 'object', additionalProperties: true },
      nonTargetGeographicAnomaly: { type: 'object', properties: { status: { type: 'string' }, detected: { type: 'boolean' }, outOfTargetViews: { type: 'integer', minimum: 0 }, isFraud: { type: 'boolean', const: false }, confidence: { type: 'number', minimum: 0, maximum: 1 }, explanation: { type: 'string' } } },
      earningsPrediction: { type: 'object', required: ['status', 'estimatedGrossAmountCents', 'estimatedCreatorNetAmountCents', 'currency', 'confidence', 'explanation'], properties: { status: { type: 'string', enum: ['ESTIMATED', 'INSUFFICIENT_DATA'] }, estimatedGrossAmountCents: { type: ['integer', 'null'], minimum: 0 }, estimatedCreatorNetAmountCents: { type: ['integer', 'null'], minimum: 0 }, currency: { type: 'string', enum: ['USD'] }, confidence: { type: 'number', minimum: 0, maximum: 1 }, explanation: { type: 'string' } } },
      explanation: { type: 'string' },
    },
  };
  schemas.CampaignAnalyticsResponse = { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', const: true }, data: { $ref: '#/components/schemas/CampaignAnalyticsData' } } };
  Object.assign(schemas, REQUEST_SCHEMAS);
  Object.assign(spec.components.responses, {
    ApiValidationError: { description: 'Request validation failed. Main Backend validation errors use HTTP 400.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Validation failed', code: 'VALIDATION_ERROR' } } } },
    ApiUnauthorized: { description: 'Bearer token is missing, invalid, expired, or revoked.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Not authorized', code: 'UNAUTHORIZED' } } } },
    ApiForbidden: { description: 'The caller has the wrong role or does not own the referenced resource.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Forbidden', code: 'FORBIDDEN' } } } },
    ApiNotFound: { description: 'The resource does not exist or is not visible to this caller.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Resource not found', code: 'NOT_FOUND' } } } },
    ApiConflict: { description: 'The requested lifecycle transition conflicts with the current state.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'The resource is not available for this action.', code: 'CONFLICT' } } } },
    ApiRateLimited: { description: 'The caller exceeded the configured endpoint rate limit.', headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Too many requests', code: 'TOO_MANY_REQUESTS' } } } },
    ApiBadGateway: { description: 'An upstream AI or integration service failed or returned an invalid response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Upstream service unavailable', code: 'AI_SERVICE_BAD_RESPONSE' } } } },
    ApiServiceUnavailable: { description: 'A required service or encryption configuration is unavailable.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' } } } },
    ApiServerError: { description: 'The request could not be completed. Internal details are not returned.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' }, example: { success: false, message: 'Server error', code: 'INTERNAL_ERROR' } } } },
  });
}

function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .map(([key, child]) => [key, omitUndefined(child)]));
}

function main() {
  addSchemas();
  spec.info.title = 'PayPerView Main Backend API';
  spec.info.description = 'OpenAPI contract for all currently mounted Main Backend HTTP routes. Route coverage is checked against Express router definitions by scripts/validateOpenApi.js. API data uses USD and ISO-8601 UTC timestamps unless noted. Upload routes accept multipart/form-data; exported files and material downloads return binary or CSV responses.';
  spec.info.version = '1.0.0';
  spec.servers = [{ url: '/api/v1', description: 'Main Backend API base path' }];
  spec.tags = TAGS;
  delete spec.externalDocs;
  const previousPaths = spec.paths || {};
  spec.paths = {};
  for (const route of getMountedRoutes()) {
    spec.paths[route.path] ||= {};
    const operation = buildOperation(route);
    const previous = previousPaths[route.path]?.[route.method];
    if (previous) {
      const key = `${route.method.toUpperCase()} ${route.path}`;
      const description = [...new Set([previous.description, operation.description].filter(Boolean))].join(' ');
      spec.paths[route.path][route.method] = {
        ...previous,
        ...operation,
        summary: SUMMARY[key] || previous.summary || operation.summary,
        description,
        parameters: operation.parameters,
        requestBody: NO_BODY.has(key) ? undefined : operation.requestBody || previous.requestBody,
        responses: { ...operation.responses, ...previous.responses },
      };
      if (SPECIFIC_RESPONSE_SCHEMAS[key]) {
        if (operation.responses['200']) spec.paths[route.path][route.method].responses['200'] = operation.responses['200'];
      }
    } else {
      spec.paths[route.path][route.method] = operation;
    }
  }
  spec.components.securitySchemes = {
    ...(spec.components.securitySchemes || {}),
    BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'PayPerView access JWT. Send it as Authorization: Bearer <token>.' },
  };
  spec.security = [{ BearerAuth: [] }];
  fs.writeFileSync(specPath, yaml.dump(omitUndefined(spec), { noRefs: true, lineWidth: 110, sortKeys: false }), 'utf8');
  console.log(`Generated ${Object.values(spec.paths).reduce((sum, operations) => sum + Object.keys(operations).filter((key) => ['get','post','put','patch','delete'].includes(key)).length, 0)} operations across ${Object.keys(spec.paths).length} paths.`);
}

main();
