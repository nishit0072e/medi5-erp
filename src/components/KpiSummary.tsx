import React from 'react';
import { Package, AlertTriangle, Clock, Layers } from 'lucide-react';
import { InventoryKpis } from '../utils/inventoryCalculations';

interface KpiSummaryProps {
  kpis: InventoryKpis;
  activeFilter: string;
  onFilterClick: (filter: string) => void;
}

export const KpiSummary: React.FC<KpiSummaryProps> = ({ kpis, onFilterClick }) => {
  return (
    <section className="kpi-section" aria-label="Inventory Overview Metrics">
      <div className="kpi-grid">
        <div 
          className="kpi-card" 
          onClick={() => onFilterClick('ALL')}
          role="button"
          tabIndex={0}
          title="Total unique medicines tracked"
        >
          <div className="kpi-label">
            <Layers size={13} />
            <span>Medicines</span>
          </div>
          <div className="kpi-value">{kpis.totalMedicines}</div>
          <div className="kpi-subtext">{kpis.totalBatches} active batches</div>
        </div>

        <div 
          className="kpi-card success"
          onClick={() => onFilterClick('ALL')}
          role="button"
          tabIndex={0}
          title="Total saleable inventory units"
        >
          <div className="kpi-label">
            <Package size={13} />
            <span>Saleable Units</span>
          </div>
          <div className="kpi-value">{kpis.totalSellableUnits}</div>
          <div className="kpi-subtext">Eligible for POS</div>
        </div>

        <div 
          className={`kpi-card ${kpis.lowStockCount > 0 ? 'warning' : ''}`}
          onClick={() => onFilterClick('LOW_STOCK')}
          role="button"
          tabIndex={0}
          title="Medicines at or below threshold"
        >
          <div className="kpi-label">
            <AlertTriangle size={13} />
            <span>Low Stock</span>
          </div>
          <div className="kpi-value">{kpis.lowStockCount}</div>
          <div className="kpi-subtext">Needs reorder</div>
        </div>

        <div 
          className={`kpi-card ${kpis.expiredBatchesCount > 0 ? 'danger' : kpis.expiringSoonCount > 0 ? 'warning' : ''}`}
          onClick={() => onFilterClick('EXPIRING')}
          role="button"
          tabIndex={0}
          title="Batches expired or near expiry"
        >
          <div className="kpi-label">
            <Clock size={13} />
            <span>Expiry Risk</span>
          </div>
          <div className="kpi-value">
            {kpis.expiredBatchesCount > 0 ? `${kpis.expiredBatchesCount} Exp` : `${kpis.expiringSoonCount} Soon`}
          </div>
          <div className="kpi-subtext">
            {kpis.expiredBatchesCount > 0 ? 'Excluded from sale' : '< 60 days left'}
          </div>
        </div>
      </div>
    </section>
  );
};
