// src/services/material/materialStream.service.js
// الخطوة 4ب: يبثّ الملف من Cloudinary إلى المبدع بعد نجاح redeemDownload.
// أي فشل قبل أول بايت => خطأ JSON (502). أي فشل أثناء البث => قطع الاتصال + تسجيل FAILED.
const axios = require('axios');
const { Transform, pipeline } = require('stream');
const CampaignActivityLog = require('../../models/CampaignActivityLog');
const { AppError } = require('../../utils/errors');
const { CAMPAIGN_ACTION } = require('../../constants/campaign.constants');
const { markFailed, DOWNLOAD_FAILURE_REASON: FAIL } = require('./materialDownload.service');
const { notifyDownloadResult } = require('../submission/submissionNotifications.service');

const UPSTREAM_TIMEOUT_MS = 15000;
// الحد المسموح للرفع + هامش 1MB
const MAX_BYTES = 25 * 1024 * 1024;

const sourceUnavailable = () =>
  new AppError('Download source is unavailable', 'DOWNLOAD_SOURCE_UNAVAILABLE');

/** Content-Disposition آمن للأسماء العربية: ASCII احتياطي + filename* (RFC 5987) */
const buildContentDisposition = (fileName) => {
  const name = String(fileName || 'download').replace(/[\r\n"\\]/g, '');
  const ascii = name.replace(/[^\x20-\x7E]/g, '_') || 'download';
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

/** A5.5: سجل نشاط واحد لكل (مبدع، حملة)، عند أول تنزيل فعلي. لا يكسر التنزيل أبداً */
const recordFirstDownload = async (log) => {
  try {
    await CampaignActivityLog.updateOne(
      {
        campaignId: log.campaignId,
        action: CAMPAIGN_ACTION.MATERIALS_DOWNLOADED,
        performedBy: log.creatorId,
      },
      { $setOnInsert: { metadata: { applicationId: log.applicationId, materialId: log.materialId } } },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[materialStream] activity log failed: ${error.message}`);
  }
};

const failureReasonOf = (error) => {
  if (error && error.message === 'TOO_LARGE') return FAIL.TOO_LARGE;
  if (error && error.code === 'ERR_STREAM_PREMATURE_CLOSE') return FAIL.CLIENT_ABORTED;
  return FAIL.UPSTREAM_ERROR;
};

/**
 * إشعار المبدع بفشل من جهة السيرفر (DOWNLOAD_FAILED).
 * لا نزعجه إن قطع هو الاتصال بنفسه (CLIENT_ABORTED). لا يرمي أبداً.
 */
const notifyFailure = async (log, campaign, reason) => {
  if (reason === FAIL.CLIENT_ABORTED) return;
  try {
    await notifyDownloadResult(log, campaign, 'FAILED');
  } catch (error) {
    console.error(`[materialStream] failure notification failed: ${error.message}`);
  }
};

/**
 * @param {{ prepared: Object (ناتج redeemDownload), res: express.Response }} input
 * يرمي AppError فقط قبل بدء الكتابة على res. بعدها يُنهي الوعد دائماً دون رمي.
 */
const streamDownload = async ({ prepared, res }) => {
  const { log, campaign, material, sourceUrl } = prepared;

  // 1) الاتصال بالمصدر (بلا تحويلات: منع SSRF عبر redirect)
  let upstream;
  try {
    upstream = await axios.get(sourceUrl, {
      responseType: 'stream',
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRedirects: 0,
      headers: { 'Accept-Encoding': 'identity' }, // بلا gzip حتى يصح Content-Length
      validateStatus: (status) => status === 200,
    });
  } catch (error) {
    await markFailed(log._id, FAIL.UPSTREAM_ERROR);
    await notifyFailure(log, campaign, FAIL.UPSTREAM_ERROR);
    throw sourceUnavailable();
  }

  // 2) فحص الحجم المعلن قبل بث أي بايت
  const declared = Number(upstream.headers && upstream.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    upstream.data.destroy();
    await markFailed(log._id, FAIL.TOO_LARGE);
    await notifyFailure(log, campaign, FAIL.TOO_LARGE);
    throw sourceUnavailable();
  }

  // 3) الترويسات (النوع من قاعدة بياناتنا، لا من المصدر)
  res.setHeader('Content-Type', material.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', buildContentDisposition(material.fileName));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
  if (Number.isFinite(declared)) res.setHeader('Content-Length', String(declared));

  recordFirstDownload(log); // بلا await عمداً

  // 4) البث مع حارس حجم فعلي (في حال لم يُعلن المصدر الطول أو كذب)
  let bytes = 0;
  const guard = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) return cb(new Error('TOO_LARGE'));
      return cb(null, chunk);
    },
  });

  return new Promise((resolve) => {
    pipeline(upstream.data, guard, res, async (error) => {
      if (error) {
        const reason = failureReasonOf(error);
        await markFailed(log._id, reason);
        await notifyFailure(log, campaign, reason);
      }
      resolve({ bytes, failed: !!error });
    });
  });
};

module.exports = { streamDownload, buildContentDisposition, MAX_BYTES };