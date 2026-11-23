const { sendMessageBodySchema } = require('../validators/ai/chat.validator');

test('chat request limit matches the FastAPI service contract', () => {
  expect(sendMessageBodySchema.validate({ content: 'a'.repeat(4000) }).error).toBeUndefined();
  expect(sendMessageBodySchema.validate({ content: 'a'.repeat(4001) }).error).toBeDefined();
});
