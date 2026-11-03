/**
 * Medi5 ERP - Financial Health & Business Intelligence Calculation Engine (Phase 4)
 * 
 * Computes executive KPIs, date-range filtered metrics, expense breakdowns,
 * inventory valuations, supplier aging, cash flow analysis, and CSV export records.
 * Pure, tested functions designed for high reliability and financial auditability.
 */

import { SaleRecord, Medicine, MedicineBatch } from '../types/inventory';
import { 
  ExpenseRecord, 
  SupplierPayable, 
  FinancialExecutiveSummary, 
  InventoryValuationBreakdown,
  CashFlowPoint,
  DateFilterPreset,
  FinancialReportType
} from '../types/financials';
import { parseExpiryDate } from './dateUtils';
import { toPaise, fromPaise } from './moneyUtils';

/**
 * Resolves start and end Date objects from a date filter preset.
 */
export function resolveDateFilterRange(
  preset: DateFilterPreset, 
  customStart?: string, 
  customEnd?: string,
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date; prevStartDate: Date; prevEndDate: Date } {
  let end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  let start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  let prevStart = new Date(referenceDate);
  let prevEnd = new Date(referenceDate);

  switch (preset) {
    case 'today': {
      start.setHours(0, 0, 0, 0);
      prevStart.setDate(start.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(end.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      break;
    }
    case 'last7days': {
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'last30days': {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 29);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'thisMonth': {
      start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
      const prevMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0, 23, 59, 59, 999);
      prevStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1, 0, 0, 0, 0);
      prevEnd = prevMonthEnd;
      break;
    }
    case 'lastMonth': {
      const lastMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0, 23, 59, 59, 999);
      start = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1, 0, 0, 0, 0);
      end.setTime(lastMonthEnd.getTime());
      
      const twoMonthsAgoEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
      prevStart = new Date(twoMonthsAgoEnd.getFullYear(), twoMonthsAgoEnd.getMonth(), 1, 0, 0, 0, 0);
      prevEnd = twoMonthsAgoEnd;
      break;
    }
    case 'custom': {
      if (customStart) {
        const parts = customStart.split('-').map(Number);
        start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      } else {
        start.setDate(end.getDate() - 29);
      }
      if (customEnd) {
        const parts = customEnd.split('-').map(Number);
        end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      }
      const durationMs = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - durationMs);
      break;
    }
  }

  return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
}

/**
 * Filter sales records strictly between two dates.
 */
export function filterSalesByDate(sales: SaleRecord[], start: Date, end: Date): SaleRecord[] {
  return sales.filter(s => {
    const time = new Date(s.timestamp).getTime();
    return time >= start.getTime() && time <= end.getTime();
  });
}

/**
 * Filter expense records strictly between two dates.
 */
export function filterExpensesByDate(expenses: ExpenseRecord[], start: Date, end: Date): ExpenseRecord[] {
  return expenses.filter(e => {
    const time = new Date(e.date).getTime();
    return time >= start.getTime() && time <= end.getTime();
  });
}

/**
 * Calculates Executive Financial Summary for the dashboard.
 */
