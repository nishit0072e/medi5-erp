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
import { PatientsView } from './components/PatientsView';
import { LoginScreen } from './components/LoginScreen';
import { SuperAdminPortal } from './components/SuperAdminPortal';
import { getStoredSession, clearStoredSession, AUTH_SESSION_KEY } from './utils/authService';
import { 
  DEMO_STORAGE_KEY,
  loadDemoInventory, 
  saveDemoInventory, 
  resetDemoInventory, 
  processStockReceipt, 
  processStockAdjustment,
  processSaleCheckout,
  getTenantInventory,
  updatePharmacyProfile,
  switchPharmacyTenant,
  createPharmacyTenant,
  addPharmacyStaffMember,
  removePharmacyStaffMember,
  createPatient,
  updatePatient,
  deletePatient,
  addPatientMedication,
  deletePatientMedication,
  recordWhatsAppReminderSent,
  markRefillDispensed
} from './data/demoRepository';
import { UpdatePharmacyInput, AddMemberInput, AuthSession } from './types/pharmacy';
import { CreatePatientInput, AddMedicationInput, Patient } from './types/patient';
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
  // 0. Authentication & Multi-Tenant Session State
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [inspectingPharmacyId, setInspectingPharmacyId] = useState<string | null>(null);

  // 1. Initial State from Versioned Demo Repository
  const [demoState, setDemoState] = useState(() => loadDemoInventory());
  const {
    medicines: allMedicines,
    batches: allBatches,
    movements: allMovements,
    sales: allSales = [],
    pharmacies = [],
    activePharmacyId = ''
  } = demoState;

  // Determine current role & isolated pharmacy context
  const isSuperAdmin = session?.user.role === 'SUPER_ADMIN';

  // Active Pharmacy Tenant:
  // - Super Admin may inspect any pharmacy (or the last active tenant).
  // - Tenant users are strictly bound to their authenticated pharmacyId. No fallback.
  const effectivePharmacyId = isSuperAdmin
    ? (inspectingPharmacyId || activePharmacyId || pharmacies[0]?.id || '')
    : (session?.user.pharmacyId || '');

  const activePharmacy = useMemo(() => {
    return pharmacies.find((p) => p.id === effectivePharmacyId)
      || (isSuperAdmin ? pharmacies[0] : undefined);
  }, [pharmacies, effectivePharmacyId, isSuperAdmin]);

  const tenantInventory = useMemo(
    () => getTenantInventory(demoState, effectivePharmacyId),
    [demoState, effectivePharmacyId]
  );
  const { 
    medicines, 
    batches, 
    movements, 
    sales,
    patients = [],
    refills = [],
    reminderLogs = []
  } = tenantInventory;

  // 2. Navigation & View State ('inventory' | 'pos' | 'ledger' | 'patients' | 'settings')
  const [activeView, setActiveView] = useState<'inventory' | 'pos' | 'ledger' | 'patients' | 'settings'>('inventory');
  const activeTab: 'inventory' | 'patients' | 'analytics' | 'settings' = 
    activeView === 'settings' ? 'settings' : activeView === 'patients' ? 'patients' : 'inventory';

  // Urgent Refills Count
  const refillsDueCount = useMemo(() => {
    return refills.filter((r) => r.status === 'DUE_TODAY' || r.status === 'OVERDUE').length;
  }, [refills]);

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

  const handleLogout = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setInspectingPharmacyId(null);
    setActiveView('inventory');
    setSearchQuery('');
    setStockFilter('ALL');
    setExpiryFilter('ALL');
    setExpandedIds(new Set());
    setIsReceiveOpen(false);
    setAdjustTarget(null);
    setSelectedReceiptSale(null);
    setIsReceiptOpen(false);
    setToast(null);
  }, []);

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

  // Keep demo data and authentication synchronized across browser tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DEMO_STORAGE_KEY) {
        setDemoState(loadDemoInventory());
      }
      if (event.key === AUTH_SESSION_KEY) {
        setSession(getStoredSession());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
      const result = processStockReceipt(demoState, input, session?.user.name, effectivePharmacyId);
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
      const result = processStockAdjustment(demoState, input, session?.user.name, effectivePharmacyId);
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
      const result = processSaleCheckout(
        demoState,
        input,
        new Date(),
        session?.user.name,
        effectivePharmacyId
      );
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

  // Reset Demo Dataset Safely (tenant-scoped unless Super Admin)
  const handleResetDemo = () => {
    const resetScope = isSuperAdmin ? 'all pharmacy tenants' : activePharmacy?.name || 'this pharmacy';
    if (window.confirm(`Reset inventory, counter sales, and stock ledger changes for ${resetScope} back to the original demo dataset?`)) {
      try {
        const fresh = resetDemoInventory(isSuperAdmin ? undefined : effectivePharmacyId);
        setDemoState(fresh);
        resetFilters();
        setExpandedIds(new Set(['med-dolo-650']));
        showToast('success', `Demo data reset for ${resetScope}.`);
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to reset demo data.');
      }
    }
  };

  // Pharmacy Profile & Tenant Management (Phase 2)
  const persistTenantChange = (
    nextState: ReturnType<typeof updatePharmacyProfile>,
    failureMessage: string
  ): boolean => {
    if (!saveDemoInventory(nextState)) {
      showToast('error', failureMessage);
      return false;
    }
    setDemoState(nextState);
    return true;
  };

  const handleUpdatePharmacyProfile = (pharmacyId: string, input: UpdatePharmacyInput) => {
    try {
      const nextState = updatePharmacyProfile(demoState, pharmacyId, input);
      if (!persistTenantChange(nextState, 'Profile update failed: unable to persist changes.')) return;
      showToast('success', 'Pharmacy profile and legal details updated successfully.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update pharmacy profile.');
    }
  };

  const handleSwitchPharmacy = (pharmacyId: string) => {
    try {
      const nextState = switchPharmacyTenant(demoState, pharmacyId);
      if (!persistTenantChange(nextState, 'Tenant switch failed: unable to persist active pharmacy.')) return;
      if (isSuperAdmin) setInspectingPharmacyId(pharmacyId);
      setActiveView('inventory');
      setSearchQuery('');
      setStockFilter('ALL');
      setExpiryFilter('ALL');
      setExpandedIds(new Set());
      setSelectedReceiptSale(null);
      setIsReceiptOpen(false);
      setAdjustTarget(null);
      setIsReceiveOpen(false);
      const target = nextState.pharmacies.find((p) => p.id === pharmacyId);
      showToast('success', `Switched active tenant to ${target?.name || 'selected pharmacy'}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to switch pharmacy.');
    }
  };

  const handleCreatePharmacy = (input: UpdatePharmacyInput & { ownerName: string; ownerPhone: string; ownerEmail: string }) => {
    try {
      const nextState = createPharmacyTenant(demoState, input);
      if (!persistTenantChange(nextState, 'Registration failed: unable to persist the new pharmacy.')) return;
      showToast('success', `Created and activated new pharmacy branch "${input.name}".`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to register pharmacy.');
    }
  };

  const handleAddStaffMember = (pharmacyId: string, input: AddMemberInput) => {
    try {
      const nextState = addPharmacyStaffMember(demoState, pharmacyId, input);
      if (!persistTenantChange(nextState, 'Staff creation failed: unable to persist changes.')) return;
      showToast('success', `Added ${input.name} (${input.role}) to staff list.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add staff member.');
    }
  };

  const handleRemoveStaffMember = (pharmacyId: string, memberId: string) => {
    try {
      const nextState = removePharmacyStaffMember(demoState, pharmacyId, memberId);
      if (!persistTenantChange(nextState, 'Staff removal failed: unable to persist changes.')) return;
      showToast('success', 'Staff member removed.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove member.');
    }
  };

  // =========================================================================
  // Patient & WhatsApp Refill Reminders Handlers (Phase 3)
  // =========================================================================
  const handleCreatePatient = (input: CreatePatientInput) => {
    try {
      const result = createPatient(demoState, activePharmacy?.id, input);
      if (!persistTenantChange(result.nextState, 'Patient registration failed: unable to persist changes.')) return;
      showToast('success', `Registered patient "${result.patient.name}" successfully.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to register patient');
    }
  };

  const handleUpdatePatient = (patientId: string, input: Partial<Patient>) => {
    try {
      const result = updatePatient(demoState, activePharmacy?.id, patientId, input);
      if (!persistTenantChange(result.nextState, 'Patient update failed: unable to persist changes.')) return;
      showToast('success', 'Patient record updated successfully.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update patient');
    }
  };

  const handleDeletePatient = (patientId: string) => {
    try {
      const nextState = deletePatient(demoState, activePharmacy?.id, patientId);
      if (!persistTenantChange(nextState, 'Patient deletion failed: unable to persist changes.')) return;
      showToast('success', 'Patient record and reminders removed.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete patient');
    }
  };

  const handleAddMedication = (patientId: string, input: AddMedicationInput) => {
    try {
      const result = addPatientMedication(demoState, activePharmacy?.id, patientId, input);
      if (!persistTenantChange(result.nextState, 'Medication schedule failed: unable to persist changes.')) return;
      showToast('success', `Added ${result.medication.medicineName} to refill schedule.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add medication');
    }
  };

  const handleDeleteMedication = (medicationId: string) => {
    try {
      const nextState = deletePatientMedication(demoState, activePharmacy?.id, medicationId);
      if (!persistTenantChange(nextState, 'Medication deletion failed: unable to persist changes.')) return;
      showToast('success', 'Medication removed from refill schedule.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove medication');
    }
  };

  const handleRecordWhatsAppSent = (logData: {
    patientId: string;
    medicationId: string;
    patientName: string;
    patientPhone: string;
    messageText: string;
    initiatedByStaff: string;
  }) => {
    try {
      const result = recordWhatsAppReminderSent(demoState, activePharmacy?.id, logData);
      if (!persistTenantChange(result.nextState, 'Audit log failed: unable to persist changes.')) return;
      showToast('success', `WhatsApp reminder logged for ${logData.patientName}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to record WhatsApp reminder');
    }
  };

  const handleMarkRefillDispensed = (medicationId: string) => {
    try {
      const result = markRefillDispensed(demoState, activePharmacy?.id, medicationId);
      if (!persistTenantChange(result.nextState, 'Refill update failed: unable to persist changes.')) return;
      showToast('success', `Refill marked dispensed for ${result.medication.medicineName}. Next cycle scheduled!`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to mark refill dispensed');
    }
  };

  // Unauthenticated Barrier -> Render Login Screen with strict authentication
  if (!session) {
    return <LoginScreen onLoginSuccess={(newSession) => setSession(newSession)} />;
  }

  // Super Admin Platform Command Center (when not actively inspecting a specific store)
  if (isSuperAdmin && !inspectingPharmacyId) {
    return (
      <SuperAdminPortal
        pharmacies={pharmacies}
        allMedicines={allMedicines}
        allBatches={allBatches}
        allSales={allSales}
        allMovements={allMovements}
        onInspectPharmacy={(pharmacyId) => {
          setInspectingPharmacyId(pharmacyId);
          handleSwitchPharmacy(pharmacyId);
        }}
        onLogout={handleLogout}
        onCreatePharmacy={handleCreatePharmacy}
      />
    );
  }

  if (!activePharmacy) {
    return (
      <div className="app-container" style={{ padding: '24px' }}>
        <h2>Tenant context unavailable</h2>
        <p className="text-muted">
          Your account is not linked to a provisioned pharmacy. Please sign in again or contact the platform administrator.
        </p>
        <button type="button" className="btn-primary-action" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    );
  }

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
        pharmacyName={activePharmacy.name} 
        location={`${activePharmacy.city}, ${activePharmacy.state}`}
        activeView={activeView}
        onViewChange={setActiveView}
        onOpenReceive={() => setIsReceiveOpen(true)}
        onResetDemo={handleResetDemo}
        ledgerCount={movements.length}
        salesCount={sales.length}
        patientsCount={patients.length}
        refillsDueCount={refillsDueCount}
        currentUser={session.user}
        onLogout={handleLogout}
        isSuperAdminInspecting={Boolean(isSuperAdmin && inspectingPharmacyId)}
        onReturnToSuperAdmin={() => setInspectingPharmacyId(null)}
      />

      {/* Aggregate KPI Overview (shown for inventory view) */}
      {activeView === 'inventory' && (
        <KpiSummary 
          kpis={kpis} 
          activeFilter={stockFilter}
          onFilterClick={handleKpiFilterClick}
        />
      )}

      {/* MAIN VIEW AREA: INVENTORY, POS COUNTER, STOCK LEDGER, PATIENTS OR SETTINGS */}
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
            key={activePharmacy.id}
            medicines={medicines}
            batches={batches}
            sales={sales}
            staffUser={session.user.name}
            onCheckout={handleCheckoutSale}
            onViewReceipt={(sale) => {
              setSelectedReceiptSale(sale);
              setIsReceiptOpen(true);
            }}
          />
        </main>
      ) : activeView === 'patients' ? (
        /* Phase 3: Patients & WhatsApp Refill Reminders Screen */
        <main className="inventory-list-section" role="region" aria-label="Patients and Refills">
          <PatientsView
            patients={patients}
            refills={refills}
            reminderLogs={reminderLogs}
            medicines={medicines}
            pharmacy={activePharmacy}
            staffUser={session.user.name}
            onCreatePatient={handleCreatePatient}
            onUpdatePatient={handleUpdatePatient}
            onDeletePatient={handleDeletePatient}
            onAddMedication={handleAddMedication}
            onDeleteMedication={handleDeleteMedication}
            onRecordWhatsAppSent={handleRecordWhatsAppSent}
            onMarkDispensed={handleMarkRefillDispensed}
            onBackToInventory={() => setActiveView('inventory')}
          />
        </main>
      ) : activeView === 'settings' ? (
        /* Multi-tenant Pharmacy Profile & Settings View (Phase 2) */
        <main className="inventory-list-section" role="region" aria-label="Pharmacy Profile Settings">
          <PharmacySettingsView
            pharmacies={isSuperAdmin ? pharmacies : [activePharmacy]}
            activePharmacyId={activePharmacy.id}
            isSuperAdmin={isSuperAdmin}
            onSwitchPharmacy={handleSwitchPharmacy}
            onUpdateProfile={handleUpdatePharmacyProfile}
            onCreatePharmacy={handleCreatePharmacy}
            onAddMember={handleAddStaffMember}
            onRemoveMember={handleRemoveStaffMember}
            onBackToInventory={() => setActiveView('inventory')}
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
          if (tab === 'inventory') {
            setActiveView('inventory');
          } else if (tab === 'patients') {
            setActiveView('patients');
          } else if (tab === 'settings') {
            setActiveView('settings');
          }
        }} 
        inventoryCount={filteredSummaries.length}
        refillAlertCount={refillsDueCount}
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
