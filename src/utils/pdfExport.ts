import {
  DailyShiftClosing,
  MasterReportEntry,
  ExpenseItem,
  CashInflowItem,
  POSTransaction,
  TrainerTransaction,
  YearlyArchive,
  Coach,
  PhysioBooking,
} from '../types';
import { formatEGP, formatTime12h } from './formatters';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { withDbTimeout, NetworkDbError, NETWORK_ERROR_MESSAGE } from './network';

const getCategoryLabel = (cat?: string): string => {
  switch (cat) {
    case 'gym':
      return 'جيم عام';
    case 'private':
      return 'تدريب خاص PT';
    case 'group':
      return 'كلاس جماعي';
    case 'physio':
      return 'علاج طبيعي';
    case 'massage':
      return 'مساج واستشفاء';
    default:
      return cat || 'اشتراك عام';
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
      return 'مصاريف نثرية';
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
      return 'كاش بالدرج';
  }
};

/**
 * Triggers a pristine printable view that can be saved directly as PDF via the browser.
 */
const openPrintWindow = (title: string, htmlContent: string) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) لعرض وطباعة التقرير أو حفظه كـ PDF.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #ffffff;
          color: #0f172a;
          margin: 0;
          padding: 10px;
          direction: rtl;
          text-align: right;
          font-size: 11px;
        }
        .header-banner {
          background: #0f172a;
          color: #ffffff;
          padding: 18px 24px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-title {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 4px 0;
          color: #38bdf8;
        }
        .header-subtitle {
          font-size: 11px;
          color: #94a3b8;
          margin: 0;
        }
        .badge {
          background: #0284c7;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 11px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          text-align: center;
        }
        .kpi-label {
          font-size: 10px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: bold;
        }
        .kpi-val {
          font-size: 15px;
          font-weight: 900;
          color: #0f172a;
        }
        .section-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin: 18px 0 8px 0;
          padding-bottom: 4px;
          border-bottom: 2px solid #0284c7;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          font-size: 10px;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-weight: 800;
          padding: 8px 10px;
          text-align: right;
          border: 1px solid #0f172a;
        }
        td {
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          vertical-align: middle;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .total-row td {
          background: #e2e8f0 !important;
          font-weight: 800;
          color: #0f172a;
        }
        .text-center { text-align: center; }
        .text-teal { color: #0d9488; font-weight: bold; }
        .text-rose { color: #e11d48; font-weight: bold; }
        .text-amber { color: #d97706; font-weight: bold; }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 12px; text-align: left;">
        <button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">
          🖨️ طباعة التقرير / حفظ بصيغة PDF
        </button>
      </div>
      ${htmlContent}
      <script>
        window.onload = function() {
          // slight delay for styles to load then prompt print
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * 1. Print Daily Shift Report PDF (شامل كل العمليات: زجاجات مياه، مقبوضات، كباتن، مصاريف)
 */
export const printDailyShiftReportPDF = async (
  closing: DailyShiftClosing,
  initialEntries: MasterReportEntry[],
  initialExpenses: ExpenseItem[],
  initialInflows: CashInflowItem[],
  initialPosTransactions: POSTransaction[],
  initialTrainerTransactions: TrainerTransaction[]
) => {
  let entries = initialEntries;
  let expenses = initialExpenses;
  let inflows = initialInflows;
  let posTransactions = initialPosTransactions;
  let trainerTransactions = initialTrainerTransactions;

  if (isSupabaseConfigured) {
    const [freshEntries, freshExpenses, freshInflows, freshPos, freshTrx] = await withDbTimeout(
      Promise.all([
        supabaseService.fetchMasterReportEntries(),
        supabaseService.fetchExpenses(),
        supabaseService.fetchCashInflows(),
        supabaseService.fetchPOSTransactions(),
        supabaseService.fetchTrainerTransactions(),
      ]),
      12000
    );
    if (freshEntries === null || freshExpenses === null || freshInflows === null) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }
    const d1 = closing.closingDayDate || closing.date;
    const d2 = closing.nextDayDate || '';
    const matchDate = (iso?: string) =>
      Boolean(iso && (iso.startsWith(d1) || (d2 && iso.startsWith(d2))));

    entries = freshEntries.filter((e) => matchDate(e.date));
    expenses = freshExpenses.filter((e) => matchDate(e.date));
    inflows = freshInflows.filter((i) => matchDate(i.date));
    if (freshPos) posTransactions = freshPos.filter((t) => matchDate(t.timestamp));
    if (freshTrx) trainerTransactions = freshTrx.filter((t) => matchDate(t.created_at));
  }

  // Aggregate POS items sold today
  const posItemsMap: { [prodName: string]: { qty: number; unitPrice: number; totalRev: number; paymentMethods: Set<string> } } = {};
  posTransactions.forEach((tx) => {
    (tx.items || []).forEach((item) => {
      if (!posItemsMap[item.productName]) {
        posItemsMap[item.productName] = {
          qty: 0,
          unitPrice: item.unitPrice,
          totalRev: 0,
          paymentMethods: new Set(),
        };
      }
      posItemsMap[item.productName].qty += item.quantity;
      posItemsMap[item.productName].totalRev += item.totalPrice;
      posItemsMap[item.productName].paymentMethods.add(getPaymentMethodLabel(tx.paymentMethod));
    });
  });

  const totalPosRev = posTransactions.reduce((s, t) => s + t.totalAmount, 0);

  const html = `
    <div class="header-banner">
      <div>
        <h1 class="header-title">EGYFIT - تقرير إقفال الوردية واليومية الشامل</h1>
        <p class="header-subtitle">
          ${
            closing.closingDayDate && closing.nextDayDate
              ? `وردية يوم: <strong>${closing.closingDayDate}</strong> حتى صباح: <strong>${closing.nextDayDate}</strong>`
              : `تاريخ الوردية: <strong>${closing.date}</strong>`
          } | وقت الإقفال: <strong>${new Date(closing.closedAt).toLocaleTimeString('ar-EG')}</strong> | المقفل بواسطة: <strong>${closing.closedBy}</strong>
        </p>
      </div>
      <div class="badge">تقرير معتمد للوردية</div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">صافي النقدية بالدرج (السيستيم)</div>
        <div class="kpi-val text-teal">${formatEGP(closing.expectedNetDrawerCash)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">النقدية الفعلية بالجرد</div>
        <div class="kpi-val">${formatEGP(closing.actualCountedCash ?? closing.expectedNetDrawerCash)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">مبيعات البار والمتجر اليوم</div>
        <div class="kpi-val">${formatEGP(totalPosRev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">إجمالي المصروفات المنصرفة</div>
        <div class="kpi-val text-rose">${formatEGP(closing.totalExpenses)}</div>
      </div>
    </div>

    <!-- 1. مبيعات البار والمتجر (تفصيل كل صنف مثل زجاجات المياه والمكملات) -->
    <div class="section-title">🥤 مبيعات البار والمتجر لليوم (حصر تفصيلي بالأصناف المباعة)</div>
    <table>
      <thead>
        <tr>
          <th>الصنف / المنتج</th>
          <th class="text-center">الكمية المباعة</th>
          <th class="text-center">سعر الوحدة</th>
          <th class="text-center">إجمالي المبيعات</th>
          <th class="text-center">طريقة الدفع</th>
        </tr>
      </thead>
      <tbody>
        ${
          Object.keys(posItemsMap).length > 0
            ? Object.entries(posItemsMap)
                .map(
                  ([name, d]) => `
              <tr>
                <td><strong>${name}</strong></td>
                <td class="text-center">${d.qty}</td>
                <td class="text-center">${formatEGP(d.unitPrice)}</td>
                <td class="text-center text-teal">${formatEGP(d.totalRev)}</td>
                <td class="text-center">${Array.from(d.paymentMethods).join('، ')}</td>
              </tr>
            `
                )
                .join('')
            : '<tr><td colspan="5" class="text-center">لا توجد مبيعات بار مسجلة في وردية اليوم.</td></tr>'
        }
        <tr class="total-row">
          <td>الإجمالي الكلي لمبيعات البار والمتجر</td>
          <td class="text-center">${Object.values(posItemsMap).reduce((s, d) => s + d.qty, 0)}</td>
          <td>—</td>
          <td class="text-center text-teal">${formatEGP(totalPosRev)}</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>

    <!-- 2. مقبوضات واشتراكات اليوم المباشرة -->
    <div class="section-title">💳 مقبوضات واشتراكات اللاعبين المباشرة بالاستقبال</div>
    <table>
      <thead>
        <tr>
          <th class="text-center">الوقت</th>
          <th>اسم اللاعب</th>
          <th class="text-center">الكود</th>
          <th>نوع النشاط</th>
          <th class="text-center">المبلغ</th>
          <th class="text-center">طريقة التحصيل</th>
        </tr>
      </thead>
      <tbody>
        ${
          entries.filter((e) => e.paymentMethod !== 'coach_collected').length > 0
            ? entries
                .filter((e) => e.paymentMethod !== 'coach_collected')
                .map(
                  (e) => `
              <tr>
                <td class="text-center">${e.date ? new Date(e.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td><strong>${e.playerName}</strong></td>
                <td class="text-center">${e.playerCode}</td>
                <td>${getCategoryLabel(e.sessionCategory)}</td>
                <td class="text-center text-teal">${formatEGP(e.amount)}</td>
                <td class="text-center">${getPaymentMethodLabel(e.paymentMethod)}</td>
              </tr>
            `
                )
                .join('')
            : '<tr><td colspan="6" class="text-center">لا توجد اشتراكات مسجلة في وردية اليوم.</td></tr>'
        }
        <tr class="total-row">
          <td colspan="4">إجمالي مقبوضات واشتراكات اليوم المباشرة بالخزينة</td>
          <td class="text-center text-teal">${formatEGP(entries.filter((e) => e.paymentMethod !== 'coach_collected').reduce((s, e) => s + e.amount, 0))}</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>

    <!-- 3. حركات الكباتن (تحميلات، سدادات، مدفوعات) -->
    <div class="section-title">🏋️ حركات الكباتن والمدربين (سدادات توريد للدرج وتحميلات المديونية)</div>
    <table>
      <thead>
        <tr>
          <th class="text-center">الوقت</th>
          <th>اسم الكابتن</th>
          <th class="text-center">نوع الحركة</th>
          <th class="text-center">المبلغ</th>
          <th class="text-center">طريقة الدفع</th>
          <th>البيان والتفاصيل</th>
        </tr>
      </thead>
      <tbody>
        ${
          trainerTransactions.length > 0
            ? trainerTransactions
                .map((t) => {
                  const isRepay = t.type === 'coach_repayment';
                  const isPhysio = t.type === 'physio_charge';
                  const label = isRepay
                    ? 'سداد مديونية (+ للدرج)'
                    : isPhysio
                    ? 'مديونية مساج / تأهيل'
                    : 'تحميل مديونية على الكابتن';
                  const detail = t.payer_name ? `اللاعب/المريض: ${t.payer_name} | ${t.notes || ''}` : (t.notes || '—');
                  return `
                <tr>
                  <td class="text-center">${t.created_at ? new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td><strong>${t.coach_name || 'الكابتن'}</strong></td>
                  <td class="text-center ${isRepay ? 'text-teal' : 'text-amber'}"><strong>${label}</strong></td>
                  <td class="text-center"><strong>${formatEGP(t.amount)}</strong></td>
                  <td class="text-center">${getPaymentMethodLabel(t.payment_method)}</td>
                  <td>${detail}</td>
                </tr>
              `;
                })
                .join('')
            : '<tr><td colspan="6" class="text-center">لا توجد حركات مالية للكباتن في وردية اليوم.</td></tr>'
        }
      </tbody>
    </table>

    <!-- 3.5 تفصيل حضور اللاعبين مع كل مدرب وحساباتهم لليوم -->
    <div class="section-title">👥 كشف اللاعبين الذين تدربوا اليوم مع الكباتن والأنشطة وحساباتهم</div>
    <table>
      <thead>
        <tr>
          <th>اسم اللاعب</th>
          <th class="text-center">الكود</th>
          <th>المدرب المسؤول</th>
          <th>نوع النشاط</th>
          <th class="text-center">المبلغ</th>
          <th class="text-center">مسار التحصيل</th>
          <th class="text-center">حصة الكابتن</th>
          <th class="text-center">مديونية الكابتن</th>
        </tr>
      </thead>
      <tbody>
        ${
          entries.length > 0
            ? entries
                .map((e) => {
                  const isDebt = e.paymentMethod === 'coach_collected';
                  const matchTrx = trainerTransactions.find((t) => t.payer_name === e.playerName || (t.coach_id === e.coachId && t.amount === e.amount));
                  const coachShare = isDebt ? 0 : (matchTrx?.coach_share ?? 0);
                  const coachDebt = isDebt ? e.amount : 0;
                  const pathway = isDebt ? 'محمل مديونية على الكابتن' : coachShare > 0 ? 'دفع للجيم مع نسبة للكابتن' : 'دفع مباشر للجيم بدون مدرب';
                  return `
                <tr>
                  <td><strong>${e.playerName}</strong></td>
                  <td class="text-center">${e.playerCode || '—'}</td>
                  <td>${e.coachName || 'بدون مدرب'}</td>
                  <td>${e.sessionTitle || getCategoryLabel(e.sessionCategory)}</td>
                  <td class="text-center text-teal"><strong>${formatEGP(e.amount)}</strong></td>
                  <td class="text-center">${pathway}</td>
                  <td class="text-center text-emerald">${coachShare > 0 ? formatEGP(coachShare) : '—'}</td>
                  <td class="text-center ${coachDebt > 0 ? 'text-rose' : ''}">${coachDebt > 0 ? formatEGP(coachDebt) : '—'}</td>
                </tr>
              `;
                })
                .join('')
            : '<tr><td colspan="8" class="text-center">لا توجد سجلات لاعبين في وردية اليوم.</td></tr>'
        }
      </tbody>
    </table>

    <!-- 4. المصروفات المنصرفة من الدرج -->
    <div class="section-title">💸 المصروفات التشغيلية وتسويات العهدة المنصرفة اليوم</div>
    <table>
      <thead>
        <tr>
          <th class="text-center">الوقت</th>
          <th>بند المصروف / البيان</th>
          <th>التصنيف</th>
          <th class="text-center">المبلغ</th>
          <th class="text-center">طريقة الدفع</th>
          <th>المسؤول / المستلم</th>
        </tr>
      </thead>
      <tbody>
        ${
          expenses.length > 0
            ? expenses
                .map(
                  (exp) => `
              <tr>
                <td class="text-center">${exp.date ? new Date(exp.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td><strong>${exp.title}</strong></td>
                <td>${getExpenseCategoryLabel(exp.category)}</td>
                <td class="text-center text-rose">${formatEGP(exp.amount)}</td>
                <td class="text-center">${getPaymentMethodLabel(exp.paymentMethod)}</td>
                <td>${exp.recordedBy || 'الاستقبال'}</td>
              </tr>
            `
                )
                .join('')
            : '<tr><td colspan="6" class="text-center">لا توجد مصروفات مسجلة في وردية اليوم.</td></tr>'
        }
        <tr class="total-row">
          <td colspan="3">إجمالي المصروفات المنصرفة</td>
          <td class="text-center text-rose">${formatEGP(expenses.reduce((s, e) => s + e.amount, 0))}</td>
          <td colspan="2">—</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>EGYFIT — Powered by Synapse • تم إصدار التقرير تلقائياً</div>
      <div>صفحة 1 من 1 | توقيع الإدارة: ________________________</div>
    </div>
  `;

  openPrintWindow(`EGYFIT - تقرير وردية ${closing.date}`, html);
};

/**
 * 2. Print Monthly Master Report PDF
 */
export const printMonthlyMasterReportPDF = async (
  monthName: string,
  initialEntries: MasterReportEntry[],
  initialExpenses: ExpenseItem[],
  initialInflows: CashInflowItem[],
  initialPosTransactions: POSTransaction[],
  initialCoaches: Coach[],
  initialTrainerTransactions: TrainerTransaction[],
  netPeriodCash: number
) => {
  let entries = initialEntries;
  let expenses = initialExpenses;
  let inflows = initialInflows;
  let posTransactions = initialPosTransactions;
  let coaches = initialCoaches;
  let trainerTransactions = initialTrainerTransactions;

  if (isSupabaseConfigured) {
    const [freshEntries, freshExpenses, freshInflows, freshPos, freshCoaches, freshTrx] =
      await withDbTimeout(
        Promise.all([
          supabaseService.fetchMasterReportEntries(),
          supabaseService.fetchExpenses(),
          supabaseService.fetchCashInflows(),
          supabaseService.fetchPOSTransactions(),
          supabaseService.fetchCoaches(),
          supabaseService.fetchTrainerTransactions(),
        ]),
        12000
      );
    if (freshEntries === null || freshExpenses === null || freshInflows === null) {
      throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
    }
    entries =
      monthName && monthName !== 'all'
        ? freshEntries.filter((e) => e.month === monthName)
        : freshEntries;
    expenses = freshExpenses;
    inflows = freshInflows;
    if (freshPos) posTransactions = freshPos;
    if (freshCoaches) coaches = freshCoaches;
    if (freshTrx) {
      trainerTransactions =
        monthName && monthName !== 'all'
          ? freshTrx.filter((t) => !t.month || t.month === monthName)
          : freshTrx;
    }
  }

  const totalRev = entries.reduce((s, e) => s + e.amount, 0);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPos = posTransactions.reduce((s, t) => s + t.totalAmount, 0);

  const html = `
    <div class="header-banner">
      <div>
        <h1 class="header-title">EGYFIT - التقرير المالي والإداري الشهري الشامل</h1>
        <p class="header-subtitle">
          الدورة الشهرية: <strong>${monthName}</strong> | تاريخ استخراج التقرير: <strong>${new Date().toLocaleDateString('ar-EG')}</strong>
        </p>
      </div>
      <div class="badge">كشف حساب شهري متكامل</div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">إجمالي إيرادات الشهر</div>
        <div class="kpi-val text-teal">${formatEGP(totalRev + totalPos)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">إجمالي المصروفات المنصرفة</div>
        <div class="kpi-val text-rose">${formatEGP(totalExp)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">صافي أرباح الشهر الدفترية</div>
        <div class="kpi-val">${formatEGP((totalRev + totalPos) - totalExp)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">صافي النقدية الموردة للدرج</div>
        <div class="kpi-val text-teal">${formatEGP(netPeriodCash)}</div>
      </div>
    </div>

    <!-- Coaches Summary Table -->
    <div class="section-title">🏋️ كشف حسابات ومستحقات ومديونيات المدربين لشهر ${monthName}</div>
    <table>
      <thead>
        <tr>
          <th>اسم الكابتن</th>
          <th>التخصص</th>
          <th class="text-center">طبيعة العقد</th>
          <th class="text-center">مديونية مرحلة سابقة</th>
          <th class="text-center">تحميلات الشهر الحالي</th>
          <th class="text-center">سدادات الكابتن</th>
          <th class="text-center">المتبقي على الكابتن</th>
        </tr>
      </thead>
      <tbody>
        ${coaches
          .map((c) => {
            const coachTrx = trainerTransactions.filter((t) => t.coach_id === c.id);
            const carried = coachTrx
              .filter((t) => t.status === 'pending' && t.month && t.month !== monthName)
              .reduce((s, t) => s + t.gym_share, 0);
            const currentCharges = coachTrx
              .filter((t) => t.collected_by === 'coach' && t.type !== 'coach_repayment' && (!t.month || t.month === monthName))
              .reduce((s, t) => s + (t.status === 'pending' ? t.gym_share : t.amount), 0);
            const repaid = coachTrx
              .filter((t) => t.type === 'coach_repayment' && (!t.month || t.month === monthName))
              .reduce((s, t) => s + t.amount, 0);
            const remaining = Math.max(0, carried + currentCharges - repaid);

            return `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.specialty}</td>
                <td class="text-center">${c.paymentType === 'monthly' ? 'راتب شهري' : c.paymentType === 'percentage' ? 'نسبة مئوية' : 'أجر بالحصة'}</td>
                <td class="text-center">${formatEGP(carried)}</td>
                <td class="text-center text-amber">${formatEGP(currentCharges)}</td>
                <td class="text-center text-teal">${formatEGP(repaid)}</td>
                <td class="text-center ${remaining > 0 ? 'text-rose' : ''}"><strong>${formatEGP(remaining)}</strong></td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>

    <!-- POS Sales Summary -->
    <div class="section-title">🥤 ملخص مبيعات البار والمتجر خلال الشهر (${posTransactions.length} عملية)</div>
    <div style="margin-bottom: 15px; font-size: 11px; color: #475569;">
      إجمالي إيراد البار الشهري: <strong>${formatEGP(totalPos)}</strong> شامل كافة المشروبات والمكملات وزجاجات المياه.
    </div>

    <!-- Expenses Breakdown Table -->
    <div class="section-title">💸 سجل المصروفات التشغيلية لشهر ${monthName} (${expenses.length} بند)</div>
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>بيان المصروف</th>
          <th>التصنيف</th>
          <th class="text-center">المبلغ</th>
          <th class="text-center">طريقة الدفع</th>
          <th>المسؤول</th>
        </tr>
      </thead>
      <tbody>
        ${expenses
          .slice(0, 50)
          .map(
            (exp) => `
          <tr>
            <td>${exp.date ? exp.date.slice(0, 10) : '—'}</td>
            <td><strong>${exp.title}</strong></td>
            <td>${getExpenseCategoryLabel(exp.category)}</td>
            <td class="text-center text-rose">${formatEGP(exp.amount)}</td>
            <td class="text-center">${getPaymentMethodLabel(exp.paymentMethod)}</td>
            <td>${exp.recordedBy || 'الإدارة'}</td>
          </tr>
        `
          )
          .join('')}
        <tr class="total-row">
          <td colspan="3">إجمالي المصروفات المنصرفة في شهر ${monthName}</td>
          <td class="text-center text-rose">${formatEGP(totalExp)}</td>
          <td colspan="2">—</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>EGYFIT — Powered by Synapse • تم إصدار التقرير الشهري تلقائياً</div>
      <div>يعتمد بتوقيع المدير العام: ________________________</div>
    </div>
  `;

  openPrintWindow(`EGYFIT - تقرير شهر ${monthName}`, html);
};

/**
 * 3. Print Yearly Archive Report PDF
 */
export const printYearlyArchiveReportPDF = (archive: YearlyArchive) => {
  const html = `
    <div class="header-banner">
      <div>
        <h1 class="header-title">EGYFIT - التقرير المالي والإداري السنوي المعتمد</h1>
        <p class="header-subtitle">
          السنة المالية: <strong>${archive.year}</strong> | أرشف بواسطة: <strong>${archive.archivedBy}</strong> | تاريخ الأرشفة: <strong>${new Date(archive.archivedAt).toLocaleDateString('ar-EG')}</strong>
        </p>
      </div>
      <div class="badge">الأرشيف المالي السنوي</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">إجمالي إيرادات السنة</div>
        <div class="kpi-val text-teal">${formatEGP(archive.totalRevenue)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">إجمالي مصروفات السنة</div>
        <div class="kpi-val text-rose">${formatEGP(archive.totalExpenses)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">صافي الأرباح السنوية</div>
        <div class="kpi-val">${formatEGP(archive.netProfit)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">إجمالي مرات الحضور</div>
        <div class="kpi-val">${archive.totalCheckIns} لاعب</div>
      </div>
    </div>

    <div class="section-title">📅 تفصيل أداء شهور سنة ${archive.year}</div>
    <table>
      <thead>
        <tr>
          <th>الشهر</th>
          <th class="text-center">إجمالي الإيرادات (ج.م)</th>
          <th class="text-center">إجمالي المصروفات (ج.م)</th>
          <th class="text-center">صافي الربح (ج.م)</th>
          <th class="text-center">مرات الحضور</th>
        </tr>
      </thead>
      <tbody>
        ${(archive.monthlyStats || [])
          .map(
            (m) => `
          <tr>
            <td><strong>${m.monthName}</strong></td>
            <td class="text-center text-teal">${formatEGP(m.revenue)}</td>
            <td class="text-center text-rose">${formatEGP(m.expenses)}</td>
            <td class="text-center"><strong>${formatEGP(m.netProfit)}</strong></td>
            <td class="text-center">${m.checkInsCount}</td>
          </tr>
        `
          )
          .join('')}
        <tr class="total-row">
          <td>المجموع السنوي التراكمي</td>
          <td class="text-center text-teal">${formatEGP(archive.totalRevenue)}</td>
          <td class="text-center text-rose">${formatEGP(archive.totalExpenses)}</td>
          <td class="text-center"><strong>${formatEGP(archive.netProfit)}</strong></td>
          <td class="text-center">${archive.totalCheckIns}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>EGYFIT — Powered by Synapse • أرشيف مالي محفوظ في قاعدة البيانات</div>
      <div>اعتماد المدير العام: ________________________</div>
    </div>
  `;

  openPrintWindow(`EGYFIT - تقرير سنة ${archive.year}`, html);
};

/**
 * 4. Print Individual Physio / Massage Session Receipt PDF
 */
export const printPhysioReceiptPDF = (booking: PhysioBooking) => {
  const isDebt = booking.paymentMethod === 'coach_debt';
  const serviceLabel = booking.serviceType === 'massage' ? 'جلسة مساج واستشفاء' : 'جلسة تأهيل وعلاج طبيعي';
  const methodLabel = isDebt
    ? 'تحميل كمديونية رسمية على الكابتن'
    : booking.paymentMethod === 'instapay'
    ? `تحويل انستاباي (${booking.instapayRef || 'معتمد'})`
    : 'نقداً بالخزينة (كاش)';

  const html = `
    <div class="header-banner">
      <div>
        <h1 class="header-title">EGYFIT - عيادة التأهيل والمساج والاستشفاء</h1>
        <p class="header-subtitle">
          إيصال محاسبة جلسة رسمية | رقم الجلسة: <strong>${booking.id}</strong> | تاريخ: <strong>${new Date(booking.startTime).toLocaleDateString('ar-EG')}</strong>
        </p>
      </div>
      <div class="badge">${serviceLabel}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">المبلغ الإجمالي المحصل</div>
        <div class="kpi-val text-teal">${formatEGP(booking.totalFee)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">طريقة السداد</div>
        <div class="kpi-val text-amber" style="font-size: 13px;">${methodLabel}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">المدة الزمنية للجلسة</div>
        <div class="kpi-val">${booking.elapsedMinutes} دقيقة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">حالة السداد</div>
        <div class="kpi-val ${isDebt ? 'text-rose' : 'text-teal'}">${isDebt ? 'مديونية مؤجلة على الكابتن' : 'مسدد بالكامل'}</div>
      </div>
    </div>

    <div class="section-title">📋 تفاصيل الجلسة والخدمات المقدمة</div>
    <table>
      <tbody>
        <tr>
          <td style="width: 25%; color: #64748b; font-weight: bold;">اسم المريض / المتدرب:</td>
          <td style="width: 25%; font-weight: bold; font-size: 13px;">${booking.patientName}</td>
          <td style="width: 25%; color: #64748b; font-weight: bold;">كود المتدرب:</td>
          <td style="width: 25%; font-family: monospace;">${booking.patientCode || 'PHY-PATIENT'}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">الطبيب / المدرب المنفذ:</td>
          <td style="font-weight: bold; font-size: 13px;">${booking.coachName || booking.doctorName}</td>
          <td style="color: #64748b; font-weight: bold;">الغرفة / العيادة:</td>
          <td>${booking.roomName}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">وقت بدء الجلسة:</td>
          <td>${new Date(booking.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
          <td style="color: #64748b; font-weight: bold;">وقت الانتهاء:</td>
          <td>${booking.endTime ? new Date(booking.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">الحد الأدنى المحتسب (ساعة):</td>
          <td style="font-weight: bold;">${formatEGP(booking.hourlyRate)}</td>
          <td style="color: #64748b; font-weight: bold;">تكلفة إضافية (تجاوز ساعة):</td>
          <td style="font-weight: bold; color: #d97706;">${booking.extraFee ? `+${formatEGP(booking.extraFee)} (${booking.extraFeeReason || 'وقت إضافي'})` : 'لا يوجد'}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">الإجمالي المستحق:</td>
          <td colspan="3" style="font-size: 15px; font-weight: bold; color: #0d9488;">${formatEGP(booking.totalFee)}</td>
        </tr>
        ${booking.notes ? `
        <tr>
          <td style="color: #64748b; font-weight: bold;">ملاحظات السداد:</td>
          <td colspan="3">${booking.notes}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="footer" style="margin-top: 40px;">
      <div>توقيع واستلام المتدرب / الكابتن: ________________________</div>
      <div>ختم واعتماد قسم الاستقبال: ________________________</div>
    </div>
  `;

  openPrintWindow(`إيصال جلسة ${booking.patientName}`, html);
};