export function calculateExecutiveSummary(
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
  batches: MedicineBatch[],
  payables: SupplierPayable[],
  preset: DateFilterPreset,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): FinancialExecutiveSummary {
  const { startDate, endDate, prevStartDate, prevEndDate } = resolveDateFilterRange(preset, customStart, customEnd, referenceDate);

  // Current period data
  const currentSales = filterSalesByDate(sales, startDate, endDate);
  const currentExpenses = filterExpensesByDate(expenses, startDate, endDate);

  // Previous period data for comparison
  const prevSales = filterSalesByDate(sales, prevStartDate, prevEndDate);
  const prevExpenses = filterExpensesByDate(expenses, prevStartDate, prevEndDate);

  // Totals current
  let totalRevenuePaise = 0;
  let totalCogsPaise = 0;
  let cashPaise = 0;
  let upiPaise = 0;
  let cardPaise = 0;

  for (const s of currentSales) {
    totalRevenuePaise += toPaise(s.sellingBill);
    totalCogsPaise += toPaise(s.estimatedCogs);
    if (s.tenderType === 'CASH') cashPaise += toPaise(s.sellingBill);
    else if (s.tenderType === 'UPI') upiPaise += toPaise(s.sellingBill);
    else if (s.tenderType === 'CARD') cardPaise += toPaise(s.sellingBill);
  }

  const grossProfitPaise = totalRevenuePaise - totalCogsPaise;
  const opExPaise = currentExpenses.reduce((acc, e) => acc + toPaise(e.amount), 0);
  const netProfitPaise = grossProfitPaise - opExPaise;

  // Totals previous
  const prevRevenuePaise = prevSales.reduce((acc, s) => acc + toPaise(s.sellingBill), 0);
  const prevCogsPaise = prevSales.reduce((acc, s) => acc + toPaise(s.estimatedCogs), 0);
  const prevGrossProfitPaise = prevRevenuePaise - prevCogsPaise;
  const prevOpExPaise = prevExpenses.reduce((acc, e) => acc + toPaise(e.amount), 0);

  // Percentage calculations
  const revenueGrowthPct = prevRevenuePaise > 0 
    ? Math.round(((totalRevenuePaise - prevRevenuePaise) / prevRevenuePaise) * 1000) / 10 
    : 0;

  const grossProfitGrowthPct = prevGrossProfitPaise > 0 
    ? Math.round(((grossProfitPaise - prevGrossProfitPaise) / prevGrossProfitPaise) * 1000) / 10 
    : 0;

  const grossMarginPct = totalRevenuePaise > 0 
    ? Math.round((grossProfitPaise / totalRevenuePaise) * 1000) / 10 
    : 0;

  const netProfitMarginPct = totalRevenuePaise > 0 
    ? Math.round((netProfitPaise / totalRevenuePaise) * 1000) / 10 
    : 0;

  // Inventory valuation
  let invPurchaseCostPaise = 0;
  let invMrpValuationPaise = 0;
  for (const b of batches) {
    const qty = Math.max(0, b.quantityRemaining);
    invPurchaseCostPaise += toPaise(b.purchaseCost * qty);
    invMrpValuationPaise += toPaise(b.mrp * qty);
  }
  const lockedMarginPaise = invMrpValuationPaise - invPurchaseCostPaise;

  // Outstanding payables
  let outstandingPayablesPaise = 0;
  for (const p of payables) {
    if (p.status !== 'PAID') {
      const remaining = Math.max(0, p.totalAmount - p.paidAmount);
      outstandingPayablesPaise += toPaise(remaining);
    }
  }

  const periodLabelMap: Record<DateFilterPreset, string> = {
    today: 'Today',
    last7days: 'Last 7 Days',
    last30days: 'Last 30 Days',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    custom: 'Custom Range'
  };

  return {
    periodLabel: periodLabelMap[preset],
    totalRevenue: fromPaise(totalRevenuePaise),
    prevTotalRevenue: fromPaise(prevRevenuePaise),
    revenueGrowthPct,
    cogs: fromPaise(totalCogsPaise),
    grossProfit: fromPaise(grossProfitPaise),
    prevGrossProfit: fromPaise(prevGrossProfitPaise),
    grossProfitGrowthPct,
    grossMarginPct,
    operatingExpenses: fromPaise(opExPaise),
    prevOperatingExpenses: fromPaise(prevOpExPaise),
    netOperatingProfit: fromPaise(netProfitPaise),
    netProfitMarginPct,
    inventoryInvestmentCost: fromPaise(invPurchaseCostPaise),
    inventoryMrpValuation: fromPaise(invMrpValuationPaise),
    lockedMarginInInventory: fromPaise(lockedMarginPaise),
    outstandingSupplierPayables: fromPaise(outstandingPayablesPaise),
    cashCollection: fromPaise(cashPaise),
    upiCollection: fromPaise(upiPaise),
    cardCollection: fromPaise(cardPaise)
  };
}

/**
 * Calculates Comprehensive Inventory Financial Health & Locked Margin.
 */
