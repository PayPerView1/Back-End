const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ARCHIVED: 'ARCHIVED',
  EXPIRED: 'EXPIRED',
};

const CONTENT_TYPE = {
  CLIPPING: 'CLIPPING',
  UGC: 'UGC',
  SLIDESHOW: 'SLIDESHOW',
  AUDIO: 'AUDIO',
  LOGO: 'LOGO',
  MIXED: 'MIXED',
};

const MATERIAL_TYPE = {
  VIDEO: 'VIDEO',
  IMAGE: 'IMAGE',
  AUDIO: 'AUDIO',
  TEXT: 'TEXT',
  LOGO: 'LOGO',
  OTHER: 'OTHER',
};

const AI_REVIEW_RESULT = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
};

const CAMPAIGN_ACTION = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  SUBMITTED: 'SUBMITTED',
  AI_APPROVED: 'AI_APPROVED',
  AI_REJECTED: 'AI_REJECTED',
  SENT_TO_MANUAL_REVIEW: 'SENT_TO_MANUAL_REVIEW',
  MANUALLY_APPROVED: 'MANUALLY_APPROVED',
  MANUALLY_REJECTED: 'MANUALLY_REJECTED',
  ACTIVATED: 'ACTIVATED',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
  RESTORED: 'RESTORED',
  COPIED: 'COPIED',
  DELETED: 'DELETED',
  BUDGET_RECHARGED: 'BUDGET_RECHARGED',
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
};

// ثابتة في الكود — لا تحتاج collection
const CAMPAIGN_CATEGORIES = [
  {
    name: 'CLIPPING',
    description: 'مقاطع فيديو قصيرة من المواد المصدر',
    icon: 'scissors',
    allowsSubCategories: false,
  },
  {
    name: 'UGC',
    description: 'محتوى من إنشاء المستخدمين',
    icon: 'user-video',
    allowsSubCategories: false,
  },
  {
    name: 'SLIDESHOW',
    description: 'عروض شرائح من الصور مع انتقالات',
    icon: 'images',
    allowsSubCategories: false,
  },
  {
    name: 'AUDIO',
    description: 'محتوى صوتي فقط',
    icon: 'microphone',
    allowsSubCategories: false,
  },
  {
    name: 'LOGO',
    description: 'تحريك الشعار أو التصميم',
    icon: 'badge',
    allowsSubCategories: false,
  },
  {
    name: 'MIXED',
    description: 'مزيج من أنواع محتوى متعددة',
    icon: 'grid',
    allowsSubCategories: true,
    // القيم المتاحة للاختيار منها عند MIXED
    subCategories: ['CLIPPING', 'UGC', 'SLIDESHOW', 'AUDIO', 'LOGO'],
  },
];

// الحد الأقصى لرفع الملفات
const MATERIAL_CONSTRAINTS = {
  MAX_FILES: 10,
  MAX_FILE_SIZE_MB: 20,
  ALLOWED_MIME_TYPES: [
    'video/mp4',
    'image/jpeg',
    'image/png',
    'application/pdf',
    'audio/mpeg',
    'audio/mp3',
    'image/svg+xml',
  ],
};

const DRAFT_EXPIRY_DAYS = 30;

module.exports = {
  CAMPAIGN_STATUS,
  CONTENT_TYPE,
  MATERIAL_TYPE,
  AI_REVIEW_RESULT,
  CAMPAIGN_ACTION,
  CAMPAIGN_CATEGORIES,
  MATERIAL_CONSTRAINTS,
  DRAFT_EXPIRY_DAYS,
};