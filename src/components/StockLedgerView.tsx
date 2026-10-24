import React, { useState, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertTriangle, 
  ShieldAlert, 
  RefreshCw, 
  Search, 
  Layers, 
  Calendar,
  User,
  FileText,
  ShoppingCart
} from 'lucide-react';
import { StockMovement, MovementType } from '../types/inventory';
import { formatDisplayDate } from '../utils/dateUtils';

interface StockLedgerViewProps {
  movements: StockMovement[];
  onOpenReceiveModal: () => void;
}

export const StockLedgerView: React.FC<StockLedgerViewProps> = ({
  movements,
  onOpenReceiveModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MovementType | 'ALL'>('ALL');

  // Format full timestamp
  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const datePart = formatDisplayDate(isoString);
      const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${datePart}, ${timePart}`;
    } catch {
      return isoString;
    }
  };

  // Filtered movements
  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return movements.filter((m) => {
      // Type filter
      if (selectedType !== 'ALL' && m.movementType !== selectedType) {
        return false;
      }

      // Search query
      if (q) {
        const matchesMed = m.medicineName.toLowerCase().includes(q);
        const matchesBatch = m.batchNumber.toLowerCase().includes(q);
        const matchesReason = m.reason.toLowerCase().includes(q);
        const matchesRef = (m.referenceId || '').toLowerCase().includes(q);
        const matchesUser = m.performedBy.toLowerCase().includes(q);
        if (!matchesMed && !matchesBatch && !matchesReason && !matchesRef && !matchesUser) {
          return false;
        }
      }

      return true;
    });
  }, [movements, searchQuery, selectedType]);

  // Aggregate stats
  const stats = useMemo(() => {
    let receipts = 0;
    let dispensed = 0;
    let writeOffs = 0;
    let corrections = 0;

    movements.forEach((m) => {
      if (m.movementType === 'PURCHASE_RECEIPT') {
        receipts += m.quantityChange;
      } else if (m.movementType === 'SALE_DISPENSE') {
        dispensed += Math.abs(m.quantityChange);
      } else if (m.movementType === 'EXPIRED_WRITE_OFF' || m.movementType === 'DAMAGE_WRITE_OFF') {
        writeOffs += Math.abs(m.quantityChange);
      } else if (m.movementType === 'AUDIT_CORRECTION') {
        corrections += 1;
      }
    });

    return { receipts, dispensed, writeOffs, corrections, totalCount: movements.length };
  }, [movements]);

  const getMovementMeta = (type: MovementType) => {
    switch (type) {
      case 'PURCHASE_RECEIPT':
        return {
          label: 'Stock Received',
          icon: <ArrowDownLeft size={13} />,
          badgeClass: 'badge-green',
          sign: '+',
          color: 'var(--color-primary)'
        };
      case 'SALE_DISPENSE':
        return {
          label: 'Counter Dispense',
          icon: <ShoppingCart size={13} />,
          badgeClass: 'badge-purple',
          sign: '',
          color: '#7C3AED'
        };
      case 'EXPIRED_WRITE_OFF':
        return {
          label: 'Expired Write-Off',
          icon: <ShieldAlert size={13} />,
          badgeClass: 'badge-red',
          sign: '',
          color: '#DC2626'
        };
      case 'DAMAGE_WRITE_OFF':
        return {
          label: 'Damage Write-Off',
          icon: <AlertTriangle size={13} />,
          badgeClass: 'badge-amber',
          sign: '',
          color: '#D97706'
        };
      case 'AUDIT_CORRECTION':
        return {
          label: 'Audit Correction',
          icon: <RefreshCw size={13} />,
          badgeClass: 'badge-blue',
          sign: '',
          color: '#2563EB'
        };
      default:
        return {
          label: type,
          icon: <ArrowUpRight size={13} />,
          badgeClass: 'badge-gray',
          sign: '',
          color: 'var(--text-light)'
        };
    }
  };

  return (
    <div className="stock-ledger-container" role="region" aria-label="Stock Movement Ledger">
      {/* Ledger Stats Summary Bar */}
      <div className="ledger-summary-strip">
        <div className="ledger-stat-item">
          <span className="ledger-stat-value">{stats.totalCount}</span>
          <span className="ledger-stat-label">Total Entries</span>
        </div>
        <div className="ledger-stat-item">
          <span className="ledger-stat-value" style={{ color: 'var(--color-primary)' }}>+{stats.receipts}</span>
          <span className="ledger-stat-label">Received</span>
        </div>
        <div className="ledger-stat-item">
          <span className="ledger-stat-value" style={{ color: '#7C3AED' }}>-{stats.dispensed}</span>
          <span className="ledger-stat-label">Dispensed</span>
        </div>
        <div className="ledger-stat-item">
          <span className="ledger-stat-value" style={{ color: '#DC2626' }}>-{stats.writeOffs}</span>
          <span className="ledger-stat-label">Written Off</span>
        </div>
        <div className="ledger-stat-item">
          <span className="ledger-stat-value" style={{ color: '#2563EB' }}>{stats.corrections}</span>
          <span className="ledger-stat-label">Audits</span>
        </div>
      </div>

      {/* Ledger Search & Type Filters */}
      <div className="ledger-controls">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search ledger by medicine, batch, or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search ledger transactions"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="ledger-filter-pills" role="tablist" aria-label="Movement type filters">
          <button
            type="button"
            className={`filter-pill ${selectedType === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedType('ALL')}
          >
            All Types ({movements.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedType === 'PURCHASE_RECEIPT' ? 'active' : ''}`}
            onClick={() => setSelectedType('PURCHASE_RECEIPT')}
          >
            Receipts
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedType === 'SALE_DISPENSE' ? 'active' : ''}`}
            onClick={() => setSelectedType('SALE_DISPENSE')}
          >
            Dispensed
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedType === 'EXPIRED_WRITE_OFF' ? 'active' : ''}`}
            onClick={() => setSelectedType('EXPIRED_WRITE_OFF')}
          >
            Expiry
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedType === 'DAMAGE_WRITE_OFF' ? 'active' : ''}`}
            onClick={() => setSelectedType('DAMAGE_WRITE_OFF')}
          >
            Damage
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedType === 'AUDIT_CORRECTION' ? 'active' : ''}`}
            onClick={() => setSelectedType('AUDIT_CORRECTION')}
          >
            Audit
          </button>
        </div>
      </div>

      {/* Invariant Rule Banner */}
      <div className="ledger-rule-banner">
        <Layers size={13} />
        <span>
          <strong>Auditable Append-Only Ledger:</strong> Every movement preserves the invariant{' '}
          <code>balance_after = balance_before + qty_change</code>. Old records are never edited.
        </span>
      </div>

      {/* Movements Timeline / Cards */}
      {filteredMovements.length > 0 ? (
        <div className="ledger-list">
          {filteredMovements.map((m) => {
            const meta = getMovementMeta(m.movementType);
            const isPositive = m.quantityChange > 0;
            const isZero = m.quantityChange === 0;

            return (
              <div key={m.id} className="ledger-item-card">
                <div className="ledger-item-top">
                  <div>
                    <span className="ledger-med-name">{m.medicineName}</span>
                    <span className="ledger-batch-tag">Batch {m.batchNumber}</span>
                  </div>

                  <span className={`badge ${meta.badgeClass}`}>
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>
                </div>

                <div className="ledger-item-metrics">
                  <div className="ledger-qty-change">
                    <span className="metric-label">Quantity Change</span>
                    <span 
                      className="metric-value-large"
                      style={{ 
                        color: isPositive ? 'var(--color-primary)' : isZero ? 'var(--text-light)' : '#DC2626' 
                      }}
                    >
                      {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                    </span>
                  </div>

                  <div className="ledger-balance-progression">
                    <span className="metric-label">Batch Balance (Before ➔ After)</span>
                    <div className="balance-flow">
                      <span className="balance-box">{m.balanceBefore}</span>
                      <span className="flow-arrow">➔</span>
                      <span className="balance-box balance-after">{m.balanceAfter}</span>
                    </div>
                  </div>
                </div>

                <div className="ledger-item-meta-footer">
                  <div className="meta-info-item">
                    <Calendar size={12} />
                    <span>{formatTimestamp(m.timestamp)}</span>
                  </div>

                  {m.referenceId && (
                    <div className="meta-info-item">
                      <FileText size={12} />
                      <span>Ref: {m.referenceId}</span>
                    </div>
                  )}

                  <div className="meta-info-item">
                    <User size={12} />
                    <span>{m.performedBy}</span>
                  </div>
                </div>

                {m.reason && (
                  <div className="ledger-item-reason">
                    <strong>Note:</strong> {m.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state-card" style={{ marginTop: '16px' }}>
          <p className="empty-title">No stock movements found</p>
          <p className="empty-desc">
            {searchQuery || selectedType !== 'ALL'
              ? 'No ledger movements match the current search or movement filter.'
              : 'No stock movements have been recorded yet.'}
          </p>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={onOpenReceiveModal}
            style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowDownLeft size={16} />
            Receive Stock
          </button>
        </div>
      )}
    </div>
  );
};
