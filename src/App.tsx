import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { KpiSummary } from './components/KpiSummary';
import { Controls } from './components/Controls';
import { MedicineCard } from './components/MedicineCard';
import { EmptyState } from './components/EmptyState';
import { BottomNav } from './components/BottomNav';
import { ReceiveStockModal } from './components/ReceiveStockModal';
import { AdjustStockModal } from './components/AdjustStockModal';
import { StockLedgerView } from './components/StockLedgerView';
import { PosScreen } from './components/PosScreen';
import { SaleReceiptModal } from './components/SaleReceiptModal';
import { PharmacySettingsView } from './components/PharmacySettingsView';
import { 
  loadDemoInventory, 
  saveDemoInventory, 
  resetDemoInventory, 
  processStockReceipt, 
  processStockAdjustment,
  processSaleCheckout,
  updatePharmacyProfile,
  switchPharmacyTenant,
  createPharmacyTenant,
  addPharmacyStaffMember,
  removePharmacyStaffMember
} from './data/demoRepository';
import { UpdatePharmacyInput, AddMemberInput } from './types/pharmacy';
import { calculateAllSummaries, calculateInventoryKpis } from './utils/inventoryCalculations';
import { 
  StockFilter, 
  ExpiryFilter, 
  ReceiveStockInput, 
  AdjustStockInput, 
  ProcessSaleInput,
  SaleRecord,
  BatchRecord, 
  Medicine 
} from './types/inventory';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  // 1. Initial State from Versioned Demo Repository
  const [demoState, setDemoState] = useState(() => loadDemoInventory());
  const { medicines, batches, movements, sales = [], pharmacies = [], activePharmacyId = '' } = demoState;

  // Active Pharmacy Tenant
  const activePharmacy = useMemo(() => {
    return pharmacies.find((p) => p.id === activePharmacyId) || pharmacies[0];
  }, [pharmacies, activePharmacyId]);

  // 2. Navigation & View State ('inventory' | 'pos' | 'ledger' | 'settings')
  const [activeView, setActiveView] = useState<'inventory' | 'pos' | 'ledger' | 'settings'>('inventory');
  const [activeTab, setActiveTab] = useState<'inventory' | 'patients' | 'analytics' | 'settings'>('inventory');

  // 3. Search & Filters for Inventory View
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['med-dolo-650']));

  // 4. Modals State
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<{ batch: BatchRecord; medicine: Medicine } | null>(null);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<SaleRecord | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // 5. Toast Feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Persist whenever demo state updates
  useEffect(() => {
    saveDemoInventory(demoState);
  }, [demoState]);

  // Derive inventory summaries directly from batch data
  const allSummaries = useMemo(() => {
    return calculateAllSummaries(medicines, batches);
  }, [medicines, batches]);

  // Calculate aggregated KPIs for inventory
  const kpis = useMemo(() => {
    return calculateInventoryKpis(allSummaries);
  }, [allSummaries]);

  // Compute live filter pill badge counts
  const filterCounts = useMemo(() => {
    return {
      all: allSummaries.length,
      inStock: allSummaries.filter((s) => !s.isLowStock && !s.isOutOfStock).length,
      lowStock: allSummaries.filter((s) => s.isLowStock).length,
      outOfStock: allSummaries.filter((s) => s.isOutOfStock).length,
      expiringSoon: allSummaries.filter((s) => s.hasExpiringSoonBatches).length,
      expired: allSummaries.filter((s) => s.hasExpiredBatches).length
    };
  }, [allSummaries]);

  // Filter summaries based on user input
  const filteredSummaries = useMemo(() => {
    return allSummaries.filter((summary) => {
      // 1. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = summary.medicine.name.toLowerCase().includes(q);
        const matchesGeneric = summary.medicine.genericName.toLowerCase().includes(q);
        const matchesStrength = summary.medicine.strength.toLowerCase().includes(q);
        const matchesDosage = summary.medicine.dosageForm.toLowerCase().includes(q);
        const matchesBatch = summary.batches.some((b) => b.batchNumber.toLowerCase().includes(q));
        const matchesCategory = summary.medicine.category.toLowerCase().includes(q);

        if (!matchesName && !matchesGeneric && !matchesStrength && !matchesDosage && !matchesBatch && !matchesCategory) {
          return false;
        }
      }

      // 2. Stock level filter
      if (stockFilter === 'IN_STOCK' && (summary.isLowStock || summary.isOutOfStock)) {
        return false;
      }
      if (stockFilter === 'LOW_STOCK' && !summary.isLowStock) {
        return false;
      }
      if (stockFilter === 'OUT_OF_STOCK' && !summary.isOutOfStock) {
        return false;
      }

      // 3. Expiry status filter
      if (expiryFilter === 'EXPIRING_SOON' && !summary.hasExpiringSoonBatches) {
        return false;
      }
      if (expiryFilter === 'EXPIRED' && !summary.hasExpiredBatches) {
        return false;
      }
      if (expiryFilter === 'VALID' && (summary.hasExpiredBatches || summary.hasExpiringSoonBatches)) {
        return false;
      }

      return true;
    });
  }, [allSummaries, searchQuery, stockFilter, expiryFilter]);

  // Toggle card expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Reset all search and filter conditions
  const resetFilters = () => {
    setSearchQuery('');
    setStockFilter('ALL');
    setExpiryFilter('ALL');
  };

  // Handle KPI card clicks for quick filtering
  const handleKpiFilterClick = (filter: string) => {
    setActiveView('inventory');
    if (filter === 'ALL') {
      resetFilters();
    } else if (filter === 'LOW_STOCK') {
      setStockFilter('LOW_STOCK');
      setExpiryFilter('ALL');
    } else if (filter === 'EXPIRING') {
      if (filterCounts.expired > 0) {
        setExpiryFilter('EXPIRED');
      } else {
        setExpiryFilter('EXPIRING_SOON');
      }
      setStockFilter('ALL');
    }
  };

  // Process Stock Receipt
  const handleReceiveStock = (input: ReceiveStockInput) => {
    try {
      const result = processStockReceipt(demoState, input);
      const saveOk = saveDemoInventory(result.nextState);
      if (!saveOk) {
        showToast('error', 'Receiving failed: Unable to persist to browser storage. Inventory remains unchanged.');
        return;
      }

      setDemoState(result.nextState);

      // Expand the received medicine card automatically
      const targetMedId = input.medicineId || result.affectedBatch.medicineId;
      setExpandedIds((prev) => new Set([...prev, targetMedId]));

      const actionDesc = result.isExistingBatch
        ? `Added ${input.quantity} units to existing compatible Batch ${input.batchNumber}.`
        : `Created new Batch ${input.batchNumber} with ${input.quantity} units.`;

      showToast('success', `Stock received successfully! ${actionDesc}`);
      setIsReceiveOpen(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to receive stock');
    }
  };

  // Process Stock Adjustment
  const handleAdjustStock = (input: AdjustStockInput) => {
    try {
      const result = processStockAdjustment(demoState, input);
      const saveOk = saveDemoInventory(result.nextState);
      if (!saveOk) {
        showToast('error', 'Adjustment failed: Unable to persist to browser storage. Inventory remains unchanged.');
        return;
      }

      setDemoState(result.nextState);

      const typeLabel = input.movementType.replace(/_/g, ' ');
      const changeDesc = input.quantityChange > 0 ? `+${input.quantityChange}` : `${input.quantityChange}`;
      showToast('success', `Adjustment recorded! Batch ${result.affectedBatch.batchNumber}: ${typeLabel} (${changeDesc} units).`);
      setAdjustTarget(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to adjust stock');
    }
  };

  // Process Counter Sale Checkout (Stage 3B)
  const handleCheckoutSale = (input: ProcessSaleInput): boolean => {
    try {
      const result = processSaleCheckout(demoState, input);
      if (result.isIdempotentReplay) {
        showToast('success', `Sale ${result.sale.id} already processed. Displaying receipt.`);
        setSelectedReceiptSale(result.sale);
        setIsReceiptOpen(true);
        return true;
      }

      // Isolate and persist
      const saveOk = saveDemoInventory(result.nextState);
      if (!saveOk) {
        showToast('error', 'Checkout failed: Unable to persist to browser storage. Inventory remains unchanged.');
        return false;
      }

      setDemoState(result.nextState);
      setSelectedReceiptSale(result.sale);
      setIsReceiptOpen(true);

      const totalQty = input.cart.reduce((acc, c) => acc + c.quantity, 0);
      showToast('success', `Sale ${result.sale.id} confirmed! (${totalQty} units dispensed via FEFO)`);
      return true;
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Checkout failed');
      return false;
    }
  };

  // Reset Demo Dataset Safely
  const handleResetDemo = () => {
    if (window.confirm('Reset all inventory, counter sales, and stock ledger changes back to original demo dataset?')) {
      const fresh = resetDemoInventory();
      setDemoState(fresh);
      resetFilters();
      setExpandedIds(new Set(['med-dolo-650']));
      showToast('success', 'Demo data reset to initial seed state.');
    }
  };

  // Pharmacy Profile & Tenant Management (Phase 2)
  const handleUpdatePharmacyProfile = (pharmacyId: string, input: UpdatePharmacyInput) => {
    try {
      const nextState = updatePharmacyProfile(demoState, pharmacyId, input);
      setDemoState(nextState);
      showToast('success', 'Pharmacy profile and legal details updated successfully.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update pharmacy profile.');
    }
  };

  const handleSwitchPharmacy = (pharmacyId: string) => {
    try {
      const nextState = switchPharmacyTenant(demoState, pharmacyId);
      setDemoState(nextState);
      const target = nextState.pharmacies.find((p) => p.id === pharmacyId);
      showToast('success', `Switched active tenant to ${target?.name || 'selected pharmacy'}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to switch pharmacy.');
    }
  };

  const handleCreatePharmacy = (input: UpdatePharmacyInput & { ownerName: string; ownerPhone: string; ownerEmail: string }) => {
    try {
      const nextState = createPharmacyTenant(demoState, input);
      setDemoState(nextState);
      showToast('success', `Created and activated new pharmacy branch "${input.name}".`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to register pharmacy.');
    }
  };

  const handleAddStaffMember = (pharmacyId: string, input: AddMemberInput) => {
    try {
      const nextState = addPharmacyStaffMember(demoState, pharmacyId, input);
      setDemoState(nextState);
      showToast('success', `Added ${input.name} (${input.role}) to staff list.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add staff member.');
    }
  };

  const handleRemoveStaffMember = (pharmacyId: string, memberId: string) => {
    try {
      const nextState = removePharmacyStaffMember(demoState, pharmacyId, memberId);
      setDemoState(nextState);
      showToast('success', 'Staff member removed.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove member.');
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-banner toast-${toast.type}`} role="alert">
          <div className="toast-content">
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
          <button 
            type="button" 
            className="toast-close-btn" 
            onClick={() => setToast(null)}
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Brand Header, Tenant Badge, View Tabs & Demo Banner */}
      <Header 
        pharmacyName={activePharmacy?.name || 'Nandan Pharmacy'} 
        location={activePharmacy ? `${activePharmacy.city}, ${activePharmacy.state}` : 'Kolkata, WB'}
        activeView={activeView}
        onViewChange={(view) => {
          setActiveView(view);
          if (view === 'inventory') setActiveTab('inventory');
          if (view === 'settings') setActiveTab('settings');
        }}
        onOpenReceive={() => setIsReceiveOpen(true)}
        onResetDemo={handleResetDemo}
        ledgerCount={movements.length}
        salesCount={sales.length}
      />

      {/* Aggregate KPI Overview (shown for inventory view) */}
      {activeView === 'inventory' && (
        <KpiSummary 
          kpis={kpis} 
          activeFilter={stockFilter}
          onFilterClick={handleKpiFilterClick}
        />
      )}

      {/* MAIN VIEW AREA: INVENTORY, POS COUNTER, STOCK LEDGER OR SETTINGS */}
      {activeView === 'inventory' ? (
        <>
          {/* Search Input & Filter Pills */}
          <Controls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            stockFilter={stockFilter}
            onStockFilterChange={setStockFilter}
            expiryFilter={expiryFilter}
            onExpiryFilterChange={setExpiryFilter}
            counts={filterCounts}
          />

          {/* Medicine & Batch Cards */}
          <main className="inventory-list-section" role="region" aria-label="Medicine Inventory List">
            {filteredSummaries.length > 0 ? (
              filteredSummaries.map((summary) => (
                <MedicineCard
                  key={summary.medicine.id}
                  summary={summary}
                  isExpanded={expandedIds.has(summary.medicine.id)}
                  onToggleExpand={() => toggleExpand(summary.medicine.id)}
                  onOpenAdjust={(batch, medicine) => setAdjustTarget({ batch, medicine })}
                />
              ))
            ) : (
              <EmptyState
                searchQuery={searchQuery}
                hasActiveFilters={Boolean(searchQuery || stockFilter !== 'ALL' || expiryFilter !== 'ALL')}
                onReset={resetFilters}
              />
            )}
          </main>
        </>
      ) : activeView === 'pos' ? (
        /* Counter Sales POS Screen */
        <main className="pos-main-section" role="region" aria-label="Counter Sales POS">
          <PosScreen
            medicines={medicines}
            batches={batches}
            sales={sales}
            onCheckout={handleCheckoutSale}
            onViewReceipt={(sale) => {
              setSelectedReceiptSale(sale);
              setIsReceiptOpen(true);
            }}
          />
        </main>
      ) : activeView === 'settings' ? (
        /* Multi-tenant Pharmacy Profile & Settings View (Phase 2) */
        <main className="inventory-list-section" role="region" aria-label="Pharmacy Profile Settings">
          <PharmacySettingsView
            pharmacies={pharmacies}
            activePharmacyId={activePharmacyId}
            onSwitchPharmacy={handleSwitchPharmacy}
            onUpdateProfile={handleUpdatePharmacyProfile}
            onCreatePharmacy={handleCreatePharmacy}
            onAddMember={handleAddStaffMember}
            onRemoveMember={handleRemoveStaffMember}
            onBackToInventory={() => {
              setActiveView('inventory');
              setActiveTab('inventory');
            }}
          />
        </main>
      ) : (
        /* Stock Movement Ledger View */
        <main className="inventory-list-section" role="region" aria-label="Auditable Stock Ledger">
          <StockLedgerView 
            movements={movements} 
            onOpenReceiveModal={() => setIsReceiveOpen(true)}
          />
        </main>
      )}

      {/* 4-Tab Bottom Navigation */}
      <BottomNav 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'inventory') {
            setActiveView('inventory');
          } else if (tab === 'settings') {
            setActiveView('settings');
          }
        }} 
        inventoryCount={filteredSummaries.length}
      />

      {/* Receive Stock Modal */}
      {isReceiveOpen && (
        <ReceiveStockModal
          medicines={medicines}
          existingBatches={batches}
          isOpen={isReceiveOpen}
          onClose={() => setIsReceiveOpen(false)}
          onReceive={handleReceiveStock}
        />
      )}

      {/* Adjust / Write-off Stock Modal */}
      {adjustTarget && (
        <AdjustStockModal
          isOpen={Boolean(adjustTarget)}
          batch={adjustTarget.batch}
          medicine={adjustTarget.medicine}
          onClose={() => setAdjustTarget(null)}
          onAdjust={handleAdjustStock}
        />
      )}

      {/* Completed Sale Dispensing Receipt Modal */}
      {isReceiptOpen && selectedReceiptSale && (
        <SaleReceiptModal
          isOpen={isReceiptOpen}
          sale={selectedReceiptSale}
          pharmacy={activePharmacy}
          onClose={() => {
            setIsReceiptOpen(false);
            setSelectedReceiptSale(null);
          }}
          onNewSale={() => {
            setIsReceiptOpen(false);
            setSelectedReceiptSale(null);
            setActiveView('pos');
          }}
        />
      )}
    </div>
  );
};

export default App;
