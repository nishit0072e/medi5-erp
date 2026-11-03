import React, { useState, useMemo } from 'react';
import { 
  Percent, 
  AlertTriangle, 
  ShieldAlert, 
  Award
} from 'lucide-react';
import { SaleRecord, Medicine } from '../../types/inventory';
import { formatINR } from '../../utils/moneyUtils';

interface ProfitabilityIntelligenceProps {
  sales: SaleRecord[];
  medicines: Medicine[];
}

export const ProfitabilityIntelligence: React.FC<ProfitabilityIntelligenceProps> = ({
  sales,
  medicines
}) => {
  const [viewMetric, setViewMetric] = useState<'profit' | 'margin' | 'revenue'>('profit');

  // SKU Profitability Aggregation
  const skuMetrics = useMemo(() => {
    const map = new Map<string, {
      medicineId: string;
      medicineName: string;
      category: string;
      strength: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      discountGiven: number;
    }>();

    const medMap = new Map(medicines.map(m => [m.id, m]));

    for (const s of sales) {
      for (const item of s.items) {
        const med = medMap.get(item.medicineId);
        const name = med ? med.name : item.medicineName;
        const cat = med ? med.category : 'General';
        const str = med ? med.strength : item.strength;

        const existing = map.get(item.medicineId) || {
          medicineId: item.medicineId,
          medicineName: name,
          category: cat,
          strength: str,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          discountGiven: 0
        };

        const itemRev = item.lineTotalMrp * (s.totalBillMrp > 0 ? s.sellingBill / s.totalBillMrp : 1);
        const itemDiscount = item.lineTotalMrp - itemRev;

        existing.unitsSold += item.quantity;
        existing.revenue += itemRev;
        existing.cogs += item.lineTotalCogs;
        existing.discountGiven += itemDiscount;
        map.set(item.medicineId, existing);
      }
    }

    return Array.from(map.values()).map(sku => {
      const grossProfit = sku.revenue - sku.cogs;
      const marginPct = sku.revenue > 0 ? (grossProfit / sku.revenue) * 100 : 0;
      return {
        ...sku,
        grossProfit,
        marginPct
      };
    });
  }, [sales, medicines]);

  // Top SKUs sorted by selected metric
  const sortedSkus = useMemo(() => {
    return [...skuMetrics].sort((a, b) => {
      if (viewMetric === 'profit') return b.grossProfit - a.grossProfit;
      if (viewMetric === 'margin') return b.marginPct - a.marginPct;
      return b.revenue - a.revenue;
    });
  }, [skuMetrics, viewMetric]);

  // Top 5 Highest Margin SKUs
  const highestMarginSkus = useMemo(() => {
    return [...skuMetrics].filter(s => s.unitsSold > 0).sort((a, b) => b.marginPct - a.marginPct).slice(0, 5);
  }, [skuMetrics]);

  // Top 5 Lowest Margin SKUs
  const lowestMarginSkus = useMemo(() => {
    return [...skuMetrics].filter(s => s.unitsSold > 0).sort((a, b) => a.marginPct - b.marginPct).slice(0, 5);
  }, [skuMetrics]);

  // Total Discount Impact
  const discountImpact = useMemo(() => {
    const totalDiscount = sales.reduce((acc, s) => acc + s.discount, 0);
    const totalSelling = sales.reduce((acc, s) => acc + s.sellingBill, 0);
    const totalMrp = totalSelling + totalDiscount;
    const discountRate = totalMrp > 0 ? (totalDiscount / totalMrp) * 100 : 0;
    return {
      totalDiscount,
      discountRate
    };
  }, [sales]);

  // Below-cost sales alerts
  const belowCostSales = useMemo(() => {
    return sales.filter(s => s.sellingBill < s.estimatedCogs || s.confirmedBelowCost);
  }, [sales]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner: Discount Impact & Below-Cost Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Discount Impact Card */}
        <div className="analytics-card" style={{ padding: '16px 20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>PATIENT DISCOUNT IMPACT</span>
            <div className="fin-icon-badge bg-amber-50 text-amber-600">
              <Percent size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#D97706' }}>
            {formatINR(discountImpact.totalDiscount)}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
            Avg discount rate {discountImpact.discountRate.toFixed(1)}% offered to retain chronic patients.
          </p>
        </div>

        {/* Below-Cost Sales Interlock Status */}
        <div className="analytics-card" style={{ padding: '16px 20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>BELOW-COST SAFETY INTERLOCK</span>
            <div className={`fin-icon-badge ${belowCostSales.length > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: belowCostSales.length > 0 ? '#DC2626' : '#059669' }}>
            {belowCostSales.length === 0 ? '0 Incidents (100% Protected)' : `${belowCostSales.length} Deliberate Below-Cost Bills`}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
            {belowCostSales.length === 0 
              ? 'Zero unapproved below-cost sales. Profitability guardrails active.' 
              : 'Requires manager biometric / password confirmation before checkout.'}
          </p>
        </div>
      </div>

      {/* Highest vs Lowest Margin Medicines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Highest Margin */}
        <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 600, color: '#065F46', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} />
            Top 5 Highest Margin Medicines
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {highestMarginSkus.map((sku, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>{sku.medicineName} ({sku.strength})</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{sku.category} • {sku.unitsSold} units</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="margin-good" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                    {sku.marginPct.toFixed(1)}% Margin
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Profit: {formatINR(sku.grossProfit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lowest Margin */}
        <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 600, color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            Top 5 Lowest Margin Medicines
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lowestMarginSkus.map((sku, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>{sku.medicineName} ({sku.strength})</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{sku.category} • {sku.unitsSold} units</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="margin-warn" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                    {sku.marginPct.toFixed(1)}% Margin
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Profit: {formatINR(sku.grossProfit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Medicine Profitability Table with View Switcher */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#1E293B' }}>
              Medicine SKU Profitability Ledger
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
              Granular breakdown of billing revenues, COGS, and real gross profit per SKU.
            </p>
          </div>

          <div className="pill-group" style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`filter-pill-btn ${viewMetric === 'profit' ? 'active' : ''}`}
              onClick={() => setViewMetric('profit')}
            >
              Order by Gross Profit
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${viewMetric === 'margin' ? 'active' : ''}`}
              onClick={() => setViewMetric('margin')}
            >
              Order by Margin %
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${viewMetric === 'revenue' ? 'active' : ''}`}
              onClick={() => setViewMetric('revenue')}
            >
              Order by Revenue
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Medicine & Strength</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Category</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Units Sold</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Revenue (INR)</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>COGS (INR)</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Gross Profit</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {sortedSkus.map((sku, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px' }}>
                    <strong>{sku.medicineName}</strong> <span style={{ color: '#64748B', fontSize: '0.78rem' }}>({sku.strength})</span>
                  </td>
                  <td style={{ padding: '10px', color: '#475569' }}>{sku.category}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{sku.unitsSold}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(sku.revenue)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#64748B' }}>{formatINR(sku.cogs)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#059669' }}>
                    {formatINR(sku.grossProfit)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span className={sku.marginPct >= 25 ? 'margin-good' : sku.marginPct >= 15 ? 'margin-warn' : 'margin-bad'}>
                      {sku.marginPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
