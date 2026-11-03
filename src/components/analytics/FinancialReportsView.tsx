import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle2, 
  IndianRupee,
  Package, 
  Building, 
  Layers
} from 'lucide-react';
import { FinancialReportType, FinancialExecutiveSummary, ExpenseRecord, SupplierPayable } from '../../types/financials';
import { SaleRecord, Medicine, MedicineBatch } from '../../types/inventory';
import { generateFinancialCSV, downloadCSV } from '../../utils/financialCalculations';

interface FinancialReportsViewProps {
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  batches: MedicineBatch[];
  medicines: Medicine[];
  payables: SupplierPayable[];
  summary: FinancialExecutiveSummary;
}

interface ReportOption {
  type: FinancialReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    type: 'pnl',
    title: 'Profit & Loss Statement (P&L)',
    description: 'Audited monthly summary of Revenues, Cost of Goods Sold, Gross Profit, and Operating Expenses.',
    icon: <IndianRupee size={20} className="text-emerald-600" />,
    badge: 'Executive'
  },
  {
    type: 'revenue',
    title: 'Sales & Revenue Register',
    description: 'Detailed billing register with invoice IDs, MRP, discounts given, and realized counter revenue.',
    icon: <FileText size={20} className="text-blue-600" />,
    badge: 'Sales'
  },
  {
    type: 'expenses',
    title: 'Operational Overheads (OpEx)',
    description: 'Itemized expense ledger with rent, utility vouchers, staff payroll, and vendor reference numbers.',
    icon: <Layers size={20} className="text-amber-600" />,
    badge: 'Auditing'
  },
  {
    type: 'inventory_valuation',
    title: 'Inventory Valuation & Capital Schedule',
    description: 'Batch-by-batch valuation at purchase cost and retail MRP, with locked potential margins.',
    icon: <Package size={20} className="text-teal-600" />,
    badge: 'Assets'
  },
  {
    type: 'supplier_payables',
    title: 'Wholesaler Aging & Payables',
    description: 'Supplier invoice aging status, amounts paid, and pending wholesale credit balances.',
    icon: <Building size={20} className="text-purple-600" />,
    badge: 'Payables'
  },
  {
    type: 'collections',
    title: 'Counter Collection & Tender Breakdown',
    description: 'Reconciliation of physical cash drawer against digital UPI and card terminal collections.',
    icon: <CheckCircle2 size={20} className="text-indigo-600" />,
    badge: 'Cashiers'
  }
];

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  sales,
  expenses,
  batches,
  medicines,
  payables,
  summary
}) => {
  const [previewReport, setPreviewReport] = useState<FinancialReportType | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownload = (type: FinancialReportType) => {
    const { filename, csvContent } = generateFinancialCSV(type, {
      sales,
      expenses,
      batches,
      medicines,
      payables,
      summary
    });

    downloadCSV(filename, csvContent);
    setDownloadSuccess(`Exported ${filename} successfully!`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{
        padding: '16px 20px',
        background: '#FFF',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} className="text-primary-green" />
            Financial Health & Audit Report Generator
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
            Generate verified statutory and management accounting reports with one-click CSV export.
          </p>
        </div>

        {downloadSuccess && (
          <div className="settings-alert alert-success" style={{ margin: 0, padding: '6px 12px' }}>
            <CheckCircle2 size={15} />
            <span>{downloadSuccess}</span>
          </div>
        )}
      </div>

      {/* Grid of Report Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {REPORT_OPTIONS.map(report => (
          <div 
            key={report.type}
            className="analytics-card"
            style={{
              padding: '20px',
              background: '#FFF',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ padding: '8px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    {report.icon}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#1E293B' }}>
                    {report.title}
                  </h4>
                </div>
                <span className="nav-badge-pill" style={{ background: '#F1F5F9', color: '#475569' }}>
                  {report.badge}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B', lineHeight: '1.4' }}>
                {report.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => setPreviewReport(report.type)}
              >
                <Eye size={14} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                className="btn-primary-action"
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => handleDownload(report.type)}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Live Preview Modal */}
      {previewReport && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: '640px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1E293B' }}>
                  Report Preview: {REPORT_OPTIONS.find(r => r.type === previewReport)?.title}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Generated for current demonstration dataset</span>
              </div>
              <button
                type="button"
                className="btn-primary-action"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => handleDownload(previewReport)}
              >
                <Download size={14} />
                <span>Download CSV</span>
              </button>
            </div>

            <div style={{
              maxHeight: '360px',
              overflowY: 'auto',
              background: '#F8FAFC',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #E2E8F0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              whiteSpace: 'pre-wrap',
              color: '#334155'
            }}>
              {generateFinancialCSV(previewReport, {
                sales,
                expenses,
                batches,
                medicines,
                payables,
                summary
              }).csvContent}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPreviewReport(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
