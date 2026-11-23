const version = '001-sprint4-campaign-fields';

const up = async ({ Campaign }) => {
  const updates = [
    ['isSuspended', false],
    ['suspensionReason', null],
    ['suspendedAt', null],
    ['applicantsCount', 0],
  ];

  const results = await Promise.all(
    updates.map(([field, value]) =>
      Campaign.updateMany(
        { [field]: { $exists: false } },
        { $set: { [field]: value } }
      )
    )
  );

  return Object.fromEntries(
    updates.map(([field], index) => [field, results[index].modifiedCount])
  );
};

module.exports = { version, up };
