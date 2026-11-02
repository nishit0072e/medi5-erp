import { describe, it, expect } from 'vitest';
import { MOCK_PHARMACIES } from '../data/mockPharmacies';
import { SaleRecord } from '../types/inventory';
import {
  calculatePharmacyHealthSummaries,
  calculatePlatformStats,
  formatMonthLabel,
  isSaleInReferenceMonth
} from '../utils/platformMetrics';

const NANDAN = 'pharm-nandan-kolkata';
const DESHBANDHU = 'pharm-deshbandhu-siliguri';

function makeSale(
  id: string,
  pharmacyId: string,
  timestamp: string,
  sellingBill: number,
  estimatedGrossProfit: number
): SaleRecord {
  return {
    id,
    pharmacyId,
    clientSaleToken: `token-${id}`,
    timestamp,
    items: [],
    totalBillMrp: sellingBill,
    sellingBill,
    discount: 0,
    estimatedCogs: sellingBill - estimatedGrossProfit,
    estimatedGrossProfit,
    tenderType: 'CASH',
    staffUser: 'Tester',
    confirmedBelowCost: false
  };
}

describe('Platform Metrics', () => {
  const referenceDate = new Date('2026-11-15T12:00:00');
  const sales = [
    makeSale('nandan-nov', NANDAN, '2026-11-02T10:00:00', 100, 20),
    makeSale('nandan-oct', NANDAN, '2026-10-20T10:00:00', 200, 50),
    makeSale('desh-nov', DESHBANDHU, '2026-11-10T10:00:00', 300, 60)
  ];

  it('matches sales only within the reference calendar month', () => {
    expect(isSaleInReferenceMonth(
      makeSale('start', NANDAN, '2026-11-01T00:00:00', 10, 2),
      referenceDate
    )).toBe(true);
    expect(isSaleInReferenceMonth(
      makeSale('previous-month', NANDAN, '2026-10-31T23:59:59', 10, 2),
      referenceDate
    )).toBe(false);
    expect(isSaleInReferenceMonth(
      makeSale('next-month', NANDAN, '2026-12-01T00:00:00', 10, 2),
      referenceDate
    )).toBe(false);
    expect(formatMonthLabel(referenceDate)).toBe('Nov 2026');
  });

  it('computes lifetime totals and current-month usage revenue separately', () => {
    const stats = calculatePlatformStats({
      sales,
      pharmacies: MOCK_PHARMACIES,
      medicines: [],
      batches: [],
      movements: [],
      feeBase: 'sales',
      feeRate: 2,
      referenceDate
    });

    expect(stats.totalSalesRupees).toBe(600);
    expect(stats.totalProfitRupees).toBe(130);
    expect(stats.totalInvoices).toBe(3);
    expect(stats.monthlySalesRupees).toBe(400);
    expect(stats.monthlyProfitRupees).toBe(80);
    expect(stats.monthlyInvoices).toBe(2);
    expect(stats.projectedPlatformRevenue).toBe(8);
    expect(stats.totalPharmacies).toBe(2);
  });

  it('supports fee calculation on monthly profit instead of sales', () => {
    const stats = calculatePlatformStats({
      sales,
      pharmacies: MOCK_PHARMACIES,
      medicines: [],
      batches: [],
      movements: [],
      feeBase: 'profit',
      feeRate: 2.5,
      referenceDate
    });

    expect(stats.projectedPlatformRevenue).toBe(2);
  });

  it('attributes sales, invoices, and monthly fees to the correct pharmacy', () => {
    const summaries = calculatePharmacyHealthSummaries({
      pharmacies: MOCK_PHARMACIES,
      sales,
      feeBase: 'sales',
      feeRate: 2,
      referenceDate
    });

    const nandan = summaries.find((summary) => summary.pharmacy.id === NANDAN)!;
    expect(nandan.salesVolume).toBe(300);
    expect(nandan.profitVolume).toBe(70);
    expect(nandan.invoicesCount).toBe(2);
    expect(nandan.monthlySalesVolume).toBe(100);
    expect(nandan.monthlyProfitVolume).toBe(20);
    expect(nandan.monthlyInvoicesCount).toBe(1);
    expect(nandan.platformFeeDue).toBe(2);

    const deshbandhu = summaries.find((summary) => summary.pharmacy.id === DESHBANDHU)!;
    expect(deshbandhu.salesVolume).toBe(300);
    expect(deshbandhu.profitVolume).toBe(60);
    expect(deshbandhu.invoicesCount).toBe(1);
    expect(deshbandhu.monthlySalesVolume).toBe(300);
    expect(deshbandhu.monthlyProfitVolume).toBe(60);
    expect(deshbandhu.monthlyInvoicesCount).toBe(1);
    expect(deshbandhu.platformFeeDue).toBe(6);
  });
});
