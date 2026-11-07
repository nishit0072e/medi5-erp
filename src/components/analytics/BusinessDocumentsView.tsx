import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  FileText, Download, AlertCircle, 
  CheckCircle2, DollarSign,
  PieChart, FileCheck, Calendar, 
  Info, X, ChevronDown, Loader2
} from 'lucide-react';
import { PharmacyProfile } from '../../types/pharmacy';
import { SaleRecord } from '../../types/inventory';
import { ExpenseRecord } from '../../types/financials';
import { SupplierPayable } from '../../types/financials';
import { formatINR } from '../../utils/moneyUtils';
import { generateSOAPDF, generateProfitLossPDF, generateIncomeExpenditurePDF } from '../../utils/pdfGeneration';

interface BusinessDocumentsViewProps {
  pharmacy: PharmacyProfile;
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  payables: SupplierPayable[];
  batches: any[];
  movements: any[];
  periodStart: string;
  periodEnd: string;
  staffUser: string;
}

type DocumentType = 'SOA' | 'P&L' | 'INCOME_EXPENDITURE';

interface DocumentConfig {
  type: DocumentType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const DOCUMENT_TYPES: DocumentConfig[] = [
  {
    type: 'SOA',
    title: 'Statement of Accounts (SOA)',
    description: 'Complete ledger with opening/closing balance, all transactions (sales, purchases, payments, expenses) for the period.',
    icon: FileText,
    color: '#13634B'
  },
  {
    type: 'P&L',
    title: 'Profit & Loss Statement',
    description: 'Revenue, COGS, gross profit, operating expenses, and net profit for the period.',
    icon: DollarSign,
    color: '#10B981'
  },
  {
    type: 'INCOME_EXPENDITURE',
    title: 'Income vs Expenditure Report',
    description: 'Detailed breakdown of income sources and expenditure categories with percentages.',
    icon: PieChart,
    color: '#3B82F6'
  }
];

export const BusinessDocumentsView: React.FC<BusinessDocumentsViewProps> = ({
  pharmacy,
  sales,
  expenses,
  payables,
  batches,
  movements,
  periodStart: initialPeriodStart,
  periodEnd: initialPeriodEnd,
  staffUser
}) => {
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd);

  useEffect(() => {
    setPeriodStart(initialPeriodStart);
    setPeriodEnd(initialPeriodEnd);
    setCustomPeriod({ start: initialPeriodStart, end: initialPeriodEnd });
  }, [initialPeriodStart, initialPeriodEnd]);

  const [selectedDoc, setSelectedDoc] = useState<DocumentType | null>(null);
  const [isGenerating, setIsGenerating] = useState<DocumentType | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Partial<Record<DocumentType, string>>>({});
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [customPeriod, setCustomPeriod] = useState({ start: initialPeriodStart, end: initialPeriodEnd });

