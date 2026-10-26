const { normalizeMeta, fetchPostMetadata, withTimeout } = require('../services/social/socialMetadata.service');

describe('socialMetadata', () => {
  test('normalizeMeta: OK يحافظ على الحقول ويقص الوصف عند 5000', () => {
    const long = `${'x'.repeat(4990)} #وافي_الاستثمار`;
    const r = normalizeMeta({ fetchStatus: 'OK', caption: long, durationSec: '42', stats: { views: '10', likes: null } });
    expect(r.fetchStatus).toBe('OK');
    expect(r.caption).toHaveLength(5000);
    expect(r.durationSec).toBe(42);
    expect(r.stats).toEqual({ views: 10, likes: null, comments: null, shares: null });
    expect(r.fetchedAt).toBeTruthy();
  });

  test('normalizeMeta: حالة غير OK تُرجع بيانات فارغة', () => {
    const r = normalizeMeta({ fetchStatus: 'NOT_FOUND', caption: 'ignored' });
    expect(r.fetchStatus).toBe('NOT_FOUND');
    expect(r.caption).toBe('');
    expect(r.stats).toBeNull();
  });

  test('normalizeMeta: حالة مجهولة أو مدخل فارغ يصبحان UNAVAILABLE', () => {
    expect(normalizeMeta({ fetchStatus: 'WEIRD' }).fetchStatus).toBe('UNAVAILABLE');
    expect(normalizeMeta(undefined).fetchStatus).toBe('UNAVAILABLE');
  });

  test('normalizeMeta: إحصاءات كلها null تصبح null', () => {
    expect(normalizeMeta({ fetchStatus: 'OK', stats: { views: null } }).stats).toBeNull();
  });

  test('منصة بلا مزود فعّال (إنستغرام stub) ترجع UNAVAILABLE ولا ترمي', async () => {
    expect((await fetchPostMetadata({ platform: 'INSTAGRAM', canonicalUrl: 'x', externalId: 'y' })).fetchStatus).toBe('UNAVAILABLE');
    expect((await fetchPostMetadata({ platform: 'UNKNOWN' })).fetchStatus).toBe('UNAVAILABLE');
  });

  test('withTimeout يرفض عند انتهاء المهلة ويمرر النتيجة قبلها', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200));
    let error = null;
    try {
      await withTimeout(slow, 20);
    } catch (e) {
      error = e;
    }
    expect(error.message).toBe('SOCIAL_FETCH_TIMEOUT');
    expect(await withTimeout(Promise.resolve('fast'), 200)).toBe('fast');
  });
});