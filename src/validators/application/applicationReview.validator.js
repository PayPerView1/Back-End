const { body, param, query } = require('express-validator');
const { APPLICATION_STATUS } = require('../../constants/discovery.constants');
const { validationResult } = require('express-validator');
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

const validateCampaignIdParam = [
  param('campaignId').isMongoId().withMessage('Invalid campaign ID format'),
];

const validateApplicationIdParam = [
  param('id').isMongoId().withMessage('Invalid application ID format'),
];

const validateListApplicationsQuery = [
  query('status')
    .optional()
    .isIn([...Object.values(APPLICATION_STATUS), 'ALL'])
    .withMessage('Invalid status filter'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('perPage').optional().isInt({ min: 1, max: 50 }).withMessage('perPage must be between 1 and 50'),
];

const validateUpdateApplicationStatus = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn([APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.REJECTED])
    .withMessage('Status must be ACCEPTED or REJECTED'),
];

module.exports = {
  validate,
  validateCampaignIdParam,
  validateApplicationIdParam,
  validateListApplicationsQuery,
  validateUpdateApplicationStatus,
};