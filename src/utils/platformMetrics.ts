import { Medicine, MedicineBatch, SaleRecord, StockMovement } from '../types/inventory';
import { PharmacyMember, PharmacyProfile } from '../types/pharmacy';
import { fromPaise, toPaise } from './moneyUtils';

export type PlatformFeeBasis = 'sales' | 'profit';

export interface PlatformStats {
  totalSalesRupees: number;
  totalProfitRupees: number;
  monthlySalesRupees: number;
  monthlyProfitRupees: number;
  projectedPlatformRevenue: number;
  totalInvoices: number;
  monthlyInvoices: number;
  totalPharmacies: number;
  totalMedicines: number;
  totalActiveBatches: number;
  totalExpiringSoonBatches: number;
  totalAuditEntries: number;
}

export interface PharmacyHealthSummary {
  pharmacy: PharmacyProfile;
  owner: PharmacyMember | undefined;
  salesVolume: number;
  profitVolume: number;
  monthlySalesVolume: number;
  monthlyProfitVolume: number;
  invoicesCount: number;
  monthlyInvoicesCount: number;
  platformFeeDue: number;
  systemStatus: 'HEALTHY';
}

interface SalesTotals {
  revenue: number;
  profit: number;
}

function calculateSalesTotals(sales: SaleRecord[]): SalesTotals {
  const salesPaise = sales.reduce((acc, sale) => acc + toPaise(sale.sellingBill), 0);
  const profitPaise = sales.reduce((acc, sale) => acc + toPaise(sale.estimatedGrossProfit), 0);
  return {
    revenue: fromPaise(salesPaise),
    profit: fromPaise(profitPaise)
  };
}

function calculateUsageFee(totals: SalesTotals, feeBase: PlatformFeeBasis, feeRate: number): number {
  const basePaise = toPaise(feeBase === 'sales' ? totals.revenue : totals.profit);
  return fromPaise(Math.round((basePaise * feeRate) / 100));
}

export function isSaleInReferenceMonth(sale: SaleRecord, referenceDate: Date): boolean {
  const timestamp = new Date(sale.timestamp);
  return (
    !Number.isNaN(timestamp.getTime()) &&
    timestamp.getFullYear() === referenceDate.getFullYear() &&
    timestamp.getMonth() === referenceDate.getMonth()
  );
}

export function formatMonthLabel(referenceDate: Date): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`;
}

export function calculatePlatformStats(params: {
  sales: SaleRecord[];
  pharmacies: PharmacyProfile[];
  medicines: Medicine[];
  batches: MedicineBatch[];
  movements: StockMovement[];
  feeBase: PlatformFeeBasis;
  feeRate: number;
  referenceDate: Date;
}): PlatformStats {
  const {
    sales,
    pharmacies,
    medicines,
    batches,
    movements,
    feeBase,
    feeRate,
    referenceDate
  } = params;

  const monthlySales = sales.filter((sale) => isSaleInReferenceMonth(sale, referenceDate));
  const lifetimeTotals = calculateSalesTotals(sales);
  const monthlyTotals = calculateSalesTotals(monthlySales);
  const referenceTime = referenceDate.getTime();
  const dayMs = 1000 * 60 * 60 * 24;

  return {
    totalSalesRupees: lifetimeTotals.revenue,
    totalProfitRupees: lifetimeTotals.profit,
    monthlySalesRupees: monthlyTotals.revenue,
    monthlyProfitRupees: monthlyTotals.profit,
    projectedPlatformRevenue: calculateUsageFee(monthlyTotals, feeBase, feeRate),
    totalInvoices: sales.length,
    monthlyInvoices: monthlySales.length,
    totalPharmacies: pharmacies.length,
    totalMedicines: medicines.length,
    totalActiveBatches: batches.filter((b) => b.quantityRemaining > 0 && b.status === 'ACTIVE').length,
    totalExpiringSoonBatches: batches.filter((b) => {
      if (b.quantityRemaining <= 0) return false;
      const daysUntilExpiry = (new Date(b.expiryDate).getTime() - referenceTime) / dayMs;
      return daysUntilExpiry <= 60 && daysUntilExpiry > 0;
    }).length,
    totalAuditEntries: movements.length
  };
}

export function calculatePharmacyHealthSummaries(params: {
  pharmacies: PharmacyProfile[];
  sales: SaleRecord[];
  feeBase: PlatformFeeBasis;
  feeRate: number;
  referenceDate: Date;
}): PharmacyHealthSummary[] {
  const { pharmacies, sales, feeBase, feeRate, referenceDate } = params;

  return pharmacies.map((pharmacy) => {
    const storeSales = sales.filter((sale) => sale.pharmacyId === pharmacy.id);
    const monthlyStoreSales = storeSales.filter((sale) => isSaleInReferenceMonth(sale, referenceDate));
    const lifetimeTotals = calculateSalesTotals(storeSales);
    const monthlyTotals = calculateSalesTotals(monthlyStoreSales);
    const owner = pharmacy.members.find((member) => member.role === 'OWNER') || pharmacy.members[0];

    return {
      pharmacy,
      owner,
      salesVolume: lifetimeTotals.revenue,
      profitVolume: lifetimeTotals.profit,
      monthlySalesVolume: monthlyTotals.revenue,
      monthlyProfitVolume: monthlyTotals.profit,
      invoicesCount: storeSales.length,
      monthlyInvoicesCount: monthlyStoreSales.length,
      platformFeeDue: calculateUsageFee(monthlyTotals, feeBase, feeRate),
      systemStatus: 'HEALTHY'
    };
  });
}
