// src/services/ai/aiSubmissionReview.client.js
// عميل خدمة الـ AI لمراجعة التسليمات (العقد في API_CONTRACT_Sprint5.md §9).
//
// التوقيعات المتفق عليها:
//   buildReviewPayload({ submission, campaign, backendChecks }) -> payload
//   reviewSubmission(payload) -> { result, score, feedback, checks, manualReasonCode }
//        يرمي Error بـ code: AI_REQUEST_FAILED | AI_INVALID_RESPONSE (تعدّها المعالجة محاولة فاشلة)
//
// وضع التطوير: AI_MOCK=true (لا يتصل بالشبكة)
//   AI_MOCK_RESULT = APPROVED (افتراضي) | REJECTED | MANUAL_REVIEW_REQUIRED
//   AI_MOCK_DELAY_MS (افتراضي 2000) لتظهر حالة "قيد الفحص" في الواجهة
const axios = require('axios');
const { AI_REVIEW_RESULT } = require('../../constants/campaign.constants');
const { CHECK_STATUS, CHECK_SOURCE, CHECK_CODE } = require('../../constants/submission.constants');
const { extractHashtags, extractMentions } = require('../../utils/submission/hashtag.utils');

const REVIEW_PATH = '/api/v1/ai/submissions/review';
const DEFAULT_AI_URL = 'https://payperview-ai.onrender.com'; // نفس افتراضي aiChatbotClient

const getBaseUrl = () => process.env.AI_SERVICE_URL || DEFAULT_AI_URL;
const getTimeoutMs = () => Number(process.env.AI_REVIEW_TIMEOUT_MS) || 90000;

const makeError = (code, message, extra = {}) => {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
};

const clampScore = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== null && value !== '' ? Math.min(100, Math.max(0, Math.round(n))) : null;
};

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

const sanitizeCheck = (raw) => {
  if (!raw || typeof raw.code !== 'string') return null;
  const code = raw.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 50);
  if (code.length < 2) return null;

  const status = String(raw.status || '').toUpperCase();
  return {
    code,
    source: CHECK_SOURCE.AI,
    status: Object.values(CHECK_STATUS).includes(status) ? status : CHECK_STATUS.NEEDS_REVIEW,
    message: text(raw.message, 500),
    fixHint: text(raw.fixHint, 500),
    score: clampScore(raw.score),
    meta: null,
  };
};

/** يتحقق من رد خدمة الـ AI ويحوّله لشكل جاهز للتخزين */
const normalizeAiResponse = (raw) => {
  if (!raw || typeof raw !== 'object') {
    throw makeError('AI_INVALID_RESPONSE', 'AI response is not an object');
  }

  const result = String(raw.result || '').toUpperCase();
  const allowed = [
    AI_REVIEW_RESULT.APPROVED,
    AI_REVIEW_RESULT.REJECTED,
    AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED,
  ];
  if (!allowed.includes(result)) {
    throw makeError('AI_INVALID_RESPONSE', `Unknown AI result: ${String(raw.result)}`);
  }

  const checks = (Array.isArray(raw.checks) ? raw.checks : []).map(sanitizeCheck).filter(Boolean).slice(0, 30);

  return {
    result,
    score: clampScore(raw.score),
    feedback: typeof raw.feedback === 'string' ? raw.feedback.slice(0, 1000) : null,
    checks,
    manualReasonCode:
      result === AI_REVIEW_RESULT.MANUAL_REVIEW_REQUIRED
        ? text(raw.manualReasonCode, 50) || 'UNSPECIFIED'
        : null,
  };
};