export function calculateInventoryFinancialHealth(
  _medicines: Medicine[],
  batches: MedicineBatch[],
  sales: SaleRecord[],
  referenceDate: Date = new Date()
): InventoryValuationBreakdown {
  let totalCostPaise = 0;
  let totalMrpPaise = 0;
  let expiredCostPaise = 0;
  let nearExpiryCostPaise = 0;
  let deadStockCostPaise = 0;
  let fastMovingCostPaise = 0;
  let slowMovingCostPaise = 0;

  // Calculate SKU sales activity in last 30 days
  const thirtyDaysAgo = new Date(referenceDate);
  thirtyDaysAgo.setDate(referenceDate.getDate() - 30);
  
  const medicineSalesQty = new Map<string, number>();
  for (const s of sales) {
    if (new Date(s.timestamp) >= thirtyDaysAgo) {
      for (const item of s.items) {
        medicineSalesQty.set(item.medicineId, (medicineSalesQty.get(item.medicineId) || 0) + item.quantity);
      }
    }
  }

  for (const b of batches) {
    const qty = Math.max(0, b.quantityRemaining);
    if (qty === 0) continue;

    const cost = toPaise(b.purchaseCost * qty);
    const mrp = toPaise(b.mrp * qty);

    totalCostPaise += cost;
    totalMrpPaise += mrp;

    const expiry = parseExpiryDate(b.expiryDate);
    if (expiry) {
      const diffMs = expiry.getTime() - referenceDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0 || b.status === 'EXPIRED') {
        expiredCostPaise += cost;
      } else if (diffDays <= 60) {
        nearExpiryCostPaise += cost;
      }
    }

    const soldIn30d = medicineSalesQty.get(b.medicineId) || 0;
    if (soldIn30d >= 10) {
      fastMovingCostPaise += cost;
    } else if (soldIn30d === 0) {
      deadStockCostPaise += cost;
      slowMovingCostPaise += cost;
    } else {
      slowMovingCostPaise += cost;
    }
  }

  const potentialProfitPaise = totalMrpPaise - totalCostPaise;
  const potentialMarginPct = totalMrpPaise > 0 
    ? Math.round((potentialProfitPaise / totalMrpPaise) * 1000) / 10 
    : 0;

  // Turnover Ratio = Annualized COGS / Inventory Cost
  const totalCogs30d = sales
    .filter(s => new Date(s.timestamp) >= thirtyDaysAgo)
    .reduce((acc, s) => acc + toPaise(s.estimatedCogs), 0);

  const annualizedCogs = totalCogs30d * 12;
  const turnoverRatio = totalCostPaise > 0 
    ? Math.round((annualizedCogs / totalCostPaise) * 10) / 10 
    : 0;

  // Days Inventory Outstanding (DIO) = (Inventory / Annualized COGS) * 365
  const daysInventoryOutstanding = annualizedCogs > 0 
    ? Math.round((totalCostPaise / annualizedCogs) * 365) 
    : 0;

  return {
    totalPurchaseCost: fromPaise(totalCostPaise),
    totalMrpValuation: fromPaise(totalMrpPaise),
    potentialGrossProfit: fromPaise(potentialProfitPaise),
    potentialGrossMarginPct: potentialMarginPct,
    expiredStockCost: fromPaise(expiredCostPaise),
    nearExpiryStockCost: fromPaise(nearExpiryCostPaise),
    deadStockCost: fromPaise(deadStockCostPaise),
    fastMovingStockCost: fromPaise(fastMovingCostPaise),
    slowMovingStockCost: fromPaise(slowMovingCostPaise),
    turnoverRatio,
    daysInventoryOutstanding
  };
}

/**
 * Calculates Supplier Payables Aging & Balance Summary.
 */
