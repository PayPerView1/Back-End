// src/services/material/materialDownload.service.js
// إصدار روابط التنزيل الموقّعة (الخطوة 3). الاستهلاك والبث في الخطوة 4.
//
//   createDownloadLink({ applicationId, materialId, creatorId, ip, userAgent })
//       -> { logId, materialId, fileName, fileSizeKb, url, expiresAt }
//   createDownloadAllLinks({ applicationId, creatorId, ip, userAgent })
//       -> { strategy: 'FILES', totalSizeKb, items: [ نفس شكل العنصر أعلاه ] }
//
// لكل رابط سجل DownloadLog (REQUESTED). لا يُرجَع أي fileUrl أو publicId أبداً.
const crypto = require('crypto');
const mongoose = require('mongoose');
const Campaign = require('../../models/campaign');
const DownloadLog = require('../../models/downloadLog');
const { AppError } = require('../../utils/errors');
const { DOWNLOAD_TYPE, DOWNLOAD_STATUS } = require('../../constants/submission.constants');
const {
  getAcceptedApplication,
  assertCampaignAllowsDownloads,
} = require('../../utils/submission/submissionGuards.utils');
const { signDownloadToken,verifyDownloadToken, buildDownloadUrl } = require('../../utils/material/downloadToken.utils');

const USER_AGENT_MAX = 200;
// المضيفون المسموح البث منهم (قرار D3): مواد الحملات مرفوعة على Cloudinary فقط.
// نتحقق من هذا عند البث حتى لو عُبث بـ fileUrl في قاعدة البيانات (منع SSRF).
const ALLOWED_SOURCE_HOSTS = ['res.cloudinary.com'];

// أسباب فشل التنزيل المخزّنة في DownloadLog.failureReason
const DOWNLOAD_FAILURE_REASON = {
  ACCESS_REVOKED: 'ACCESS_REVOKED',     // سُحب القبول أو أُلغيت/أُوقفت/أُرشفت الحملة بعد إصدار الرابط
  MATERIAL_REMOVED: 'MATERIAL_REMOVED', // حُذفت المادة بعد إصدار الرابط
  INVALID_SOURCE: 'INVALID_SOURCE',     // رابط الملف ليس https على مضيف مسموح
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',     // فشل جلب الملف من Cloudinary (الخطوة 4ب)
  TOO_LARGE: 'TOO_LARGE',               // الملف أكبر من الحد (الخطوة 4ب)
  CLIENT_ABORTED: 'CLIENT_ABORTED',     // قطع المبدع الاتصال (الخطوة 4ب)
  INTERNAL_ERROR: 'INTERNAL_ERROR',     // خطأ غير متوقع (مثلاً انقطاع قاعدة البيانات)
};
/** HMAC للعنوان (لا نخزّن IP خاماً). بدون IP_HASH_SECRET لا نخزّن شيئاً (نفس أسلوب report.service) */
const hashIp = (ip) => {
  if (!ip || !process.env.IP_HASH_SECRET) return null;
  return crypto.createHmac('sha256', process.env.IP_HASH_SECRET).update(String(ip)).digest('hex');
};

const loadDownloadableCampaign = async (application) => {
  const campaign = await Campaign.findById(application.campaignId)
    .select('name materials isSuspended isArchived status')
    .lean();
  if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');

  assertCampaignAllowsDownloads(campaign);
  return campaign;
};

/**
 * يوقّع رابطاً لكل مادة ثم يُدرج السجلات دفعة واحدة.
 * التوقيع أولاً (بمعرّف سجل مُولَّد مسبقاً): فإن فشل لا يُنشأ أي سجل، ويتطابق انتهاء الرابط مع انتهاء السجل تماماً.
 */
const issueLinks = async ({ application, campaign, materials, creatorId, ip, userAgent }) => {
  const ipHash = hashIp(ip);
  const agent = typeof userAgent === 'string' ? userAgent.slice(0, USER_AGENT_MAX) : '';

  const prepared = materials.map((material) => {
    const logId = new mongoose.Types.ObjectId();
    const { token, expiresAt } = signDownloadToken({ logId, creatorId });

    return {
      doc: {
        _id: logId,
        applicationId: application._id,
        campaignId: campaign._id,
        creatorId,
        materialId: material._id,
        type: DOWNLOAD_TYPE.FILE,
        fileName: material.fileName,
        fileSizeKb: material.fileSizeKb,
        status: DOWNLOAD_STATUS.REQUESTED,
        linkExpiresAt: expiresAt,
        ipHash,
        userAgent: agent,
      },
      item: {
        logId,
        materialId: material._id,
        fileName: material.fileName,
        fileSizeKb: material.fileSizeKb,
        url: buildDownloadUrl(token),
        expiresAt,
      },
    };
  });

  await DownloadLog.insertMany(prepared.map((entry) => entry.doc));
  return prepared.map((entry) => entry.item);
};

const createDownloadLink = async ({ applicationId, materialId, creatorId, ip, userAgent }) => {
  const application = await getAcceptedApplication(creatorId, { applicationId });
  const campaign = await loadDownloadableCampaign(application);

  const material = (campaign.materials || []).find((m) => String(m._id) === String(materialId));
  if (!material) throw new AppError('Material not found', 'NOT_FOUND');

  const [item] = await issueLinks({ application, campaign, materials: [material], creatorId, ip, userAgent });
  return item;
};

