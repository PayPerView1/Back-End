// scripts/tryProvider.js
// تجربة يدوية للمزودين على روابط حقيقية (مهمتا A1.4 و A1.5).
//
// الاستعمال:
//   node scripts/tryProvider.js "<رابط المنشور>"
//   node scripts/tryProvider.js "<رابط>" --hashtags=تمويل_إسلامي,وافي_الاستثمار --mentions=WafiFinance
//   node scripts/tryProvider.js "<رابط>" --platform=TIKTOK --min=30 --max=60
//
// يمر بنفس المسار الذي تستعمله verifyPost: تحليل الرابط (وحل المختصر) ثم جلب البيانات ثم تقييم المتطلبات.
// يقرأ YOUTUBE_API_KEY من .env. لا يطبع المفتاح.
require('dotenv').config();

const { resolveAndParse } = require('../src/services/social/linkParser.service');
const { fetchPostMetadata } = require('../src/services/social/socialMetadata.service');
const { evaluateRequirements } = require('../src/utils/submission/submissionRules.utils');
const { extractHashtags, extractMentions, toStoredList } = require('../src/utils/submission/hashtag.utils');

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const opt = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
};

if (!url) {
  console.error('Usage: node scripts/tryProvider.js "<post url>" [--platform=TIKTOK] [--hashtags=a,b] [--mentions=x] [--min=30] [--max=60]');
  process.exit(1);
}

(async () => {
  try {
    const parsed = await resolveAndParse(url, opt('platform'));
    console.log('\n--- parsed ---');
    console.log(parsed);

    const postMeta = await fetchPostMetadata(parsed);
    console.log('\n--- postMeta ---');
    console.log({
      ...postMeta,
      caption: postMeta.caption.length > 300 ? `${postMeta.caption.slice(0, 300)}... (${postMeta.caption.length} chars)` : postMeta.caption,
    });

    console.log('\n--- detected in caption ---');
    console.log({ hashtags: extractHashtags(postMeta.caption), mentions: extractMentions(postMeta.caption) });

    const requirements = {
      requiredHashtags: toStoredList((opt('hashtags') || '').split(',')),
      requiredMentions: toStoredList((opt('mentions') || '').split(',')),
      minDurationSec: opt('min') ? Number(opt('min')) : null,
      maxDurationSec: opt('max') ? Number(opt('max')) : null,
    };
    const hasRequirements =
      requirements.requiredHashtags.length || requirements.requiredMentions.length ||
      requirements.minDurationSec || requirements.maxDurationSec;

    if (hasRequirements) {
      const { view, canSubmit, warnings } = evaluateRequirements({ requirements, postMeta });
      console.log('\n--- requirements ---');
      console.log(JSON.stringify({ canSubmit, warnings, view }, null, 2));
    }
  } catch (error) {
    console.error('\nFAILED:', error.code || error.name, '-', error.message);
    if (error.details) console.error('details:', error.details);
    process.exitCode = 1;
  }
})();