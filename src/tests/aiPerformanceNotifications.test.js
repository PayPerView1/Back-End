jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../models/campaign', () => ({ find: jest.fn() }));
jest.mock('../models/SubmissionViewSnapshot', () => ({ aggregate: jest.fn() }));
jest.mock('../services/notification/notification.service', () => ({ notifyUserOnce: jest.fn() }));

const cron = require('node-cron');
const Campaign = require('../models/campaign');
const SubmissionViewSnapshot = require('../models/SubmissionViewSnapshot');
const { notifyUserOnce } = require('../services/notification/notification.service');
const job = require('../jobs/aiPerformanceNotifications.job');

const campaignQuery = (data) => {
  const value = { select: jest.fn(() => value), lean: jest.fn().mockResolvedValue(data) };
  return value;
};

describe('proactive campaign view alerts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('alerts only on a sustained validated-view drop and uses a stable dedupe key', async () => {
    const now = new Date('2026-11-10T12:00:00Z');
    Campaign.find.mockReturnValue(campaignQuery([{ _id: 'campaign-a', advertiserId: 'brand-a', name: 'Campaign A' }]));
    const snapshots = [];
    const end = new Date('2026-11-10T00:00:00Z');
    for (let offset = 14; offset > 7; offset -= 1) {
      snapshots.push({ _id: { campaignId: 'campaign-a', day: new Date(end.getTime() - offset * 86400000).toISOString().slice(0, 10) }, views: 100 });
    }
    for (let offset = 7; offset > 0; offset -= 1) {
      snapshots.push({ _id: { campaignId: 'campaign-a', day: new Date(end.getTime() - offset * 86400000).toISOString().slice(0, 10) }, views: 30 });
    }
    SubmissionViewSnapshot.aggregate.mockResolvedValue(snapshots);
    notifyUserOnce.mockResolvedValue({ created: true });

    const result = await job.runAiPerformanceNotifications(now);

    expect(result).toEqual({ scanned: 1, notified: 1 });
    expect(notifyUserOnce).toHaveBeenCalledWith('brand-a', expect.objectContaining({
      type: 'AI_PERFORMANCE_ALERT', data: expect.objectContaining({ kind: 'VALIDATED_VIEW_DROP', dropPercent: 70 }),
    }), 'AI_VIEW_DROP:campaign-a:2026-11-09');
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('does not notify on insufficient daily coverage or low baseline', async () => {
    Campaign.find.mockReturnValue(campaignQuery([{ _id: 'campaign-a', advertiserId: 'brand-a', name: 'Campaign A' }]));
    SubmissionViewSnapshot.aggregate.mockResolvedValue([
      { _id: { campaignId: 'campaign-a', day: '2026-11-09' }, views: 0 },
    ]);
    const result = await job.runAiPerformanceNotifications(new Date('2026-11-10T12:00:00Z'));
    expect(result).toEqual({ scanned: 1, notified: 0 });
    expect(notifyUserOnce).not.toHaveBeenCalled();
  });
});