/** يبني الطلب المرسل للـ AI (القيم بدون # و @ كما في العقد) */
const buildReviewPayload = ({ submission, campaign, backendChecks = [] }) => {
  const meta = submission.postMeta || {};
  const caption = meta.caption || '';
  const r = campaign.submissionRequirements || {};
  const h = campaign.halalDeclaration || {};
  const brief = campaign.brief || {};

  return {
    submissionId: String(submission._id),
    platform: submission.platform,
    postUrl: submission.canonicalUrl || submission.postUrl,
    post: {
      caption,
      hashtags: extractHashtags(caption).map((t) => t.replace(/^#/, '')),
      mentions: extractMentions(caption).map((m) => m.replace(/^@/, '')),
      authorHandle: meta.authorHandle || '',
      durationSec: meta.durationSec === undefined ? null : meta.durationSec,
      thumbnailUrl: meta.thumbnailUrl || '',
      fetchStatus: meta.fetchStatus || 'UNAVAILABLE',
    },
    campaign: {
      name: campaign.name,
      brief: {
        mainIdea: brief.mainIdea || '',
        tone: brief.tone || '',
        keyMessages: brief.keyMessages || '',
        keywords: brief.keywords || [],
      },
      requirements: {
        requiredHashtags: r.requiredHashtags || [],
        requiredKeywords: r.requiredKeywords || [],
        requiredMentions: r.requiredMentions || [],
        aspectRatio: r.aspectRatio || '9:16',
        minDurationSec: r.minDurationSec || null,
        maxDurationSec: r.maxDurationSec || null,
        shariaNote: r.shariaNote || '',
      },
      halalDeclaration: {
        noGambling: !!h.noGambling,
        noSexualContent: !!h.noSexualContent,
        noExplicitMusic: !!h.noExplicitMusic,
        noAlcohol: !!h.noAlcohol,
        noSuspiciousCurrencies: !!h.noSuspiciousCurrencies,
        noUnrealisticProfit: !!h.noUnrealisticProfit,
      },
    },
    backendChecks,
  };
};

// ----------------------
// Mock (للتطوير فقط)
// ----------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mockReview = async () => {
  const delay = process.env.AI_MOCK_DELAY_MS === undefined ? 2000 : Number(process.env.AI_MOCK_DELAY_MS);
  if (delay > 0) await sleep(delay);

  const mode = String(process.env.AI_MOCK_RESULT || 'APPROVED').toUpperCase();
  const pass = (code, message, score = 100) => ({ code, status: 'PASSED', message, fixHint: '', score });

  if (mode === 'REJECTED') {
    return normalizeAiResponse({
      result: 'REJECTED',
      score: 40,
      feedback: 'Mock: clip does not meet the requirements',
      checks: [
        { code: CHECK_CODE.AUDIO_COMPLIANCE, status: 'FAILED', message: 'Background music detected', fixHint: 'Replace the audio with a clean track', score: 20 },
        pass(CHECK_CODE.VIDEO_FORMAT, 'Vertical 9:16, 1080p'),
        pass(CHECK_CODE.LOGO_VISIBLE, 'Logo is visible', 95),
      ],
    });
  }

  if (mode === 'MANUAL_REVIEW_REQUIRED') {
    return normalizeAiResponse({
      result: 'MANUAL_REVIEW_REQUIRED',
      score: 70,
      feedback: 'Mock: audio needs a human check',
      manualReasonCode: 'AUDIO_UNCERTAIN',
      checks: [
        { code: CHECK_CODE.AUDIO_COMPLIANCE, status: 'NEEDS_REVIEW', message: 'Audio could not be classified with confidence', fixHint: '', score: 60 },
        pass(CHECK_CODE.VIDEO_FORMAT, 'Vertical 9:16, 1080p'),
      ],
    });
  }

  return normalizeAiResponse({
    result: 'APPROVED',
    score: 96,
    feedback: 'Mock: clip meets all requirements',
    checks: [
      pass(CHECK_CODE.AUDIO_COMPLIANCE, 'No music detected'),
      pass(CHECK_CODE.LOGO_VISIBLE, 'Logo is visible at the start', 95),
      pass(CHECK_CODE.AUDIO_CLARITY, 'Natural, clear voice', 96),
      pass(CHECK_CODE.PRESENTATION_QUALITY, 'High resolution', 94),
    ],
  });
};

// ----------------------
// الاستدعاء الفعلي
// ----------------------
const reviewSubmission = async (payload) => {
  if (process.env.AI_MOCK === 'true') return mockReview(payload);

  const apiKey = process.env.AI_SERVICE_API_KEY;
  let response;
  try {
    response = await axios.post(`${getBaseUrl()}${REVIEW_PATH}`, payload, {
      timeout: getTimeoutMs(),
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-Service-Key': apiKey } : {}) },
    });
  } catch (error) {
    const status = error.response ? error.response.status : null;
    throw makeError(
      'AI_REQUEST_FAILED',
      `AI review request failed: ${status ? `HTTP ${status}` : error.message}`,
      { status }
    );
  }

  return normalizeAiResponse(response.data);
};

module.exports = { buildReviewPayload, reviewSubmission, normalizeAiResponse };