  // Compute SOA Data
  const soaData = useMemo(() => {
    const transactions: Array<{
      date: string;
      type: 'SALE' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'EXPENSE' | 'ADJUSTMENT';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }> = [];

    let runningBalance = 0;

    sales.forEach(sale => {
      runningBalance += sale.sellingBill;
      transactions.push({
        date: sale.timestamp,
        type: 'SALE',
        reference: sale.id,
        description: `Sale to ${sale.patientId ? 'Patient' : 'Walk-in'} - ${sale.items.length} item(s)`,
        debit: 0,
        credit: sale.sellingBill,
        balance: runningBalance
      });
    });

    expenses.forEach(expense => {
      runningBalance -= expense.amount;
      transactions.push({
        date: expense.date,
        type: 'EXPENSE',
        reference: expense.id,
        description: `${expense.title} (${expense.category})`,
        debit: expense.amount,
        credit: 0,
        balance: runningBalance
      });
    });

    payables.filter(p => p.status === 'PAID').forEach(payable => {
      const paidAmount = payable.paidAmount || payable.paymentHistory.reduce((sum, ph) => sum + ph.amount, 0);
      const paymentDate = payable.paymentHistory.find(ph => ph.paymentDate)?.paymentDate || payable.dueDate;
      runningBalance -= paidAmount;
      transactions.push({
        date: paymentDate,
        type: 'PAYMENT',
        reference: payable.id,
        description: `Payment to ${payable.supplierName}`,
        debit: paidAmount,
        credit: 0,
        balance: runningBalance
      });
    });

    movements.filter(m => m.movementType === 'PURCHASE_RECEIPT').forEach(mov => {
      runningBalance -= mov.quantityChange * (mov.purchaseCost || 0);
      transactions.push({
        date: mov.timestamp,
        type: 'PURCHASE',
        reference: mov.id,
        description: `Stock receipt - ${mov.medicineName} (${mov.batchNumber})`,
        debit: mov.quantityChange * (mov.purchaseCost || 0),
        credit: 0,
        balance: runningBalance
      });
    });

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    transactions.forEach(txn => {
      balance += txn.credit - txn.debit;
      txn.balance = balance;
    });

    let openingBalance = 0;
    transactions.filter(txn => new Date(txn.date).getTime() < new Date(periodStart).getTime()).forEach(txn => {
      openingBalance += txn.credit - txn.debit;
    });

    const periodTransactions = transactions.filter(txn => 
      new Date(txn.date).getTime() >= new Date(periodStart).getTime() &&
      new Date(txn.date).getTime() <= new Date(periodEnd).getTime()
    );

    let periodBalance = openingBalance;
    periodTransactions.forEach(txn => {
      periodBalance += txn.credit - txn.debit;
      txn.balance = periodBalance;
    });

    const closingBalance = periodBalance;

    const totalSales = sales
      .filter(s => new Date(s.timestamp).getTime() >= new Date(periodStart).getTime() && 
                   new Date(s.timestamp).getTime() <= new Date(periodEnd).getTime())
      .reduce((sum, s) => sum + s.sellingBill, 0);

    const totalPurchases = movements
      .filter(m => m.movementType === 'PURCHASE_RECEIPT' && 
                   new Date(m.timestamp).getTime() >= new Date(periodStart).getTime() &&
                   new Date(m.timestamp).getTime() <= new Date(periodEnd).getTime())
      .reduce((sum, m) => sum + (m.quantityChange * (m.purchaseCost || 0)), 0);

    const totalExpenses = expenses
      .filter(e => new Date(e.date).getTime() >= new Date(periodStart).getTime() &&
                   new Date(e.date).getTime() <= new Date(periodEnd).getTime())
      .reduce((sum, e) => sum + e.amount, 0);

    const totalPaymentsReceived = sales
      .filter(s => new Date(s.timestamp).getTime() >= new Date(periodStart).getTime() &&
                   new Date(s.timestamp).getTime() <= new Date(periodEnd).getTime())
      .reduce((sum, s) => sum + s.sellingBill, 0);

    const totalPaymentsMade = expenses
      .filter(e => new Date(e.date).getTime() >= new Date(periodStart).getTime() &&
                   new Date(e.date).getTime() <= new Date(periodEnd).getTime())
      .reduce((sum, e) => sum + e.amount, 0) +
      payables.filter(p => p.status === 'PAID' &&
        (p.paymentHistory.find(ph => ph.paymentDate)?.paymentDate || p.dueDate) >= periodStart &&
        (p.paymentHistory.find(ph => ph.paymentDate)?.paymentDate || p.dueDate) <= periodEnd)
        .reduce((sum, p) => sum + (p.paidAmount || p.paymentHistory.reduce((sum, ph) => sum + ph.amount, 0)), 0);

    return {
      pharmacy,
      periodStart,
      periodEnd,
      openingBalance,
      transactions: periodTransactions,
      closingBalance,
      totalSales,
      totalPurchases,
      totalExpenses,
      totalPaymentsReceived,
      totalPaymentsMade
    };
  }, [sales, expenses, payables, movements, periodStart, periodEnd]);

