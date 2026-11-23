const { changePasswordBodySchema } = require('../validators/auth.validator');

test('change password requires confirmation matching the new password', () => {
  expect(changePasswordBodySchema.validate({
    currentPassword: 'CurrentPassword123!',
    newPassword: 'NewPassword123!',
  }).error).toBeDefined();
  expect(changePasswordBodySchema.validate({
    currentPassword: 'CurrentPassword123!',
    newPassword: 'NewPassword123!',
    confirmPassword: 'DifferentPassword123!',
  }).error).toBeDefined();
  expect(changePasswordBodySchema.validate({
    currentPassword: 'CurrentPassword123!',
    newPassword: 'NewPassword123!',
    confirmPassword: 'NewPassword123!',
  }).error).toBeUndefined();
});
