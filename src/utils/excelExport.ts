import ExcelJS from 'exceljs';
import {
  MasterReportEntry,
  ExpenseItem,
  CashInflowItem,
  DailyShiftClosing,
  YearlyArchive,
  SessionCategory,
  POSTransaction,
  Coach,
  TrainerTransaction,
  CheckInLog,
} from '../types';

// Common styling helpers for professional Excel sheets
const HEADER_BG_COLOR = 'FF0F172A'; // Dark slate #0F172A
const HEADER_FONT_COLOR = 'FFFFFFFF'; // White bold
const TOTAL_ROW_BG_COLOR = 'FFE6F4EA'; // Soft green highlight #E6F4EA
const TOTAL_ROW_FONT_COLOR = 'FF0F5132'; // Dark green
const TITLE_BANNER_BG = 'FF0D2235'; // Gym theme navy
const BORDER_COLOR = 'FFCBD5E1';

const getCategoryLabel = (cat?: SessionCategory | string): string => {
  switch (cat) {
    case 'gym':
      return 'جيم عام (Gym)';
    case 'private':
      return 'تدريب خاص (Private)';
    case 'group':
      return 'حصص جماعية (Group)';
    case 'physio':
      return 'علاج طبيعي (Physio)';
    case 'massage':
      return 'مساج واستشفاء (Massage)';
    default:
      return 'اشتراك عام';
  }
};

const getExpenseCategoryLabel = (category: string): string => {
  switch (category) {
    case 'electricity':
      return 'كهرباء وتكييف';
    case 'water':
      return 'مياه ومرافق';
    case 'maintenance':
      return 'صيانة وأجهزة';
    case 'rent':
      return 'إيجار مقر';
    case 'trainer_payout':
      return 'رواتب ومستحقات كباتن';
    case 'supplies':
      return 'نظافة ومستلزمات';
    default:
      return 'مصاريف نثرية وأخرى';
  }
};

const getPaymentMethodLabel = (method?: string): string => {
  switch (method) {
    case 'coach_collected':
      return 'تحميل على الكابتن';
    case 'instapay':
      return 'إنستاباي (InstaPay)';
    case 'card':
      return 'بطاقة / فيزا';
    default:
      return 'كاش بالخزينة';
  }
};

/**
 * Applies right-to-left view and auto-fits columns to ensure no text is clipped.
 */
const finalizeWorksheet = (worksheet: ExcelJS.Worksheet, minWidth = 14) => {
  worksheet.views = [{ state: 'normal', rightToLeft: true }];

  worksheet.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        let valStr = '';
        if (typeof cell.value === 'object' && 'text' in cell.value) {
          valStr = String(cell.value.text);
        } else if (typeof cell.value === 'object' && 'richText' in cell.value) {
          valStr = cell.value.richText.map((r) => r.text).join('');
        } else {
          valStr = String(cell.value);
        }
        maxLen = Math.max(maxLen, valStr.length + 3);
      }
    });
    column.width = Math.min(Math.max(maxLen, minWidth), 48);
  });
};

/**
 * Styles a table header row with dark background and white bold centered font.
 */
const styleHeaderRow = (row: ExcelJS.Row) => {
  row.height = 30;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG_COLOR },
    };
    cell.font = {
      bold: true,
      color: { argb: HEADER_FONT_COLOR },
      size: 11,
      name: 'Segoe UI',
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF14B8A6' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
};

/**
 * Styles a sub-section header (lighter, indigo theme)
 */
const styleSubHeaderRow = (row: ExcelJS.Row, bgArgb = 'FF1E293B') => {
  row.height = 26;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.font = { bold: true, color: { argb: 'FFA5F3FC' }, size: 10, name: 'Segoe UI' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
};

/**
 * Styles a total row with soft green highlight and double bottom border.
 */
const styleTotalRow = (row: ExcelJS.Row) => {
  row.height = 26;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TOTAL_ROW_BG_COLOR },
    };
    cell.font = {
      bold: true,
      color: { argb: TOTAL_ROW_FONT_COLOR },
      size: 11,
      name: 'Segoe UI',
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF10B981' } },
      bottom: { style: 'double', color: { argb: 'FF10B981' } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });
};

/**
 * Triggers browser download of the workbook buffer.
 */
