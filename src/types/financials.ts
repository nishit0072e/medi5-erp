/**
 * Medi5 ERP - Financial Health & Business Intelligence Types (Phase 4)
 * 
 * Data models for Executive Dashboard, Expense Management, Supplier Payables,
 * Cash Flow Tracking, Inventory Financial Health, and P&L Financial Reporting.
 */

export type ExpenseCategory = 
  | 'RENT'
  | 'SALARIES'
  | 'ELECTRICITY'
  | 'INTERNET'
  | 'TRANSPORTATION'
  | 'SOFTWARE'
  | 'MAINTENANCE'
  | 'MISCELLANEOUS';

export interface ExpenseRecord {
  id: string;
  pharmacyId: string;
  category: ExpenseCategory;
  title: string;
  amount: number; // in INR
  date: string; // YYYY-MM-DD
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber?: string;
  vendorName?: string;
  notes?: string;
  createdAt: string;
}

export type SupplierPaymentStatus = 'PAID' | 'PARTIAL' | 'OVERDUE' | 'DUE_SOON' | 'PENDING';

export interface SupplierPaymentEntry {
  id: string;
  amount: number;
  paymentDate: string;
  method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  reference?: string;
  recordedBy: string;
}

export interface SupplierPayable {
  id: string;
  pharmacyId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  totalAmount: number;
  paidAmount: number;
  status: SupplierPaymentStatus;
  paymentHistory: SupplierPaymentEntry[];
  notes?: string;
}

export interface CashFlowPoint {
  period: string; // e.g., '2026-05', '2026-06' or YYYY-MM-DD
  label: string;
  inflow: number; // Sales Collections (Cash + UPI + Card)
  outflow: number; // Operating Expenses + Supplier Payments
  net: number; // inflow - outflow
}

export interface CashFlowSummary {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  trends: CashFlowPoint[];
}

export interface FinancialExecutiveSummary {
  periodLabel: string;
  totalRevenue: number;
  prevTotalRevenue: number;
  revenueGrowthPct: number;
  cogs: number;
  grossProfit: number;
  prevGrossProfit: number;
  grossProfitGrowthPct: number;
  grossMarginPct: number;
  operatingExpenses: number;
  prevOperatingExpenses: number;
  netOperatingProfit: number; // grossProfit - operatingExpenses
  netProfitMarginPct: number;
  inventoryInvestmentCost: number;
  inventoryMrpValuation: number;
  lockedMarginInInventory: number;
  outstandingSupplierPayables: number;
  cashCollection: number;
  upiCollection: number;
  cardCollection: number;
}

export interface InventoryValuationBreakdown {
  totalPurchaseCost: number;
  totalMrpValuation: number;
  potentialGrossProfit: number;
  potentialGrossMarginPct: number;
  expiredStockCost: number;
  nearExpiryStockCost: number;
  deadStockCost: number; // unsold/quarantined > 90d
  fastMovingStockCost: number;
  slowMovingStockCost: number;
  turnoverRatio: number;
  daysInventoryOutstanding: number;
}

export type DateFilterPreset = 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

export type FinancialReportType = 
  | 'pnl'
  | 'revenue'
  | 'expenses'
  | 'inventory_valuation'
  | 'supplier_payables'
  | 'collections';

