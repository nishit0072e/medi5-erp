import React from 'react';
import { 
  TrendingUp, 
  IndianRupee, 
  Package, 
  CreditCard, 
  Building, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { FinancialExecutiveSummary, DateFilterPreset } from '../../types/financials';
import { formatINR } from '../../utils/moneyUtils';

interface FinancialOverviewProps {
  summary: FinancialExecutiveSummary;
  selectedPreset: DateFilterPreset;
  onSelectPreset: (preset: DateFilterPreset) => void;
  customStart?: string;
  customEnd?: string;
  onCustomDateChange?: (start: string, end: string) => void;
}

const PRESET_OPTIONS: { value: DateFilterPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' }
];

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({
  summary,
  selectedPreset,
  onSelectPreset,
  customStart,
  customEnd,
  onCustomDateChange
}) => {
  const isRevenueUp = summary.revenueGrowthPct >= 0;
  const isProfitUp = summary.grossProfitGrowthPct >= 0;
  const isProfitable = summary.netOperatingProfit >= 0;

  return (
    <div className="financial-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Date Filter Toolbar */}
      <div className="analytics-filter-bar" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} className="text-primary-green" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>Reporting Period:</span>
          <div className="pill-group" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {PRESET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`filter-pill-btn ${selectedPreset === opt.value ? 'active' : ''}`}
                onClick={() => onSelectPreset(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {selectedPreset === 'custom' && onCustomDateChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="date"
              className="form-input"
              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
              value={customStart || ''}
              onChange={(e) => onCustomDateChange(e.target.value, customEnd || '')}
            />
            <span style={{ color: '#64748B' }}>to</span>
            <input 
              type="date"
              className="form-input"
              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
              value={customEnd || ''}
              onChange={(e) => onCustomDateChange(customStart || '', e.target.value)}
            />
          </div>
        )}

        <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Comparing vs previous equivalent period</span>
        </div>
      </div>

      {/* Primary KPI Grid (8 Cards) */}
      <div className="fin-kpi-grid">
        {/* Total Revenue */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">TOTAL REVENUE</span>
            <div className="fin-icon-badge bg-emerald-50 text-emerald-600">
              <IndianRupee size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(summary.totalRevenue)}</div>
          <div className="fin-kpi-footer">
            <span className={`fin-trend-pill ${isRevenueUp ? 'trend-up' : 'trend-down'}`}>
              {isRevenueUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(summary.revenueGrowthPct)}%
            </span>
            <span className="fin-kpi-sub">vs prev ({formatINR(summary.prevTotalRevenue)})</span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">GROSS PROFIT</span>
            <div className="fin-icon-badge bg-blue-50 text-blue-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(summary.grossProfit)}</div>
          <div className="fin-kpi-footer">
            <span className={`fin-trend-pill ${isProfitUp ? 'trend-up' : 'trend-down'}`}>
              {isProfitUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(summary.grossProfitGrowthPct)}%
            </span>
            <span className="fin-kpi-sub">Margin: {summary.grossMarginPct}%</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">OPERATING EXPENSES</span>
            <div className="fin-icon-badge bg-amber-50 text-amber-600">
              <Wallet size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(summary.operatingExpenses)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">
              {summary.totalRevenue > 0 ? ((summary.operatingExpenses / summary.totalRevenue) * 100).toFixed(1) : 0}% of revenue
            </span>
          </div>
        </div>

        {/* Net Operating Profit */}
        <div className="fin-kpi-card" style={{ borderColor: summary.netOperatingProfit >= 0 ? '#10B981' : '#EF4444' }}>
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">NET OPERATING PROFIT</span>
            <div className={`fin-icon-badge ${summary.netOperatingProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: summary.netOperatingProfit >= 0 ? '#065F46' : '#991B1B' }}>
            {formatINR(summary.netOperatingProfit)}
          </div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub" style={{ fontWeight: 600 }}>
              Net Margin: {summary.netProfitMarginPct}%
            </span>
          </div>
        </div>

        {/* Inventory Investment */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">INVENTORY INVESTMENT</span>
            <div className="fin-icon-badge bg-teal-50 text-teal-600">
              <Package size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(summary.inventoryInvestmentCost)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">MRP: {formatINR(summary.inventoryMrpValuation)}</span>
          </div>
        </div>

        {/* Outstanding Supplier Payments */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">SUPPLIER PAYABLES</span>
            <div className="fin-icon-badge bg-purple-50 text-purple-600">
              <Building size={16} />
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: summary.outstandingSupplierPayables > 0 ? '#B45309' : '#059669' }}>
            {formatINR(summary.outstandingSupplierPayables)}
          </div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Wholesale dues pending</span>
          </div>
        </div>

        {/* Cash Collections */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">CASH DRAWER TENDER</span>
            <div className="fin-icon-badge bg-emerald-50 text-emerald-600">
              <IndianRupee size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(summary.cashCollection)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">
              {summary.totalRevenue > 0 ? ((summary.cashCollection / summary.totalRevenue) * 100).toFixed(1) : 0}% of collections
            </span>
          </div>
        </div>

        {/* UPI & Digital Collections */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">UPI & DIGITAL TENDER</span>
            <div className="fin-icon-badge bg-indigo-50 text-indigo-600">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(summary.upiCollection + summary.cardCollection)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Instant bank settlement</span>
          </div>
        </div>
      </div>

      {/* Financial Health & Profitability Diagnostic Banner */}
      <div style={{
        padding: '16px 20px',
        background: isProfitable ? '#F0FDF4' : '#FEF2F2',
        borderRadius: '12px',
        border: `1px solid ${isProfitable ? '#BBF7D0' : '#FECACA'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isProfitable ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isProfitable ? '#166534' : '#B91C1C', flexShrink: 0 }}>
            {isProfitable ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: isProfitable ? '#166534' : '#991B1B' }}>
              {isProfitable
                ? 'Business Financial Vitality: Strong & Profitable'
                : 'Business Financial Vitality: Operating at a Loss'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: isProfitable ? '#15803D' : '#B91C1C' }}>
              {isProfitable
                ? `Gross margin stands at healthy ${summary.grossMarginPct}%. Net operating profit is ${formatINR(summary.netOperatingProfit)} after covering all operating expenses.`
                : `Gross margin is ${summary.grossMarginPct}%, but operating expenses exceed gross profit. Net operating loss is ${formatINR(Math.abs(summary.netOperatingProfit))} for this period.`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#64748B' }}>COGS Ratio: </span>
            <strong style={{ color: '#1E293B' }}>
              {summary.totalRevenue > 0 ? ((summary.cogs / summary.totalRevenue) * 100).toFixed(1) : 0}%
            </strong>
          </div>
          <div>
            <span style={{ color: '#64748B' }}>Locked Gross Margin: </span>
            <strong style={{ color: '#059669' }}>{formatINR(summary.lockedMarginInInventory)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
