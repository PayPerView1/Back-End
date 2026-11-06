// scripts/generateDownloadLink.js
// يولي رابط تنزيل موقّع (مرة واحدة) لاختبار مسارات المواد في Postman / Thunder Client.
//
// السبب: لا توجد حالياً نقطة HTTP تُصدر رابط التنزيل (createDownloadLink خدمة فقط)،
// فهذا السكربت ينشئ سجل DownloadLog ويوقّع التوكن بنفس منطق الإنتاج.
//
// التشغيل:
//   node scripts/generateDownloadLink.js <creatorEmail> [materialIndex=0]
//
// مثال:
//   node scripts/generateDownloadLink.js creator@example.com 0
//
// المتطلبات في .env: MONGO_URI, DOWNLOAD_LINK_SECRET, BACKEND_URL (اختياري)
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../src/models/user');
const Application = require('../src/models/application');
const Campaign = require('../src/models/campaign');
const DownloadLog = require('../src/models/downloadLog');
const { APPLICATION_STATUS } = require('../src/constants/discovery.constants');
const { assertCampaignAllowsDownloads } = require('../src/utils/submission/submissionGuards.utils');
const { signDownloadToken, buildDownloadUrl } = require('../src/utils/material/downloadToken.utils');

const run = async () => {
  const email = process.argv[2];
  const index = Number(process.argv[3] || 0);

  if (!email) {
    console.error('Usage: node scripts/generateDownloadLink.js <creatorEmail> [materialIndex]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Connected: ${mongoose.connection.name}`);

  const creator = await User.findOne({ email }).lean();
  if (!creator) throw new Error(`No user with email: ${email}`);

  const application = await Application.findOne({
    creatorId: creator._id,
    status: APPLICATION_STATUS.ACCEPTED,
  })
    .sort({ appliedAt: -1 })
    .lean();

  if (!application) {
    throw new Error('This creator has no ACCEPTED application. Accept one first (admin/brand side).');
  }

  const campaign = await Campaign.findById(application.campaignId)
    .select('name materials isSuspended isArchived status')
    .lean();
  if (!campaign) throw new Error('Campaign not found for this application');

  // نفس فحص الإنتاج: لا روابط لحملة ملغاة/موقوفة/مؤرشفة
  assertCampaignAllowsDownloads(campaign);

  const materials = campaign.materials || [];
  const material = materials[index];
  if (!material) {
    throw new Error(`No material at index ${index}. Campaign has ${materials.length} material(s).`);
  }

  const logId = new mongoose.Types.ObjectId();
  const { token, expiresAt } = signDownloadToken({ logId, creatorId: creator._id });

  await DownloadLog.create({
    _id: logId,
    applicationId: application._id,
    campaignId: campaign._id,
    creatorId: creator._id,
    materialId: material._id,
    fileName: material.fileName,
    fileSizeKb: material.fileSizeKb,
    linkExpiresAt: expiresAt,
  });

  const url = buildDownloadUrl(token);

  console.log('\n================ READY FOR POSTMAN ================');
  console.log('creator     :', creator.email, `(${creator.role})`);
  console.log('campaign    :', campaign.name, '|', String(campaign._id));
  console.log('material    :', material.fileName, `(index ${index})`);
  console.log('logId       :', String(logId));
  console.log('expiresAt   :', expiresAt.toISOString());
  console.log('\n1) GET   ' + url);
  console.log('2) PATCH /api/v1/downloads/' + String(logId));
  console.log('3) GET   /api/v1/campaigns/' + String(campaign._id) + '/downloads');
  console.log('\nHeader for all three:  Authorization: Bearer <JWT from POST /api/v1/auth/login>');
  console.log('  - requests 1 & 2 need a CLIPPER token');
  console.log('  - request  3 needs a BRAND token (owner of the campaign)');
  console.log('===================================================\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('❌ ERROR:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
