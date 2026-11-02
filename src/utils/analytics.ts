/**
 * Medi5 ERP - Financial Health & Leakage Analytics Engine
 * 
 * Computes pharmacy-level analytics from inventory, sales, and movement data.
 * Pure functions with no side effects for testability.
 */

import {
  Medicine,
  MedicineBatch,
  SaleRecord,
  StockMovement,
  MedicineInventorySummary
} from '../types/inventory';
import {
  AnalyticsInput,
  AnalyticsPeriod,
  AnalyticsGranularity,
  TimeSeriesPoint,
  TenderBreakdown,
  CategoryPerformance,
  SkuPerformance,
  InventoryEfficiency,
  LeakageAnalysis,
  PharmacyAnalytics,
  AnalyticsAlert,
  ProfitabilityTrend,
  ANALYTICS_THRESHOLDS,
  CARRYING_COST_RATE
} from '../types/analytics';
import { parseExpiryDate, getExpiryUrgency } from './dateUtils';

/** Default period: last 12 months with monthly granularity */
export function getDefaultPeriod(referenceDate: Date = new Date()): AnalyticsPeriod {
  const to = new Date(referenceDate);
  const from = new Date(referenceDate);
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  return { from, to, granularity: 'month' };
}

/** Check if a date falls within the analytics period */
export function inPeriod(date: Date, period: AnalyticsPeriod): boolean {
  return date >= period.from && date <= period.to;
}