const createDownloadAllLinks = async ({ applicationId, creatorId, ip, userAgent }) => {
  const application = await getAcceptedApplication(creatorId, { applicationId });
  const campaign = await loadDownloadableCampaign(application);

  const materials = campaign.materials || [];
  if (materials.length === 0) return { strategy: 'FILES', totalSizeKb: 0, items: [] };

  const items = await issueLinks({ application, campaign, materials, creatorId, ip, userAgent });
  const totalSizeKb = items.reduce((sum, item) => sum + (item.fileSizeKb || 0), 0);

  return { strategy: 'FILES', totalSizeKb, items };
};
// ============================================
// الاستهلاك (الخطوة 4أ): كل الفحوصات قبل أي بايت يُبث
// ============================================

/** رابط المصدر إن كان https على مضيف مسموح (بلا بيانات اعتماد أو منفذ)، وإلا null */
const getAllowedSourceUrl = (fileUrl) => {
  let url;
  try {
    url = new URL(fileUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password || url.port) return null;
  if (!ALLOWED_SOURCE_HOSTS.includes(url.hostname)) return null;
  return url.toString();
};

/** يسجّل فشل تنزيل بدأ (STARTED فقط: لا يكتب فوق COMPLETED). لا يرمي أبداً */
const markFailed = async (logId, reason) => {
  try {
    await DownloadLog.updateOne(
      { _id: logId, status: DOWNLOAD_STATUS.STARTED },
      { $set: { status: DOWNLOAD_STATUS.FAILED, failureReason: reason } }
    );
  } catch (error) {
    console.error(`[materialDownload] markFailed failed: ${error.message}`);
  }
};

const sourceUnavailable = () => new AppError('Download source is unavailable', 'DOWNLOAD_SOURCE_UNAVAILABLE');

/**
 * @param {{ token: string, creatorId: ObjectId|string, now?: Date }} input
 * @returns {Promise<{ log, campaign: { _id, name }, material: { fileName, mimeType, fileSizeKb }, sourceUrl: string }>}
 *   sourceUrl داخلي: يُستعمل للبث فقط ولا يُرسل لأي عميل.
 *
 * الترتيب مقصود:
 *  1) التوكن + مطابقة المبدع (D2) قبل أي لمس لقاعدة البيانات: رابط مسرَّب لا يحرق رابط صاحبه.
 *  2) استهلاك ذري لمرة واحدة: طلبان متزامنان => ينجح واحد فقط.
 *  3) إعادة فحص الوصول وقت الاستهلاك (القبول، حالة الحملة)، ثم المادة، ثم المصدر.
 * أي فشل بعد الاستهلاك يسجَّل FAILED (الرابط محروق، ويطلب المبدع رابطاً جديداً).
 */
const redeemDownload = async ({ token, creatorId, now = new Date() }) => {
  const claims = verifyDownloadToken(token);
  if (claims.creatorId !== String(creatorId)) {
    throw new AppError('Invalid download link', 'FORBIDDEN');
  }

  const log = await DownloadLog.findOneAndUpdate(
    {
      _id: claims.logId,
      creatorId: claims.creatorId,
      status: DOWNLOAD_STATUS.REQUESTED,
      consumedAt: null,
      linkExpiresAt: { $gt: now },
    },
    { $set: { consumedAt: now, status: DOWNLOAD_STATUS.STARTED } },
    { returnDocument: 'after' }
  ).lean();
  if (!log) throw new AppError('Download link expired', 'DOWNLOAD_LINK_EXPIRED');

  let campaign;
  try {
    await getAcceptedApplication(claims.creatorId, { applicationId: log.applicationId });

    campaign = await Campaign.findById(log.campaignId)
      .select('name materials isSuspended isArchived status')
      .lean();
    if (!campaign) throw new AppError('Campaign not found', 'NOT_FOUND');

    assertCampaignAllowsDownloads(campaign);
  } catch (error) {
    await markFailed(
      log._id,
      error instanceof AppError ? DOWNLOAD_FAILURE_REASON.ACCESS_REVOKED : DOWNLOAD_FAILURE_REASON.INTERNAL_ERROR
    );
    throw error;
  }

  const material = (campaign.materials || []).find((m) => String(m._id) === String(log.materialId));
  if (!material) {
    await markFailed(log._id, DOWNLOAD_FAILURE_REASON.MATERIAL_REMOVED);
    throw new AppError('Material not found', 'NOT_FOUND');
  }

  const sourceUrl = getAllowedSourceUrl(material.fileUrl);
  if (!sourceUrl) {
    await markFailed(log._id, DOWNLOAD_FAILURE_REASON.INVALID_SOURCE);
    throw sourceUnavailable();
  }

  return {
    log,
    campaign: { _id: campaign._id, name: campaign.name },
    material: { fileName: material.fileName, mimeType: material.mimeType, fileSizeKb: material.fileSizeKb },
    sourceUrl,
  };
};
module.exports = {
  createDownloadLink,
  createDownloadAllLinks,
  redeemDownload,
  markFailed,
  getAllowedSourceUrl,
  DOWNLOAD_FAILURE_REASON,
};