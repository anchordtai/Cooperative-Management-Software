import { Response, Router } from 'express';
import PDFDocument from 'pdfkit';
import { QueryTypes } from 'sequelize';
import { brand } from '../config/brand';
import sequelize from '../config/database';
import { authenticate, restrictTo } from '../middleware/auth';
import { financialScope, ownMember } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import { permit } from '../middleware/permissions';
import Cooperative from '../models/Cooperative';
import Transaction from '../models/Transaction';

const router = Router();
const localDate = new Intl.DateTimeFormat('en-NG', {
  timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short'
});
const dateOnly = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium' });
const amountFormat = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: string | number) => `NGN ${amountFormat.format(Number(value))}`;
const category: Record<string, string> = {
  deposit: 'Savings deposit', withdrawal: 'Savings withdrawal', loan: 'Loan disbursement',
  repayment: 'Loan repayment', contribution: 'Contribution', loan_payment: 'Loan payment', fee: 'Fee'
};

function pdf(res: Response, filename: string, cooperativeName: string, title: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.attachment(filename);
  const document = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true, info: { Title: title, Author: cooperativeName, Creator: brand.name } });
  document.on('error', error => res.destroy(error));
  document.pipe(res);
  document.fillColor(brand.colors.royal).font('Helvetica-Bold').fontSize(12).text(cooperativeName);
  document.moveDown(0.8).fillColor(brand.colors.navy).fontSize(23).text(title);
  document.moveDown().font('Helvetica').fontSize(10);
  return document;
}

function field(document: PDFKit.PDFDocument, label: string, value: string) {
  document.fillColor(brand.colors.muted).fontSize(9).text(label);
  document.fillColor(brand.colors.navy).fontSize(11).text(value);
  document.moveDown(0.7);
}

function finishPdf(document: PDFKit.PDFDocument) {
  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index++) {
    document.switchToPage(index);
    document.font('Helvetica').fontSize(8).fillColor(brand.colors.muted);
    document.text(`${brand.name} · ${brand.attribution}`, 46, 782, { lineBreak: false });
    const pageLabel = `Page ${index + 1} of ${pages.count}`;
    const pageLabelX = document.page.width - document.page.margins.right - document.widthOfString(pageLabel);
    document.text(pageLabel, pageLabelX, 782, { lineBreak: false });
  }
  document.end();
}

router.use(authenticate);

router.get('/receipts/:id', permit('finance.read', true), async (req, res, next) => {
  try {
    const scope = await financialScope(req);
    const entry = await Transaction.findOne({
      where: { ...scope, id: req.params.id, status: 'completed' }
    });
    if (!entry) throw new AppError('Receipt not found', 404);

    const [[details], cooperative] = await Promise.all([
      sequelize.query<{ firstName: string; lastName: string; membershipNumber: string; officer: string | null }>(`
        SELECT m."firstName", m."lastName", m."membershipNumber",
          CASE WHEN u.id IS NOT NULL THEN concat_ws(' ', u."firstName", u."lastName") END AS officer
        FROM "Transactions" t
        JOIN "Members" m ON m.id = t."memberId" AND m."cooperativeId" = t."cooperativeId"
        LEFT JOIN "Users" u ON u.id = t."handledBy" AND u."cooperativeId" = t."cooperativeId"
        WHERE t.id = :id AND t."cooperativeId" = :cooperativeId
      `, { replacements: { id: entry.id, cooperativeId: scope.cooperativeId }, type: QueryTypes.SELECT }),
      Cooperative.findByPk(scope.cooperativeId)
    ]);
    if (!cooperative || !details) throw new AppError('Receipt not found', 404);

    const document = pdf(res, `receipt-${entry.id}.pdf`, cooperative.name, 'Transaction receipt');
    const reference = entry.getDataValue('externalReference') as string | null;
    if (reference?.startsWith('ec-test-')) field(document, 'Mode', 'Paystack test transaction');
    field(document, 'Receipt number', entry.id);
    field(document, 'Member', `${details.firstName} ${details.lastName}`);
    field(document, 'Membership number', details.membershipNumber);
    field(document, 'Transaction type', category[entry.type] || entry.type);
    field(document, 'Amount', amount(entry.amount));
    field(document, 'Recorded at (WAT)', localDate.format(entry.type === 'withdrawal' ? entry.updatedAt : entry.createdAt));
    if (reference) field(document, 'External payment reference', reference);
    if (details.officer) field(document, 'Recorded by', details.officer);
    field(document, 'Description', entry.description || '');
    finishPdf(document);
  } catch (error) {
    next(error);
  }
});

interface SavingsEntry { type: 'deposit' | 'withdrawal'; amount: string; postedAt: Date; externalReference: string | null }

router.get('/my-savings-statement', restrictTo('member'), async (req, res, next) => {
  try {
    const member = await ownMember(req);
    const { cooperativeId } = req.user!;
    const [entries, cooperative] = await Promise.all([
      sequelize.query<SavingsEntry>(`
        SELECT type, amount, "externalReference",
          CASE WHEN type = 'withdrawal' THEN "updatedAt" ELSE "createdAt" END AS "postedAt"
        FROM "Transactions"
        WHERE "cooperativeId" = :cooperativeId AND "memberId" = :memberId
          AND type IN ('deposit', 'withdrawal') AND status = 'completed'
          AND (CASE WHEN type = 'withdrawal' THEN "updatedAt" ELSE "createdAt" END) >= now() - interval '12 months'
        ORDER BY "postedAt", id LIMIT 5001
      `, { replacements: { cooperativeId, memberId: member.id }, type: QueryTypes.SELECT }),
      Cooperative.findByPk(cooperativeId)
    ]);
    if (!cooperative) throw new AppError('Cooperative not found', 404);
    if (entries.length > 5000) throw new AppError('Statement is too large. Ask your cooperative for a shorter reporting period', 422);

    const document = pdf(res, 'savings-statement.pdf', cooperative.name, 'Savings activity statement');
    field(document, 'Member', `${member.firstName} ${member.lastName}`);
    field(document, 'Membership number', member.membershipNumber);
    field(document, 'Period', `Previous 12 months through ${dateOnly.format(new Date())}`);
    field(document, 'Current savings balance', amount(member.savings));
    document.moveDown();
    if (entries.length === 0) document.text('No completed savings activity in this period.');
    for (const row of entries) {
      if (document.y > 744) document.addPage();
      document.font('Helvetica-Bold').text(`${dateOnly.format(row.postedAt)}   |   ${category[row.type]}   |   ${amount(row.amount)}`);
      if (row.externalReference) document.font('Helvetica').text(`Reference ${row.externalReference}`);
      document.moveDown(0.6);
    }
    finishPdf(document);
  } catch (error) {
    next(error);
  }
});

export default router;