export function calculateSupplierAging(
  payables: SupplierPayable[],
  referenceDate: Date = new Date()
): {
  totalOutstanding: number;
  currentDues: number; // 0-30 days
  overdue30: number;   // 1-30 days overdue
  overdue60: number;   // 31-60 days overdue
  overdue90Plus: number; // >60 days overdue
  paidTotal: number;
} {
  let totalOutstanding = 0;
  let currentDues = 0;
  let overdue30 = 0;
  let overdue60 = 0;
  let overdue90Plus = 0;
  let paidTotal = 0;

  for (const p of payables) {
    const remaining = Math.max(0, p.totalAmount - p.paidAmount);
    paidTotal += p.paidAmount;

    if (remaining > 0) {
      totalOutstanding += remaining;
      const due = new Date(p.dueDate);
      const diffMs = referenceDate.getTime() - due.getTime();
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        currentDues += remaining;
      } else if (daysOverdue <= 30) {
        overdue30 += remaining;
      } else if (daysOverdue <= 60) {
        overdue60 += remaining;
      } else {
        overdue90Plus += remaining;
      }
    }
  }

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    currentDues: Math.round(currentDues * 100) / 100,
    overdue30: Math.round(overdue30 * 100) / 100,
    overdue60: Math.round(overdue60 * 100) / 100,
    overdue90Plus: Math.round(overdue90Plus * 100) / 100,
    paidTotal: Math.round(paidTotal * 100) / 100
  };
}

/**
 * Generates monthly Cash Flow points (Inflows vs Outflows).
 */
export function calculateMonthlyCashFlow(
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
  payables: SupplierPayable[],
  monthsCount: number = 6,
  referenceDate: Date = new Date()
): CashFlowPoint[] {
  const points: CashFlowPoint[] = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthName = d.toLocaleString('en-US', { month: 'short' });
    const label = `${monthName} ${d.getFullYear().toString().slice(-2)}`;

    // Inflow: sales in that month
    const monthSales = sales.filter(s => s.timestamp.startsWith(monthKey));
    const inflow = monthSales.reduce((acc, s) => acc + s.sellingBill, 0);

    // Outflow: expenses in that month + supplier payments recorded in that month
    const monthExpenses = expenses.filter(e => e.date.startsWith(monthKey));
    const expenseSum = monthExpenses.reduce((acc, e) => acc + e.amount, 0);

    let supplierPaySum = 0;
    for (const p of payables) {
      for (const h of p.paymentHistory) {
        if (h.paymentDate.startsWith(monthKey)) {
          supplierPaySum += h.amount;
        }
      }
    }

    const outflow = expenseSum + supplierPaySum;
    const net = Math.round((inflow - outflow) * 100) / 100;

    points.push({
      period: monthKey,
      label,
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
      net
    });
  }

  return points;
}

/**
 * Functional CSV Generator for browser download.
 */
