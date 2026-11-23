const { adminWithdrawalDecisionBodySchema } = require('../validators/wallet/creatorEarnings.validator');

test('manual payout completion requires a non-empty external payment reference', () => {
  expect(adminWithdrawalDecisionBodySchema.validate({ decision: 'COMPLETE' }).error).toBeDefined();
  expect(adminWithdrawalDecisionBodySchema.validate({
    decision: 'COMPLETE',
    externalReference: '  ',
  }).error).toBeDefined();
  expect(adminWithdrawalDecisionBodySchema.validate({
    decision: 'COMPLETE',
    externalReference: 'bank-transfer-123',
  }).error).toBeUndefined();
});

test('processing a withdrawal does not require a completed payout reference', () => {
  expect(adminWithdrawalDecisionBodySchema.validate({ decision: 'PROCESS' }).error).toBeUndefined();
});
