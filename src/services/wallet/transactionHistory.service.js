// src/services/wallet/transactionHistory.service.js

const Transaction = require('../../models/transaction');
const { TRANSACTION_TYPE, TRANSACTION_STATUS, PAYMENT_METHOD } = require('../../constants/payment.constants');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
/**
 * جلب المعاملات بشكل مصفح مع فلترة كاملة
 */
const getTransactions = async (walletId, filters = {}, pagination = {}) => {
  const { type, status, paymentMethod, dateFrom, dateTo, search } = filters;
  const page    = parseInt(pagination.page)    || 1;
  const perPage = Math.min(parseInt(pagination.perPage) || 20, 100);

  const query = { walletId };

  // ----------------------
  // فلاتر MVP الأصلية
  // ----------------------
  if (type && Object.values(TRANSACTION_TYPE).includes(type)) {
    query.type = type;
  }

  if (status && Object.values(TRANSACTION_STATUS).includes(status)) {
    query.status = status;
  }

  // ----------------------
  // فلاتر جديدة
  // ----------------------
  if (paymentMethod && Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    query.paymentMethod = paymentMethod;
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      // نضيف يوم كامل عشان يشمل كل ساعات نهاية اليوم
      const endDate = new Date(dateTo);
      endDate.setUTCHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  if (search && search.trim()) {
    query.$or = [
      { referenceId:  { $regex: search.trim(), $options: 'i' } },
      { description:  { $regex: search.trim(), $options: 'i' } },
    ];
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
    id:            t._id,
    type:          t.type,
    grossAmount:   t.grossAmount,
    commission:    t.commission,
    netAmount:     t.netAmount,
    currency:      t.currency,
    paymentMethod: t.paymentMethod,
    status:        t.status,
    description:   t.description,
    campaignId:    t.campaignId?._id  || null,
    campaignName:  t.campaignId?.name || null,
    createdAt:     t.createdAt,
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

  let receiptUrl = null;
  if (transaction.paymentMethod === 'BANK_TRANSFER') {
    const BankTransfer = require('../../models/bankTransfer');
    const bt = await BankTransfer.findOne({
      transactionId: transaction._id,
    }).select('receiptUrl');
    receiptUrl = bt?.receiptUrl || null;
  }

  return {
    id:            transaction._id,
    type:          transaction.type,
    grossAmount:   transaction.grossAmount,
    commission:    transaction.commission,
    netAmount:     transaction.netAmount,
    currency:      transaction.currency,
    paymentMethod: transaction.paymentMethod,
    status:        transaction.status,
    referenceId:   transaction.referenceId,
    description:   transaction.description,
    campaignId:    transaction.campaignId?._id  || null,
    campaignName:  transaction.campaignId?.name || null,
    receiptUrl,
    createdAt:     transaction.createdAt,
    updatedAt:     transaction.updatedAt,
  };
};

/**
 * تصدير المعاملات كملف Excel
 * @returns {Promise<Buffer>}
 */
const exportTransactionsExcel = async (walletId, filters = {}) => {
  const { type, status, paymentMethod, dateFrom, dateTo, search } = filters;

  const query = { walletId };

  if (type && Object.values(TRANSACTION_TYPE).includes(type)) {
    query.type = type;
  }
  if (status && Object.values(TRANSACTION_STATUS).includes(status)) {
    query.status = status;
  }
  if (paymentMethod && Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    query.paymentMethod = paymentMethod;
  }
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setUTCHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }
  if (search && search.trim()) {
    query.$or = [
      { referenceId: { $regex: search.trim(), $options: 'i' } },
      { description: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .populate('campaignId', 'name');

  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet('Transactions');

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
      description:   t.description    || '—',
    });
  });

  sheet.getRow(1).fill = {
    type:    'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};



/**
 * تصدير المعاملات كملف PDF
 * @returns {Promise<Buffer>}
 */
const exportTransactionsPDF = async (walletId, filters = {}) => {
  const { type, status, paymentMethod, dateFrom, dateTo, search } = filters;

  const query = { walletId };

  if (type && Object.values(TRANSACTION_TYPE).includes(type)) query.type = type;
  if (status && Object.values(TRANSACTION_STATUS).includes(status)) query.status = status;
  if (paymentMethod && Object.values(PAYMENT_METHOD).includes(paymentMethod)) query.paymentMethod = paymentMethod;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setUTCHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }
  if (search && search.trim()) {
    query.$or = [
      { referenceId: { $regex: search.trim(), $options: 'i' } },
      { description: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .populate('campaignId', 'name');

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];

    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   ()      => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ----------------------
    // Header
    // ----------------------
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Transaction History', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`, { align: 'center' });

    doc.moveDown(1);

    // ----------------------
    // Column definitions
    // ----------------------
    const columns = [
      { label: 'Date',           width: 110 },
      { label: 'Type',           width: 55  },
      { label: 'Gross ($)',      width: 65  },
      { label: 'Commission ($)', width: 80  },
      { label: 'Net ($)',        width: 65  },
      { label: 'Method',         width: 80  },
      { label: 'Status',         width: 75  },
      { label: 'Campaign',       width: 110 },
      { label: 'Description',    width: 165 },
    ];

    const startX    = doc.page.margins.left;
    const rowHeight = 20;

    // ----------------------
    // Table header
    // ----------------------
    let x = startX;
    doc
      .rect(startX, doc.y, columns.reduce((s, c) => s + c.width, 0), rowHeight)
      .fill('#1F2937');

    const headerY = doc.y + 5;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');

    columns.forEach((col) => {
      doc.text(col.label, x + 3, headerY, { width: col.width - 6, lineBreak: false });
      x += col.width;
    });

    doc.moveDown(0.2);
    doc.fillColor('#000000');

    // ----------------------
    // Table rows
    // ----------------------
    transactions.forEach((t, i) => {
      const rowY = doc.y;

      // تبديل لون الصفوف
      if (i % 2 === 0) {
        doc
          .rect(startX, rowY, columns.reduce((s, c) => s + c.width, 0), rowHeight)
          .fill('#F3F4F6');
        doc.fillColor('#000000');
      }

      const cells = [
        t.createdAt.toISOString().replace('T', ' ').substring(0, 19),
        t.type,
        t.grossAmount.toFixed(2),
        t.commission.toFixed(2),
        t.netAmount.toFixed(2),
        t.paymentMethod || '—',
        t.status,
        t.campaignId?.name || '—',
        t.description      || '—',
      ];

      x = startX;
      doc.font('Helvetica').fontSize(7.5);

      cells.forEach((cell, idx) => {
        doc.text(
          cell,
          x + 3,
          rowY + 5,
          { width: columns[idx].width - 6, lineBreak: false }
        );
        x += columns[idx].width;
      });

      doc.moveDown(0.55);

      // صفحة جديدة إذا اقتربنا من نهاية الصفحة
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
      }
    });

    // ----------------------
    // Footer
    // ----------------------
    doc
      .moveDown(1)
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(`Total records: ${transactions.length}`, { align: 'right' });

    doc.end();
  });
};
module.exports = {
  getTransactions,
  getTransactionById,
  exportTransactionsExcel,
  exportTransactionsPDF,
};