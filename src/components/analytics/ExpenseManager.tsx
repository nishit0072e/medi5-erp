import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  IndianRupee, 
  PieChart, 
  Search
} from 'lucide-react';
import { ExpenseRecord, ExpenseCategory } from '../../types/financials';
import { formatINR } from '../../utils/moneyUtils';
import { AddExpenseModal } from './AddExpenseModal';

interface ExpenseManagerProps {
  expenses: ExpenseRecord[];
  onAddExpense: (expense: {
    category: ExpenseCategory;
    title: string;
    amount: number;
    date: string;
    paymentMethod: ExpenseRecord['paymentMethod'];
    referenceNumber?: string;
    vendorName?: string;
    notes?: string;
  }) => void;
  onUpdateExpense: (expenseId: string, updates: Partial<ExpenseRecord>) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: 'Store Rent',
  SALARIES: 'Payroll & Salaries',
  ELECTRICITY: 'Electricity & Power',
  INTERNET: 'Internet & Cloud',
  TRANSPORTATION: 'Logistics & Transit',
  SOFTWARE: 'Software & Tools',
  MAINTENANCE: 'Store Maintenance',
  MISCELLANEOUS: 'Miscellaneous'
};

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Category Breakdown
  const categoryStats = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    let total = 0;

    for (const e of expenses) {
      const cur = map.get(e.category) || 0;
      map.set(e.category, cur + e.amount);
      total += e.amount;
    }

    return Array.from(map.entries()).map(([cat, amount]) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  // Filtered expense list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesCat = categoryFilter === 'ALL' || e.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        e.title.toLowerCase().includes(q) || 
        (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [expenses, categoryFilter, searchQuery]);

  const handleDeleteConfirm = (id: string) => {
    onDeleteExpense(id);
    setDeletingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar & Summary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '16px 20px',
        background: '#FFF',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IndianRupee size={20} className="text-primary-green" />
            Operational Expense (OpEx) Management
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
            Total Recorded Overheads: <strong style={{ color: '#065F46' }}>{formatINR(totalExpenseAmount)}</strong> across {expenses.length} entries
          </p>
        </div>

        <button
          type="button"
          className="btn-primary-action"
          onClick={() => { setEditingExpense(null); setIsAddModalOpen(true); }}
        >
          <Plus size={16} />
          <span>Record New Expense</span>
        </button>
      </div>

      {/* Expense Distribution Cards by Category */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={16} className="text-primary-green" />
          Expense Distribution by Category
        </h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {categoryStats.map(stat => (
            <div 
              key={stat.category}
              style={{
                padding: '12px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                cursor: 'pointer'
              }}
              onClick={() => setCategoryFilter(categoryFilter === stat.category ? 'ALL' : stat.category)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748B' }}>
                <span>{stat.label}</span>
                <span>{stat.pct.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1E293B', marginTop: '4px' }}>
                {formatINR(stat.amount)}
              </div>
              <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${stat.pct}%`, height: '100%', background: '#13634B' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expense Ledger Table */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px', maxWidth: '400px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search title, vendor, reference..."
                className="form-input"
                style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="pill-group" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`filter-pill-btn ${categoryFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('ALL')}
            >
              All Categories
            </button>
            {categoryStats.slice(0, 4).map(stat => (
              <button
                key={stat.category}
                type="button"
                className={`filter-pill-btn ${categoryFilter === stat.category ? 'active' : ''}`}
                onClick={() => setCategoryFilter(stat.category)}
              >
                {stat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Title & Description</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Vendor</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Amount (INR)</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Payment Mode</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                    No expenses match the current filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(expense => (
                  <tr key={expense.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#475569' }}>
                      {expense.date}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#334155', fontWeight: 600 }}>
                        {CATEGORY_LABELS[expense.category] || expense.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{expense.title}</div>
                      {expense.referenceNumber && (
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Ref: {expense.referenceNumber}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px', color: '#475569' }}>{expense.vendorName || '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1E293B' }}>
                      {formatINR(expense.amount)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#ECFDF5', color: '#065F46' }}>
                        {expense.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="icon-btn-ghost"
                          title="Edit expense"
                          onClick={() => {
                            setEditingExpense(expense);
                            setIsAddModalOpen(true);
                          }}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-ghost text-red-500"
                          title="Delete expense"
                          onClick={() => setDeletingId(expense.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '400px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#DC2626' }}>
              Confirm Expense Deletion
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748B' }}>
              Are you sure you want to permanently delete this expense? This will adjust your operating profit calculations.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-danger"
                style={{ padding: '8px 16px', background: '#DC2626', color: '#FFF', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                onClick={() => handleDeleteConfirm(deletingId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingExpense(null); }}
        initialData={editingExpense}
        onSubmit={(expenseData) => {
          if (editingExpense) {
            onUpdateExpense(editingExpense.id, expenseData);
          } else {
            onAddExpense(expenseData);
          }
        }}
      />
    </div>
  );
};