/** Group dates by granularity */
function getPeriodKey(date: Date, granularity: AnalyticsGranularity): string {
  if (granularity === 'day') {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (granularity === 'week') {
    const year = date.getFullYear();
    const week = Math.ceil((date.getDate() + new Date(year, date.getMonth(), 1).getDay()) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodLabel(key: string, granularity: AnalyticsGranularity): string {
  if (granularity === 'day') {
    return key; // YYYY-MM-DD
  }
  if (granularity === 'week') {
    const [year, week] = key.split('-W');
    return `W${week} ${year}`;
  }
  const [year, month] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

/** Generate all period keys in range */
function generatePeriodKeys(period: AnalyticsPeriod): string[] {
  const keys: string[] = [];
  const current = new Date(period.from);
  const end = new Date(period.to);
  
  while (current <= end) {
    keys.push(getPeriodKey(current, period.granularity));
    if (period.granularity === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (period.granularity === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }
  return keys;
}

/** Aggregate sales by period */
function aggregateSalesByPeriod(
  sales: SaleRecord[],
  period: AnalyticsPeriod
): Map<string, { revenue: number; cogs: number; profit: number; discount: number; count: number; cash: number; upi: number; card: number }> {
  const map = new Map<string, { revenue: number; cogs: number; profit: number; discount: number; count: number; cash: number; upi: number; card: number }>();
  
  for (const sale of sales) {
    const date = new Date(sale.timestamp);
    if (!inPeriod(date, period)) continue;
    
    const key = getPeriodKey(date, period.granularity);
    const existing = map.get(key) || { revenue: 0, cogs: 0, profit: 0, discount: 0, count: 0, cash: 0, upi: 0, card: 0 };
    
    existing.revenue += sale.sellingBill;
    existing.cogs += sale.estimatedCogs;
    existing.profit += sale.estimatedGrossProfit;
    existing.discount += sale.discount;
    existing.count += 1;
    
    if (sale.tenderType === 'CASH') existing.cash += sale.sellingBill;
    else if (sale.tenderType === 'UPI') existing.upi += sale.sellingBill;
    else if (sale.tenderType === 'CARD') existing.card += sale.sellingBill;
    
    map.set(key, existing);
  }
  return map;
}

/** Build time series from aggregated map */
function buildTimeSeries(
  keys: string[],
  map: Map<string, { revenue: number; cogs: number; profit: number; discount: number; count: number; cash: number; upi: number; card: number }>,
  granularity: AnalyticsGranularity,
  valueKey: 'revenue' | 'cogs' | 'profit' | 'discount' | 'count' | 'cash' | 'upi' | 'card'
): TimeSeriesPoint[] {
  return keys.map(key => {
    const data = map.get(key);
    return {
      period: key,
      label: getPeriodLabel(key, granularity),
      value: data?.[valueKey] ?? 0
    };
  });
}

/** Calculate category performance */
export function calculateCategoryPerformance(
  medicines: Medicine[],
  sales: SaleRecord[],
  period: AnalyticsPeriod
): CategoryPerformance[] {
  const categoryMap = new Map<string, {
    medicines: Set<string>;
    revenue: number;
    cogs: number;
    unitsSold: number;
  }>();
  
  for (const sale of sales) {
    if (!inPeriod(new Date(sale.timestamp), period)) continue;
    
    for (const item of sale.items) {
      const medicine = medicines.find(m => m.id === item.medicineId);
      if (!medicine) continue;
      
      const cat = medicine.category || 'Uncategorized';
      const existing = categoryMap.get(cat) || { medicines: new Set<string>(), revenue: 0, cogs: 0, unitsSold: 0 };
      existing.medicines.add(item.medicineId);
      existing.revenue += item.lineTotalMrp;
      existing.cogs += item.lineTotalCogs;
      existing.unitsSold += item.quantity;
      categoryMap.set(cat, existing);
    }
  }
  
  return Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    medicineCount: data.medicines.size,
    totalRevenue: data.revenue,
    totalCogs: data.cogs,
    grossProfit: data.revenue - data.cogs,
    grossMarginPct: data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue) * 100 : 0,
    unitsSold: data.unitsSold,
    avgSellingPrice: data.unitsSold > 0 ? data.revenue / data.unitsSold : 0
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/** Calculate SKU performance */
export function calculateSkuPerformance(
  medicines: Medicine[],
  _batches: MedicineBatch[],
  sales: SaleRecord[],
  summaries: MedicineInventorySummary[],
  period: AnalyticsPeriod
): SkuPerformance[] {
  const periodDays = Math.max(1, Math.ceil((period.to.getTime() - period.from.getTime()) / (1000 * 60 * 60 * 24)));
  const dailyFactor = 365 / periodDays;
  
  const skuMap = new Map<string, {
    medicine: Medicine;
    unitsSold: number;
    revenue: number;
    cogs: number;
    totalDiscount: number;
    totalMrp: number;
  }>();
  
  for (const sale of sales) {
    if (!inPeriod(new Date(sale.timestamp), period)) continue;
    
    for (const item of sale.items) {
      const existing = skuMap.get(item.medicineId) || { medicine: medicines.find(m => m.id === item.medicineId)!, unitsSold: 0, revenue: 0, cogs: 0, totalDiscount: 0, totalMrp: 0 };
      existing.unitsSold += item.quantity;
      existing.revenue += item.lineTotalMrp;
      existing.cogs += item.lineTotalCogs;
      existing.totalDiscount += (item.lineTotalMrp - (item.lineTotalMrp * (1 - (sale.discount / (sale.totalBillMrp || 1))))); // approximate
      existing.totalMrp += item.lineTotalMrp;
      skuMap.set(item.medicineId, existing);
    }
  }
  
  const results: SkuPerformance[] = [];
  
  for (const [medicineId, data] of skuMap.entries()) {
    const summary = summaries.find(s => s.medicine.id === medicineId);
    const avgInventory = summary?.saleableQuantity ?? 0;
    const turnover = avgInventory > 0 ? (data.unitsSold / avgInventory) * dailyFactor : 0;
    const daysOfStock = data.unitsSold > 0 ? avgInventory / (data.unitsSold / periodDays) : Infinity;
    const grossMarginPct = data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue) * 100 : 0;
    const avgDiscountPct = data.totalMrp > 0 ? (data.totalDiscount / data.totalMrp) * 100 : 0;
    
    results.push({
      medicineId,
      medicineName: data.medicine.name,
      genericName: data.medicine.genericName,
      strength: data.medicine.strength,
      category: data.medicine.category,
      unitsSold: data.unitsSold,
      revenue: data.revenue,
      cogs: data.cogs,
      grossProfit: data.revenue - data.cogs,
      grossMarginPct,
      avgDiscountPct,
      stockTurnover: turnover,
      daysOfStock: daysOfStock === Infinity ? 999 : daysOfStock,
      isFastMover: turnover > ANALYTICS_THRESHOLDS.FAST_MOVER_TURNOVER,
      isSlowMover: daysOfStock > ANALYTICS_THRESHOLDS.SLOW_MOVER_DAYS && data.unitsSold > 0
    });
  }
  
  return results.sort((a, b) => b.revenue - a.revenue);
}

/** Calculate inventory efficiency */
export function calculateInventoryEfficiency(
  summaries: MedicineInventorySummary[],
  _movements: StockMovement[],
  sales: SaleRecord[],
  period: AnalyticsPeriod
): InventoryEfficiency {
  const periodDays = Math.max(1, Math.ceil((period.to.getTime() - period.from.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Total COGS in period
  const periodCogs = sales
    .filter(s => inPeriod(new Date(s.timestamp), period))
    .reduce((acc: number, s: SaleRecord) => acc + s.estimatedCogs, 0);
  
  // Average inventory value (simple: current saleable value)
  const totalInventoryValue = summaries.reduce((acc: number, s: MedicineInventorySummary) => acc + s.saleableQuantity * s.averageCost, 0);
  
  // Inventory turnover
  const inventoryTurnoverRatio = totalInventoryValue > 0 ? periodCogs / totalInventoryValue : 0;
  const daysInventoryOutstanding = inventoryTurnoverRatio > 0 ? 365 / inventoryTurnoverRatio : 999;
  
  // Carrying cost
  const carryingCostPct = totalInventoryValue > 0 ? (totalInventoryValue * CARRYING_COST_RATE * (periodDays / 365)) / periodCogs * 100 : 0;
  
  // Dead stock
  const deadStockValue = summaries.reduce((acc, s) => acc + (s.expiredQuantity + s.quarantinedQuantity) * s.averageCost, 0);
  const deadStockPct = totalInventoryValue > 0 ? (deadStockValue / totalInventoryValue) * 100 : 0;
  
  // Stockout incidents
  const stockoutIncidents = summaries.filter(s => s.isOutOfStock).length;
  const stockoutRate = summaries.length > 0 ? stockoutIncidents / summaries.length : 0;
  
  // Average stockout duration (simplified - would need historical OOS tracking)
  const avgStockoutDurationDays = 7; // placeholder
  
  // Reorder accuracy (simplified)
  const reorderAccuracy = 0.85; // placeholder
  
  return {
    inventoryTurnoverRatio: Math.round(inventoryTurnoverRatio * 100) / 100,
    daysInventoryOutstanding: Math.round(daysInventoryOutstanding),
    carryingCostPct: Math.round(carryingCostPct * 100) / 100,
    deadStockValue: Math.round(deadStockValue),
    deadStockPct: Math.round(deadStockPct * 100) / 100,
    stockoutIncidents,
    stockoutRate: Math.round(stockoutRate * 10000) / 100,
    avgStockoutDurationDays,
    reorderAccuracy: Math.round(reorderAccuracy * 10000) / 100
  };
}

/** Calculate leakage analysis */
export function calculateLeakageAnalysis(
  movements: StockMovement[],
  sales: SaleRecord[],
  batches: MedicineBatch[],
  period: AnalyticsPeriod
): LeakageAnalysis {
  // Write-offs
  const writeOffMovements = movements.filter(m => 
    inPeriod(new Date(m.timestamp), period) &&
    (m.movementType === 'EXPIRED_WRITE_OFF' || m.movementType === 'DAMAGE_WRITE_OFF' || m.movementType === 'AUDIT_CORRECTION') &&
    m.quantityChange < 0
  );
  
  const expiredWriteOffs = writeOffMovements
    .filter(m => m.movementType === 'EXPIRED_WRITE_OFF')
    .reduce((acc, m) => acc + Math.abs(m.quantityChange) * (batches.find(b => b.id === m.batchId)?.purchaseCost || 0), 0);
  
  const damageWriteOffs = writeOffMovements
    .filter(m => m.movementType === 'DAMAGE_WRITE_OFF')
    .reduce((acc, m) => acc + Math.abs(m.quantityChange) * (batches.find(b => b.id === m.batchId)?.purchaseCost || 0), 0);
  
  const auditCorrections = writeOffMovements
    .filter(m => m.movementType === 'AUDIT_CORRECTION')
    .reduce((acc, m) => acc + Math.abs(m.quantityChange) * (batches.find(b => b.id === m.batchId)?.purchaseCost || 0), 0);
  
  const totalWriteOffs = expiredWriteOffs + damageWriteOffs + auditCorrections;
  const writeOffCount = writeOffMovements.length;
  
  // Below-cost sales
  const belowCostSales = sales
    .filter(s => inPeriod(new Date(s.timestamp), period) && s.confirmedBelowCost)
    .reduce((acc, s) => acc + s.sellingBill, 0);
  const belowCostCount = sales.filter(s => inPeriod(new Date(s.timestamp), period) && s.confirmedBelowCost).length;
  
  // Returns
  const customerReturns = movements
    .filter(m => inPeriod(new Date(m.timestamp), period) && m.movementType === 'CUSTOMER_RETURN')
    .reduce((acc, m) => acc + Math.abs(m.quantityChange) * (batches.find(b => b.id === m.batchId)?.mrp || 0), 0);
  
  const supplierReturns = movements
    .filter(m => inPeriod(new Date(m.timestamp), period) && m.movementType === 'SUPPLIER_RETURN')
    .reduce((acc, m) => acc + Math.abs(m.quantityChange) * (batches.find(b => b.id === m.batchId)?.purchaseCost || 0), 0);
  
  const periodRevenue = sales.filter(s => inPeriod(new Date(s.timestamp), period)).reduce((acc, s) => acc + s.sellingBill, 0);
  const periodCogs = sales.filter(s => inPeriod(new Date(s.timestamp), period)).reduce((acc, s) => acc + s.estimatedCogs, 0);
  
  const returnRate = periodRevenue > 0 ? ((customerReturns + supplierReturns) / periodRevenue) * 100 : 0;
  const writeOffPctOfCogs = periodCogs > 0 ? (totalWriteOffs / periodCogs) * 100 : 0;
  const belowCostPctOfRevenue = periodRevenue > 0 ? (belowCostSales / periodRevenue) * 100 : 0;
  
  // Shrinkage estimate: difference between expected and actual inventory
  // Simplified: unaccounted negative movements not in write-offs/returns
  const shrinkageEstimate = Math.max(0, totalWriteOffs * 0.1); // 10% of write-offs as proxy
  
  // Leakage score (0-100)
  let leakageScore = 0;
  leakageScore += Math.min(30, writeOffPctOfCogs * 3);
  leakageScore += Math.min(25, belowCostPctOfRevenue * 5);
  leakageScore += Math.min(20, returnRate * 2);
  leakageScore += Math.min(15, shrinkageEstimate / (periodCogs || 1) * 100);
  leakageScore += Math.min(10, writeOffCount / (sales.length || 1) * 100);
  
  return {
    totalWriteOffs: Math.round(totalWriteOffs),
    expiredWriteOffs: Math.round(expiredWriteOffs),
    damageWriteOffs: Math.round(damageWriteOffs),
    auditCorrections: Math.round(auditCorrections),
    writeOffCount,
    writeOffPctOfCogs: Math.round(writeOffPctOfCogs * 100) / 100,
    belowCostSales: Math.round(belowCostSales),
    belowCostCount,
    belowCostPctOfRevenue: Math.round(belowCostPctOfRevenue * 100) / 100,
    customerReturns: Math.round(customerReturns),
    supplierReturns: Math.round(supplierReturns),
    returnRate: Math.round(returnRate * 100) / 100,
    shrinkageEstimate: Math.round(shrinkageEstimate),
    leakageScore: Math.round(Math.min(100, leakageScore))
  };
}

/** Generate alerts based on analytics */
export function generateAlerts(
  analytics: Omit<PharmacyAnalytics, 'alerts'>
): AnalyticsAlert[] {
  const alerts: AnalyticsAlert[] = [];
  const { inventoryEfficiency, leakage, grossMarginPct, bottomSkus } = analytics;
  
  // Low overall margin
  if (grossMarginPct < ANALYTICS_THRESHOLDS.LOW_MARGIN_PCT) {
    alerts.push({
      type: 'LOW_MARGIN',
      severity: 'CRITICAL',
      title: 'Low Gross Margin',
      message: `Overall gross margin is ${grossMarginPct.toFixed(1)}% (threshold: ${ANALYTICS_THRESHOLDS.LOW_MARGIN_PCT}%)`,
      value: grossMarginPct,
      threshold: ANALYTICS_THRESHOLDS.LOW_MARGIN_PCT,
      action: 'Review pricing strategy and discount policies'
    });
  }
  
  // High write-offs
  if (leakage.writeOffPctOfCogs > ANALYTICS_THRESHOLDS.HIGH_WRITE_OFF_PCT) {
    alerts.push({
      type: 'HIGH_WRITE_OFF',
      severity: 'WARNING',
      title: 'High Write-off Rate',
      message: `Write-offs are ${leakage.writeOffPctOfCogs.toFixed(1)}% of COGS (threshold: ${ANALYTICS_THRESHOLDS.HIGH_WRITE_OFF_PCT}%)`,
      value: leakage.writeOffPctOfCogs,
      threshold: ANALYTICS_THRESHOLDS.HIGH_WRITE_OFF_PCT,
      action: 'Review expiry management and storage conditions'
    });
  }
  
  // Dead stock
  if (inventoryEfficiency.deadStockPct > ANALYTICS_THRESHOLDS.DEAD_STOCK_PCT) {
    alerts.push({
      type: 'DEAD_STOCK',
      severity: 'WARNING',
      title: 'High Dead Stock',
      message: `${inventoryEfficiency.deadStockPct.toFixed(1)}% of inventory value is expired/quarantined (threshold: ${ANALYTICS_THRESHOLDS.DEAD_STOCK_PCT}%)`,
      value: inventoryEfficiency.deadStockPct,
      threshold: ANALYTICS_THRESHOLDS.DEAD_STOCK_PCT,
      action: 'Run clearance promotions or return to supplier'
    });
  }
  
  // Stockout rate
  if (inventoryEfficiency.stockoutRate > ANALYTICS_THRESHOLDS.STOCKOUT_RATE * 100) {
    alerts.push({
      type: 'STOCKOUT_RISK',
      severity: 'WARNING',
      title: 'High Stockout Rate',
      message: `${inventoryEfficiency.stockoutRate.toFixed(1)}% of SKUs are out of stock (threshold: ${ANALYTICS_THRESHOLDS.STOCKOUT_RATE * 100}%)`,
      value: inventoryEfficiency.stockoutRate,
      threshold: ANALYTICS_THRESHOLDS.STOCKOUT_RATE * 100,
      action: 'Improve reorder points and safety stock levels'
    });
  }
  
  // Below-cost sales
  if (leakage.belowCostPctOfRevenue > ANALYTICS_THRESHOLDS.BELOW_COST_PCT) {
    alerts.push({
      type: 'BELOW_COST_SALES',
      severity: 'CRITICAL',
      title: 'Below-Cost Sales Detected',
      message: `${leakage.belowCostPctOfRevenue.toFixed(1)}% of revenue from below-cost sales (threshold: ${ANALYTICS_THRESHOLDS.BELOW_COST_PCT}%)`,
      value: leakage.belowCostPctOfRevenue,
      threshold: ANALYTICS_THRESHOLDS.BELOW_COST_PCT,
      action: 'Review staff override permissions and pricing rules'
    });
  }
  
  // Slow movers
  const slowMovers = bottomSkus.filter(s => s.isSlowMover && s.unitsSold > 0).length;
  if (slowMovers > 0) {
    alerts.push({
      type: 'SLOW_MOVER',
      severity: 'INFO',
      title: 'Slow-Moving Inventory',
      message: `${slowMovers} SKUs have > ${ANALYTICS_THRESHOLDS.SLOW_MOVER_DAYS} days of stock`,
      value: slowMovers,
      threshold: 0,
      action: 'Consider promotions, bundling, or returning to supplier'
    });
  }
  
  return alerts;
}

/** Main analytics computation entry point */
export function computePharmacyAnalytics(input: AnalyticsInput): PharmacyAnalytics {
  const { pharmacy, medicines, batches, sales, movements, period, referenceDate } = input;
  
  // Filter data to pharmacy
  const pharmacyMedicines = medicines.filter(m => m.pharmacyId === pharmacy.id);
  const pharmacyBatches = batches.filter(b => b.pharmacyId === pharmacy.id);
  const pharmacySales = sales.filter(s => s.pharmacyId === pharmacy.id);
  const pharmacyMovements = movements.filter(m => m.pharmacyId === pharmacy.id);
  
  // Compute inventory summaries
  const computedSummaries = pharmacyMedicines.map(med => {
    const medBatches = pharmacyBatches.filter(b => b.medicineId === med.id);
    let totalQuantity = 0, saleableQuantity = 0, expiredQuantity = 0, quarantinedQuantity = 0;
    let totalSaleableCost = 0;
    let hasExpiredBatches = false, hasExpiringSoonBatches = false;
    const eligibleBatches: MedicineBatch[] = [];
    
    for (const batch of medBatches) {
      const qty = Math.max(0, batch.quantityRemaining);
      totalQuantity += qty;
      
      const urgency = getExpiryUrgency(batch.expiryDate, 60, referenceDate);
      const isPastExpiry = urgency === 'EXPIRED';
      
      if (isPastExpiry || batch.status === 'EXPIRED') {
        expiredQuantity += qty;
        hasExpiredBatches = true;
      } else if (batch.status === 'QUARANTINED') {
        quarantinedQuantity += qty;
      } else if (batch.status === 'ACTIVE' && qty > 0) {
        saleableQuantity += qty;
        totalSaleableCost += qty * batch.purchaseCost;
        eligibleBatches.push(batch);
        if (urgency === 'EXPIRING_SOON') hasExpiringSoonBatches = true;
      }
    }
    
    eligibleBatches.sort((a, b) => parseExpiryDate(a.expiryDate).getTime() - parseExpiryDate(b.expiryDate).getTime());
    
    const fefoEligibleBatch = eligibleBatches.length > 0 ? eligibleBatches[0] : null;
    const earliestExpiryDate = fefoEligibleBatch ? fefoEligibleBatch.expiryDate : null;
    const averageCost = saleableQuantity > 0 ? totalSaleableCost / saleableQuantity : 0;
    
    return {
      medicine: med,
      batches: medBatches,
      totalQuantity,
      saleableQuantity,
      expiredQuantity,
      quarantinedQuantity,
      isLowStock: saleableQuantity > 0 && saleableQuantity <= med.lowStockThreshold,
      isOutOfStock: saleableQuantity === 0,
      hasExpiredBatches,
      hasExpiringSoonBatches,
      earliestExpiryDate,
      fefoEligibleBatch,
      averageCost
    } as MedicineInventorySummary;
  });
  
  // Period keys
  const periodKeys = generatePeriodKeys(period);
  
  // Sales aggregation
  const salesByPeriod = aggregateSalesByPeriod(pharmacySales, period);
  
  // Profitability trend
  const profitabilityTrend: ProfitabilityTrend = {
    revenue: buildTimeSeries(periodKeys, salesByPeriod, period.granularity, 'revenue'),
    grossProfit: buildTimeSeries(periodKeys, salesByPeriod, period.granularity, 'profit'),
    grossMarginPct: periodKeys.map(key => {
      const data = salesByPeriod.get(key);
      const revenue = data?.revenue || 0;
      const profit = data?.profit || 0;
      return {
        period: key,
        label: getPeriodLabel(key, period.granularity),
        value: revenue > 0 ? (profit / revenue) * 100 : 0
      };
    }),
    discountPct: periodKeys.map(key => {
      const data = salesByPeriod.get(key);
      const revenue = data?.revenue || 0;
      const discount = data?.discount || 0;
      return {
        period: key,
        label: getPeriodLabel(key, period.granularity),
        value: revenue > 0 ? (discount / (revenue + discount)) * 100 : 0
      };
    })
  };
  
  // Totals
  const totalRevenue = pharmacySales.reduce((acc, s) => acc + s.sellingBill, 0);
  const totalCogs = pharmacySales.reduce((acc, s) => acc + s.estimatedCogs, 0);
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalDiscount = pharmacySales.reduce((acc, s) => acc + s.discount, 0);
  const avgDiscountPct = (totalRevenue + totalDiscount) > 0 ? (totalDiscount / (totalRevenue + totalDiscount)) * 100 : 0;
  
  // Tender breakdown
  const tenderBreakdown: TenderBreakdown = {
    CASH: { revenue: 0, count: 0, avgTicket: 0 },
    UPI: { revenue: 0, count: 0, avgTicket: 0 },
    CARD: { revenue: 0, count: 0, avgTicket: 0 }
  };
  
  for (const sale of pharmacySales) {
    const tb = tenderBreakdown[sale.tenderType];
    tb.revenue += sale.sellingBill;
    tb.count += 1;
  }
  tenderBreakdown.CASH.avgTicket = tenderBreakdown.CASH.count ? tenderBreakdown.CASH.revenue / tenderBreakdown.CASH.count : 0;
  tenderBreakdown.UPI.avgTicket = tenderBreakdown.UPI.count ? tenderBreakdown.UPI.revenue / tenderBreakdown.UPI.count : 0;
  tenderBreakdown.CARD.avgTicket = tenderBreakdown.CARD.count ? tenderBreakdown.CARD.revenue / tenderBreakdown.CARD.count : 0;
  
  // Category & SKU
  const categoryPerformance = calculateCategoryPerformance(pharmacyMedicines, pharmacySales, period);
  const skuPerformance = calculateSkuPerformance(pharmacyMedicines, pharmacyBatches, pharmacySales, computedSummaries, period);
  const topSkus = skuPerformance.slice(0, 10);
  const bottomSkus = skuPerformance.slice(-10).reverse();
  
  // Inventory efficiency
  const inventoryEfficiency = calculateInventoryEfficiency(computedSummaries, pharmacyMovements, pharmacySales, period);
  
  // Leakage
  const leakage = calculateLeakageAnalysis(pharmacyMovements, pharmacySales, pharmacyBatches, period);
  
  // Build base analytics for alerts
  const baseAnalytics = {
    pharmacy,
    period,
    generatedAt: new Date(),
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct,
    avgDiscountPct,
    tenderBreakdown,
    profitabilityTrend,
    categoryPerformance,
    topSkus,
    bottomSkus,
    inventoryEfficiency,
    leakage
  };
  
  const alerts = generateAlerts(baseAnalytics);
  
  return {
    ...baseAnalytics,
    alerts
  };
}