import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  IndianRupee, 
  Package, 
  BarChart2, 
  Building, 
  FileText, 
  ArrowLeft,
  Sparkles,
  Wallet
} from 'lucide-react';
import { Medicine, MedicineBatch, SaleRecord, StockMovement } from '../types/inventory';
import { ExpenseRecord, SupplierPayable, DateFilterPreset } from '../types/financials';
import { generateSyntheticHistoricalSales } from '../data/mockFinancials';
import { calculateExecutiveSummary } from '../utils/financialCalculations';
import { 
  recordExpense, 
  updateExpense, 
  deleteExpense, 
  recordSupplierPayment,
  loadDemoInventory
} from '../data/demoRepository';

import { FinancialOverview } from './analytics/FinancialOverview';
import { RevenueAnalytics } from './analytics/RevenueAnalytics';
import { ProfitabilityIntelligence } from './analytics/ProfitabilityIntelligence';
import { ExpenseManager } from './analytics/ExpenseManager';
import { InventoryFinancialHealth } from './analytics/InventoryFinancialHealth';
import { SupplierPayablesView } from './analytics/SupplierPayablesView';
import { FinancialReportsView } from './analytics/FinancialReportsView';
import { BusinessDocumentsView } from './analytics/BusinessDocumentsView';

interface AnalyticsViewProps {
  pharmacyId: string;
  pharmacyName: string;
  medicines: Medicine[];
  batches: MedicineBatch[];
  sales: SaleRecord[];
  movements?: StockMovement[];
  expenses?: ExpenseRecord[];
  payables?: SupplierPayable[];
  onBackToInventory: () => void;
}

