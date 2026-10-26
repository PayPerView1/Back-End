jest.mock('axios');

const axios = require('axios');
const { resolveShortLink, resolveAndParse, parseLink } = require('../services/social/linkParser.service');

const FULL = 'https://www.tiktok.com/@mizaninvest/video/7391234567890123456';
const redirect = (location, status = 301) => ({ status, headers: { location }, data: { destroy() {} } });
const plain = (status) => ({ status, headers: {}, data: { destroy() {} } });

const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

beforeEach(() => {
  axios.get.mockReset();
});

describe('resolveShortLink', () => {
  test('رابط مختصر يتحول إلى رابط الفيديو الكامل ومعرّفه', async () => {
    axios.get.mockResolvedValueOnce(redirect(`${FULL}?_r=1&u_code=abc`));
    const r = await resolveAndParse('https://vm.tiktok.com/ZMhAbCdEf/', 'TIKTOK');
    expect(r).toEqual({ platform: 'TIKTOK', canonicalUrl: FULL, externalId: '7391234567890123456', needsResolve: false });
    expect(axios.get.mock.calls[0][1].maxRedirects).toBe(0);
  });

  test('يتبع تحويلتين متتاليتين', async () => {
    axios.get
      .mockResolvedValueOnce(redirect('https://www.tiktok.com/t/ZT8abcd/'))
      .mockResolvedValueOnce(redirect(FULL));
    const r = await resolveAndParse('https://vt.tiktok.com/ZMhAbCdEf/', 'TIKTOK');
    expect(r.externalId).toBe('7391234567890123456');
    expect(axios.get.mock.calls).toHaveLength(2);
  });

  test('تحويلة إلى مضيف خارج القائمة المسموحة مرفوضة (SSRF)', async () => {
    axios.get.mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data'));
    const error = await errorOf(resolveAndParse('https://vm.tiktok.com/ZMhAbCdEf/', 'TIKTOK'));
    expect(error.code).toBe('INVALID_LINK');
    expect(axios.get.mock.calls).toHaveLength(1); // لم نطلب المضيف الخارجي أصلاً
  });

  test('رد غير تحويلة (404 أو 200) يعني INVALID_LINK مع httpStatus', async () => {
    axios.get.mockResolvedValueOnce(plain(404));
    const e404 = await errorOf(resolveAndParse('https://vm.tiktok.com/ZMhAbCdEf/', 'TIKTOK'));
    expect(e404.code).toBe('INVALID_LINK');
    expect(e404.details.httpStatus).toBe(404);

    axios.get.mockResolvedValueOnce(plain(200));
    const e200 = await errorOf(resolveAndParse('https://vm.tiktok.com/ZMhAbCdEf/', 'TIKTOK'));
    expect(e200.details.httpStatus).toBe(200);
  });

  test('خطأ شبكة يعني INVALID_LINK', async () => {
    axios.get.mockRejectedValueOnce(new Error('timeout'));
    expect((await errorOf(resolveAndParse('https://vm.tiktok.com/ZMhAbCdEf/', 'TIKTOK'))).code).toBe('INVALID_LINK');
  });

  test('حد التحويلات: لا حلقة لا نهائية', async () => {
    axios.get.mockResolvedValue(redirect('https://www.tiktok.com/login'));
    const error = await errorOf(resolveAndParse('https://vm.tiktok.com/ZMhAbCdEf/', 'TIKTOK'));
    expect(error.code).toBe('INVALID_LINK');
    expect(axios.get.mock.calls).toHaveLength(3);
  });

  test('الرابط الكامل لا يستدعي الشبكة أصلاً', async () => {
    const r = await resolveAndParse(FULL, 'TIKTOK');
    expect(r.externalId).toBe('7391234567890123456');
    expect(axios.get.mock.calls).toHaveLength(0);
  });

  test('resolveShortLink مباشرة', async () => {
    axios.get.mockResolvedValueOnce(redirect(FULL));
    const r = await resolveShortLink(parseLink('https://www.tiktok.com/t/ZT8abcd/', 'TIKTOK'));
    expect(r.canonicalUrl).toBe(FULL);
  });
});