import React, { useState } from 'react';
import { X, IndianRupee, Calendar, Tag, CreditCard, CheckCircle2 } from 'lucide-react';
import { ExpenseCategory, ExpenseRecord } from '../../types/financials';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expenseData: {
    category: ExpenseCategory;
    title: string;
    amount: number;
    date: string;
    paymentMethod: ExpenseRecord['paymentMethod'];
    referenceNumber?: string;
    vendorName?: string;
    notes?: string;
  }) => void;
  initialData?: ExpenseRecord | null;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'RENT', label: 'Store Premises Rent' },
  { value: 'SALARIES', label: 'Staff Salaries & Payroll' },
  { value: 'ELECTRICITY', label: 'Electricity & Cold Storage Power' },
  { value: 'INTERNET', label: 'Internet & Cloud Sync' },
  { value: 'TRANSPORTATION', label: 'Depot Logistics & Transportation' },
  { value: 'SOFTWARE', label: 'Software & Subscriptions' },
  { value: 'MAINTENANCE', label: 'Equipment & AC Maintenance' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous / Consumables' }
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData
}) => {
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'RENT');
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState<string>(initialData ? initialData.amount.toString() : '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<ExpenseRecord['paymentMethod']>(initialData?.paymentMethod || 'UPI');
  const [vendorName, setVendorName] = useState(initialData?.vendorName || '');
  const [referenceNumber, setReferenceNumber] = useState(initialData?.referenceNumber || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a descriptive title for this expense.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive expense amount.');
      return;
    }

    if (!date) {
      setError('Please select the expense transaction date.');
      return;
    }

    onSubmit({
      category,
      title: title.trim(),
      amount: Math.round(numAmount * 100) / 100,
      date,
      paymentMethod,
      vendorName: vendorName.trim() || undefined,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
      <div className="modal-card" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div>
            <h3 id="expense-modal-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {initialData ? 'Edit Operational Expense' : 'Record Operational Expense'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Track store overheads, logistics, utility bills, and payroll for net profit calculations.
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

        {error && (
          <div className="settings-alert alert-error" style={{ margin: '12px 16px 0 16px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={14} /> Expense Category
              </label>
              <select 
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Expense Title / Description *</label>
              <input 
                type="text"
                className="form-input"
                placeholder="e.g. Monthly Commercial Store Rent, CESC Electricity Bill"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IndianRupee size={14} /> Amount (INR ₹) *
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Date *
                </label>
                <input 
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} /> Payment Method
                </label>
                <select 
                  className="form-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as ExpenseRecord['paymentMethod'])}
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CASH">Cash Drawer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="form-label">Vendor / Payee</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. Landlord, Electricity Board"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label">Reference / Bill / UTR #</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. UTR-99214, INV-8812"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Audit Notes</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Optional context"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
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
              <span>{initialData ? 'Update Expense' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
