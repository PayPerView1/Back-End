// scripts/checkIndexes.js
// تشغيل: node scripts/checkIndexes.js
// يتأكد أن فهارس نماذج Sprint 5 أُنشئت (خصوصاً الفهرس الفريد الجزئي لمنع تكرار الرابط).
require('dotenv').config();
const mongoose = require('mongoose');

require('../src/models/submission');
require('../src/models/submissionDraft');
require('../src/models/downloadLog');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    for (const name of ['Submission', 'SubmissionDraft', 'DownloadLog']) {
      const Model = mongoose.models[name];
      await Model.init(); // ينتظر اكتمال بناء الفهارس
      const indexes = await Model.collection.indexes();
      console.log(`\n=== ${name} (${indexes.length} indexes) ===`);
      indexes.forEach((i) =>
        console.log(
          i.name,
          JSON.stringify(i.key),
          i.unique ? 'UNIQUE' : '',
          i.partialFilterExpression ? `partial=${JSON.stringify(i.partialFilterExpression)}` : '',
          i.expireAfterSeconds !== undefined ? `ttl=${i.expireAfterSeconds}` : ''
        )
      );
    }
  } catch (error) {
    console.error('checkIndexes failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();