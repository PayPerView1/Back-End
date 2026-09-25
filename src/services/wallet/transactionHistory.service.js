const Transaction = require('../../models/transaction');
const { TRANSACTION_TYPE, TRANSACTION_STATUS } = require('../../constants/payment.constants');
const ExcelJS = require('exceljs');

/**
 * جلب المعاملات بشكل مصفح مع فلترة بسيطة
 */
const getTransactions = async (walletId, filters = {}, pagination = {}) => {
  const { type, status } = filters;
  const page = parseInt(pagination.page) || 1;
  const perPage = Math.min(parseInt(pagination.perPage) || 20, 100);

  const query = { walletId };

  if (type && Object.values(TRANSACTION_TYPE).includes(type)) {
    query.type = type;
  }

  if (status && Object.values(TRANSACTION_STATUS).includes(status)) {
    query.status = status;
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('campaignId', 'name'),
    Transaction.countDocuments(query),
  ]);

  const data = transactions.map((t) => ({
    id: t._id,
    type: t.type,
    grossAmount: t.grossAmount,
    commission: t.commission,
    netAmount: t.netAmount,
    currency: t.currency,
    paymentMethod: t.paymentMethod,
    status: t.status,
    description: t.description,
    campaignId: t.campaignId?._id || null,
    campaignName: t.campaignId?.name || null,
    createdAt: t.createdAt,
  }));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

/**
 * جلب تفاصيل معاملة واحدة مع التحقق من الملكية
 */
const getTransactionById = async (transactionId, walletId) => {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    walletId,
  }).populate('campaignId', 'name');

  if (!transaction) return null;

  // جلب receipt إذا كانت bank transfer
  let receiptUrl = null;
  if (transaction.paymentMethod === 'BANK_TRANSFER') {
    const BankTransfer = require('../../models/bankTransfer.model');
    const bt = await BankTransfer.findOne({
      transactionId: transaction._id,
    }).select('receiptUrl');
    receiptUrl = bt?.receiptUrl || null;
  }

  return {
    id: transaction._id,
    type: transaction.type,
    grossAmount: transaction.grossAmount,
    commission: transaction.commission,
    netAmount: transaction.netAmount,
    currency: transaction.currency,
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    referenceId: transaction.referenceId,
    description: transaction.description,
    campaignId: transaction.campaignId?._id || null,
    campaignName: transaction.campaignId?.name || null,
    receiptUrl,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
};

/**
 * تصدير المعاملات كملف Excel
 * @returns {Promise<Buffer>}
 */
const exportTransactionsExcel = async (walletId, filters = {}) => {
  const { type, status } = filters;

  const query = { walletId };
  if (type && Object.values(TRANSACTION_TYPE).includes(type)) query.type = type;
  if (status && Object.values(TRANSACTION_STATUS).includes(status)) query.status = status;

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .populate('campaignId', 'name');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transactions');

  sheet.columns = [
    { header: 'Transaction ID', key: 'id',            width: 30 },
    { header: 'Date',           key: 'date',          width: 20 },
    { header: 'Type',           key: 'type',          width: 12 },
    { header: 'Gross Amount',   key: 'grossAmount',   width: 15 },
    { header: 'Commission',     key: 'commission',    width: 15 },
    { header: 'Net Amount',     key: 'netAmount',     width: 15 },
    { header: 'Currency',       key: 'currency',      width: 10 },
    { header: 'Payment Method', key: 'paymentMethod', width: 18 },
    { header: 'Status',         key: 'status',        width: 15 },
    { header: 'Campaign',       key: 'campaign',      width: 25 },
    { header: 'Description',    key: 'description',   width: 35 },
  ];

  transactions.forEach((t) => {
    sheet.addRow({
      id:            t._id.toString(),
      date:          t.createdAt.toISOString().replace('T', ' ').substring(0, 19),
      type:          t.type,
      grossAmount:   t.grossAmount,
      commission:    t.commission,
      netAmount:     t.netAmount,
      currency:      t.currency,
      paymentMethod: t.paymentMethod || '—',
      status:        t.status,
      campaign:      t.campaignId?.name || '—',
      description:   t.description || '—',
    });
  });

  // تنسيق الـ header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  getTransactions,
  getTransactionById,
  exportTransactionsExcel,
};