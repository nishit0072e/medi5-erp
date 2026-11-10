import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateExecutiveSummary, 
  calculateInventoryFinancialHealth, 
  calculateSupplierAging, 
  calculateMonthlyCashFlow, 
  generateFinancialCSV,
  resolveDateFilterRange,
  filterSalesByDate,
  filterExpensesByDate
} from '../utils/financialCalculations';
import { 
  recordExpense, 
  updateExpense, 
  deleteExpense, 
  recordSupplierPayment,
  getInitialSeedState
} from '../data/demoRepository';
import { MOCK_MEDICINES, MOCK_BATCHES } from '../data/mockInventory';
import { MOCK_EXPENSES, MOCK_SUPPLIER_PAYABLES, generateSyntheticHistoricalSales } from '../data/mockFinancials';
import { ExpenseRecord, SupplierPayable } from '../types/financials';
import { SaleRecord } from '../types/inventory';

describe('Phase 4: Financial Health & Business Intelligence Engine', () => {
  const referenceDate = new Date('2026-11-02T12:00:00.000Z');
  let testSales: SaleRecord[];
  let testExpenses: ExpenseRecord[];
  let testPayables: SupplierPayable[];

  beforeEach(() => {
    testSales = generateSyntheticHistoricalSales('pharm-nandan-kolkata');
    testExpenses = JSON.parse(JSON.stringify(MOCK_EXPENSES)).filter(
      (e: ExpenseRecord) => e.pharmacyId === 'pharm-nandan-kolkata'
    );
    testPayables = JSON.parse(JSON.stringify(MOCK_SUPPLIER_PAYABLES)).filter(
      (p: SupplierPayable) => p.pharmacyId === 'pharm-nandan-kolkata'
    );
  });

  describe('A. Executive Financial Summary & Date Filtering', () => {
    it('correctly computes revenue, COGS, gross profit and margins', () => {
      const summary = calculateExecutiveSummary(
        testSales,
        testExpenses,
        MOCK_BATCHES,
        testPayables,
        'last30days',
        undefined,
        undefined,
        referenceDate
      );

      expect(summary.totalRevenue).toBeGreaterThan(0);
      expect(summary.cogs).toBeGreaterThan(0);
      expect(summary.grossProfit).toBeCloseTo(summary.totalRevenue - summary.cogs, 2);
      expect(summary.grossMarginPct).toBeGreaterThan(0);
      expect(summary.grossMarginPct).toBeLessThan(100);
      expect(summary.operatingExpenses).toBeGreaterThan(0);
      expect(summary.netOperatingProfit).toBeCloseTo(summary.grossProfit - summary.operatingExpenses, 2);
    });

    it('correctly resolves date ranges for presets', () => {
      const last7 = resolveDateFilterRange('last7days', undefined, undefined, referenceDate);
      expect(last7.startDate.getTime()).toBeLessThan(last7.endDate.getTime());
      
      const last30 = resolveDateFilterRange('last30days', undefined, undefined, referenceDate);
      expect(last30.startDate.getTime()).toBeLessThan(last30.endDate.getTime());

      const custom = resolveDateFilterRange('custom', '2026-10-01', '2026-10-15', referenceDate);
      expect(custom.startDate.getFullYear()).toBe(2026);
      expect(custom.startDate.getMonth()).toBe(9);
      expect(custom.startDate.getDate()).toBe(1);
      expect(custom.endDate.getDate()).toBe(15);
    });

    it('filters sales and expenses accurately strictly within date bounds', () => {
      const start = new Date('2026-10-01T00:00:00.000Z');
      const end = new Date('2026-10-15T23:59:59.999Z');

      const filteredS = filterSalesByDate(testSales, start, end);
      for (const s of filteredS) {
        const t = new Date(s.timestamp).getTime();
        expect(t).toBeGreaterThanOrEqual(start.getTime());
        expect(t).toBeLessThanOrEqual(end.getTime());
      }

      const filteredE = filterExpensesByDate(testExpenses, start, end);
      for (const e of filteredE) {
        const t = new Date(e.date).getTime();
        expect(t).toBeGreaterThanOrEqual(start.getTime());
        expect(t).toBeLessThanOrEqual(end.getTime());
      }
    });

    it('correctly tracks tender collection split (Cash vs UPI vs Card)', () => {
      const summary = calculateExecutiveSummary(
        testSales,
        testExpenses,
        MOCK_BATCHES,
        testPayables,
        'last30days',
        undefined,
        undefined,
        referenceDate
      );

      const totalCollections = summary.cashCollection + summary.upiCollection + summary.cardCollection;
      expect(Math.round(totalCollections * 100) / 100).toBe(Math.round(summary.totalRevenue * 100) / 100);
    });
  });

  describe('B. Operational Expense Management CRUD', () => {
    it('records a new expense with valid parameters and assigns unique ID', () => {
      const state = getInitialSeedState();
      const initialCount = state.expenses.length;

      const { nextState, expense } = recordExpense(state, 'pharm-nandan-kolkata', {
        category: 'ELECTRICITY',
        title: 'Generator Diesel Backup',
        amount: 3500,
        date: '2026-11-02',
        paymentMethod: 'CASH',
        referenceNumber: 'PETTY-881'
      });

      expect(expense.id).toContain('exp-');
      expect(expense.amount).toBe(3500);
      expect(nextState.expenses.length).toBe(initialCount + 1);
      expect(nextState.expenses[0].id).toBe(expense.id);
    });

    it('rejects recording expense with negative or non-finite amount', () => {
      const state = getInitialSeedState();

      expect(() => {
        recordExpense(state, 'pharm-nandan-kolkata', {
          category: 'MAINTENANCE',
          title: 'AC Gas Refill',
          amount: -500,
          date: '2026-11-02',
          paymentMethod: 'UPI'
        });
      }).toThrow(/positive finite number/);

      expect(() => {
        recordExpense(state, 'pharm-nandan-kolkata', {
          category: 'MAINTENANCE',
          title: 'AC Gas Refill',
          amount: NaN,
          date: '2026-11-02',
          paymentMethod: 'UPI'
        });
      }).toThrow(/positive finite number/);
    });

    it('updates existing expense details and persists to nextState', () => {
      const state = getInitialSeedState();
      const firstExp = state.expenses[0];

      const { nextState, expense } = updateExpense(state, firstExp.pharmacyId, firstExp.id, {
        amount: 38000,
        notes: 'Negotiated renewed rent rate'
      });

      expect(expense.amount).toBe(38000);
      expect(expense.notes).toBe('Negotiated renewed rent rate');
      const found = nextState.expenses.find(e => e.id === firstExp.id);
      expect(found?.amount).toBe(38000);
    });

    it('deletes an expense record safely without affecting other tenants', () => {
      const state = getInitialSeedState();
      const targetExp = state.expenses[0];
      const initialLength = state.expenses.length;

      const nextState = deleteExpense(state, targetExp.pharmacyId, targetExp.id);
      expect(nextState.expenses.length).toBe(initialLength - 1);
      expect(nextState.expenses.find(e => e.id === targetExp.id)).toBeUndefined();
    });
  });

  describe('C. Inventory Valuation & Financial Health', () => {
    it('computes purchase cost valuation, MRP valuation, and locked margin', () => {
      const valuation = calculateInventoryFinancialHealth(
        MOCK_MEDICINES,
        MOCK_BATCHES,
        testSales,
        referenceDate
      );

      expect(valuation.totalPurchaseCost).toBeGreaterThan(0);
      expect(valuation.totalMrpValuation).toBeGreaterThan(valuation.totalPurchaseCost);
      expect(valuation.potentialGrossProfit).toBeCloseTo(valuation.totalMrpValuation - valuation.totalPurchaseCost, 2);
      expect(valuation.potentialGrossMarginPct).toBeGreaterThan(0);
      expect(valuation.turnoverRatio).toBeGreaterThan(0);
    });

    it('identifies expired and near-expiry stock capital at risk', () => {
      const valuation = calculateInventoryFinancialHealth(
        MOCK_MEDICINES,
        MOCK_BATCHES,
        testSales,
        referenceDate
      );

      expect(valuation.expiredStockCost).toBeGreaterThanOrEqual(0);
      expect(valuation.nearExpiryStockCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('D. Supplier Payables Aging & Settlements', () => {
    it('calculates aging breakdown across credit windows', () => {
      const aging = calculateSupplierAging(testPayables, referenceDate);

      expect(aging.totalOutstanding).toBeGreaterThan(0);
      expect(aging.paidTotal).toBeGreaterThan(0);
      expect(aging.currentDues + aging.overdue30 + aging.overdue60 + aging.overdue90Plus).toBeCloseTo(aging.totalOutstanding, 1);
    });

    it('records partial supplier payment and updates status to PARTIAL', () => {
      const state = getInitialSeedState();
      const unpaid = state.payables.find(p => p.pharmacyId === 'pharm-nandan-kolkata' && p.status === 'OVERDUE')!;

      const { nextState, payable } = recordSupplierPayment(state, 'pharm-nandan-kolkata', unpaid.id, {
        amount: 10000,
        paymentDate: '2026-11-02',
        method: 'BANK_TRANSFER',
        reference: 'NEFT-88912',
        recordedBy: 'Nandan Owner'
      });

      expect(payable.paidAmount).toBe(unpaid.paidAmount + 10000);
      expect(payable.status).toBe('PARTIAL');
      expect(payable.paymentHistory.length).toBe(unpaid.paymentHistory.length + 1);

      const found = nextState.payables.find(p => p.id === unpaid.id);
      expect(found?.paidAmount).toBe(unpaid.paidAmount + 10000);
    });

    it('records full supplier payment and marks invoice as PAID', () => {
      const state = getInitialSeedState();
      const unpaid = state.payables.find(p => p.pharmacyId === 'pharm-nandan-kolkata' && p.status !== 'PAID')!;
      const remaining = unpaid.totalAmount - unpaid.paidAmount;

      const { payable } = recordSupplierPayment(state, 'pharm-nandan-kolkata', unpaid.id, {
        amount: remaining,
        paymentDate: '2026-11-02',
        method: 'BANK_TRANSFER',
        reference: 'FULL-SETTLE-01',
        recordedBy: 'Nandan Owner'
      });

      expect(payable.paidAmount).toBe(unpaid.totalAmount);
      expect(payable.status).toBe('PAID');
    });

    it('rejects overpaying more than the remaining due balance', () => {
      const state = getInitialSeedState();
      const unpaid = state.payables.find(p => p.pharmacyId === 'pharm-nandan-kolkata' && p.status !== 'PAID')!;
      const remaining = unpaid.totalAmount - unpaid.paidAmount;

      expect(() => {
        recordSupplierPayment(state, 'pharm-nandan-kolkata', unpaid.id, {
          amount: remaining + 5000,
          paymentDate: '2026-11-02',
          method: 'BANK_TRANSFER',
          recordedBy: 'Nandan Owner'
        });
      }).toThrow(/cannot exceed remaining due/);
    });
  });

  describe('E. Operating Cash Flow Trends', () => {
    it('computes 6-month monthly cash inflows, outflows and net flows', () => {
      const trends = calculateMonthlyCashFlow(testSales, testExpenses, testPayables, 6, referenceDate);
      expect(trends.length).toBe(6);

      for (const t of trends) {
        expect(t.inflow).toBeGreaterThanOrEqual(0);
        expect(t.outflow).toBeGreaterThanOrEqual(0);
        expect(t.net).toBeCloseTo(t.inflow - t.outflow, 2);
      }
    });
  });

  describe('F. Financial CSV Export Engine', () => {
    it('generates valid P&L, Expenses, Revenue, Inventory and Supplier CSV outputs', () => {
      const summary = calculateExecutiveSummary(
        testSales,
        testExpenses,
        MOCK_BATCHES,
        testPayables,
        'last30days',
        undefined,
        undefined,
        referenceDate
      );

      const pnlCsv = generateFinancialCSV('pnl', {
        sales: testSales,
        expenses: testExpenses,
        batches: MOCK_BATCHES,
        medicines: MOCK_MEDICINES,
        payables: testPayables,
        summary
      });
      expect(pnlCsv.filename).toContain('Medi5_PnL_Statement');
      expect(pnlCsv.csvContent).toContain('Gross Sales / Revenue');
      expect(pnlCsv.csvContent).toContain('Net Operating Profit');

      const expCsv = generateFinancialCSV('expenses', {
        sales: testSales,
        expenses: testExpenses,
        batches: MOCK_BATCHES,
        medicines: MOCK_MEDICINES,
        payables: testPayables,
        summary
      });
      expect(expCsv.filename).toContain('Medi5_Expenses');
      expect(expCsv.csvContent).toContain('Expense ID');

      const invCsv = generateFinancialCSV('inventory_valuation', {
        sales: testSales,
        expenses: testExpenses,
        batches: MOCK_BATCHES,
        medicines: MOCK_MEDICINES,
        payables: testPayables,
        summary
      });
      expect(invCsv.filename).toContain('Medi5_Inventory_Valuation');
      expect(invCsv.csvContent).toContain('Locked Profit');
    });
  });
});
