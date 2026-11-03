import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  Layers
} from 'lucide-react';
import { SaleRecord, Medicine } from '../../types/inventory';
import { formatINR } from '../../utils/moneyUtils';

interface RevenueAnalyticsProps {
  sales: SaleRecord[];
  medicines: Medicine[];
}

export const RevenueAnalytics: React.FC<RevenueAnalyticsProps> = ({
  sales,
  medicines
}) => {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; revenue: number; cogs: number; profit: number } | null>(null);

  // Group sales by selected granularity
  const timeSeries = useMemo(() => {
    const buckets = new Map<string, { label: string; revenue: number; cogs: number; profit: number; count: number }>();

    // Sort ascending
    const sorted = [...sales].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const s of sorted) {
      const d = new Date(s.timestamp);
      let key = '';
      let label = '';

      if (granularity === 'daily') {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (granularity === 'weekly') {
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        key = `${d.getFullYear()}-W${week}`;
        label = `Wk ${week}, ${d.getFullYear()}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      const existing = buckets.get(key) || { label, revenue: 0, cogs: 0, profit: 0, count: 0 };
      existing.revenue += s.sellingBill;
      existing.cogs += s.estimatedCogs;
      existing.profit += s.estimatedGrossProfit;
      existing.count += 1;
      buckets.set(key, existing);
    }

    // Take recent 14 points if daily, 8 if weekly, 6 if monthly
    const limit = granularity === 'daily' ? 14 : granularity === 'weekly' ? 8 : 6;
    return Array.from(buckets.values()).slice(-limit);
  }, [sales, granularity]);

  // Payment Tender Breakdown
  const tenderStats = useMemo(() => {
    let cash = 0, upi = 0, card = 0;
    let cashCount = 0, upiCount = 0, cardCount = 0;

    for (const s of sales) {
      if (s.tenderType === 'CASH') { cash += s.sellingBill; cashCount++; }
      else if (s.tenderType === 'UPI') { upi += s.sellingBill; upiCount++; }
      else if (s.tenderType === 'CARD') { card += s.sellingBill; cardCount++; }
    }

    const total = cash + upi + card;
    return {
      total,
      CASH: { amount: cash, count: cashCount, pct: total > 0 ? (cash / total) * 100 : 0 },
      UPI: { amount: upi, count: upiCount, pct: total > 0 ? (upi / total) * 100 : 0 },
      CARD: { amount: card, count: cardCount, pct: total > 0 ? (card / total) * 100 : 0 }
    };
  }, [sales]);

  // Category Revenue Distribution
  const categoryStats = useMemo(() => {
    const catMap = new Map<string, { category: string; revenue: number; cogs: number; units: number }>();
    const medMap = new Map(medicines.map(m => [m.id, m]));

    for (const s of sales) {
      for (const item of s.items) {
        const med = medMap.get(item.medicineId);
        const cat = med?.category || 'General';
        const existing = catMap.get(cat) || { category: cat, revenue: 0, cogs: 0, units: 0 };
        
        // Allocate proportionally
        const ratio = s.totalBillMrp > 0 ? s.sellingBill / s.totalBillMrp : 1;
        existing.revenue += item.lineTotalMrp * ratio;
        existing.cogs += item.lineTotalCogs;
        existing.units += item.quantity;
        catMap.set(cat, existing);
      }
    }

    return Array.from(catMap.values())
      .map(c => ({
        ...c,
        profit: c.revenue - c.cogs,
        marginPct: c.revenue > 0 ? ((c.revenue - c.cogs) / c.revenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales, medicines]);

  const maxRevenue = Math.max(...timeSeries.map(p => p.revenue), 1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Time-Series Chart Header & Controls */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} className="text-primary-green" />
              Revenue vs. Cost of Goods Sold (COGS) Trends
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
              Compare gross billing revenue against wholesale inventory acquisition cost.
            </p>
          </div>

          <div className="pill-group" style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`filter-pill-btn ${granularity === 'daily' ? 'active' : ''}`}
              onClick={() => setGranularity('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${granularity === 'weekly' ? 'active' : ''}`}
              onClick={() => setGranularity('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${granularity === 'monthly' ? 'active' : ''}`}
              onClick={() => setGranularity('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Interactive Dual-Bar Chart Canvas */}
        <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingTop: '20px', paddingBottom: '30px', position: 'relative' }}>
          {timeSeries.map((point, index) => {
            const revHeightPct = (point.revenue / maxRevenue) * 100;
            const cogsHeightPct = (point.cogs / maxRevenue) * 100;

            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '80%', height: '100%' }}>
                  {/* Revenue Bar */}
                  <div
                    style={{
                      flex: 1,
                      height: `${Math.max(4, revHeightPct)}%`,
                      backgroundColor: '#13634B',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`Revenue: ${formatINR(point.revenue)}`}
                  />
                  {/* COGS Bar */}
                  <div
                    style={{
                      flex: 1,
                      height: `${Math.max(4, cogsHeightPct)}%`,
                      backgroundColor: '#94A3B8',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`COGS: ${formatINR(point.cogs)}`}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px', whiteSpace: 'nowrap' }}>
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Active Hover Tooltip Card */}
        <div style={{
          padding: '10px 14px',
          background: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ color: '#64748B' }}>
              Selected Period: <strong>{hoveredPoint ? hoveredPoint.label : 'Latest Period Overview'}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#13634B', borderRadius: '2px', display: 'inline-block' }} />
              Revenue: <strong>{formatINR(hoveredPoint ? hoveredPoint.revenue : timeSeries.reduce((a, b) => a + b.revenue, 0))}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#94A3B8', borderRadius: '2px', display: 'inline-block' }} />
              COGS: <strong>{formatINR(hoveredPoint ? hoveredPoint.cogs : timeSeries.reduce((a, b) => a + b.cogs, 0))}</strong>
            </span>
          </div>

          <span style={{ color: '#059669', fontWeight: 600 }}>
            Gross Profit: {formatINR(hoveredPoint ? hoveredPoint.profit : timeSeries.reduce((a, b) => a + b.profit, 0))}
          </span>
        </div>
      </div>

      {/* Grid: Payment Method Breakdown & Category Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Payment Tender Breakdown */}
        <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} className="text-primary-green" />
            Revenue by Tender / Payment Mode
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* UPI */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#1E293B' }}>UPI & Instant QR ({tenderStats.UPI.count} bills)</span>
                <span style={{ color: '#059669', fontWeight: 600 }}>{formatINR(tenderStats.UPI.amount)} ({tenderStats.UPI.pct.toFixed(1)}%)</span>
              </div>
              <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${tenderStats.UPI.pct}%`, height: '100%', background: '#10B981', borderRadius: '4px' }} />
              </div>
            </div>

            {/* CASH */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#1E293B' }}>Cash Drawer ({tenderStats.CASH.count} bills)</span>
                <span style={{ color: '#059669', fontWeight: 600 }}>{formatINR(tenderStats.CASH.amount)} ({tenderStats.CASH.pct.toFixed(1)}%)</span>
              </div>
              <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${tenderStats.CASH.pct}%`, height: '100%', background: '#3B82F6', borderRadius: '4px' }} />
              </div>
            </div>

            {/* CARD */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#1E293B' }}>Credit / Debit Card POS ({tenderStats.CARD.count} bills)</span>
                <span style={{ color: '#059669', fontWeight: 600 }}>{formatINR(tenderStats.CARD.amount)} ({tenderStats.CARD.pct.toFixed(1)}%)</span>
              </div>
              <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${tenderStats.CARD.pct}%`, height: '100%', background: '#8B5CF6', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Category Revenue Contribution */}
        <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} className="text-primary-green" />
            Top Revenue Categories
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categoryStats.slice(0, 5).map((cat, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>{cat.category}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{cat.units} units sold • Margin {cat.marginPct.toFixed(1)}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#13634B' }}>{formatINR(cat.revenue)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#059669' }}>Profit: {formatINR(cat.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
