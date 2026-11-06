// src/tests/submissionEligibility.test.js
const {
  classifyEligibility,
  matchesTab,
  countTabs,
  buildCampaignCode,
} = require('../utils/submission/submissionEligibility.utils');

const NOW = new Date('2026-10-28T10:00:00.000Z');
const inHours = (h) => new Date(NOW.getTime() + h * 3600 * 1000);

const camp = (overrides = {}) => ({
  _id: '66f1a2b3c4d5e6f708192a3b',
  status: 'ACTIVE',
  walletId: 'wallet-1',
  remainingBudget: 1000,
  isSuspended: false,
  isArchived: false,
  endDate: null,
  ...overrides,
});

const classify = (overrides, options = {}) => classifyEligibility(camp(overrides), { now: NOW, ...options });

describe('classifyEligibility: حملة جاهزة', () => {
  test('نشطة ومموّلة بلا تاريخ انتهاء', () => {
    expect(classify()).toEqual({
      eligible: true,
      availability: 'AVAILABLE',
      unavailableReason: null,
      isReady: true,
      isEndingSoon: false,
      hoursLeft: null,
      badges: ['READY'],
      active: 0,
      limit: 5,
    });
  });

  test('تنتهي خلال 18 ساعة: جاهزة وتنتهي قريباً', () => {
    const r = classify({ endDate: inHours(18) });
    expect(r.hoursLeft).toBe(18);
    expect(r.isEndingSoon).toBe(true);
    expect(r.badges).toEqual(['READY', 'ENDING_SOON']);
  });

  test('الساعات تُقرَّب لأعلى (17.2 ساعة تعني 18)', () => {
    expect(classify({ endDate: inHours(17.2) }).hoursLeft).toBe(18);
  });

  test('حدّ "تنتهي قريباً": 48 ساعة شاملة، و49 لا', () => {
    expect(classify({ endDate: inHours(48) }).isEndingSoon).toBe(true);
    expect(classify({ endDate: inHours(49) }).isEndingSoon).toBe(false);
    expect(classify({ endDate: inHours(49) }, { endingSoonHours: 72 }).isEndingSoon).toBe(true);
  });

  test('متوقفة بسبب الحد اليومي: جاهزة (تُستأنف منتصف الليل)', () => {
    const r = classify({ status: 'PAUSED', pauseReason: 'DAILY_LIMIT_REACHED' });
    expect(r.isReady).toBe(true);
    expect(r.unavailableReason).toBeNull();
  });

  test('حد التسليمات الافتراضي 5 (4 فعّالة تسمح، 5 تمنع)', () => {
    expect(classify({}, { activeCount: 4 }).isReady).toBe(true);
    expect(classify({}, { activeCount: 5 }).unavailableReason).toBe('SUBMISSION_LIMIT_REACHED');
  });

  test('حد خاص بالحملة يتفوق على الافتراضي', () => {
    expect(classify({ maxSubmissionsPerCreator: 2 }, { activeCount: 1 }).isReady).toBe(true);
    const r = classify({ maxSubmissionsPerCreator: 2 }, { activeCount: 2 });
    expect(r.unavailableReason).toBe('SUBMISSION_LIMIT_REACHED');
    expect(r.limit).toBe(2);
    expect(r.active).toBe(2);
  });
});

