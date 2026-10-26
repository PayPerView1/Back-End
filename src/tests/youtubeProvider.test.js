jest.mock('axios');

const axios = require('axios');
const { fetchPost, parseIsoDuration, mapVideo } = require('../services/social/providers/youtube.provider');

const video = (overrides = {}) => ({
  snippet: {
    title: 'كيف تبدأ؟',
    description: 'شرح مفصل\n#تمويل_إسلامي #وافي_الاستثمار',
    channelTitle: 'Mizan Invest',
    channelId: 'UC123',
    publishedAt: '2026-10-20T10:00:00Z',
    thumbnails: { default: { url: 'd.jpg' }, high: { url: 'h.jpg' } },
  },
  contentDetails: { duration: 'PT42S' },
  statistics: { viewCount: '1200', likeCount: '45', commentCount: '8' },
  ...overrides,
});

beforeEach(() => {
  axios.get.mockReset();
  process.env.YOUTUBE_API_KEY = 'test-key';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('youtube.provider', () => {
  test('نجاح: يدمج العنوان والوصف ويحوّل المدة والإحصاءات', async () => {
    axios.get.mockResolvedValue({ status: 200, data: { items: [video()] } });

    const r = await fetchPost({ externalId: 'abcDEF12345' });
    expect(r.fetchStatus).toBe('OK');
    expect(r.caption).toBe('كيف تبدأ؟\nشرح مفصل\n#تمويل_إسلامي #وافي_الاستثمار');
    expect(r.authorName).toBe('Mizan Invest');
    expect(r.authorUrl).toBe('https://www.youtube.com/channel/UC123');
    expect(r.thumbnailUrl).toBe('h.jpg');
    expect(r.durationSec).toBe(42);
    expect(r.publishedAt).toBe('2026-10-20T10:00:00Z');
    expect(r.stats).toEqual({ views: 1200, likes: 45, comments: 8, shares: null });
    const config = axios.get.mock.calls[0][1];
    expect(config.params.id).toBe('abcDEF12345');
    expect(config.params.part).toBe('snippet,contentDetails,statistics');
  });

  test('الإعجابات المخفية تصبح null', async () => {
    const hidden = video({ statistics: { viewCount: '10' } });
    expect(mapVideo(hidden).stats).toEqual({ views: 10, likes: null, comments: null, shares: null });
  });

  test('بدون مفتاح: UNAVAILABLE ولا طلب شبكة', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const r = await fetchPost({ externalId: 'abcDEF12345' });
    expect(r.fetchStatus).toBe('UNAVAILABLE');
    expect(axios.get.mock.calls).toHaveLength(0);
  });

  test('items فارغة تعني NOT_FOUND', async () => {
    axios.get.mockResolvedValue({ status: 200, data: { items: [] } });
    expect((await fetchPost({ externalId: 'abcDEF12345' })).fetchStatus).toBe('NOT_FOUND');
  });

  test('حصة منتهية أو مفتاح خاطئ أو عطل: UNAVAILABLE', async () => {
    for (const status of [400, 403, 429, 500]) {
      axios.get.mockResolvedValue({ status, data: { error: { errors: [{ reason: 'quotaExceeded' }] } } });
      expect((await fetchPost({ externalId: 'abcDEF12345' })).fetchStatus).toBe('UNAVAILABLE');
    }
  });

  test('خطأ شبكة: UNAVAILABLE ولا يرمي', async () => {
    axios.get.mockRejectedValue(new Error('ECONNRESET'));
    expect((await fetchPost({ externalId: 'abcDEF12345' })).fetchStatus).toBe('UNAVAILABLE');
  });

  test('parseIsoDuration', () => {
    expect(parseIsoDuration('PT42S')).toBe(42);
    expect(parseIsoDuration('PT1M2S')).toBe(62);
    expect(parseIsoDuration('PT3M')).toBe(180);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('P1DT1S')).toBe(86401);
    expect(parseIsoDuration('P0D')).toBe(0);
    expect(parseIsoDuration('garbage')).toBeNull();
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});