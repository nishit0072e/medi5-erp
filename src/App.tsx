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
import { AnalyticsView } from './components/AnalyticsView';
import { LoginScreen } from './components/LoginScreen';
import { SuperAdminPortal } from './components/SuperAdminPortal';
import { DoctorCorner } from './components/DoctorCorner';
import { OPDCorner } from './components/OPDCorner';
import { AppointmentsView } from './components/AppointmentsView';
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
  markRefillDispensed,
  snoozeRefill,
  cancelRefill,
  completeRefill,
  reactivateRefill,
  createPrescription,
  deletePrescription,
  linkSaleToPatient,
  createDoctor,
  updateDoctor,
  createEPrescription,
  updateEPrescriptionStatus,
  shareEPrescription,
  registerPatientFromPrescription,
  createAppointment,
  updateAppointmentStatus,
  updateAppointmentVitals,
  deleteAppointment,
  saveDoctorSchedule,
  deleteDoctorSchedule
} from './data/demoRepository';
import { UpdatePharmacyInput, CreatePharmacyInput, AddMemberInput, AuthSession } from './types/pharmacy';
import { CreatePatientInput, AddMedicationInput, UpdatePatientInput, PrescriptionReference } from './types/patient';
import { CreateAppointmentInput, PatientVitals, AppointmentStatus, DoctorScheduleSlot, PaymentStatus, PaymentMode } from './types/appointment';
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
import { computePharmacyAnalytics, getDefaultPeriod } from './utils/analytics';
import { AnalyticsPeriod } from './types/analytics';

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

  // Generate pharmacy code from name (first 3 letters uppercase)
  const pharmacyCode = useMemo(() => {
    if (!activePharmacy) return 'MED';
    return activePharmacy.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'MED';
  }, [activePharmacy]);

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
    reminderLogs = [],
    prescriptions = [],
    doctors = [],
    ePrescriptions = [],
    appointments = [],
    doctorSchedules = []
  } = tenantInventory;

  // 2. Navigation & View State
  const [activeView, setActiveView] = useState<'inventory' | 'pos' | 'ledger' | 'patients' | 'analytics' | 'settings' | 'doctor-corner' | 'opd-corner' | 'appointments'>(() => {
    const current = getStoredSession();
    if (current?.user.role === 'DOCTOR') return 'doctor-corner';
    if (current?.user.role === 'STAFF') return 'pos';
    if (current?.user.role === 'MANAGER') return 'inventory';
    if (current?.user.role === 'OWNER') return 'analytics';
    return 'inventory';
  });
  const activeTab: 'inventory' | 'patients' | 'analytics' | 'settings' = 
    activeView === 'settings'
      ? 'settings'
      : activeView === 'patients'
        ? 'patients'
        : activeView === 'analytics'
          ? 'analytics'
          : activeView === 'doctor-corner'
            ? 'patients'
            : activeView === 'opd-corner'
              ? 'patients'
              : 'inventory';

  // Urgent Refills Count
  const refillsDueCount = useMemo(() => {
    return refills.filter((r) => r.status === 'DUE_TODAY' || r.status === 'OVERDUE').length;
  }, [refills]);

  // Today Waiting Appointments Count
  const todayAppointmentsWaitingCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter((a) => a.appointmentDate === today && a.status === 'WAITING').length;
  }, [appointments]);

  // Analytics computation for leakage score and analytics view
  const [analyticsPeriod] = useState<AnalyticsPeriod>(() => getDefaultPeriod());
  const analytics = useMemo(() => {
    if (!medicines.length && !sales.length) return null;
    return computePharmacyAnalytics({
      pharmacy: { id: activePharmacy?.id || '', name: activePharmacy?.name || '' } as any,
      medicines,
      batches,
      sales,
      movements,
      period: analyticsPeriod,
      referenceDate: new Date()
    });
  }, [medicines, batches, sales, movements, analyticsPeriod]);

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

  const handleCreatePharmacy = (input: CreatePharmacyInput) => {
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

  const handleUpdatePatient = (patientId: string, input: UpdatePatientInput) => {
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

  const handleSnoozeRefill = (medicationId: string) => {
    try {
      const result = snoozeRefill(demoState, activePharmacy?.id, medicationId, 7);
      if (!persistTenantChange(result.nextState, 'Refill snooze failed: unable to persist changes.')) return;
      showToast('success', `Refill reminder snoozed to ${result.medication.nextRefillDueDate}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to snooze refill');
    }
  };

  const handleCancelRefill = (medicationId: string) => {
    try {
      const result = cancelRefill(demoState, activePharmacy?.id, medicationId);
      if (!persistTenantChange(result.nextState, 'Refill cancellation failed: unable to persist changes.')) return;
      showToast('success', `Refill schedule for ${result.medication.medicineName} cancelled.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to cancel refill');
    }
  };

  const handleCompleteRefill = (medicationId: string) => {
    try {
      const result = completeRefill(demoState, activePharmacy?.id, medicationId);
      if (!persistTenantChange(result.nextState, 'Refill update failed: unable to persist changes.')) return;
      showToast('success', `${result.medication.medicineName} therapy marked completed.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to complete refill');
    }
  };

  const handleReactivateRefill = (medicationId: string) => {
    try {
      const result = reactivateRefill(demoState, activePharmacy?.id, medicationId);
      if (!persistTenantChange(result.nextState, 'Refill update failed: unable to persist changes.')) return;
      showToast('success', `${result.medication.medicineName} refill schedule reactivated.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reactivate refill');
    }
  };

  const handleCreatePrescription = (
    patientId: string,
    input: Omit<PrescriptionReference, 'id' | 'pharmacyId' | 'patientId' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      const result = createPrescription(demoState, activePharmacy?.id, { ...input, patientId });
      if (!persistTenantChange(result.nextState, 'Prescription save failed: unable to persist changes.')) return;
      showToast('success', `Prescription ${result.prescription.referenceNumber} saved.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save prescription');
    }
  };

  const handleDeletePrescription = (prescriptionId: string) => {
    try {
      const nextState = deletePrescription(demoState, activePharmacy?.id, prescriptionId);
      if (!persistTenantChange(nextState, 'Prescription deletion failed: unable to persist changes.')) return;
      showToast('success', 'Prescription reference deleted.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete prescription');
    }
  };

  const handleLinkPurchase = (patientId: string, saleId: string) => {
    try {
      const nextState = linkSaleToPatient(demoState, activePharmacy?.id, saleId, patientId);
      if (!persistTenantChange(nextState, 'Purchase linkage failed: unable to persist changes.')) return;
      showToast('success', 'Sale linked to patient purchase history.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to link sale');
    }
  };

  // =========================================================================
  // E-Prescription & OPD Corner Handlers
  // =========================================================================

  const handleCreateDoctor = (input: any) => {
    try {
      const result = createDoctor(demoState, effectivePharmacyId, input);
      if (!persistTenantChange(result.nextState, 'Doctor registration failed: unable to persist changes.')) return;
      showToast('success', `Registered Dr. ${result.doctor.name} successfully.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to register doctor');
    }
  };

  const handleUpdateDoctor = (doctorId: string, input: any) => {
    try {
      const result = updateDoctor(demoState, effectivePharmacyId, doctorId, input);
      if (!persistTenantChange(result.nextState, 'Doctor update failed: unable to persist changes.')) return;
      showToast('success', `Dr. ${result.doctor.name} updated successfully.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update doctor');
    }
  };

  const handleCreateEPrescription = (input: any) => {
    try {
      const result = createEPrescription(demoState, effectivePharmacyId, input);
      if (!persistTenantChange(result.nextState, 'E-Prescription creation failed: unable to persist changes.')) return;
      showToast('success', `E-Prescription ${result.prescription.referenceNumber} created for ${result.prescription.patientName}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create e-prescription');
    }
  };

  const handleDispensePrescription = (prescriptionId: string, dispensedMeds: Array<{ medicationId: string; quantityDispensed: number; batchNumbers: string[] }>) => {
    try {
      const result = updateEPrescriptionStatus(demoState, effectivePharmacyId, prescriptionId, 'PARTIALLY_DISPENSED', dispensedMeds, session!.user.name);
      if (!persistTenantChange(result.nextState, 'Dispensing failed: unable to persist changes.')) return;
      showToast('success', `Medications dispensed for prescription ${result.prescription.referenceNumber}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to dispense medications');
    }
  };

  const handleSharePrescription = (prescriptionId: string, method: 'WHATSAPP' | 'EMAIL' | 'PRINT' | 'SMS') => {
    try {
      const result = shareEPrescription(demoState, effectivePharmacyId, prescriptionId, method);
      if (!persistTenantChange(result.nextState, 'Sharing failed: unable to persist changes.')) return;
      showToast('success', `Prescription shared via ${method}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to share prescription');
    }
  };

  const handleRegisterPatientFromPrescription = (prescriptionId: string) => {
    try {
      const result = registerPatientFromPrescription(demoState, effectivePharmacyId, prescriptionId);
      if (!persistTenantChange(result.nextState, 'Patient registration failed: unable to persist changes.')) return;
      showToast('success', `Patient ${result.patient.name} registered with ${result.createdPatientIds.length} lifetime medication(s).`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to register patient');
    }
  };

  // Phase 6: Doctor Appointments & Chamber Operations
  const handleCreateAppointment = (input: CreateAppointmentInput) => {
    try {
      const result = createAppointment(demoState, effectivePharmacyId, input, session?.user.name || 'Reception Staff');
      if (!persistTenantChange(result.nextState, 'Booking failed: unable to persist changes.')) return;
      showToast('success', `Appointment booked! Token #${result.appointment.tokenNumber} assigned for ${result.appointment.patientName}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to book appointment');
    }
  };

  const handleUpdateAppointmentStatus = (
    appointmentId: string, 
    status: AppointmentStatus, 
    paymentStatus?: PaymentStatus, 
    paymentMode?: PaymentMode
  ) => {
    try {
      const result = updateAppointmentStatus(demoState, effectivePharmacyId, appointmentId, status, paymentStatus, paymentMode);
      if (!persistTenantChange(result.nextState, 'Status update failed: unable to persist changes.')) return;
      showToast('success', `Appointment status updated to ${status}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update appointment status');
    }
  };

  const handleUpdateAppointmentVitals = (appointmentId: string, vitals: PatientVitals) => {
    try {
      const result = updateAppointmentVitals(demoState, effectivePharmacyId, appointmentId, vitals);
      if (!persistTenantChange(result.nextState, 'Vitals recording failed: unable to persist changes.')) return;
      showToast('success', `Clinical vitals recorded for ${result.appointment.patientName}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to record vitals');
    }
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    try {
      const nextState = deleteAppointment(demoState, effectivePharmacyId, appointmentId);
      if (!persistTenantChange(nextState, 'Cancellation failed: unable to persist changes.')) return;
      showToast('success', 'Appointment removed.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove appointment');
    }
  };

  const handleSaveDoctorSchedule = (schedule: Omit<DoctorScheduleSlot, 'id' | 'pharmacyId'> & { id?: string }) => {
    try {
      const result = saveDoctorSchedule(demoState, effectivePharmacyId, schedule);
      if (!persistTenantChange(result.nextState, 'Schedule save failed: unable to persist changes.')) return;
      showToast('success', `Doctor shift for ${result.schedule.doctorName} saved.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  const handleDeleteDoctorSchedule = (scheduleId: string) => {
    try {
      const nextState = deleteDoctorSchedule(demoState, effectivePharmacyId, scheduleId);
      if (!persistTenantChange(nextState, 'Schedule deletion failed: unable to persist changes.')) return;
      showToast('success', 'Doctor shift removed.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to remove schedule');
    }
  };

  // Temporary patient cleanup is available via demoRepository.cleanupTemporaryPatients()

  // Unauthenticated Barrier -> Render Login Screen with strict authentication
  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          if (newSession.user.role === 'DOCTOR') {
            setActiveView('doctor-corner');
          } else if (newSession.user.role === 'STAFF') {
            setActiveView('pos');
          } else if (newSession.user.role === 'MANAGER') {
            setActiveView('inventory');
          } else if (newSession.user.role === 'OWNER') {
            setActiveView('analytics');
          }
        }}
      />
    );
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
        appointmentsCount={todayAppointmentsWaitingCount}
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
          <main className="inventory-list-section inventory-grid" role="region" aria-label="Medicine Inventory List">
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
      ) : activeView === 'analytics' ? (
        /* Phase 4: Financial Health & Leakage Analytics Screen */
        <main className="inventory-list-section" role="region" aria-label="Financial Health & Leakage Analytics">
          <AnalyticsView
            pharmacyId={activePharmacy.id}
            pharmacyName={activePharmacy.name}
            medicines={medicines}
            batches={batches}
            sales={sales}
            onBackToInventory={() => setActiveView('inventory')}
          />
        </main>
      ) : activeView === 'doctor-corner' ? (
        /* Doctor's Corner - E-Prescription Creation */
        <main className="inventory-list-section" role="region" aria-label="Doctor's Corner E-Prescription">
          <DoctorCorner
            _pharmacyId={activePharmacy.id}
            _pharmacyName={activePharmacy.name}
            pharmacyCode={pharmacyCode}
            doctors={doctors}
            medicines={medicines}
            onCreatePrescription={handleCreateEPrescription}
            onCreateDoctor={handleCreateDoctor}
            onUpdateDoctor={handleUpdateDoctor}
            onBackToInventory={() => setActiveView('inventory')}
            _staffUser={session.user.name}
          />
        </main>
      ) : activeView === 'opd-corner' ? (
        /* OPD Corner - Pharmacist E-Prescription Management */
        <main className="inventory-list-section" role="region" aria-label="OPD Corner E-Prescriptions">
          <OPDCorner
            pharmacyId={activePharmacy.id}
            pharmacyName={activePharmacy.name}
            pharmacyCode={pharmacyCode}
            prescriptions={ePrescriptions}
            medicines={medicines}
            batches={batches}
            patients={patients}
            onDispensePrescription={handleDispensePrescription}
            onSharePrescription={handleSharePrescription}
            onRegisterPatientFromPrescription={handleRegisterPatientFromPrescription}
            onBackToInventory={() => setActiveView('inventory')}
            staffUser={session.user.name}
          />
        </main>
      ) : activeView === 'appointments' ? (
        /* Phase 6: Doctor Appointments & Chamber Management */
        <main className="inventory-list-section" role="region" aria-label="Doctor Appointments & Chamber Queue">
          <AppointmentsView
            pharmacy={activePharmacy}
            doctors={doctors}
            patients={patients}
            appointments={appointments}
            schedules={doctorSchedules}
            staffUser={session.user.name}
            userRole={session.user.role}
            onCreateAppointment={handleCreateAppointment}
            onUpdateStatus={handleUpdateAppointmentStatus}
            onUpdateVitals={handleUpdateAppointmentVitals}
            onDeleteAppointment={handleDeleteAppointment}
            onSaveSchedule={handleSaveDoctorSchedule}
            onDeleteSchedule={handleDeleteDoctorSchedule}
            onStartConsultationBridge={(appointment) => {
              setActiveView('doctor-corner');
              showToast('success', `Bridged appointment #${appointment.tokenNumber} into Doctor Corner for ${appointment.patientName}.`);
            }}
            onBackToInventory={() => setActiveView('inventory')}
          />
        </main>
      ) : activeView === 'patients' ? (
        /* Phase 3: Patients & WhatsApp Refill Reminders Screen */
        <main className="inventory-list-section" role="region" aria-label="Patients and Refills">
          <PatientsView
            patients={patients}
            refills={refills}
            reminderLogs={reminderLogs}
            prescriptions={prescriptions}
            sales={sales}
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
            onSnoozeRefill={handleSnoozeRefill}
            onCancelRefill={handleCancelRefill}
            onCompleteRefill={handleCompleteRefill}
            onReactivateRefill={handleReactivateRefill}
            onCreatePrescription={handleCreatePrescription}
            onDeletePrescription={handleDeletePrescription}
            onLinkPurchase={handleLinkPurchase}
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
            prescriptions={ePrescriptions}
            pharmacy={activePharmacy}
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
          } else if (tab === 'analytics') {
            setActiveView('analytics');
          } else if (tab === 'settings') {
            setActiveView('settings');
          }
        }} 
        inventoryCount={filteredSummaries.length}
        refillAlertCount={refillsDueCount}
        leakageScore={analytics?.leakage.leakageScore || 0}
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
