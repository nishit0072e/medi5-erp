import React, { useState, useMemo } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Layers, 
  ChevronRight, 
  Info,
  IndianRupee
} from 'lucide-react';
import { Medicine, MedicineBatch, SaleRecord } from '../../types/inventory';
import { InventoryValuationBreakdown } from '../../types/financials';
import { formatINR } from '../../utils/moneyUtils';
import { calculateInventoryFinancialHealth } from '../../utils/financialCalculations';
import { parseExpiryDate } from '../../utils/dateUtils';

interface InventoryFinancialHealthProps {
  medicines: Medicine[];
  batches: MedicineBatch[];
  sales: SaleRecord[];
}

export const InventoryFinancialHealth: React.FC<InventoryFinancialHealthProps> = ({
  medicines,
  batches,
  sales
}) => {
  const [selectedDrillDown, setSelectedDrillDown] = useState<'all' | 'nearExpiry' | 'expired' | 'deadStock'>('all');
  const [inspectingBatch, setInspectingBatch] = useState<MedicineBatch | null>(null);

  const valuation: InventoryValuationBreakdown = useMemo(() => {
    return calculateInventoryFinancialHealth(medicines, batches, sales);
  }, [medicines, batches, sales]);

  const medMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  // Filtered Batches for Drill-down
  const drillDownBatches = useMemo(() => {
    const today = new Date();
    return batches.filter(b => {
      const qty = Math.max(0, b.quantityRemaining);
      if (qty === 0) return false;

      if (selectedDrillDown === 'all') return true;

      const expiry = parseExpiryDate(b.expiryDate);
      const diffMs = expiry ? expiry.getTime() - today.getTime() : 0;
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (selectedDrillDown === 'expired') {
        return daysLeft <= 0 || b.status === 'EXPIRED';
      }
      if (selectedDrillDown === 'nearExpiry') {
        return daysLeft > 0 && daysLeft <= 60;
      }
      if (selectedDrillDown === 'deadStock') {
        // No sales in last 30 days
        const hasSold = sales.some(s => s.items.some(item => item.medicineId === b.medicineId));
        return !hasSold;
      }
      return true;
    });
  }, [batches, selectedDrillDown, sales]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Disclaimer Alert */}
      <div style={{
        padding: '12px 16px',
        background: '#EFF6FF',
        borderRadius: '10px',
        border: '1px solid #BFDBFE',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.82rem',
        color: '#1E40AF'
      }}>
        <Info size={16} />
        <span>
          <strong>Inventory Accounting Principle:</strong> Inventory valuations represent capital deployed at purchase cost and potential maximum gross margin at current MRP. Potential margin is unrealized until sold.
        </span>
      </div>

      {/* Primary Valuation Cards (4 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
        {/* Total Cost Valuation */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">PURCHASE COST VALUATION</span>
            <div className="fin-icon-badge bg-emerald-50 text-emerald-600">
              <IndianRupee size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(valuation.totalPurchaseCost)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Total capital tied up in physical stock</span>
          </div>
        </div>

        {/* Total MRP Valuation */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">TOTAL MRP VALUATION</span>
            <div className="fin-icon-badge bg-blue-50 text-blue-600">
              <Package size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(valuation.totalMrpValuation)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Maximum gross billing potential</span>
          </div>
        </div>

        {/* Locked Gross Margin */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">LOCKED GROSS MARGIN</span>
            <div className="fin-icon-badge bg-teal-50 text-teal-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: '#059669' }}>
            {formatINR(valuation.potentialGrossProfit)}
          </div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Unrealized Margin: {valuation.potentialGrossMarginPct}%</span>
          </div>
        </div>

        {/* Turnover & DIO */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">TURNOVER & DAYS OF STOCK</span>
            <div className="fin-icon-badge bg-purple-50 text-purple-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{valuation.turnoverRatio}x / yr</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Days Inventory Outstanding (DIO): {valuation.daysInventoryOutstanding}d</span>
          </div>
        </div>
      </div>

      {/* At-Risk Capital Section (Expired, Near-Expiry, Dead Stock) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* Near-Expiry Risk */}
        <div 
          className="analytics-card" 
          style={{ 
            padding: '16px', 
            background: selectedDrillDown === 'nearExpiry' ? '#FFFBEB' : '#FFF', 
            borderRadius: '10px', 
            border: `1px solid ${selectedDrillDown === 'nearExpiry' ? '#F59E0B' : 'var(--border-subtle)'}`,
            cursor: 'pointer'
          }}
          onClick={() => setSelectedDrillDown(selectedDrillDown === 'nearExpiry' ? 'all' : 'nearExpiry')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} />
              Near-Expiry Capital At Risk (≤60 Days)
            </span>
            <ChevronRight size={16} color="#B45309" />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#B45309', marginTop: '6px' }}>
            {formatINR(valuation.nearExpiryStockCost)}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
            Click to isolate batches needing FEFO liquidation or supplier return.
          </p>
        </div>

        {/* Expired Stock Loss */}
        <div 
          className="analytics-card" 
          style={{ 
            padding: '16px', 
            background: selectedDrillDown === 'expired' ? '#FEF2F2' : '#FFF', 
            borderRadius: '10px', 
            border: `1px solid ${selectedDrillDown === 'expired' ? '#EF4444' : 'var(--border-subtle)'}`,
            cursor: 'pointer'
          }}
          onClick={() => setSelectedDrillDown(selectedDrillDown === 'expired' ? 'all' : 'expired')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} />
              Expired Stock Cost (Write-off)
            </span>
            <ChevronRight size={16} color="#B91C1C" />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#B91C1C', marginTop: '6px' }}>
            {formatINR(valuation.expiredStockCost)}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
            Non-dispensable batches locked in quarantine.
          </p>
        </div>

        {/* Dead Stock Investment */}
        <div 
          className="analytics-card" 
          style={{ 
            padding: '16px', 
            background: selectedDrillDown === 'deadStock' ? '#F8FAFC' : '#FFF', 
            borderRadius: '10px', 
            border: `1px solid ${selectedDrillDown === 'deadStock' ? '#64748B' : 'var(--border-subtle)'}`,
            cursor: 'pointer'
          }}
          onClick={() => setSelectedDrillDown(selectedDrillDown === 'deadStock' ? 'all' : 'deadStock')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} />
              Dead Stock / Slow Movers {'>'}90d)
            </span>
            <ChevronRight size={16} color="#334155" />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#334155', marginTop: '6px' }}>
            {formatINR(valuation.deadStockCost)}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
            Capital tied in dormant inventory with zero recent retail dispenses.
          </p>
        </div>
      </div>

      {/* Batch-wise Valuation Drill-Down Ledger */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#1E293B' }}>
              Batch-Wise Inventory Capital Drill-Down
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
              Showing {drillDownBatches.length} batches • View: <strong>{selectedDrillDown.toUpperCase()}</strong>
            </p>
          </div>

          <div className="pill-group" style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`filter-pill-btn ${selectedDrillDown === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDrillDown('all')}
            >
              All Active Batches
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${selectedDrillDown === 'nearExpiry' ? 'active' : ''}`}
              onClick={() => setSelectedDrillDown('nearExpiry')}
            >
              Near-Expiry Only
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${selectedDrillDown === 'expired' ? 'active' : ''}`}
              onClick={() => setSelectedDrillDown('expired')}
            >
              Expired Only
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${selectedDrillDown === 'deadStock' ? 'active' : ''}`}
              onClick={() => setSelectedDrillDown('deadStock')}
            >
              Dead Stock
            </button>
          </div>
        </div>

        {/* Drill-down Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Medicine & Generic</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Batch #</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Expiry</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Qty In Stock</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Purchase Cost</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Cost Valuation</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>MRP Valuation</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Locked Profit</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {drillDownBatches.map(batch => {
                const med = medMap.get(batch.medicineId);
                const costVal = batch.purchaseCost * batch.quantityRemaining;
                const mrpVal = batch.mrp * batch.quantityRemaining;
                const lockedProfit = mrpVal - costVal;

                return (
                  <tr key={batch.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px' }}>
                      <strong>{med?.name || batch.medicineId}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{med?.genericName} • {med?.strength}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{batch.batchNumber}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#475569' }}>{batch.expiryDate}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{batch.quantityRemaining}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(batch.purchaseCost)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1E293B' }}>
                      {formatINR(costVal)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(mrpVal)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 600 }}>
                      {formatINR(lockedProfit)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer' }}
                        onClick={() => setInspectingBatch(batch)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Details Drawer / Modal */}
      {inspectingBatch && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '500px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#1E293B' }}>
              Batch Financial Details: {inspectingBatch.batchNumber}
            </h4>
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569' }}>
              <div>Medicine: <strong>{medMap.get(inspectingBatch.medicineId)?.name}</strong></div>
              <div>Expiry Date: <strong>{inspectingBatch.expiryDate}</strong></div>
              <div>Stock Remaining: <strong>{inspectingBatch.quantityRemaining} units</strong></div>
              <div>Unit Purchase Cost: <strong>{formatINR(inspectingBatch.purchaseCost)}</strong></div>
              <div>Unit Retail MRP: <strong>{formatINR(inspectingBatch.mrp)}</strong></div>
              <div>Total Capital Locked: <strong>{formatINR(inspectingBatch.purchaseCost * inspectingBatch.quantityRemaining)}</strong></div>
              <div>Potential Gross Margin: <strong>{formatINR((inspectingBatch.mrp - inspectingBatch.purchaseCost) * inspectingBatch.quantityRemaining)}</strong></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                type="button" 
                className="btn-primary-action"
                onClick={() => setInspectingBatch(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
