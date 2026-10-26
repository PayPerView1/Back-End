// مهمة A5.0: لا يحصل على روابط المواد إلا المبدع المقبول (كان الشرط معلّقاً)
const db = require('./helpers/db');
const f = require('./helpers/factories');
const { getAcceptedMaterials } = require('../services/application/application.service');

jest.setTimeout(120000);
beforeAll(db.connect);
afterEach(db.clearDatabase);
afterAll(db.disconnect);

const material = (creatorOrBrand) => ({
  fileName: 'intro.mp4',
  fileUrl: 'https://res.cloudinary.com/demo/video/upload/campaign-materials/intro.mp4',
  fileType: 'VIDEO',
  fileSizeKb: 8200,
  mimeType: 'video/mp4',
  uploadedBy: creatorOrBrand._id,
  publicId: 'campaign-materials/intro',
  resourceType: 'video',
});

const setup = async (campaignOverrides = {}, applicationOverrides = {}) => {
  const brand = await f.createBrand();
  const creator = await f.createUser();
  const campaign = await f.createCampaign(brand, { materials: [material(brand)], ...campaignOverrides });
  const application = await f.createAcceptedApplication(creator, campaign, applicationOverrides);
  return { brand, creator, campaign, application };
};

const errorOf = async (promise) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
};

describe('getAcceptedMaterials', () => {
  test('المبدع المقبول يحصل على الملفات', async () => {
    const s = await setup();
    const items = await getAcceptedMaterials(s.application._id, s.creator._id);
    expect(items).toHaveLength(1);
    expect(items[0].fileName).toBe('intro.mp4');
  });

  test.each(['PENDING', 'REJECTED', 'WITHDRAWN'])('طلب %s ممنوع', async (status) => {
    const s = await setup({}, { status });
    const error = await errorOf(getAcceptedMaterials(s.application._id, s.creator._id));
    expect(error.code).toBe('APPLICATION_NOT_ACCEPTED');
  });

  test('طلب مبدع آخر يعطي NOT_FOUND (لا نكشف وجوده)', async () => {
    const s = await setup();
    const other = await f.createUser();
    const error = await errorOf(getAcceptedMaterials(s.application._id, other._id));
    expect(error.code).toBe('NOT_FOUND');
  });

  test.each([
    ['ملغاة', { status: 'CANCELLED' }],
    ['موقوفة بسبب بلاغ', { isSuspended: true }],
    ['مؤرشفة', { isArchived: true }],
  ])('حملة %s ممنوعة', async (_label, overrides) => {
    const s = await setup(overrides);
    const error = await errorOf(getAcceptedMaterials(s.application._id, s.creator._id));
    expect(error.code).toBe('CAMPAIGN_UNAVAILABLE');
  });
});