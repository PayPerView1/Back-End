const aiReviewClient = require('../services/ai/aiSubmissionReview.client');

describe('AI submission review response contract', () => {
  const originalEnv = {};

  beforeEach(() => {
    for (const key of ['AI_MOCK', 'AI_MOCK_RESULT', 'AI_MOCK_DELAY_MS', 'NODE_ENV']) {
      originalEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ['AI_MOCK', 'AI_MOCK_RESULT', 'AI_MOCK_DELAY_MS', 'NODE_ENV']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  test('rejects responses missing required checks or feedback', () => {
    expect(() => aiReviewClient.normalizeAiResponse({
      result: 'APPROVED',
      score: 90,
    })).toThrow('missing required fields');
  });

  test('rejects invalid check statuses instead of silently downgrading them', () => {
    expect(() => aiReviewClient.normalizeAiResponse({
      result: 'MANUAL_REVIEW_REQUIRED',
      score: null,
      feedback: 'A human must review the media.',
      checks: [{ code: 'AUDIO_COMPLIANCE', status: 'UNKNOWN', message: 'Review audio.' }],
    })).toThrow('invalid check status');
  });

  test('keeps the media-limited manual-review response shape', () => {
    expect(aiReviewClient.normalizeAiResponse({
      result: 'MANUAL_REVIEW_REQUIRED',
      score: null,
      feedback: 'Media evidence is unavailable.',
      manualReasonCode: 'MEDIA_EVIDENCE_UNAVAILABLE',
      checks: [{ code: 'VIDEO_FORMAT', status: 'NEEDS_REVIEW', message: 'Video was not supplied.' }],
    })).toMatchObject({
      result: 'MANUAL_REVIEW_REQUIRED',
      score: null,
      manualReasonCode: 'MEDIA_EVIDENCE_UNAVAILABLE',
      checks: [{ code: 'VIDEO_FORMAT', status: 'NEEDS_REVIEW' }],
    });
  });

  test('blocks mock decisions in production, even when the flag is set', async () => {
    process.env.AI_MOCK = 'true';
    process.env.NODE_ENV = 'production';

    await expect(aiReviewClient.reviewSubmission({})).rejects.toMatchObject({
      code: 'AI_CONFIGURATION_ERROR',
    });
  });
});