describe('classifyEligibility: حملة ظاهرة لكن غير متاحة', () => {
  test.each([
    ['إيقاف يدوي', { status: 'MANUALLY_PAUSED', pauseReason: 'MANUAL' }, 'CAMPAIGN_PAUSED'],
    ['توقف بسبب نفاد الميزانية', { status: 'PAUSED', pauseReason: 'BUDGET_EXHAUSTED', remainingBudget: 0 }, 'BUDGET_EXHAUSTED'],
    ['توقف بسبب نفاد الميزانية (الرصيد ما زال موجباً)', { status: 'PAUSED', pauseReason: 'BUDGET_EXHAUSTED' }, 'BUDGET_EXHAUSTED'],
    ['نشطة لكن الرصيد صفر (قبل أن يوقفها الـ job)', { remainingBudget: 0 }, 'BUDGET_EXHAUSTED'],
    ['حد يومي مع رصيد صفر', { status: 'PAUSED', pauseReason: 'DAILY_LIMIT_REACHED', remainingBudget: 0 }, 'BUDGET_EXHAUSTED'],
    ['متوقفة بلا سبب معروف', { status: 'PAUSED', pauseReason: null }, 'CAMPAIGN_PAUSED'],
  ])('%s', (_label, overrides, reason) => {
    const r = classify(overrides);
    expect(r.eligible).toBe(true);
    expect(r.availability).toBe('UNAVAILABLE');
    expect(r.unavailableReason).toBe(reason);
    expect(r.isReady).toBe(false);
  });

  test('إيقاف الحملة له أولوية على بلوغ الحد', () => {
    const r = classify({ status: 'MANUALLY_PAUSED' }, { activeCount: 5 });
    expect(r.unavailableReason).toBe('CAMPAIGN_PAUSED');
  });

  test('غير المتاحة لا تحمل شارات حتى لو تنتهي بعد ساعة', () => {
    const r = classify({ status: 'MANUALLY_PAUSED', endDate: inHours(1) });
    expect(r.badges).toEqual([]);
    expect(r.isEndingSoon).toBe(false);
    expect(r.hoursLeft).toBe(1); // الساعات تبقى للعرض
  });
});

describe('classifyEligibility: حملة لا تظهر أبداً', () => {
  test.each([
    ['موقوفة بسبب بلاغ', { isSuspended: true }],
    ['مؤرشفة', { isArchived: true }],
    ['غير مموّلة', { walletId: null }],
    ['انتهى تاريخها', { endDate: inHours(-1) }],
    ['ملغاة', { status: 'CANCELLED' }],
    ['مكتملة', { status: 'COMPLETED' }],
    ['منتهية الصلاحية', { status: 'EXPIRED' }],
    ['مرفوضة', { status: 'REJECTED' }],
    ['مسودة', { status: 'DRAFT' }],
    ['قيد المراجعة', { status: 'PENDING_REVIEW' }],
    ['مراجعة يدوية', { status: 'MANUAL_REVIEW' }],
  ])('%s', (_label, overrides) => {
    const r = classify(overrides);
    expect(r.eligible).toBe(false);
    expect(r.isReady).toBe(false);
    expect(r.isEndingSoon).toBe(false);
    expect(r.badges).toEqual([]);
    expect(r.unavailableReason).toBeNull();
  });

  test('تنتهي بعد لحظة: ما زالت تظهر', () => {
    expect(classify({ endDate: new Date(NOW.getTime() + 1000) }).eligible).toBe(true);
    expect(classify({ endDate: NOW }).eligible).toBe(false); // endDate == الآن تعني انتهت
  });
});

describe('matchesTab و countTabs', () => {
  const list = [
    classify({ endDate: inHours(18) }),                       // جاهزة + تنتهي قريباً
    classify({ endDate: inHours(72) }),                       // جاهزة
    classify({}),                                             // جاهزة
    classify({ status: 'MANUALLY_PAUSED' }),                  // ظاهرة غير متاحة
    classify({}, { activeCount: 5 }),                         // بلغت الحد
    classify({ isSuspended: true }),                          // مخفية
  ];

  test('العدّادات تطابق مثال التصميم (الكل / جاهزة / تنتهي قريباً)', () => {
    expect(countTabs(list)).toEqual({ all: 5, ready: 3, endingSoon: 1 });
  });

  test('التبويبات', () => {
    expect(list.filter((c) => matchesTab(c, 'ALL'))).toHaveLength(5);
    expect(list.filter((c) => matchesTab(c, 'READY'))).toHaveLength(3);
    expect(list.filter((c) => matchesTab(c, 'ENDING_SOON'))).toHaveLength(1);
    expect(list.filter((c) => matchesTab(c, 'UNKNOWN'))).toHaveLength(5); // الافتراضي ALL
  });

  test('قائمة فارغة', () => {
    expect(countTabs([])).toEqual({ all: 0, ready: 0, endingSoon: 0 });
  });
});

describe('buildCampaignCode', () => {
  test('آخر 6 خانات بأحرف كبيرة', () => {
    expect(buildCampaignCode('66f1a2b3c4d5e6f708192a3b')).toBe('PPV-192A3B');
  });
});