type AnalyticsSubTab = 
  | 'overview' 
  | 'revenue' 
  | 'profitability' 
  | 'expenses' 
  | 'inventory' 
  | 'payables' 
  | 'reports'
  | 'business-docs';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  pharmacyId,
  pharmacyName,
  medicines,
  batches,
  sales: incomingSales,
  movements: _movements,
  expenses: propExpenses,
  payables: propPayables,
  onBackToInventory
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>('overview');
  const [selectedPreset, setSelectedPreset] = useState<DateFilterPreset>('last30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Fallback demo state from repository if not passed in props
  const [localExpenses, setLocalExpenses] = useState<ExpenseRecord[]>(() => {
    if (propExpenses && propExpenses.length > 0) return propExpenses;
    const inv = loadDemoInventory();
    return (inv.expenses || []).filter((e: ExpenseRecord) => e.pharmacyId === pharmacyId);
  });

  const [localPayables, setLocalPayables] = useState<SupplierPayable[]>(() => {
    if (propPayables && propPayables.length > 0) return propPayables;
    const inv = loadDemoInventory();
    return (inv.payables || []).filter((p: SupplierPayable) => p.pharmacyId === pharmacyId);
  });

  // Ensure rich synthetic sales data is available for investor-ready charts
  const activeSales: SaleRecord[] = useMemo(() => {
    const tenantSales = incomingSales.filter(s => s.pharmacyId === pharmacyId);
    if (tenantSales.length >= 15) {
      return tenantSales;
    }
    // Combine existing sales with realistic synthetic history
    const synthetic = generateSyntheticHistoricalSales(pharmacyId);
    return [...tenantSales, ...synthetic];
  }, [incomingSales, pharmacyId]);

  // Executive Summary
  const executiveSummary = useMemo(() => {
    return calculateExecutiveSummary(
      activeSales,
      localExpenses,
      batches,
      localPayables,
      selectedPreset,
      customStart,
      customEnd
    );
  }, [activeSales, localExpenses, batches, localPayables, selectedPreset, customStart, customEnd]);

  // Expense Handlers
  const handleAddExpense = (expenseData: any) => {
    const current = loadDemoInventory();
    const result = recordExpense(current, pharmacyId, expenseData);
    setLocalExpenses(result.nextState.expenses.filter((e: ExpenseRecord) => e.pharmacyId === pharmacyId));
  };

  const handleUpdateExpense = (expenseId: string, updates: any) => {
    const current = loadDemoInventory();
    const result = updateExpense(current, pharmacyId, expenseId, updates);
    setLocalExpenses(result.nextState.expenses.filter((e: ExpenseRecord) => e.pharmacyId === pharmacyId));
  };

  const handleDeleteExpense = (expenseId: string) => {
    const current = loadDemoInventory();
    const next = deleteExpense(current, pharmacyId, expenseId);
    setLocalExpenses(next.expenses.filter((e: ExpenseRecord) => e.pharmacyId === pharmacyId));
  };

  // Supplier Payment Handler
  const handleRecordSupplierPayment = (payableId: string, paymentData: any) => {
    const current = loadDemoInventory();
    const result = recordSupplierPayment(current, pharmacyId, payableId, paymentData);
    setLocalPayables(result.nextState.payables.filter((p: SupplierPayable) => p.pharmacyId === pharmacyId));
  };

  return (
    <div className="analytics-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Top Clinical Header & Context Bar (Inspired by Reference UI) */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="icon-btn-ghost"
            onClick={onBackToInventory}
            title="Back to Inventory Counter"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#132720' }}>
                {pharmacyName}
              </h2>
              <span className="nav-badge-pill" style={{ background: '#DFECE6', color: '#13634B', fontWeight: 600 }}>
                Financial Health & BI
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#537066' }}>
              Executive SaaS dashboard for revenue trends, margins, operating expenses, and inventory valuation.
            </p>
          </div>
        </div>

        {/* Investor Demo Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: '#FEF3C7',
          borderRadius: '9999px',
          border: '1px solid #FDE68A',
          color: '#92400E',
          fontSize: '0.78rem',
          fontWeight: 600
        }}>
          <Sparkles size={14} />
          <span>INVESTOR DEMONSTRATION MODE • SYNTHETIC DATA</span>
        </div>
      </div>

      {/* Segmented Navigation Tabs (Matching Reference Aesthetic) */}
      <div className="analytics-tabs" style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        overflowX: 'visible',
        paddingBottom: '4px',
        borderBottom: '2px solid #E2E8F0'
      }}>
        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          <TrendingUp size={16} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('revenue')}
        >
          <BarChart2 size={16} />
          <span>Revenue</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'profitability' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('profitability')}
        >
          <IndianRupee size={16} />
          <span>Profitability</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('expenses')}
        >
          <Wallet size={16} />
          <span>Expenses</span>
          <span className="tab-count-pill">{localExpenses.length}</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('inventory')}
        >
          <Package size={16} />
          <span>Inventory</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'payables' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('payables')}
        >
          <Building size={16} />
          <span>Payables</span>
          {localPayables.filter(p => p.status === 'OVERDUE').length > 0 && (
            <span className="tab-count-pill" style={{ background: '#EF4444', color: '#FFF' }}>
              {localPayables.filter(p => p.status === 'OVERDUE').length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reports')}
        >
          <FileText size={16} />
          <span>Reports</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeSubTab === 'business-docs' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('business-docs')}
        >
          <FileText size={16} />
          <span>Business Docs</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'overview' && (
        <FinancialOverview
          summary={executiveSummary}
          selectedPreset={selectedPreset}
          onSelectPreset={setSelectedPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomDateChange={(start, end) => {
            setCustomStart(start);
            setCustomEnd(end);
          }}
        />
      )}

      {activeSubTab === 'revenue' && (
        <RevenueAnalytics
          sales={activeSales}
          medicines={medicines}
        />
      )}

      {activeSubTab === 'profitability' && (
<ProfitabilityIntelligence
          sales={activeSales}
          medicines={medicines}
        />
      )}

      {activeSubTab === 'expenses' && (
        <ExpenseManager
          expenses={localExpenses}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
        />
      )}

      {activeSubTab === 'inventory' && (
        <InventoryFinancialHealth
          medicines={medicines}
          batches={batches}
          sales={activeSales}
        />
      )}

      {activeSubTab === 'payables' && (
        <SupplierPayablesView
          payables={localPayables}
          sales={activeSales}
          expenses={localExpenses}
          onRecordPayment={handleRecordSupplierPayment}
          staffUser="Nandan Owner (Demo)"
        />
      )}

      {activeSubTab === 'reports' && (
        <FinancialReportsView
          sales={activeSales}
          expenses={localExpenses}
          batches={batches}
          medicines={medicines}
          payables={localPayables}
          summary={executiveSummary}
        />
      )}

      {activeSubTab === 'business-docs' && (
        <BusinessDocumentsView
          pharmacy={{ id: pharmacyId, name: pharmacyName } as any}
          sales={activeSales}
          expenses={localExpenses}
          payables={localPayables}
          batches={batches}
          movements={[]}
          periodStart={selectedPreset === 'custom' ? customStart : (() => {
            const now = new Date();
            switch (selectedPreset) {
              case 'today': return now.toISOString().split('T')[0];
              case 'last7days': return new Date(now.getTime() - 7*24*60*60*1000).toISOString().split('T')[0];
              case 'last30days': return new Date(now.getTime() - 30*24*60*60*1000).toISOString().split('T')[0];
              case 'thisMonth': return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
              case 'lastMonth': return new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split('T')[0];
              default: return new Date(now.getTime() - 30*24*60*60*1000).toISOString().split('T')[0];
            }
          })()}
          periodEnd={selectedPreset === 'custom' ? customEnd : new Date().toISOString().split('T')[0]}
          staffUser="Nandan Owner (Demo)"
        />
      )}
    </div>
  );
};
