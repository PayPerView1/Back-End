const {
  grossCentsForViews,
  calculateViewDelta,
  countryDelta,
  mergeCountryHighWater,
} = require('../services/submission/submissionViews.service');

test('converts CPM dollars and view counts into cents without inflating campaign spend', () => {
  expect(grossCentsForViews(1000, 5)).toBe(500);
  expect(grossCentsForViews(500, 5)).toBe(250);
  expect(grossCentsForViews(0, 5)).toBe(0);
});

test('does not count a temporary platform counter decrease again when the count recovers', () => {
  const first = calculateViewDelta(1000, null, null);
  expect(first).toEqual({ deltaViews: 0, highWaterViews: 1000, decreased: false });

  const decreased = calculateViewDelta(900, first.highWaterViews, 1000);
  expect(decreased).toEqual({ deltaViews: 0, highWaterViews: 1000, decreased: true });

  const recovered = calculateViewDelta(1000, decreased.highWaterViews, 900);
  expect(recovered).toEqual({ deltaViews: 0, highWaterViews: 1000, decreased: false });

  const newViews = calculateViewDelta(1100, recovered.highWaterViews, 1000);
  expect(newViews).toEqual({ deltaViews: 100, highWaterViews: 1100, decreased: false });
});

test('uses per-country high-water values so temporary geography decreases do not create new deltas', () => {
  const highWater = mergeCountryHighWater([
    { countryCode: 'SAU', views: 700 },
    { countryCode: 'USA', views: 300 },
  ], []);
  expect(countryDelta([
    { countryCode: 'SAU', views: 650 },
    { countryCode: 'USA', views: 350 },
  ], highWater)).toEqual([
    { countryCode: 'SAU', views: 0 },
    { countryCode: 'USA', views: 50 },
  ]);
});
