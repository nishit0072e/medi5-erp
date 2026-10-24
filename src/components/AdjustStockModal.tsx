import React, { useState } from 'react';
import { X, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { MedicineBatch, Medicine, AdjustStockInput } from '../types/inventory';

interface AdjustStockModalProps {
  batch: MedicineBatch | null;
  medicine: Medicine | null;
  isOpen: boolean;
  onClose: () => void;
  onAdjust: (input: AdjustStockInput) => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  batch,
  medicine,
  isOpen,
  onClose,
  onAdjust
}) => {
  const [movementType, setMovementType] = useState<'EXPIRED_WRITE_OFF' | 'DAMAGE_WRITE_OFF' | 'AUDIT_CORRECTION'>('EXPIRED_WRITE_OFF');
  const [unitsToDeduct, setUnitsToDeduct] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !batch || !medicine) return null;

  const currentRemaining = batch.quantityRemaining;
  const parsedUnits = parseInt(unitsToDeduct, 10);
  const validUnits = !isNaN(parsedUnits) ? parsedUnits : 0;
  
  // For write-offs, the change is negative
  const quantityChange = movementType === 'AUDIT_CORRECTION' 
    ? parsedUnits 
    : -Math.abs(validUnits);

  const resultingBalance = currentRemaining + (isNaN(quantityChange) ? 0 : quantityChange);
  const isNegative = resultingBalance < 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const rawVal = Number(unitsToDeduct);
      if (isNaN(rawVal) || !Number.isInteger(rawVal) || rawVal === 0) {
        throw new Error('Please enter a non-zero whole number (integer) adjustment quantity.');
      }
      if (resultingBalance < 0) {
        throw new Error(`Inventory invariant: Stock balance cannot become negative (${currentRemaining} -> ${resultingBalance}).`);
      }
      if (!reason.trim()) {
        throw new Error('Please provide an operational reason or reference for this adjustment.');
      }

      onAdjust({
        batchId: batch.id,
        movementType,
        quantityChange,
        reason: reason.trim()
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process adjustment.');
    }
  };

  const handleQuickAllWriteOff = () => {
    setUnitsToDeduct(currentRemaining.toString());
    setReason(`Full write-off of ${currentRemaining} ${medicine.unitLabel.split(' ')[0]} due to ${movementType === 'EXPIRED_WRITE_OFF' ? 'expiry' : 'damage'}`);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={20} color="#DC2626" />
            <h2 id="adjust-title" className="modal-title">Adjust / Write-Off Stock</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="form-error-alert" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Target Batch Info Card */}
          <div className="target-batch-summary">
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{medicine.name} {medicine.strength}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Batch: <code className="batch-no">{batch.batchNumber}</code> • Expiry: {batch.expiryDate}
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.82rem', fontWeight: 600 }}>
              Current Remaining: <span style={{ color: 'var(--primary-green)', fontWeight: 800 }}>{currentRemaining}</span> {medicine.unitLabel}
            </div>
          </div>

          {/* Action Type */}
          <div className="form-field">
            <label className="form-label">Adjustment Type *</label>
            <div className="form-radio-group">
              <label className={`radio-pill ${movementType === 'EXPIRED_WRITE_OFF' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="adjustmentType"
                  value="EXPIRED_WRITE_OFF"
                  checked={movementType === 'EXPIRED_WRITE_OFF'}
                  onChange={() => setMovementType('EXPIRED_WRITE_OFF')}
                />
                Expired Write-Off
              </label>

              <label className={`radio-pill ${movementType === 'DAMAGE_WRITE_OFF' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="adjustmentType"
                  value="DAMAGE_WRITE_OFF"
                  checked={movementType === 'DAMAGE_WRITE_OFF'}
                  onChange={() => setMovementType('DAMAGE_WRITE_OFF')}
                />
                Damaged / Broken
              </label>

              <label className={`radio-pill ${movementType === 'AUDIT_CORRECTION' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="adjustmentType"
                  value="AUDIT_CORRECTION"
                  checked={movementType === 'AUDIT_CORRECTION'}
                  onChange={() => setMovementType('AUDIT_CORRECTION')}
                />
                Audit Correction (±)
              </label>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="adjust-qty">
                {movementType === 'AUDIT_CORRECTION' ? 'Quantity Change (e.g. +5 or -2) *' : 'Units to Write-Off *'}
              </label>
              {currentRemaining > 0 && movementType !== 'AUDIT_CORRECTION' && (
                <button 
                  type="button" 
                  onClick={handleQuickAllWriteOff}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-green)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Write-off All ({currentRemaining})
                </button>
              )}
            </div>

            <input
              id="adjust-qty"
              type="number"
              className={`form-input ${isNegative ? 'input-error' : ''}`}
              placeholder={movementType === 'AUDIT_CORRECTION' ? 'e.g. -5 or 10' : 'e.g. 15'}
              value={unitsToDeduct}
              onChange={(e) => setUnitsToDeduct(e.target.value)}
              required
            />

            {/* Invariant Preview Banner */}
            <div className={`balance-preview-box ${isNegative ? 'danger' : 'normal'}`}>
              <span>Balance Before: <strong>{currentRemaining}</strong></span>
              <span>Net Change: <strong>{quantityChange > 0 ? `+${quantityChange}` : quantityChange}</strong></span>
              <span>Resulting Balance: <strong>{isNaN(resultingBalance) ? currentRemaining : resultingBalance}</strong></span>
            </div>
            {isNegative && (
              <span className="field-error-text">Negative inventory is strictly prohibited by database invariants.</span>
            )}
          </div>

          {/* Reason / Reference */}
          <div className="form-field">
            <label className="form-label" htmlFor="adjust-reason">Operational Reason / Reference *</label>
            <input
              id="adjust-reason"
              type="text"
              className="form-input"
              placeholder="e.g. Routine physical stock audit or Supplier return"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-danger-action"
              disabled={isNegative || isNaN(parsedUnits) || parsedUnits === 0}
            >
              <CheckCircle2 size={16} />
              <span>Record Immutable Movement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