export function generateFinancialCSV(
  reportType: FinancialReportType,
  data: {
    sales: SaleRecord[];
    expenses: ExpenseRecord[];
    batches: MedicineBatch[];
    medicines: Medicine[];
    payables: SupplierPayable[];
    summary: FinancialExecutiveSummary;
  }
): { filename: string; csvContent: string } {
  const dateStr = new Date().toISOString().slice(0, 10);

  switch (reportType) {
    case 'pnl': {
      const rows = [
        ['Medi5 ERP - Profit & Loss Statement (Demo)'],
        [`Generated On: ${dateStr}`],
        [''],
        ['Account Line', 'Amount (INR)', '% of Revenue'],
        ['Gross Sales / Revenue', data.summary.totalRevenue.toFixed(2), '100.0%'],
        ['Cost of Goods Sold (COGS)', `-${data.summary.cogs.toFixed(2)}`, `${((data.summary.cogs / (data.summary.totalRevenue || 1)) * 100).toFixed(1)}%`],
        ['Gross Operating Profit', data.summary.grossProfit.toFixed(2), `${data.summary.grossMarginPct.toFixed(1)}%`],
        [''],
        ['Operating Expenses (OpEx)', `-${data.summary.operatingExpenses.toFixed(2)}`, `${((data.summary.operatingExpenses / (data.summary.totalRevenue || 1)) * 100).toFixed(1)}%`],
        ['Net Operating Profit (EBITDA)', data.summary.netOperatingProfit.toFixed(2), `${data.summary.netProfitMarginPct.toFixed(1)}%`]
      ];
      return {
        filename: `Medi5_PnL_Statement_${dateStr}.csv`,
        csvContent: rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      };
    }

    case 'expenses': {
      const header = ['Expense ID', 'Date', 'Category', 'Title', 'Vendor', 'Amount (INR)', 'Payment Method', 'Reference'];
      const rows = data.expenses.map(e => [
        e.id,
        e.date,
        e.category,
        e.title,
        e.vendorName || '-',
        e.amount.toFixed(2),
        e.paymentMethod,
        e.referenceNumber || '-'
      ]);
      return {
        filename: `Medi5_Expenses_${dateStr}.csv`,
        csvContent: [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      };
    }

    case 'revenue': {
      const header = ['Invoice ID', 'Date & Time', 'Tender', 'MRP Total', 'Discount (INR)', 'Selling Bill (INR)', 'COGS', 'Gross Profit'];
      const rows = data.sales.map(s => [
        s.id,
        s.timestamp,
        s.tenderType,
        s.totalBillMrp.toFixed(2),
        s.discount.toFixed(2),
        s.sellingBill.toFixed(2),
        s.estimatedCogs.toFixed(2),
        s.estimatedGrossProfit.toFixed(2)
      ]);
      return {
        filename: `Medi5_Revenue_Sales_${dateStr}.csv`,
        csvContent: [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      };
    }

    case 'inventory_valuation': {
      const header = ['Medicine ID', 'Medicine Name', 'Batch', 'Expiry Date', 'Qty Remaining', 'Purchase Cost (INR)', 'MRP (INR)', 'Cost Valuation', 'MRP Valuation', 'Locked Profit'];
      const rows = data.batches.map(b => {
        const med = data.medicines.find(m => m.id === b.medicineId);
        const name = med ? `${med.name} (${med.strength})` : b.medicineId;
        const costVal = b.purchaseCost * b.quantityRemaining;
        const mrpVal = b.mrp * b.quantityRemaining;
        return [
          b.medicineId,
          name,
          b.batchNumber,
          b.expiryDate,
          b.quantityRemaining.toString(),
          b.purchaseCost.toFixed(2),
          b.mrp.toFixed(2),
          costVal.toFixed(2),
          mrpVal.toFixed(2),
          (mrpVal - costVal).toFixed(2)
        ];
      });
      return {
        filename: `Medi5_Inventory_Valuation_${dateStr}.csv`,
        csvContent: [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      };
    }

    case 'supplier_payables': {
      const header = ['Payable ID', 'Supplier Name', 'Invoice #', 'Invoice Date', 'Due Date', 'Total Amount', 'Paid Amount', 'Remaining Due', 'Status'];
      const rows = data.payables.map(p => [
        p.id,
        p.supplierName,
        p.invoiceNumber,
        p.invoiceDate,
        p.dueDate,
        p.totalAmount.toFixed(2),
        p.paidAmount.toFixed(2),
        Math.max(0, p.totalAmount - p.paidAmount).toFixed(2),
        p.status
      ]);
      return {
        filename: `Medi5_Supplier_Payables_${dateStr}.csv`,
        csvContent: [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      };
    }

    case 'collections': {
      const header = ['Tender Type', 'Count of Sales', 'Total Collected (INR)', 'Average Ticket Size (INR)'];
      const cash = data.sales.filter(s => s.tenderType === 'CASH');
      const upi = data.sales.filter(s => s.tenderType === 'UPI');
      const card = data.sales.filter(s => s.tenderType === 'CARD');

      const sumCash = cash.reduce((acc, s) => acc + s.sellingBill, 0);
      const sumUpi = upi.reduce((acc, s) => acc + s.sellingBill, 0);
      const sumCard = card.reduce((acc, s) => acc + s.sellingBill, 0);

      const rows = [
        ['CASH', cash.length.toString(), sumCash.toFixed(2), cash.length ? (sumCash / cash.length).toFixed(2) : '0.00'],
        ['UPI', upi.length.toString(), sumUpi.toFixed(2), upi.length ? (sumUpi / upi.length).toFixed(2) : '0.00'],
        ['CARD', card.length.toString(), sumCard.toFixed(2), card.length ? (sumCard / card.length).toFixed(2) : '0.00']
      ];
      return {
        filename: `Medi5_Collections_${dateStr}.csv`,
        csvContent: [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
      };
    }
  }
}

/**
 * Triggers a browser file download of CSV content.
 */
export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === 'undefined' || !window.document) return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