const downloadWorkbook = async (workbook: ExcelJS.Workbook, filename: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// ============================================================================
// 1. MASTER REPORT MULTI-TAB EXCEL EXPORT — 5 TABS (.xlsx)
// ============================================================================
export interface MasterReportExportPayload {
  selectedMonth: string;
  entries: MasterReportEntry[];
  expenses: ExpenseItem[];
  repayments: CashInflowItem[];
  cashInflows?: CashInflowItem[];
  posTransactions: POSTransaction[];
  coaches: Coach[];
  totalDirectRevenue: number;
  totalCoachDebtRevenue: number;
  grandTotalPlayerRevenue: number;
  totalExpensesAmount: number;
  totalRepaymentsAmount: number;
  netPeriodCash: number;
}

export const exportMasterReportToXLSX = async (data: MasterReportExportPayload) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Synapse Gym SaaS Pro';
  workbook.lastModifiedBy = 'Synapse Management';
  workbook.created = new Date();
  workbook.modified = new Date();

  const directEntries = data.entries.filter((e) => e.paymentMethod !== 'coach_collected');
  const coachEntries = data.entries.filter((e) => e.paymentMethod === 'coach_collected');

  // ─────────────────────────────────────────────────────────────
  // TAB 1: الملخص المالي والدرج
  // ─────────────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('الملخص المالي والدرج');
  summarySheet.views = [{ state: 'normal', rightToLeft: true }];

  summarySheet.mergeCells('A1:E1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'التقرير المالي والتشغيلي المجمع - SYNAPSE GYM';
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  summarySheet.getRow(1).height = 40;

  summarySheet.mergeCells('A2:E2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `الدورة المالية: ${data.selectedMonth} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}`;
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Segoe UI' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  summarySheet.getRow(2).height = 24;

  summarySheet.addRow([]);

  const kpiHeaderRow = summarySheet.addRow([
    'البند المالي / البيان',
    'القيمة المحققة (ج.م)',
    'طريقة الدفع',
    'الحالة المحاسبية',
    'ملاحظات وتوجيه الخزينة',
  ]);
  styleHeaderRow(kpiHeaderRow);

  // Direct Cash breakdown by payment method
  const directCash = directEntries.filter((e) => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);
  const directInstapay = directEntries.filter((e) => e.paymentMethod === 'instapay').reduce((s, e) => s + e.amount, 0);
  const directCard = directEntries.filter((e) => e.paymentMethod === 'card').reduce((s, e) => s + e.amount, 0);
  const posTotal = data.posTransactions.reduce((s, t) => s + t.totalAmount, 0);
  const posCash = data.posTransactions.filter((t) => t.paymentMethod === 'cash').reduce((s, t) => s + t.totalAmount, 0);
  const posInstapay = data.posTransactions.filter((t) => t.paymentMethod === 'instapay').reduce((s, t) => s + t.totalAmount, 0);
  const repCash = data.repayments.filter((r) => r.paymentMethod === 'cash').reduce((s, r) => s + r.amount, 0);
  const repInstapay = data.repayments.filter((r) => r.paymentMethod === 'instapay').reduce((s, r) => s + r.amount, 0);

  const custodyDeposits = (data.cashInflows || [])
    .filter((i) => i.type === 'manual_deposit' && (i.title.includes('عهدة') || i.title.includes('إيداع')))
    .reduce((s, i) => s + i.amount, 0);

  const custodyWithdrawals = data.expenses
    .filter((e) => e.title.includes('عهدة') || e.title.includes('سحب'))
    .reduce((s, e) => s + e.amount, 0);

  const coachPayouts = data.expenses
    .filter((e) => e.category === 'trainer_payout')
    .reduce((s, e) => s + e.amount, 0);

  const summaryKPIs = [
    { label: 'اشتراكات مباشرة - كاش بالخزينة', value: directCash, method: 'كاش', status: 'وارد فعلي بالدرج', notes: 'اشتراكات وجلسات تم تحصيلها نقداً في الاستقبال' },
    { label: 'اشتراكات مباشرة - إنستاباي', value: directInstapay, method: 'إنستاباي', status: 'وارد رقمي', notes: 'تحويلات إنستاباي تم تأكيدها بالاستقبال' },
    { label: 'اشتراكات مباشرة - بطاقة / فيزا', value: directCard, method: 'فيزا / بطاقة', status: 'وارد رقمي', notes: 'مدفوعات بطاقات بنكية' },
    { label: 'مبيعات البار والمتجر - كاش', value: posCash, method: 'كاش', status: 'وارد بالدرج', notes: 'نقدية مبيعات POS المتجر' },
    { label: 'مبيعات البار والمتجر - إنستاباي', value: posInstapay, method: 'إنستاباي', status: 'وارد رقمي', notes: 'مبيعات POS عبر إنستاباي' },
    { label: 'إجمالي مبيعات البار والمتجر', value: posTotal, method: 'متنوع', status: 'إجمالي POS', notes: `${data.posTransactions.length} فاتورة بيع` },
    { label: 'سدادات الكباتن - كاش بالخزينة', value: repCash, method: 'كاش', status: 'توريد بالدرج', notes: 'مبالغ سددها المدربون نقداً من مديونياتهم' },
    { label: 'سدادات الكباتن - إنستاباي', value: repInstapay, method: 'إنستاباي', status: 'توريد رقمي', notes: 'سداد مديونيات عبر إنستاباي' },
    { label: 'إجمالي إيداعات سداد الكباتن', value: data.totalRepaymentsAmount, method: '-', status: 'إجمالي السدادات', notes: 'مجموع توريدات المدربين خلال الدورة' },
    { label: 'تسوية عهدة - إيداعات إضافية بالدرج', value: custodyDeposits, method: 'كاش', status: 'وارد عهدة', notes: 'إيداعات نقدية وفكة مسجلة بالبيان' },
    { label: 'تسوية عهدة - مسحوبات وسحب عهدة', value: custodyWithdrawals, method: 'كاش', status: 'منصرف عهدة', notes: 'سحب نقدي من الدرج ببيان رسمي' },
    { label: 'مستحقات ومدفوعات الكباتن المنصرفة', value: coachPayouts, method: 'كاش / تحويل', status: 'منصرف كباتن', notes: 'رواتب وسلف ومستحقات حصص مسددة للمدربين' },
    { label: 'إجمالي المصاريف التشغيلية المنصرفة', value: data.totalExpensesAmount, method: 'متنوع', status: 'مصروف تشغيل', notes: 'كهرباء، مياه، صيانة، إيجار، ونثريات' },
    { label: 'صافي النقدية المتوفرة بالدرج (السيولة)', value: data.netPeriodCash, method: '-', status: data.netPeriodCash >= 0 ? 'فائض نقدي متاح' : 'عجز في الدرج', notes: 'المقبوضات مطروح منها المصاريف' },
    { label: 'إجمالي مديونيات التحميل المعلقة على الكباتن', value: data.totalCoachDebtRevenue, method: 'تحميل', status: 'مديونية مستحقة للجيم', notes: 'جلسات استلم المدرب قيمتها ولم يورد للجيم بعد' },
    { label: 'الإيراد الكلي الشامل للنادي', value: data.grandTotalPlayerRevenue, method: 'متنوع', status: 'القيمة الإنتاجية الشاملة', notes: 'كافة الأنشطة (اشتراكات + تحميلات + متجر)' },
  ];

  summaryKPIs.forEach((kpi, index) => {
    const row = summarySheet.addRow([
      kpi.label,
      `${kpi.value.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      kpi.method,
      kpi.status,
      kpi.notes,
    ]);
    row.height = 24;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).font = { bold: true, name: 'Segoe UI' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    if (index % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    if (kpi.label.includes('صافي النقدية') || kpi.label.includes('الإيراد الكلي')) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        c.font = { bold: true, color: { argb: 'FF0369A1' }, name: 'Segoe UI' };
      });
    }

    if (kpi.label.includes('مديونيات')) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        c.font = { bold: true, color: { argb: 'FFB45309' }, name: 'Segoe UI' };
      });
    }
  });

  finalizeWorksheet(summarySheet, 18);

  // ─────────────────────────────────────────────────────────────
  // TAB 2: تفصيل مبيعات البار والمتجر (POS Sales)
  // ─────────────────────────────────────────────────────────────
  const posSheet = workbook.addWorksheet('مبيعات البار والمتجر');

  // Title
  posSheet.mergeCells('A1:H1');
  const posTitleCell = posSheet.getCell('A1');
  posTitleCell.value = `تفصيل مبيعات البار والمتجر - ${data.selectedMonth}`;
  posTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  posTitleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  posTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2235' } };
  posSheet.getRow(1).height = 36;
  posSheet.addRow([]);

  const posHeaders = [
    'م',
    'وقت البيع',
    'المنتج / الصنف',
    'الكمية المباعة',
    'سعر الوحدة (ج.م)',
    'إجمالي البيع (ج.م)',
    'طريقة الدفع',
    'الكاشير',
  ];
  const posHeaderRow = posSheet.addRow(posHeaders);
  styleHeaderRow(posHeaderRow);

  // Group transactions by product
  const productSalesMap: Record<string, { name: string; qty: number; revenue: number; cost: number; lastMethod: string }> = {};

  let rowIndex = 1;
  data.posTransactions.forEach((tx) => {
    const timeStr = new Date(tx.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
    tx.items.forEach((item) => {
      const row = posSheet.addRow([
        rowIndex++,
        timeStr,
        item.productName,
        item.quantity,
        `${item.unitPrice.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        `${item.totalPrice.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        getPaymentMethodLabel(tx.paymentMethod),
        tx.cashierName || 'الكاشير',
      ]);
      row.height = 22;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).font = { bold: true, name: 'Segoe UI' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).font = { bold: true, name: 'Segoe UI' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      if (rowIndex % 2 === 0) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }

      // Accumulate product summary
      const key = item.productName;
      if (!productSalesMap[key]) {
        productSalesMap[key] = { name: item.productName, qty: 0, revenue: 0, cost: 0, lastMethod: getPaymentMethodLabel(tx.paymentMethod) };
      }
      productSalesMap[key].qty += item.quantity;
      productSalesMap[key].revenue += item.totalPrice;
      productSalesMap[key].cost += item.unitCost * item.quantity;
    });
  });

  // Total row
  const posTotalRow = posSheet.addRow([
    'الإجمالي',
    `${data.posTransactions.length} فاتورة`,
    `${rowIndex - 1} سطر بيع`,
    '',
    '',
    `${posTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '',
    '',
  ]);
  styleTotalRow(posTotalRow);

  // Summary by product section
  posSheet.addRow([]);
  posSheet.addRow([]);
  const prodSumHeaderRow = posSheet.addRow(['ملخص المبيعات حسب الصنف', 'الكمية الإجمالية المباعة', 'إجمالي الإيراد (ج.م)', 'إجمالي التكلفة (ج.م)', 'صافي الربح (ج.م)', '', '', '']);
  styleSubHeaderRow(prodSumHeaderRow, 'FF0F4C75');

  Object.values(productSalesMap).forEach((prod, i) => {
    const profitPerProd = prod.revenue - prod.cost;
    const row = posSheet.addRow([
      prod.name,
      prod.qty,
      `${prod.revenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      `${prod.cost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      `${profitPerProd.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      '', '', '',
    ]);
    row.height = 22;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).font = { bold: true };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).font = { bold: true, color: { argb: 'FF065F46' } };
    if (i % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });
    }
  });

  finalizeWorksheet(posSheet, 15);

  // ─────────────────────────────────────────────────────────────
  // TAB 3: الاشتراكات المباشرة حسب النشاط
  // ─────────────────────────────────────────────────────────────
  const directSheet = workbook.addWorksheet('الاشتراكات المباشرة');
  directSheet.mergeCells('A1:J1');
  const dTitle = directSheet.getCell('A1');
  dTitle.value = `الاشتراكات المباشرة حسب النشاط - ${data.selectedMonth}`;
  dTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  dTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  directSheet.getRow(1).height = 36;
  directSheet.addRow([]);

  // Group by category and render separately
  const categories: Array<{ key: SessionCategory | string; label: string; bgArgb: string }> = [
    { key: 'gym', label: 'اشتراكات صالة الجيم العام', bgArgb: 'FF14532D' },
    { key: 'private', label: 'حصص التدريب الخاص (Private PT)', bgArgb: 'FF312E81' },
    { key: 'group', label: 'الكلاسات الجماعية (Group Classes)', bgArgb: 'FF1E40AF' },
    { key: 'massage', label: 'جلسات المساج والاستشفاء', bgArgb: 'FF701A75' },
    { key: 'physio', label: 'جلسات العلاج الطبيعي', bgArgb: 'FF0C4A6E' },
  ];

  const directHeaders = ['م', 'كود اللاعب', 'اسم اللاعب / العضو', 'تفاصيل الباقة / الحصة', 'القيمة المسددة (ج.م)', 'طريقة الدفع', 'الكابتن / المشرف', 'التاريخ', 'حالة السداد', 'ملاحظات'];

  let directGrandTotal = 0;
  let directGrandCount = 0;

  categories.forEach(({ key, label, bgArgb }) => {
    const catEntries = directEntries.filter((e) => e.sessionCategory === key);
    if (catEntries.length === 0) return;

    const catTotal = catEntries.reduce((s, e) => s + e.amount, 0);
    directGrandTotal += catTotal;
    directGrandCount += catEntries.length;

    // Section header
    const secRow = directSheet.addRow([label, `عدد القيود: ${catEntries.length}`, `إجمالي: ${catTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`, '', '', '', '', '', '', '']);
    secRow.height = 28;
    secRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI', size: 11 };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const hRow = directSheet.addRow(directHeaders);
    styleSubHeaderRow(hRow, 'FF1E293B');

    catEntries.forEach((entry, idx) => {
      const dStr = entry.date ? new Date(entry.date).toLocaleDateString('ar-EG') : '';
      const statusLabel = entry.paymentStatus === 'paid' ? 'مسدد' : entry.paymentStatus === 'pending_on_coach' ? 'تحميل قائم' : 'غير مسدد';
      const row = directSheet.addRow([
        idx + 1,
        entry.playerCode || '-',
        entry.playerName,
        entry.sessionTitle || 'اشتراك شهري',
        `${entry.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        getPaymentMethodLabel(entry.paymentMethod),
        entry.coachName || 'الخزينة العامة',
        dStr,
        statusLabel,
        entry.notes || '-',
      ]);
      row.height = 22;
      [1, 2, 4, 7, 8].forEach((n) => { row.getCell(n).alignment = { vertical: 'middle', horizontal: 'center' }; });
      [3, 4, 10].forEach((n) => { row.getCell(n).alignment = { vertical: 'middle', horizontal: 'right' }; });
      row.getCell(5).font = { bold: true, name: 'Segoe UI' };
      if (idx % 2 === 1) {
        row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
      }
    });

    directSheet.addRow([]);
  });

  // Grand total
  const directTotalRow = directSheet.addRow([
    'الإجمالي الكلي للاشتراكات المباشرة',
    `${directGrandCount} قيد`,
    `${directGrandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '', '', '', '', '', '', '',
  ]);
  styleTotalRow(directTotalRow);

  finalizeWorksheet(directSheet, 14);

  // ─────────────────────────────────────────────────────────────
  // TAB 4: حسابات الكباتن المستقلة
  // ─────────────────────────────────────────────────────────────
  const coachSheet = workbook.addWorksheet('حسابات الكباتن');
  coachSheet.mergeCells('A1:J1');
  const coachTitle = coachSheet.getCell('A1');
  coachTitle.value = `حسابات وجداول الكباتن المستقلة - ${data.selectedMonth}`;
  coachTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  coachTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  coachTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  coachSheet.getRow(1).height = 36;
  coachSheet.addRow([]);

  // Group coach entries by coachId/coachName
  const coachMap: Record<string, { name: string; entries: MasterReportEntry[] }> = {};
  coachEntries.forEach((entry) => {
    const cid = entry.coachId || entry.coachName || 'unknown';
    if (!coachMap[cid]) {
      coachMap[cid] = { name: entry.coachName || 'كابتن', entries: [] };
    }
    coachMap[cid].entries.push(entry);
  });

  // Add repayments info from data.repayments (keyed by coach name match if possible)
  const coachHeaders = ['م', 'كود اللاعب', 'اسم اللاعب', 'نوع النشاط', 'تفاصيل الحصة', 'المبلغ المحمل (ج.م)', 'حالة السداد', 'التاريخ', 'حالة التوريد', 'ملاحظات'];

  let coachGrandTotal = 0;

  Object.entries(coachMap).forEach(([, coachData]) => {
    const coachTotal = coachData.entries.reduce((s, e) => s + e.amount, 0);
    const paidEntries = coachData.entries.filter((e) => e.paymentStatus === 'paid');
    const pendingEntries = coachData.entries.filter((e) => e.paymentStatus !== 'paid');
    const paidAmount = paidEntries.reduce((s, e) => s + e.amount, 0);
    const pendingAmount = pendingEntries.reduce((s, e) => s + e.amount, 0);
    coachGrandTotal += coachTotal;

    // Coach section banner
    const bannerRow = coachSheet.addRow([
      `كابتن: ${coachData.name}`,
      `إجمالي التحميل: ${coachTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      `مسدد: ${paidAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      `مديونية قائمة: ${pendingAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      '', '', '', '', '', '',
    ]);
    bannerRow.height = 28;
    bannerRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C75' } };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Segoe UI' };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const hRow = coachSheet.addRow(coachHeaders);
    styleSubHeaderRow(hRow, 'FF1E293B');

    coachData.entries.forEach((entry, idx) => {
      const dStr = entry.date ? new Date(entry.date).toLocaleDateString('ar-EG') : '';
      const statusLabel = entry.paymentStatus === 'paid' ? '✅ تم السداد' : '⏳ تحميل قائم (مديونية)';
      const row = coachSheet.addRow([
        idx + 1,
        entry.playerCode || '-',
        entry.playerName,
        getCategoryLabel(entry.sessionCategory),
        entry.sessionTitle || 'حصة تدريبية',
        `${entry.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        statusLabel,
        dStr,
        entry.paymentStatus === 'paid' ? 'وُرِّد للجيم' : 'لم يورد بعد',
        entry.notes || '-',
      ]);
      row.height = 22;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).font = { bold: true, name: 'Segoe UI' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      if (entry.paymentStatus !== 'paid') {
        row.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' }, name: 'Segoe UI' };
      }
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

      if (idx % 2 === 1) {
        row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
      }
    });

    // Coach subtotal
    const subTotalRow = coachSheet.addRow([
      `إجمالي كابتن: ${coachData.name}`,
      `${coachData.entries.length} حصة`,
      `${coachTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      '', '', '', '', '', '', '',
    ]);
    styleTotalRow(subTotalRow);
    coachSheet.addRow([]);
  });

  // Grand Coach Total
  const coachGrandRow = coachSheet.addRow([
    'الإجمالي الكلي لجميع الكباتن',
    `${coachEntries.length} حصة`,
    `${coachGrandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '', '', '', '', '', '', '',
  ]);
  coachGrandRow.height = 28;
  coachGrandRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
    c.font = { bold: true, color: { argb: 'FF0F5132' }, size: 12, name: 'Segoe UI' };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = { bottom: { style: 'double', color: { argb: 'FF10B981' } } };
  });

  finalizeWorksheet(coachSheet, 15);

  // ─────────────────────────────────────────────────────────────
  // TAB 5: المصاريف التشغيلية المفصلة
  // ─────────────────────────────────────────────────────────────
  const expenseSheet = workbook.addWorksheet('المصاريف التشغيلية');
  expenseSheet.mergeCells('A1:H1');
  const expTitle = expenseSheet.getCell('A1');
  expTitle.value = `المصاريف التشغيلية المفصلة - ${data.selectedMonth}`;
  expTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  expTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  expenseSheet.getRow(1).height = 36;
  expenseSheet.addRow([]);

  // Group expenses by category
  const expenseCategories = [
    { key: 'electricity', label: 'كهرباء وتكييف', bgArgb: 'FF713F12' },
    { key: 'water', label: 'مياه ومرافق', bgArgb: 'FF0C4A6E' },
    { key: 'maintenance', label: 'صيانة وأجهزة', bgArgb: 'FF7C3AED' },
    { key: 'rent', label: 'إيجار مقر', bgArgb: 'FF065F46' },
    { key: 'trainer_payout', label: 'رواتب ومستحقات كباتن', bgArgb: 'FF0F172A' },
    { key: 'supplies', label: 'نظافة ومستلزمات', bgArgb: 'FF1E3A5F' },
    { key: 'other', label: 'مصاريف نثرية وأخرى', bgArgb: 'FF374151' },
  ];

  const expHeaders = ['م', 'بيان المصروف', 'تصنيف البند', 'المبلغ المنصرف (ج.م)', 'طريقة الصرف', 'المسجل بواسطة', 'التاريخ', 'ملاحظات'];
  let expGrandTotal = 0;

  expenseCategories.forEach(({ key, label, bgArgb }) => {
    const catExps = data.expenses.filter((e) => e.category === key);
    if (catExps.length === 0) return;
    const catTotal = catExps.reduce((s, e) => s + e.amount, 0);
    expGrandTotal += catTotal;

    const secRow = expenseSheet.addRow([
      label,
      `${catExps.length} بند`,
      `${catTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      '', '', '', '', '',
    ]);
    secRow.height = 26;
    secRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Segoe UI' };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const hRow = expenseSheet.addRow(expHeaders);
    styleSubHeaderRow(hRow, 'FF1E293B');

    catExps.forEach((exp, idx) => {
      const dStr = exp.date ? new Date(exp.date).toLocaleDateString('ar-EG') : '';
      const payLabel = exp.paymentMethod === 'card' ? 'فيزا / بطاقة' : exp.paymentMethod === 'instapay' ? 'إنستاباي' : 'كاش';
      const row = expenseSheet.addRow([
        idx + 1,
        exp.title,
        getExpenseCategoryLabel(exp.category),
        `${exp.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        payLabel,
        exp.recordedBy || 'الإدارة',
        dStr,
        exp.notes || '-',
      ]);
      row.height = 22;
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).font = { bold: true, name: 'Segoe UI' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
      if (idx % 2 === 1) {
        row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
      }
    });

    expenseSheet.addRow([]);
  });

  // Grand Expense Total
  const expTotalRow = expenseSheet.addRow([
    'إجمالي المصاريف التشغيلية',
    `${data.expenses.length} بند`,
    `${expGrandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '', '', '', '', '',
  ]);
  styleTotalRow(expTotalRow);

  finalizeWorksheet(expenseSheet, 16);

  // Trigger download
  const cleanMonth = data.selectedMonth.replace(/\s+/g, '_');
  await downloadWorkbook(workbook, `التقرير_الشامل_${cleanMonth}.xlsx`);
};

// ============================================================================
// 2. DAILY SHIFT CLOSING EXCEL EXPORT (.xlsx)
// ============================================================================
export const exportDailyShiftToXLSX = async (
  closing: DailyShiftClosing,
  todayEntries: MasterReportEntry[],
  todayExpenses: ExpenseItem[],
  todayInflows: CashInflowItem[],
  todayTransactions?: POSTransaction[],
  todayTrainerTransactions?: TrainerTransaction[],
  todayCheckInLogs?: CheckInLog[]
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Synapse Gym SaaS Pro';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // TAB 1: ملخص الوردية والدرج
  // -------------------------------------------------------------
  const sheet = workbook.addWorksheet('ملخص الوردية والدرج');

  // Title Banner
  sheet.mergeCells('A1:D1');
  const title = sheet.getCell('A1');
  title.value = `تقرير تقفيل وردية اليوم والدرج - SYNAPSE GYM`;
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  sheet.getRow(1).height = 36;

  sheet.mergeCells('A2:D2');
  const sub = sheet.getCell('A2');
  sub.value = `تاريخ الوردية: ${closing.date} | وقت الإقفال: ${new Date(closing.closedAt).toLocaleTimeString('ar-EG')} | المقفل بواسطة: ${closing.closedBy}`;
  sub.alignment = { vertical: 'middle', horizontal: 'center' };
  sub.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' } };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sheet.getRow(2).height = 24;

  sheet.addRow([]);

  // Shift Financial Summary Cards Table
  const header = sheet.addRow([
    'البيان المحاسبي للوردية',
    'القيمة (ج.م)',
    'طبيعة الحركة',
    'ملاحظات المطابقة',
  ]);
  styleHeaderRow(header);

  const diffText =
    closing.difference !== undefined
      ? closing.difference === 0
        ? 'متطابق تماماً بدون عجز أو زيادة'
        : closing.difference > 0
        ? `فائض / زيادة بمقدار ${closing.difference} ج.م`
        : `عجز في النقدية بمقدار ${Math.abs(closing.difference)} ج.م`
      : 'لم يتم إدخال الجرد الفعلي';

  const rows = [
    { label: 'إجمالي المقبوضات الكاش المباشرة بالاستقبال', val: closing.totalDirectCash, type: 'وارد بالدرج', note: 'اشتراكات فورية ومبيعات' },
    { label: 'إجمالي توريدات سداد الكباتن بالدرج', val: closing.totalRepayments, type: 'وارد بالدرج', note: 'سداد جزئي/كلي لمديونيات الكباتن' },
    { label: 'إجمالي مبيعات البار والمتجر اليوم', val: closing.totalPosCash || (todayTransactions || []).reduce((s, t) => s + t.totalAmount, 0), type: 'مبيعات منتجات', note: 'مياه، مكملات، مشروبات' },
    { label: 'إجمالي المصاريف اليومية المنصرفة من الدرج', val: closing.totalExpenses, type: 'منصرف من الدرج', note: 'مصاريف تشغيلية مقيدة اليوم' },
    { label: 'صافي النقدية المتوقعة بالدرج (السيستيم)', val: closing.expectedNetDrawerCash, type: 'رصيد دفتري', note: 'المقبوضات مطروح منها المنصرفات' },
    { label: 'النقدية الفعلية بعد الجرد اليدوي', val: closing.actualCountedCash ?? closing.expectedNetDrawerCash, type: 'جرد فعلي', note: 'العد الفعلي للكاش بالدرج' },
    { label: 'فارق الجرد (عجز / زيادة)', val: closing.difference ?? 0, type: 'ميزان المطابقة', note: diffText },
    { label: 'إجمالي تحميلات اليوم المعلقة على الكباتن', val: closing.totalCoachDebtsLoadedToday, type: 'مديونية مستمرة', note: 'لا تؤثر على درج اليوم وتظل مديونية قائمة' },
    { label: 'إجمالي أرباح ومستحقات الكباتن الناشئة اليوم', val: closing.totalCoachEarningsToday ?? 0, type: 'مستحقات للمدربين', note: 'نسب وقيم الحصص المحصلة بالاستقبال وتضاف لرصيد الكابتن (له فلوس)' },
  ];

  rows.forEach((r, idx) => {
    const row = sheet.addRow([
      r.label,
      `${r.val.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      r.type,
      r.note,
    ]);
    row.height = 24;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).font = { bold: true, name: 'Segoe UI' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    if (idx % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    if (r.label.includes('صافي النقدية المتوقعة') || r.label.includes('النقدية الفعلية')) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        c.font = { bold: true, color: { argb: 'FF0369A1' }, name: 'Segoe UI' };
      });
    }
  });

  finalizeWorksheet(sheet, 18);

  // -------------------------------------------------------------
  // TAB 2: مبيعات البار والمتجر اليومية (تفصيل كل صنف مباع)
  // -------------------------------------------------------------
  const posSheet = workbook.addWorksheet('مبيعات البار والمتجر');
  posSheet.mergeCells('A1:G1');
  const posTitle = posSheet.getCell('A1');
  posTitle.value = `حصر مبيعات البار والمتجر اليومية (زجاجات مياه، مشروبات، مكملات) - ${closing.date}`;
  posTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  posTitle.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  posTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG_COLOR } };
  posSheet.getRow(1).height = 32;

  posSheet.addRow([]);

  const posHeader = posSheet.addRow([
    'توقيت العملية',
    'اسم الصنف / المنتج',
    'الكمية المباعة',
    'سعر الوحدة (ج.م)',
    'الإجمالي (ج.م)',
    'طريقة السداد',
    'الكاشير المسؤول',
  ]);
  styleHeaderRow(posHeader);

  let totalPosQty = 0;
  let totalPosRev = 0;

  (todayTransactions || []).forEach((trx, tIdx) => {
    const timeStr = new Date(trx.timestamp).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    (trx.items || []).forEach((item, iIdx) => {
      totalPosQty += item.quantity;
      totalPosRev += item.totalPrice;

      const pRow = posSheet.addRow([
        timeStr,
        item.productName,
        item.quantity,
        `${item.unitPrice.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        `${item.totalPrice.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
        getPaymentMethodLabel(trx.paymentMethod),
        trx.cashierName || 'الكاشير',
      ]);
      pRow.height = 22;
      pRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      pRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
      pRow.getCell(2).font = { bold: true };
      pRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      pRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      pRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      pRow.getCell(5).font = { bold: true, color: { argb: 'FF0D9488' } };
      pRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      pRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

      if ((tIdx + iIdx) % 2 === 1) {
        pRow.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }
    });
  });

  const posTotalRow = posSheet.addRow([
    'الإجمالي الكلي لمبيعات البار اليوم',
    '—',
    totalPosQty,
    '—',
    `${totalPosRev.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '—',
    '—',
  ]);
  styleTotalRow(posTotalRow);
  finalizeWorksheet(posSheet, 16);

  // -------------------------------------------------------------
  // TAB 3: الاشتراكات وحركات الاستقبال اليومية
  // -------------------------------------------------------------
  const directSheet = workbook.addWorksheet('الاشتراكات وحركات اليوم');
  directSheet.mergeCells('A1:G1');
  const dTitle = directSheet.getCell('A1');
  dTitle.value = `حركات الاشتراكات والمقبوضات المباشرة اليومية - ${closing.date}`;
  dTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  dTitle.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG_COLOR } };
  directSheet.getRow(1).height = 32;

  directSheet.addRow([]);

  const dHeader = directSheet.addRow([
    'توقيت الحركة',
    'كود اللاعب',
    'اسم اللاعب',
    'نوع النشاط / الحصة',
    'المدرب / الكابتن',
    'المبلغ المسدد (ج.م)',
    'طريقة التحصيل',
  ]);
  styleHeaderRow(dHeader);

  let totalEntriesSum = 0;
  todayEntries.forEach((entry, idx) => {
    totalEntriesSum += entry.amount;
    const timeStr = entry.date
      ? new Date(entry.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '—';

    const dRow = directSheet.addRow([
      timeStr,
      entry.playerCode,
      entry.playerName,
      getCategoryLabel(entry.sessionCategory),
      entry.coachName || 'عام',
      `${entry.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      getPaymentMethodLabel(entry.paymentMethod),
    ]);
    dRow.height = 22;
    dRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    dRow.getCell(3).font = { bold: true };
    dRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    dRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    dRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    dRow.getCell(6).font = { bold: true, color: { argb: 'FF0D9488' } };
    dRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

    if (idx % 2 === 1) {
      dRow.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  const dTotalRow = directSheet.addRow([
    'إجمالي اشتراكات اليوم',
    '—',
    '—',
    '—',
    '—',
    `${totalEntriesSum.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '—',
  ]);
  styleTotalRow(dTotalRow);
  finalizeWorksheet(directSheet, 16);

  // -------------------------------------------------------------
  // TAB 4: سدادات وتحميلات الكباتن لليوم
  // -------------------------------------------------------------
  const coachSheet = workbook.addWorksheet('سدادات وتحميلات الكباتن');
  coachSheet.mergeCells('A1:F1');
  const cTitle = coachSheet.getCell('A1');
  cTitle.value = `حركات الكباتن اليومية (تحميلات، سدادات، وصرف مستحقات) - ${closing.date}`;
  cTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  cTitle.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG_COLOR } };
  coachSheet.getRow(1).height = 32;

  coachSheet.addRow([]);

  const cHeader = coachSheet.addRow([
    'توقيت الحركة',
    'اسم الكابتن / المدرب',
    'نوع الحركة',
    'المبلغ (ج.م)',
    'طريقة الحركة / الدفع',
    'البيان والملاحظات',
  ]);
  styleHeaderRow(cHeader);

  let coachChargesSum = 0;
  let coachRepaymentsSum = 0;

  (todayTrainerTransactions || []).forEach((trx, idx) => {
    const isRepay = trx.type === 'coach_repayment';
    if (isRepay) coachRepaymentsSum += trx.amount;
    else coachChargesSum += trx.amount;

    const timeStr = trx.created_at
      ? new Date(trx.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '—';

    const cRow = coachSheet.addRow([
      timeStr,
      trx.payer_name || 'الكابتن',
      isRepay ? 'سداد مديونية (+ توريد للدرج)' : 'تحميل مديونية على الكابتن',
      `${trx.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      getPaymentMethodLabel(trx.payment_method),
      trx.notes || 'حركة مالية مقيدة بالدفتر',
    ]);
    cRow.height = 22;
    cRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    cRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
    cRow.getCell(2).font = { bold: true };
    cRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    cRow.getCell(3).font = { bold: true, color: { argb: isRepay ? 'FF059669' : 'FFD97706' } };
    cRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    cRow.getCell(4).font = { bold: true };
    cRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    cRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    if (idx % 2 === 1) {
      cRow.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  const cTotalRow = coachSheet.addRow([
    'إجمالي سدادات اليوم: ' + coachRepaymentsSum.toLocaleString('ar-EG') + ' ج.م | إجمالي تحميلات اليوم: ' + coachChargesSum.toLocaleString('ar-EG') + ' ج.م',
    '—',
    '—',
    `${(coachRepaymentsSum + coachChargesSum).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '—',
    '—',
  ]);
  styleTotalRow(cTotalRow);
  finalizeWorksheet(coachSheet, 18);

  // -------------------------------------------------------------
  // TAB 5: المصروفات المنصرفة اليوم وتسويات العهدة
  // -------------------------------------------------------------
  const expSheet = workbook.addWorksheet('المصروفات وتسويات العهدة');
  expSheet.mergeCells('A1:F1');
  const eTitle = expSheet.getCell('A1');
  eTitle.value = `المصروفات اليومية المنصرفة من الدرج وتسويات العهدة - ${closing.date}`;
  eTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  eTitle.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  eTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG_COLOR } };
  expSheet.getRow(1).height = 32;

  expSheet.addRow([]);

  const expHeader = expSheet.addRow([
    'توقيت الصرف',
    'بند المصروف / البيان',
    'التصنيف',
    'المبلغ المنصرف (ج.م)',
    'طريقة الدفع',
    'المسؤول / المستلم',
  ]);
  styleHeaderRow(expHeader);

  let expSum = 0;
  todayExpenses.forEach((exp, idx) => {
    expSum += exp.amount;
    const timeStr = exp.date
      ? new Date(exp.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '—';

    const eRow = expSheet.addRow([
      timeStr,
      exp.title,
      getExpenseCategoryLabel(exp.category),
      `${exp.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      getPaymentMethodLabel(exp.paymentMethod),
      exp.recordedBy || 'الاستقبال',
    ]);
    eRow.height = 22;
    eRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    eRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
    eRow.getCell(2).font = { bold: true };
    eRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    eRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    eRow.getCell(4).font = { bold: true, color: { argb: 'FFE11D48' } };
    eRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    eRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    if (idx % 2 === 1) {
      eRow.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  const expTotalRow = expSheet.addRow([
    'إجمالي المصروفات المنصرفة اليوم',
    '—',
    '—',
    `${expSum.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '—',
    '—',
  ]);
  styleTotalRow(expTotalRow);
  finalizeWorksheet(expSheet, 18);

  await downloadWorkbook(workbook, `تقفيل_وردية_${closing.date}.xlsx`);
};

// ============================================================================
// 3. YEARLY ARCHIVE DOWNLOAD EXPORTERS (.xlsx & .json)
// ============================================================================
export const exportYearlyArchiveToXLSX = async (archive: YearlyArchive) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Synapse Gym SaaS Pro';

  // Tab 1: Yearly KPI Summary
  const sheet = workbook.addWorksheet(`أرشيف_${archive.year}`);

  sheet.mergeCells('A1:C1');
  const title = sheet.getCell('A1');
  title.value = `الأرشيف المالي والإداري الشامل لعام ${archive.year} - SYNAPSE GYM`;
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  sheet.getRow(1).height = 36;

  sheet.addRow([]);

  const kpiHeader = sheet.addRow(['الإحصائية السنوية', 'القيمة الإجمالية', 'البيان']);
  styleHeaderRow(kpiHeader);

  const kpis = [
    { label: 'السنة المالية المؤرشفة', val: archive.year, desc: 'سنة ميلادية كاملة' },
    { label: 'تاريخ إتمام الأرشفة', val: new Date(archive.archivedAt).toLocaleDateString('ar-EG'), desc: `بواسطة: ${archive.archivedBy}` },
    { label: 'إجمالي الإيرادات السنوية المحققة', val: `${archive.totalRevenue.toLocaleString('ar-EG')} ج.م`, desc: 'كافة الاشتراكات والمبيعات' },
    { label: 'إجمالي المصاريف والتشغيل السنوي', val: `${archive.totalExpenses.toLocaleString('ar-EG')} ج.م`, desc: 'رواتب، كهرباء، صيانة، إيجار' },
    { label: 'صافي الأرباح السنوية', val: `${archive.netProfit.toLocaleString('ar-EG')} ج.م`, desc: 'الفائض السنوي الصافي' },
    { label: 'إجمالي عدد تسجيلات الحضور (Check-ins)', val: archive.totalCheckIns, desc: 'حركات دخول اللاعبين المؤرشفة' },
    { label: 'إجمالي قيود الاشتراكات المباشرة', val: `${archive.totalDirectSubscriptions.toLocaleString('ar-EG')} ج.م`, desc: 'إيرادات مباشرة بالخزينة' },
    { label: 'إجمالي المديونيات المحملة على الكباتن', val: `${archive.totalCoachDebtsLoaded.toLocaleString('ar-EG')} ج.م`, desc: 'تحميلات سنوية' },
    { label: 'إجمالي سدادات وتوريدات الكباتن', val: `${archive.totalCoachSettlements.toLocaleString('ar-EG')} ج.م`, desc: 'توريدات مسددة للخزينة' },
  ];

  kpis.forEach((k) => {
    const row = sheet.addRow([k.label, k.val, k.desc]);
    row.height = 24;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).font = { bold: true };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  });

  // Tab 2: Monthly Breakdown
  const monthSheet = workbook.addWorksheet('التوزيع الشهري للسنة');

  const mHeader = monthSheet.addRow(['الشهر', 'الإيرادات (ج.م)', 'المصاريف (ج.م)', 'صافي الربح (ج.م)', 'مرات الحضور']);
  styleHeaderRow(mHeader);

  archive.monthlyStats.forEach((m) => {
    const row = monthSheet.addRow([
      m.monthName,
      `${m.revenue.toLocaleString('ar-EG')} ج.م`,
      `${m.expenses.toLocaleString('ar-EG')} ج.م`,
      `${m.netProfit.toLocaleString('ar-EG')} ج.م`,
      m.checkInsCount,
    ]);
    row.height = 22;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).font = { bold: true };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
  });

  finalizeWorksheet(sheet, 18);
  finalizeWorksheet(monthSheet, 16);

  await downloadWorkbook(workbook, `أرشيف_سنة_${archive.year}_المجمع.xlsx`);
};

export const exportYearlyArchiveToJSON = (archive: YearlyArchive) => {
  const jsonStr = JSON.stringify(archive, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `أرشيف_سنة_${archive.year}_الكامل.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
