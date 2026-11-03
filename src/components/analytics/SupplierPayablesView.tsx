import React, { useState, useMemo } from 'react';
import { 
  Building, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  TrendingDown
} from 'lucide-react';
import { SupplierPayable, ExpenseRecord, CashFlowPoint } from '../../types/financials';
import { SaleRecord } from '../../types/inventory';
import { formatINR } from '../../utils/moneyUtils';
import { calculateSupplierAging, calculateMonthlyCashFlow } from '../../utils/financialCalculations';
import { RecordSupplierPaymentModal } from './RecordSupplierPaymentModal';

interface SupplierPayablesViewProps {
  payables: SupplierPayable[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  onRecordPayment: (payableId: string, payment: {
    amount: number;
    paymentDate: string;
    method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
    reference?: string;
    recordedBy: string;
  }) => void;
  staffUser: string;
}

export const SupplierPayablesView: React.FC<SupplierPayablesViewProps> = ({
  payables,
  sales,
  expenses,
  onRecordPayment,
  staffUser
}) => {
  const [selectedPayable, setSelectedPayable] = useState<SupplierPayable | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const aging = useMemo(() => calculateSupplierAging(payables), [payables]);
  const cashFlowTrends: CashFlowPoint[] = useMemo(() => {
    return calculateMonthlyCashFlow(sales, expenses, payables, 6);
  }, [sales, expenses, payables]);

  const filteredPayables = useMemo(() => {
    if (statusFilter === 'ALL') return payables;
    return payables.filter(p => p.status === statusFilter);
  }, [payables, statusFilter]);

  const getStatusBadge = (status: SupplierPayable['status']) => {
    switch (status) {
      case 'PAID':
        return <span className="nav-badge-pill" style={{ background: '#DCFCE7', color: '#166534' }}>PAID</span>;
      case 'PARTIAL':
        return <span className="nav-badge-pill" style={{ background: '#FEF3C7', color: '#B45309' }}>PARTIAL</span>;
      case 'OVERDUE':
        return <span className="nav-badge-pill" style={{ background: '#FEE2E2', color: '#991B1B' }}>OVERDUE</span>;
      case 'DUE_SOON':
        return <span className="nav-badge-pill" style={{ background: '#EDE9FE', color: '#5B21B6' }}>DUE SOON</span>;
      default:
        return <span className="nav-badge-pill" style={{ background: '#F1F5F9', color: '#475569' }}>PENDING</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Aging KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">TOTAL OUTSTANDING DUES</span>
            <div className="fin-icon-badge bg-amber-50 text-amber-600">
              <Building size={16} />
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: '#D97706' }}>
            {formatINR(aging.totalOutstanding)}
          </div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Across {payables.filter(p => p.status !== 'PAID').length} unpaid supplier invoices</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">CURRENT DUES (0-30 DAYS)</span>
            <div className="fin-icon-badge bg-blue-50 text-blue-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="fin-kpi-value">{formatINR(aging.currentDues)}</div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Within vendor credit window</span>
          </div>
        </div>

        <div className="fin-kpi-card" style={{ borderColor: aging.overdue30 > 0 ? '#EF4444' : 'var(--border-subtle)' }}>
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">OVERDUE (1-30 DAYS)</span>
            <div className="fin-icon-badge bg-red-50 text-red-600">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: aging.overdue30 > 0 ? '#DC2626' : '#10B981' }}>
            {formatINR(aging.overdue30)}
          </div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Immediate settlement required</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-header">
            <span className="fin-kpi-title">HISTORIC SETTLEMENTS</span>
            <div className="fin-icon-badge bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: '#059669' }}>
            {formatINR(aging.paidTotal)}
          </div>
          <div className="fin-kpi-footer">
            <span className="fin-kpi-sub">Total disbursed to wholesalers</span>
          </div>
        </div>
      </div>

      {/* Cash Flow Section: Inflows vs Outflows */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingDown size={18} className="text-primary-green" />
          Operating Cash Inflow vs. Cash Outflow (Last 6 Months)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          {cashFlowTrends.map((trend, i) => (
            <div key={i} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>{trend.label}</div>
              <div style={{ fontSize: '0.78rem', color: '#059669' }}>
                +Inflow: <strong>{formatINR(trend.inflow)}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#DC2626', marginTop: '2px' }}>
                -Outflow: <strong>{formatINR(trend.outflow)}</strong>
              </div>
              <div style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid #E2E8F0',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: trend.net >= 0 ? '#059669' : '#DC2626'
              }}>
                Net: {formatINR(trend.net)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supplier Payables Ledger */}
      <div className="analytics-card" style={{ padding: '20px', background: '#FFF', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#1E293B' }}>
              Wholesale Supplier Invoices & Due Dates
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
              Track credit periods and record batch purchase settlements.
            </p>
          </div>

          <div className="pill-group" style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`filter-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Invoices
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${statusFilter === 'OVERDUE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('OVERDUE')}
            >
              Overdue
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${statusFilter === 'DUE_SOON' ? 'active' : ''}`}
              onClick={() => setStatusFilter('DUE_SOON')}
            >
              Due Soon
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${statusFilter === 'PAID' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PAID')}
            >
              Paid
            </button>
          </div>
        </div>

        {/* Payables Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <th style={{ textAlign: 'left', padding: '10px' }}>Supplier & Wholesaler</th>
                <th style={{ textAlign: 'left', padding: '10px' }}>Invoice #</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Due Date</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Total Amount</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Paid</th>
                <th style={{ textAlign: 'right', padding: '10px' }}>Remaining Due</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '10px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayables.map(payable => {
                const remaining = Math.max(0, payable.totalAmount - payable.paidAmount);

                return (
                  <tr key={payable.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px' }}>
                      <strong>{payable.supplierName}</strong>
                      {payable.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{payable.notes}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{payable.invoiceNumber}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>{payable.dueDate}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(payable.totalAmount)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#059669' }}>
                      {formatINR(payable.paidAmount)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: remaining > 0 ? '#DC2626' : '#059669' }}>
                      {formatINR(remaining)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {getStatusBadge(payable.status)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {remaining > 0 ? (
                        <button
                          type="button"
                          className="btn-primary-action"
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => setSelectedPayable(payable)}
                        >
                          Record Payment
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Settled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordSupplierPaymentModal
        isOpen={!!selectedPayable}
        payable={selectedPayable}
        onClose={() => setSelectedPayable(null)}
        onSubmit={onRecordPayment}
        staffUser={staffUser}
      />
    </div>
  );
};
