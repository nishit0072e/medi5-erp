import React from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Building2, 
  Zap, 
  ShieldAlert,
  Layers,
  SlidersHorizontal
} from 'lucide-react';
import { MedicineInventorySummary, BatchRecord, Medicine } from '../types/inventory';
import { formatDisplayDate, formatExpiryBadge, formatINR } from '../utils/dateUtils';

interface MedicineCardProps {
  summary: MedicineInventorySummary;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenAdjust?: (batch: BatchRecord, medicine: Medicine) => void;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({
  summary,
  isExpanded,
  onToggleExpand,
  onOpenAdjust
}) => {
  const { medicine, batches, saleableQuantity, totalQuantity, expiredQuantity, isLowStock, isOutOfStock } = summary;

  return (
    <div className={`medicine-card ${isExpanded ? 'expanded' : ''}`}>
      {/* Clickable Card Header */}
      <div 
        className="card-header-clickable" 
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Toggle batches for ${medicine.name}`}
      >
        <div className="card-title-row">
          <div>
            <span className="medicine-name">{medicine.name}</span>
            <span className="medicine-strength">{medicine.strength}</span>
            <div className="generic-name">{medicine.genericName} • {medicine.dosageForm}</div>
            <span className="category-pill">{medicine.category}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>
              {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
            </span>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {/* Dynamic Stock & Status Row */}
        <div className="card-stats-row">
          <div className="stock-indicator">
            <span className="stock-count-label">Saleable Stock</span>
            <div className="stock-count-value">
              <span>{saleableQuantity}</span>
              <span className="stock-unit">{medicine.unitLabel}</span>
            </div>
          </div>

          <div className="status-badge-group">
            {/* Stock Level Badge */}
            {isOutOfStock ? (
              <span className="badge badge-red">
                <AlertTriangle size={11} /> Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="badge badge-amber" title={`Threshold: ${medicine.lowStockThreshold} ${medicine.unitLabel}`}>
                <AlertTriangle size={11} /> Low Stock (≤{medicine.lowStockThreshold})
              </span>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 size={11} /> In Stock
              </span>
            )}

            {/* Expiry Risk Badges */}
            {summary.hasExpiredBatches && (
              <span className="badge badge-red" title={`${expiredQuantity} units expired and segregated`}>
                <ShieldAlert size={11} /> {expiredQuantity} Expired
              </span>
            )}

            {!summary.hasExpiredBatches && summary.hasExpiringSoonBatches && (
              <span className="badge badge-amber" title="Batch expiring in less than 60 days">
                <Clock size={11} /> Expiring &lt;60d
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Physical Batches Ledger */}
      {isExpanded && (
        <div className="batch-expansion">
          <div className="batch-section-header">
            <div className="batch-section-title">
              <Layers size={14} />
              <span>Physical Batches ({batches.length})</span>
            </div>
            {summary.totalQuantity !== summary.saleableQuantity && (
              <span style={{ fontSize: '0.7rem', color: '#DC2626', fontWeight: 600 }}>
                *Total: {totalQuantity} ({totalQuantity - saleableQuantity} non-saleable)
              </span>
            )}
          </div>

          {/* FEFO Dispense Target Callout */}
          {summary.fefoEligibleBatch && batches.length > 1 && (
            <div className="fefo-banner">
              <Zap size={14} />
              <span>
                <strong>FEFO Rule:</strong> Batch <code>{summary.fefoEligibleBatch.batchNumber}</code> expires first ({formatDisplayDate(summary.fefoEligibleBatch.expiryDate)}) and is prioritized for sale.
              </span>
            </div>
          )}

          {/* Batches List */}
          {batches.map((batch) => {
            const expiryInfo = formatExpiryBadge(batch.expiryDate);
            const isFefoTarget = summary.fefoEligibleBatch?.id === batch.id;
            const isExpired = expiryInfo.urgency === 'EXPIRED' || batch.status === 'EXPIRED';

            return (
              <div 
                key={batch.id} 
                className={`batch-item-card ${isFefoTarget ? 'fefo-target' : ''} ${isExpired ? 'batch-expired' : ''}`}
              >
                <div className="batch-header-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="batch-no">{batch.batchNumber}</span>
                    {isFefoTarget && (
                      <span className="fefo-tag" title="First-Expiry, First-Out priority batch">
                        FEFO #1
                      </span>
                    )}
                  </div>

                  {/* Expiry Badge */}
                  <span className={`badge ${
                    isExpired ? 'badge-red' : 
                    expiryInfo.urgency === 'EXPIRING_SOON' ? 'badge-amber' : 
                    'badge-green'
                  }`}>
                    {expiryInfo.label}
                  </span>
                </div>

                {isExpired && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: '#DC2626', 
                    fontWeight: 600, 
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <ShieldAlert size={12} /> Excluded from saleable stock (Quarantined)
                  </div>
                )}

                <div className="batch-grid">
                  <div className="batch-field">
                    <span className="batch-field-label">Expiry Date</span>
                    <span className="batch-field-value">{formatDisplayDate(batch.expiryDate)}</span>
                  </div>

                  <div className="batch-field">
                    <span className="batch-field-label">Stock Remaining</span>
                    <span className="batch-field-value" style={{ color: isExpired ? '#991B1B' : 'var(--text-main)' }}>
                      {batch.quantityRemaining} / {batch.quantityReceived} {medicine.unitLabel.split(' ')[0]}
                    </span>
                  </div>

                  <div className="batch-field">
                    <span className="batch-field-label">Purchase Cost</span>
                    <span className="batch-field-value">{formatINR(batch.purchaseCost)}</span>
                  </div>

                  <div className="batch-field">
                    <span className="batch-field-label">MRP (Max Retail)</span>
                    <span className="batch-field-value">{formatINR(batch.mrp)}</span>
                  </div>
                </div>

                <div className="batch-footer-row">
                  <div className="batch-supplier">
                    <Building2 size={12} />
                    <span>Supplier: {batch.supplierName}</span>
                  </div>

                  {onOpenAdjust && (
                    <button
                      type="button"
                      className="btn-batch-adjust"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAdjust(batch, medicine);
                      }}
                      title={`Adjust or write off units from Batch ${batch.batchNumber}`}
                    >
                      <SlidersHorizontal size={11} />
                      <span>Adjust / Write-off</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
