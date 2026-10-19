// src/controllers/moderation/report.controller.js
const { AppError, sendError } = require('../../utils/errors');
const reportService = require('../../services/moderation/report.service');

/**
 * POST /api/v1/campaigns/:campaignId/report
 * Submit a report for a campaign (any user or visitor)
 */
const submitReport = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const reporter = req.user || null; // null for visitors
    const body = req.body;
    const ip = req.ip;

    const result = await reportService.submitReport(campaignId, reporter, body, ip);

    const statusCode = result.requiresEmailConfirmation ? 202 : 201;
    return res.status(statusCode).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error, 'report.controller.submitReport');
  }
};

/**
 * POST /api/v1/reports/confirm
 * Confirm a visitor's report via email token
 */
const confirmVisitorReport = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError('Confirmation token is required', 'VALIDATION_ERROR');
    }

    const result = await reportService.confirmVisitorReport(token);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error, 'report.controller.confirmVisitorReport');
  }
};

/**
 * GET /api/v1/reports/statistics
 * Get report statistics (admin only)
 */
const getReportStatistics = async (req, res) => {
  try {
    const result = await reportService.getReportStatistics();

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error, 'report.controller.getReportStatistics');
  }
};

/**
 * GET /api/v1/reports
 * List all reports (admin only)
 */
const getReports = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      reason: req.query.reason,
      campaignId: req.query.campaignId,
      page: req.query.page,
      perPage: req.query.perPage,
    };

    const result = await reportService.getReports(filters);

    return res.status(200).json({
      success: true,
      data: result.reports,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error, 'report.controller.getReports');
  }
};

/**
 * GET /api/v1/reports/:id
 * Get a single report by ID (admin only)
 */
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await reportService.getReportById(id);

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    return sendError(res, error, 'report.controller.getReportById');
  }
};

/**
 * PUT /api/v1/reports/:id
 * Review a report - confirm violation or dismiss (admin only)
 */
const reviewReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;
    const { action, note } = req.body;

    const result = await reportService.reviewReport(id, adminId, { action, note });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error, 'report.controller.reviewReport');
  }
};

module.exports = {
  submitReport,
  confirmVisitorReport,
  getReportStatistics,
  getReports,
  getReportById,
  reviewReport,
};