  // Compute P&L Data
  const plData = useMemo(() => {
    const periodSales = sales.filter(s => 
      new Date(s.timestamp).getTime() >= new Date(periodStart).getTime() &&
      new Date(s.timestamp).getTime() <= new Date(periodEnd).getTime()
    );
    const totalRevenue = periodSales.reduce((sum, s) => sum + s.sellingBill, 0);

    const periodMovements = movements.filter(m => 
      m.movementType === 'PURCHASE_RECEIPT' &&
      new Date(m.timestamp).getTime() >= new Date(periodStart).getTime() &&
      new Date(m.timestamp).getTime() <= new Date(periodEnd).getTime()
    );
    
    const openingStockValue = batches
      .filter(b => new Date(b.receivedDate).getTime() < new Date(periodStart).getTime() && b.status === 'ACTIVE')
      .reduce((sum, b) => sum + (b.quantityRemaining * b.purchaseCost), 0);

    const purchases = periodMovements.reduce((sum, m) => sum + (m.quantityChange * (m.purchaseCost || 0)), 0);

    const closingStockValue = batches
      .filter(b => new Date(b.receivedDate).getTime() <= new Date(periodEnd).getTime() && b.status === 'ACTIVE')
      .reduce((sum, b) => sum + (b.quantityRemaining * b.purchaseCost), 0);

    const totalCOGS = openingStockValue + purchases - closingStockValue;
    const grossProfit = totalRevenue - totalCOGS;

    const periodExpenses = expenses.filter(e => 
      new Date(e.date).getTime() >= new Date(periodStart).getTime() &&
      new Date(e.date).getTime() <= new Date(periodEnd).getTime()
    );
    
    const expensesByCategory = periodExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const expenseCategories = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount
    }));

    const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return {
      pharmacy,
      periodStart,
      periodEnd,
      revenue: {
        sales: totalRevenue,
        otherIncome: 0,
        totalRevenue
      },
      costOfGoodsSold: {
        openingStock: openingStockValue,
        purchases,
        closingStock: closingStockValue,
        totalCOGS: Math.max(0, totalCOGS)
      },
      grossProfit: Math.max(0, grossProfit),
      expenses: expenseCategories,
      totalExpenses,
      netProfit
    };
  }, [sales, movements, batches, expenses, periodStart, periodEnd]);

  // Compute Income vs Expenditure Data
  const ieData = useMemo(() => {
    const periodSales = sales.filter(s => 
      new Date(s.timestamp).getTime() >= new Date(periodStart).getTime() &&
      new Date(s.timestamp).getTime() <= new Date(periodEnd).getTime()
    );
    const totalIncome = periodSales.reduce((sum, s) => sum + s.sellingBill, 0);

    const incomeCategories = [
      { category: 'Sales Revenue', amount: totalIncome, percentage: 100 }
    ];

    const periodExpenses = expenses.filter(e => 
      new Date(e.date).getTime() >= new Date(periodStart).getTime() &&
      new Date(e.date).getTime() <= new Date(periodEnd).getTime()
    );

    const expensesByCategory = periodExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const periodMovements = movements.filter(m => 
      m.movementType === 'PURCHASE_RECEIPT' &&
      new Date(m.timestamp).getTime() >= new Date(periodStart).getTime() &&
      new Date(m.timestamp).getTime() <= new Date(periodEnd).getTime()
    );
    const purchases = periodMovements.reduce((sum, m) => sum + (m.quantityChange * (m.purchaseCost || 0)), 0);
    
    const supplierPayments = payables
      .filter(p => p.status === 'PAID' &&
        (p.paymentHistory.find(ph => ph.paymentDate)?.paymentDate || p.dueDate) >= periodStart &&
        (p.paymentHistory.find(ph => ph.paymentDate)?.paymentDate || p.dueDate) <= periodEnd)
      .reduce((sum, p) => sum + (p.paidAmount || p.paymentHistory.reduce((sum, ph) => sum + ph.amount, 0)), 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenditure = totalExpenses + purchases + supplierPayments;

    const allExpCategories = [
      ...Object.entries(expensesByCategory).map(([category, amount]) => ({ category, amount })),
      { category: 'Cost of Goods Sold (Purchases)', amount: purchases },
      { category: 'Supplier Payments', amount: supplierPayments }
    ].filter(e => e.amount > 0);

    const expenditureCategories = allExpCategories.map(e => ({
      category: e.category,
      amount: e.amount,
      percentage: totalExpenditure > 0 ? (e.amount / totalExpenditure) * 100 : 0
    }));

    const surplusDeficit = totalIncome - totalExpenditure;

    return {
      pharmacy,
      periodStart,
      periodEnd,
      income: incomeCategories,
      expenditure: expenditureCategories,
      totalIncome,
      totalExpenditure,
      surplusDeficit
    };
  }, [sales, expenses, payables, movements, periodStart, periodEnd]);

  const handleGeneratePDF = useCallback(async (type: DocumentType) => {
    setIsGenerating(type);
    setGenerateError(null);
    try {
      let doc: any;
      const options = {
        pharmacy,
        generatedBy: staffUser,
        generatedAt: new Date().toISOString()
      };

      switch (type) {
        case 'SOA':
          doc = generateSOAPDF(soaData, options);
          break;
        case 'P&L':
          doc = generateProfitLossPDF(plData, options);
          break;
        case 'INCOME_EXPENDITURE':
          doc = generateIncomeExpenditurePDF(ieData, options);
          break;
      }

      // Trigger download
      const fileName = `${pharmacy.name.replace(/\s+/g, '_')}_${type}_${periodStart}_to_${periodEnd}.pdf`;
      doc.save(fileName);
      
      setLastGenerated(prev => ({ ...prev, [type]: new Date().toISOString() }));
      setSelectedDoc(null);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(null);
    }
  }, [soaData, plData, ieData, pharmacy, staffUser, periodStart, periodEnd]);

  const formatDate = useCallback((isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  const formatDateTime = useCallback((isoString: string) => {
    return new Date(isoString).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, []);

  const handlePeriodChange = useCallback(() => {
    // Period is controlled by parent AnalyticsView via selectedPreset
    setShowPeriodPicker(false);
  }, []);

  return (
    <div className="business-documents-container">
      {/* Header */}
      <div className="documents-header">
        <div>
          <h1 className="documents-title">
            <FileText size={24} className="text-primary-green" />
            Business Documents
          </h1>
          <p className="documents-subtitle">
            Generate real-time financial documents from current data. Documents are generated on-demand and not stored.
          </p>
        </div>
        <div className="period-selector">
          <div className="period-display" onClick={() => setShowPeriodPicker(true)}>
            <Calendar size={16} />
            <span>{formatDate(periodStart)} - {formatDate(periodEnd)}</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Document Cards */}
      <div className="documents-grid">
        {DOCUMENT_TYPES.map(doc => {
          const isGen = isGenerating === doc.type;
          return (
            <article key={doc.type} className="document-card" onClick={() => setSelectedDoc(selectedDoc === doc.type ? null : doc.type)}>
              <div className="doc-icon" style={{ backgroundColor: doc.color }}>
                <doc.icon size={24} />
              </div>
              <h3 className="doc-title">{doc.title}</h3>
              <p className="doc-description">{doc.description}</p>
              
              <div className="doc-preview-stats">
                {doc.type === 'SOA' && (
                  <>
                    <span className="stat-item"><span className="stat-value">{formatINR(soaData.totalSales)}</span><span className="stat-label">Total Sales</span></span>
                    <span className="stat-item"><span className="stat-value">{formatINR(soaData.totalExpenses)}</span><span className="stat-label">Total Expenses</span></span>
                    <span className="stat-item"><span className="stat-value">{formatINR(soaData.closingBalance)}</span><span className="stat-label">Closing Balance</span></span>
                  </>
                )}
                {doc.type === 'P&L' && (
                  <>
                    <span className="stat-item"><span className="stat-value">{formatINR(plData.revenue.totalRevenue)}</span><span className="stat-label">Revenue</span></span>
                    <span className="stat-item"><span className="stat-value">{formatINR(plData.grossProfit)}</span><span className="stat-label">Gross Profit</span></span>
                    <span className="stat-item"><span className="stat-value">{formatINR(plData.netProfit)}</span><span className="stat-label">Net Profit</span></span>
                  </>
                )}
                {doc.type === 'INCOME_EXPENDITURE' && (
                  <>
                    <span className="stat-item"><span className="stat-value">{formatINR(ieData.totalIncome)}</span><span className="stat-label">Total Income</span></span>
                    <span className="stat-item"><span className="stat-value">{formatINR(ieData.totalExpenditure)}</span><span className="stat-label">Expenditure</span></span>
                    <span className="stat-item"><span className="stat-value">{formatINR(Math.abs(ieData.surplusDeficit))}</span><span className="stat-label">{ieData.surplusDeficit >= 0 ? 'Surplus' : 'Deficit'}</span></span>
                  </>
                )}
              </div>

              <div className="doc-actions">
                <button 
                  className={`btn-primary-action ${selectedDoc === doc.type ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.type); }}
                  disabled={isGenerating !== null}
                  aria-busy={isGen}
                >
                  {isGen ? (
                    <> <Loader2 size={14} className="animate-spin" /> Generating... </>
                  ) : (
                    <>
                      <Download size={14} /> Generate PDF
                    </>
                  )}
                </button>
                {lastGenerated && lastGenerated[doc.type] && (
                  <span className="last-generated" title={`Last generated: ${formatDateTime(lastGenerated[doc.type]!)}`}>
                    <CheckCircle2 size={12} /> {formatDate(lastGenerated[doc.type]!)}
                  </span>
                )}
              </div>

              {selectedDoc === doc.type && (
                <div className="doc-expanded" role="region" aria-label={`${doc.title} preview`}>
                  <p className="expand-note">Click to generate and download PDF. Documents are generated in real-time from current data.</p>
                  <div className="doc-detail-preview">
                    {doc.type === 'SOA' && (
                      <div className="preview-section">
                        <h4>Statement of Accounts Preview</h4>
                        <div className="preview-stats">
                          <div className="preview-stat">
                            <span className="preview-label">Opening Balance</span>
                            <span className="preview-value">{formatINR(soaData.openingBalance)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Total Sales</span>
                            <span className="preview-value">{formatINR(soaData.totalSales)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Total Expenses</span>
                            <span className="preview-value">{formatINR(soaData.totalExpenses)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Closing Balance</span>
                            <span className="preview-value">{formatINR(soaData.closingBalance)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Transactions</span>
                            <span className="preview-value">{soaData.transactions.length}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {doc.type === 'P&L' && (
                      <div className="preview-section">
                        <h4>Profit & Loss Preview</h4>
                        <div className="preview-stats">
                          <div className="preview-stat">
                            <span className="preview-label">Total Revenue</span>
                            <span className="preview-value">{formatINR(plData.revenue.totalRevenue)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">COGS</span>
                            <span className="preview-value">{formatINR(plData.costOfGoodsSold.totalCOGS)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Gross Profit</span>
                            <span className="preview-value">{formatINR(plData.grossProfit)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Total Expenses</span>
                            <span className="preview-value">{formatINR(plData.totalExpenses)}</span>
                          </div>
                          <div className="preview-stat">
                            <span className="preview-label">Net Profit</span>
                            <span className="preview-value">{formatINR(plData.netProfit)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {doc.type === 'INCOME_EXPENDITURE' && (
                      <div className="preview-section">
                        <h4>Income vs Expenditure Preview</h4>
                        <div className="preview-stats">
                          <div className="preview-stat income">
                            <span className="preview-label">Total Income</span>
                            <span className="preview-value">{formatINR(ieData.totalIncome)}</span>
                          </div>
                          <div className="preview-stat expense">
                            <span className="preview-label">Total Expenditure</span>
                            <span className="preview-value">{formatINR(ieData.totalExpenditure)}</span>
                          </div>
                          <div className="preview-stat surplus">
                            <span className="preview-label">{ieData.surplusDeficit >= 0 ? 'Surplus' : 'Deficit'}</span>
                            <span className="preview-value">{formatINR(Math.abs(ieData.surplusDeficit))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {/* E-Prescription PDF Generator */}
        <article className="document-card special-card">
          <div className="doc-icon" style={{ backgroundColor: '#8B5CF6' }}>
            <FileCheck size={24} />
          </div>
          <h3 className="doc-title">E-Prescription PDF</h3>
          <p className="doc-description">Generate PDF for any e-prescription from OPD Corner. Select a prescription from OPD Corner first.</p>
          <div className="doc-actions">
            <button className="btn-secondary" disabled>
              <FileCheck size={14} /> Available in OPD Corner
            </button>
          </div>
        </article>
      </div>

      {generateError && (
        <div className="error-banner" role="alert">
          <AlertCircle size={16} />
          <span>Failed to generate PDF: {generateError}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setGenerateError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Period Picker Modal */}
      {showPeriodPicker && (
        <div className="modal-backdrop" onClick={() => setShowPeriodPicker(false)}>
          <div className="modal-card" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Period</h3>
              <button type="button" className="icon-btn-ghost" onClick={() => setShowPeriodPicker(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-input" value={customPeriod.start} onChange={e => setCustomPeriod(prev => ({ ...prev, start: e.target.value }))} max={periodEnd} />
                </div>
                <div className="form-group">
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-input" value={customPeriod.end} onChange={e => setCustomPeriod(prev => ({ ...prev, end: e.target.value }))} min={customPeriod.start} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowPeriodPicker(false)}>Cancel</button>
                <button type="button" className="btn-primary-action" onClick={() => { handlePeriodChange(); setPeriodStart(customPeriod.start); setPeriodEnd(customPeriod.end); }}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="info-banner">
        <Info size={16} />
        <div>
          <strong>Real-time Generation:</strong> These documents are generated on-demand from live data. They are not stored in the database. 
          Each generation reflects the current state of sales, expenses, inventory, and payables at the moment of generation.
        </div>
      </div>
    </div>
  );
};

export default BusinessDocumentsView;