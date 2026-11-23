require('dotenv').config();

const request = require('supertest');
const app = require('../app');

describe('campaign category routes', () => {
  test('serves categories from the documented campaign path with boolean success', async () => {
    const response = await request(app).get('/api/v1/campaigns/categories');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.categories)).toBe(true);
  });

  test('serves sub-categories from the documented campaign path with boolean success', async () => {
    const response = await request(app).get('/api/v1/campaigns/categories/sub-categories');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.subCategories)).toBe(true);
  });

  test('keeps the previous category paths available for existing clients', async () => {
    const categories = await request(app).get('/api/v1/categories');
    const subCategories = await request(app).get('/api/v1/categories/sub-categories');

    expect(categories.status).toBe(200);
    expect(categories.body.success).toBe(true);
    expect(subCategories.status).toBe(200);
    expect(subCategories.body.success).toBe(true);
  });
});
