import ExcelJS from 'exceljs';
import {
  MasterReportEntry,
  ExpenseItem,
  CashInflowItem,
  DailyShiftClosing,
  YearlyArchive,
  SessionCategory,
} from '../types';
import { formatEGP } from './formatters';

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
 * Styles a total row with soft green highlight (#E6F4EA) and double bottom border.
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
// 1. MASTER REPORT MULTI-TAB EXCEL EXPORT (.xlsx)
// ============================================================================
export interface MasterReportExportPayload {
  selectedMonth: string;
  entries: MasterReportEntry[];
  expenses: ExpenseItem[];
  repayments: CashInflowItem[];
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

  // -------------------------------------------------------------
  // TAB 1: الملخص المالي (Master Summary)
  // -------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('الملخص المالي');
  summarySheet.views = [{ state: 'normal', rightToLeft: true }];

  // Title Banner
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'التقرير المالي والتشغيلي المجمع - SYNAPSE GYM';
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Segoe UI' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BANNER_BG } };
  summarySheet.getRow(1).height = 40;

  // Subtitle
  summarySheet.mergeCells('A2:D2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `الدورة المالية: ${data.selectedMonth} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`;
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF94A3B8' }, name: 'Segoe UI' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  summarySheet.getRow(2).height = 24;

  summarySheet.addRow([]); // Blank spacer

  // KPI Summary Table Headers
  const kpiHeaderRow = summarySheet.addRow([
    'البند المالي / البيان',
    'القيمة المحققة (ج.م)',
    'الحالة المحاسبية',
    'ملاحظات وتوجيه الخزينة',
  ]);
  styleHeaderRow(kpiHeaderRow);

  const summaryKPIs = [
    {
      label: 'إجمالي الاشتراكات المباشرة المسددة بالخزينة',
      value: data.totalDirectRevenue,
      status: 'نقدية فعلية بالدرج',
      notes: 'كاش وفيزا وإنستاباي تم تحصيلها مباشرة من المتدربين',
    },
    {
      label: 'إجمالي إيداعات سداد التحميل من الكباتن',
      value: data.totalRepaymentsAmount,
      status: 'توريد مدفوع للدرج',
      notes: 'مبالغ قام المدربون بتسديدها وتوريدها لحساب الجيم',
    },
    {
      label: 'إجمالي النقدية المحصلة الداخلة للخزينة',
      value: data.totalDirectRevenue + data.totalRepaymentsAmount,
      status: 'إجمالي المقبوضات',
      notes: 'مجموع الدخل النقدي المورد للخزينة خلال الدورة',
    },
    {
      label: 'إجمالي المصاريف التشغيلية المنصرفة',
      value: data.totalExpensesAmount,
      status: 'مصروفات تشغيل',
      notes: 'كهرباء، مياه، صيانة، إيجار، ونثريات مستخرجة من الدرج',
    },
    {
      label: 'صافي النقدية المتوفرة بالدرج (السيولة)',
      value: data.netPeriodCash,
      status: data.netPeriodCash >= 0 ? 'فائض نقدي متاح' : 'عجز في الدرج',
      notes: 'المقبوضات مطروح منها المصاريف المنصرفة',
    },
    {
      label: 'إجمالي مديونيات التحميل المعلقة على الكباتن',
      value: data.totalCoachDebtRevenue,
      status: 'مديونية مستحقة للجيم',
      notes: 'جلسات استلم الكوتش مبالغها ولم يقم بتسديدها للجيم بعد',
    },
    {
      label: 'الإيراد الكلي الشامل للنادي (المباشر + التحميل)',
      value: data.grandTotalPlayerRevenue,
      status: 'القيمة الإنتاجية الشاملة',
      notes: 'القيمة الإجمالية لكافة الأنشطة والجلسات المنفذة',
    },
  ];

  summaryKPIs.forEach((kpi, index) => {
    const row = summarySheet.addRow([
      kpi.label,
      `${kpi.value.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      kpi.status,
      kpi.notes,
    ]);
    row.height = 24;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).font = { bold: true, name: 'Segoe UI' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    // Zebra striping
    if (index % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    // Special highlight for Net Cash
    if (kpi.label.includes('صافي النقدية')) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        c.font = { bold: true, color: { argb: 'FF0369A1' }, name: 'Segoe UI' };
      });
    }
  });

  finalizeWorksheet(summarySheet, 18);

  // -------------------------------------------------------------
  // TAB 2: الاشتراكات المباشرة (Direct Revenues)
  // -------------------------------------------------------------
  const directSheet = workbook.addWorksheet('الاشتراكات المباشرة');

  const directHeaders = [
    'م',
    'كود اللاعب',
    'اسم اللاعب / العضو',
    'النشاط / الفئة',
    'تفاصيل الباقة / الحصة',
    'القيمة المسددة (ج.م)',
    'طريقة الدفع',
    'الكابتن / المشرف',
    'التاريخ',
    'ملاحظات',
  ];
  const directHeaderRow = directSheet.addRow(directHeaders);
  styleHeaderRow(directHeaderRow);

  directEntries.forEach((entry, idx) => {
    const dStr = entry.date ? new Date(entry.date).toLocaleDateString('ar-EG') : '';
    const row = directSheet.addRow([
      idx + 1,
      entry.playerCode || '-',
      entry.playerName,
      getCategoryLabel(entry.sessionCategory),
      entry.sessionTitle || 'اشتراك شهري',
      `${entry.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      getPaymentMethodLabel(entry.paymentMethod),
      entry.coachName || 'الخزينة العامة',
      dStr,
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
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

    if (idx % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  // Direct Total Row
  const directTotalRow = directSheet.addRow([
    'الإجمالي',
    '',
    `عدد القيود: ${directEntries.length}`,
    '',
    '',
    `${data.totalDirectRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '',
    '',
    '',
    'إجمالي الاشتراكات المباشرة',
  ]);
  styleTotalRow(directTotalRow);

  finalizeWorksheet(directSheet, 15);

  // -------------------------------------------------------------
  // TAB 3: تحميلات المديونيات (Coaches Debts & Payouts)
  // -------------------------------------------------------------
  const coachSheet = workbook.addWorksheet('تحميلات المديونيات');

  const coachHeaders = [
    'م',
    'كود اللاعب',
    'اسم اللاعب',
    'الكابتن المحمل عليه',
    'نوع النشاط',
    'تفاصيل الجلسة',
    'المبلغ المحمل (ج.م)',
    'حالة السداد',
    'التاريخ',
    'ملاحظات',
  ];
  const coachHeaderRow = coachSheet.addRow(coachHeaders);
  styleHeaderRow(coachHeaderRow);

  coachEntries.forEach((entry, idx) => {
    const dStr = entry.date ? new Date(entry.date).toLocaleDateString('ar-EG') : '';
    const statusLabel =
      entry.paymentStatus === 'paid'
        ? 'تم السداد'
        : entry.paymentStatus === 'pending_on_coach'
        ? 'تحميل قائم (مديونية)'
        : 'غير مسدد';

    const row = coachSheet.addRow([
      idx + 1,
      entry.playerCode || '-',
      entry.playerName,
      entry.coachName || 'كابتن',
      getCategoryLabel(entry.sessionCategory),
      entry.sessionTitle || 'حصة تدريبية',
      `${entry.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      statusLabel,
      dStr,
      entry.notes || '-',
    ]);
    row.height = 22;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(4).font = { bold: true, name: 'Segoe UI' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).font = { bold: true, name: 'Segoe UI' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

    if (idx % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  // Coach Debts Total Row
  const coachTotalRow = coachSheet.addRow([
    'الإجمالي',
    '',
    `عدد الحصص: ${coachEntries.length}`,
    '',
    '',
    '',
    `${data.totalCoachDebtRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    'مديونية إجمالية',
    '',
    '',
  ]);
  styleTotalRow(coachTotalRow);

  finalizeWorksheet(coachSheet, 15);

  // -------------------------------------------------------------
  // TAB 4: المصاريف التشغيلية (Operational Expenses)
  // -------------------------------------------------------------
  const expenseSheet = workbook.addWorksheet('المصاريف التشغيلية');

  const expenseHeaders = [
    'م',
    'بيان المصروف',
    'تصنيف البند',
    'المبلغ المنصرف (ج.م)',
    'طريقة الصرف',
    'المسجل بواسطة',
    'التاريخ',
    'ملاحظات',
  ];
  const expenseHeaderRow = expenseSheet.addRow(expenseHeaders);
  styleHeaderRow(expenseHeaderRow);

  data.expenses.forEach((exp, idx) => {
    const dStr = exp.date ? new Date(exp.date).toLocaleDateString('ar-EG') : '';
    const row = expenseSheet.addRow([
      idx + 1,
      exp.title,
      getExpenseCategoryLabel(exp.category),
      `${exp.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
      exp.paymentMethod === 'card' ? 'فيزا' : exp.paymentMethod === 'instapay' ? 'إنستاباي' : 'كاش',
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
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  // Expense Total Row
  const expenseTotalRow = expenseSheet.addRow([
    'الإجمالي',
    `إجمالي بنود المصروفات: ${data.expenses.length}`,
    '',
    `${data.totalExpensesAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`,
    '',
    '',
    '',
    'إجمالي المصاريف التشغيلية',
  ]);
  styleTotalRow(expenseTotalRow);

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
  todayInflows: CashInflowItem[]
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Synapse Gym SaaS Pro';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('تقفيل وردية اليوم');

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
    { label: 'إجمالي المصاريف اليومية المنصرفة من الدرج', val: closing.totalExpenses, type: 'منصرف من الدرج', note: 'مصاريف تشغيلية مقيدة اليوم' },
    { label: 'صافي النقدية المتوقعة بالدرج (السيستيم)', val: closing.expectedNetDrawerCash, type: 'رصيد دفتري', note: 'المقبوضات مطروح منها المنصرفات' },
    { label: 'النقدية الفعلية بعد الجرد اليدوي', val: closing.actualCountedCash ?? closing.expectedNetDrawerCash, type: 'جرد فعلي', note: 'العد الفعلي للكاش بالدرج' },
    { label: 'فارق الجرد (عجز / زيادة)', val: closing.difference ?? 0, type: 'ميزان المطابقة', note: diffText },
    { label: 'إجمالي تحميلات اليوم المعلقة على الكباتن', val: closing.totalCoachDebtsLoadedToday, type: 'مديونية مستمرة', note: 'لا تؤثر على درج اليوم وتظل مديونية قائمة' },
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
