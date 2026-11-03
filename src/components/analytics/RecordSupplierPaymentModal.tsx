import React, { useState } from 'react';
import { X, CheckCircle2, IndianRupee, Calendar, CreditCard, Building } from 'lucide-react';
import { SupplierPayable } from '../../types/financials';
import { formatINR } from '../../utils/moneyUtils';

interface RecordSupplierPaymentModalProps {
  isOpen: boolean;
  payable: SupplierPayable | null;
  onClose: () => void;
  onSubmit: (payableId: string, payment: {
    amount: number;
    paymentDate: string;
    method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
    reference?: string;
    recordedBy: string;
  }) => void;
  staffUser: string;
}

export const RecordSupplierPaymentModal: React.FC<RecordSupplierPaymentModalProps> = ({
  isOpen,
  payable,
  onClose,
  onSubmit,
  staffUser
}) => {
  if (!isOpen || !payable) return null;

  const remainingDue = Math.max(0, payable.totalAmount - payable.paidAmount);

  const [amount, setAmount] = useState<string>(remainingDue.toString());
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER');
  const [reference, setReference] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (numAmount > remainingDue + 0.01) {
      setError(`Payment cannot exceed the remaining due of ${formatINR(remainingDue)}.`);
      return;
    }

    onSubmit(payable.id, {
      amount: Math.round(numAmount * 100) / 100,
      paymentDate,
      method,
      reference: reference.trim() || undefined,
      recordedBy: staffUser
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="supplier-pay-modal-title">
      <div className="modal-card" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <h3 id="supplier-pay-modal-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Record Supplier Payment
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Record settlement against wholesaler invoice.
            </p>
          </div>
          <button 
            type="button" 
            className="icon-btn-ghost" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div style={{ margin: '12px 16px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Building size={16} className="text-primary-green" />
            <span style={{ fontWeight: 600, color: '#1E293B' }}>{payable.supplierName}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', color: '#64748B' }}>
            <div>Invoice #: <strong style={{ color: '#334155' }}>{payable.invoiceNumber}</strong></div>
            <div>Due Date: <strong style={{ color: '#334155' }}>{payable.dueDate}</strong></div>
            <div>Total Invoice: <strong style={{ color: '#334155' }}>{formatINR(payable.totalAmount)}</strong></div>
            <div>Remaining Due: <strong style={{ color: '#DC2626' }}>{formatINR(remainingDue)}</strong></div>
          </div>
        </div>

        {error && (
          <div className="settings-alert alert-error" style={{ margin: '0 16px 12px 16px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '0 16px 16px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IndianRupee size={14} /> Payment Amount (INR ₹) *
              </label>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                max={remainingDue}
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }}
                  onClick={() => setAmount(remainingDue.toString())}
                >
                  Pay Full ({formatINR(remainingDue)})
                </button>
                <button
                  type="button"
                  style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', background: '#FFF' }}
                  onClick={() => setAmount((Math.round((remainingDue / 2) * 100) / 100).toString())}
                >
                  Pay 50% ({formatINR(remainingDue / 2)})
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Payment Date *
                </label>
                <input 
                  type="date"
                  className="form-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} /> Settlement Mode
                </label>
                <select 
                  className="form-input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash Drawer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Bank UTR / Cheque # / Reference</label>
              <input 
                type="text"
                className="form-input"
                placeholder="e.g. UTR-AXIS-99120"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary-action"
            >
              <CheckCircle2 size={16} />
              <span>Record Settlement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

