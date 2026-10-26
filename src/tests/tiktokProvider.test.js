jest.mock('axios');

const axios = require('axios');
const { fetchPost, handleFromAuthorUrl } = require('../services/social/providers/tiktok.provider');

const URL_1 = 'https://www.tiktok.com/@mizaninvest/video/7391234567890123456';

beforeEach(() => {
  axios.get.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('tiktok.provider', () => {
  test('نجاح: يحوّل رد oEmbed إلى postMeta', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        title: 'كيف تبدأ استثمارك؟ #وافي_الاستثمار #تمويل_إسلامي',
        author_name: 'Mizan Invest',
        author_url: 'https://www.tiktok.com/@mizaninvest',
        thumbnail_url: 'https://p16.tiktokcdn.com/img.jpg',
        html: '<blockquote>...</blockquote>',
      },
    });

    const r = await fetchPost({ canonicalUrl: URL_1, externalId: '7391234567890123456' });
    expect(r.fetchStatus).toBe('OK');
    expect(r.caption).toBe('كيف تبدأ استثمارك؟ #وافي_الاستثمار #تمويل_إسلامي');
    expect(r.authorName).toBe('Mizan Invest');
    expect(r.authorHandle).toBe('@mizaninvest');
    expect(r.authorUrl).toBe('https://www.tiktok.com/@mizaninvest');
    expect(r.thumbnailUrl).toBe('https://p16.tiktokcdn.com/img.jpg');
    expect(r.durationSec).toBeNull();
    expect(r.stats).toBeNull();
    expect(axios.get.mock.calls[0][1].params).toEqual({ url: URL_1 });
  });

  test('author_unique_id له أولوية على رابط الحساب', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { title: 't', author_name: 'n', author_url: 'https://www.tiktok.com/@old', author_unique_id: 'newname' },
    });
    expect((await fetchPost({ canonicalUrl: URL_1 })).authorHandle).toBe('@newname');
  });

  test('فيديو بوصف فارغ ما زال OK', async () => {
    axios.get.mockResolvedValue({ status: 200, data: { title: '', author_name: 'x', author_url: 'https://www.tiktok.com/@x' } });
    const r = await fetchPost({ canonicalUrl: URL_1 });
    expect(r.fetchStatus).toBe('OK');
    expect(r.caption).toBe('');
  });

  test('400 و404 تعني NOT_FOUND', async () => {
    axios.get.mockResolvedValue({ status: 404, data: {} });
    expect((await fetchPost({ canonicalUrl: URL_1 })).fetchStatus).toBe('NOT_FOUND');
    axios.get.mockResolvedValue({ status: 400, data: {} });
    expect((await fetchPost({ canonicalUrl: URL_1 })).fetchStatus).toBe('NOT_FOUND');
  });

  test('رد 200 بمحتوى خطأ بدل بيانات الفيديو يعني NOT_FOUND', async () => {
    axios.get.mockResolvedValue({ status: 200, data: { code: 400, message: 'Something went wrong' } });
    expect((await fetchPost({ canonicalUrl: URL_1 })).fetchStatus).toBe('NOT_FOUND');
  });

  test('429 و403 و500 تعني UNAVAILABLE (لا نحكم على المنشور)', async () => {
    for (const status of [429, 403, 500, 503]) {
      axios.get.mockResolvedValue({ status, data: {} });
      expect((await fetchPost({ canonicalUrl: URL_1 })).fetchStatus).toBe('UNAVAILABLE');
    }
  });

  test('خطأ شبكة أو مهلة يعني UNAVAILABLE ولا يرمي', async () => {
    axios.get.mockRejectedValue(new Error('timeout of 6000ms exceeded'));
    expect((await fetchPost({ canonicalUrl: URL_1 })).fetchStatus).toBe('UNAVAILABLE');
  });

  test('handleFromAuthorUrl', () => {
    expect(handleFromAuthorUrl('https://www.tiktok.com/@a.b_c?lang=en')).toBe('@a.b_c');
    expect(handleFromAuthorUrl('')).toBe('');
    expect(handleFromAuthorUrl('https://example.com')).toBe('');
  });
});