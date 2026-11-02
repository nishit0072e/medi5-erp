/**
 * Medi5 ERP - Financial Health & Leakage Analytics Types
 * 
 * Pharmacy-level analytics for revenue, profitability, inventory efficiency,
 * and leakage detection. Designed for Phase 4 Analytics module.
 */

import { Medicine, MedicineBatch, SaleRecord, StockMovement } from './inventory';
import { PharmacyProfile } from './pharmacy';

/** Time granularity for trend analysis */
export type AnalyticsGranularity = 'day' | 'week' | 'month';

/** Period for analytics queries */
export interface AnalyticsPeriod {
  from: Date;
  to: Date;
  granularity: AnalyticsGranularity;
}

/** Revenue breakdown by tender type */
export interface TenderBreakdown {
  CASH: { revenue: number; count: number; avgTicket: number };
  UPI: { revenue: number; count: number; avgTicket: number };
  CARD: { revenue: number; count: number; avgTicket: number };
}

/** Category performance metrics */
export interface CategoryPerformance {
  category: string;
  medicineCount: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  unitsSold: number;
  avgSellingPrice: number;
}

/** Individual SKU performance */
export interface SkuPerformance {
  medicineId: string;
  medicineName: string;
  genericName: string;
  strength: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  avgDiscountPct: number;
  stockTurnover: number; // units sold / avg inventory
  daysOfStock: number;   // saleable qty / (units sold per day)
  isFastMover: boolean;
  isSlowMover: boolean;
}

/** Inventory efficiency metrics */
export interface InventoryEfficiency {
  inventoryTurnoverRatio: number;        // COGS / avg inventory value
  daysInventoryOutstanding: number;      // avg inventory / (COGS / days)
  carryingCostPct: number;               // inventory value * carrying rate / revenue
  deadStockValue: number;                // expired + quarantined stock at cost
  deadStockPct: number;                  // dead stock value / total inventory value
  stockoutIncidents: number;             // count of medicines that went OOS in period
  stockoutRate: number;                  // stockout incidents / total medicines
  avgStockoutDurationDays: number;       // average days OOS before replenishment
  reorderAccuracy: number;               // % of reorders that prevented stockout
}

/** Leakage / loss detection */
export interface LeakageAnalysis {
  totalWriteOffs: number;                // INR value of all write-offs
  expiredWriteOffs: number;
  damageWriteOffs: number;
  auditCorrections: number;
  writeOffCount: number;
  writeOffPctOfCogs: number;             // write-offs / COGS
  belowCostSales: number;                // INR value sold below cost
  belowCostCount: number;
  belowCostPctOfRevenue: number;
  customerReturns: number;
  supplierReturns: number;
  returnRate: number;                    // return value / revenue
  shrinkageEstimate: number;             // estimated unaccounted loss
  leakageScore: number;                  // 0-100, higher = more leakage
}

/** Time-series data point */
export interface TimeSeriesPoint {
  period: string;      // ISO date or "YYYY-WW" or "YYYY-MM"
  label: string;       // Human-readable label
  value: number;
  compareValue?: number; // Previous period for comparison
}

/** Revenue & profit trend */
export interface ProfitabilityTrend {
  revenue: TimeSeriesPoint[];
  grossProfit: TimeSeriesPoint[];
  grossMarginPct: TimeSeriesPoint[];
  discountPct: TimeSeriesPoint[];
}

/** Complete analytics snapshot for a pharmacy */
export interface PharmacyAnalytics {
  pharmacy: PharmacyProfile;
  period: AnalyticsPeriod;
  generatedAt: Date;
  
  // Revenue & Profit
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  avgDiscountPct: number;
  tenderBreakdown: TenderBreakdown;
  
  // Trends
  profitabilityTrend: ProfitabilityTrend;
  
  // Category & SKU
  categoryPerformance: CategoryPerformance[];
  topSkus: SkuPerformance[];      // Top 10 by revenue
  bottomSkus: SkuPerformance[];   // Bottom 10 by margin
  
  // Inventory Efficiency
  inventoryEfficiency: InventoryEfficiency;
  
  // Leakage
  leakage: LeakageAnalysis;
  
  // Alerts
  alerts: AnalyticsAlert[];
}

/** Actionable analytics alert */
export interface AnalyticsAlert {
  type: 'STOCKOUT_RISK' | 'HIGH_WRITE_OFF' | 'LOW_MARGIN' | 'DEAD_STOCK' | 'BELOW_COST_SALES' | 'SLOW_MOVER';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  medicineId?: string;
  category?: string;
  value: number;
  threshold: number;
  action?: string;
}

/** Input for analytics computation */
export interface AnalyticsInput {
  pharmacy: PharmacyProfile;
  medicines: Medicine[];
  batches: MedicineBatch[];
  sales: SaleRecord[];
  movements: StockMovement[];
  period: AnalyticsPeriod;
  referenceDate: Date;
}

/** Carrying cost rate (annual) for inventory */
export const CARRYING_COST_RATE = 0.18; // 18% per annum

/** Thresholds for alerts */
export const ANALYTICS_THRESHOLDS = {
  LOW_MARGIN_PCT: 15,           // Gross margin below 15%
  HIGH_WRITE_OFF_PCT: 5,        // Write-offs > 5% of COGS
  DEAD_STOCK_PCT: 10,           // Dead stock > 10% of inventory value
  STOCKOUT_RATE: 0.15,          // > 15% medicines stocked out
  BELOW_COST_PCT: 2,            // > 2% revenue from below-cost sales
  SLOW_MOVER_DAYS: 90,          // > 90 days of stock
  FAST_MOVER_TURNOVER: 12,      // Turnover > 12x/year
  REORDER_ACCURACY: 0.8,        // < 80% reorder accuracy
} as const;