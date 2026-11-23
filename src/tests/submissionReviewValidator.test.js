const { bulkReviewBodySchema } = require('../validators/submission/submissionReview.validator');

const validId = '66a111111111111111111111';

test('bulk advertiser rejection requires a non-empty reason', () => {
  expect(bulkReviewBodySchema.validate({
    submissionIds: [validId],
    decision: 'REJECT',
  }).error).toBeDefined();
  expect(bulkReviewBodySchema.validate({
    submissionIds: [validId],
    decision: 'REJECT',
    note: '  ',
  }).error).toBeDefined();
  expect(bulkReviewBodySchema.validate({
    submissionIds: [validId],
    decision: 'REJECT',
    note: 'Please revise the clip',
  }).error).toBeUndefined();
});

test('bulk advertiser approval permits an omitted note but rejects duplicate submission ids', () => {
  expect(bulkReviewBodySchema.validate({
    submissionIds: [validId],
    decision: 'APPROVE',
  }).error).toBeUndefined();
  expect(bulkReviewBodySchema.validate({
    submissionIds: [validId, validId],
    decision: 'APPROVE',
  }).error).toBeDefined();
});
