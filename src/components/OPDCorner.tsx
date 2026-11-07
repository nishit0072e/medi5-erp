import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  FileText, Search, X, CheckCircle2, AlertCircle, 
  Pill, Truck, Send, Download,
  Clock, Calendar, User, Stethoscope, Microscope, Zap,
  MessageSquare, Mail, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { EPrescription, PrescriptionStatus, OPDCornerFilters } from '../types/eprescription';
import { Medicine, MedicineBatch } from '../types/inventory';
import { formatINR } from '../utils/moneyUtils';
import { downloadPrescriptionPDF, printPrescriptionDocument } from '../utils/prescriptionPdf';

interface OPDCornerProps {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyCode: string;
  prescriptions: EPrescription[];
  medicines: Medicine[];
  batches: MedicineBatch[];
  patients: any[];
  onDispensePrescription: (prescriptionId: string, dispensedMeds: Array<{ medicationId: string; quantityDispensed: number; batchNumbers: string[] }>) => void;
  onSharePrescription: (prescriptionId: string, method: 'WHATSAPP' | 'EMAIL' | 'PRINT' | 'SMS') => void;
  onRegisterPatientFromPrescription: (prescriptionId: string) => void;
  onBackToInventory: () => void;
  staffUser: string;
}

const STATUS_COLORS: Record<PrescriptionStatus, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  DISPENSED: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  PARTIALLY_DISPENSED: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  EXPIRED: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' }
};

const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  ACTIVE: 'Pending',
  DISPENSED: 'Dispensed',
  PARTIALLY_DISPENSED: 'Partial',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired'
};

export const OPDCorner: React.FC<OPDCornerProps> = (props) => {
  const { prescriptions, medicines, batches, patients, onDispensePrescription, onSharePrescription, onRegisterPatientFromPrescription, onBackToInventory } = props;
  const [filters, setFilters] = useState<OPDCornerFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<EPrescription | null>(null);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [dispenseForm, setDispenseForm] = useState<Record<string, { quantity: number; batchIds: string[] }>>({});
  const [showPatientRegModal, setShowPatientRegModal] = useState<EPrescription | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'dispensed' | 'all'>('pending');
  const [isDispensing, setIsDispensing] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [expandedPrescriptionId, setExpandedPrescriptionId] = useState<string | null>(null);

  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredPrescriptions = useMemo(() => {
    let result = prescriptions;
    
    if (activeTab === 'pending') {
      result = result.filter(p => p.status === 'ACTIVE' || p.status === 'PARTIALLY_DISPENSED');
    } else if (activeTab === 'dispensed') {
      result = result.filter(p => p.status === 'DISPENSED');
    }
    
    if (filters.status && filters.status !== 'ACTIVE') {
      result = result.filter(p => p.status === filters.status);
    }
    
    if (filters.dateFrom) {
      result = result.filter(p => p.generatedAt >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      result = result.filter(p => p.generatedAt <= filters.dateTo! + 'T23:59:59');
    }
    
    if (searchDebounce.trim()) {
      const query = searchDebounce.toLowerCase();
      result = result.filter(p => 
        p.patientName.toLowerCase().includes(query) ||
        p.referenceNumber.toLowerCase().includes(query) ||
        p.doctorName.toLowerCase().includes(query) ||
        p.medications.some(m => m.medicineName.toLowerCase().includes(query))
      );
    }
    
    return result.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [prescriptions, filters, searchDebounce, activeTab]);

  const pendingCount = prescriptions.filter(p => p.status === 'ACTIVE' || p.status === 'PARTIALLY_DISPENSED').length;
  const dispensedCount = prescriptions.filter(p => p.status === 'DISPENSED').length;

  const openDispenseModal = useCallback((prescription: EPrescription) => {
    setSelectedPrescription(prescription);
    const initialForm: Record<string, { quantity: number; batchIds: string[] }> = {};
    prescription.medications.forEach(med => {
      initialForm[med.id] = { quantity: med.quantity, batchIds: [] };
    });
    setDispenseForm(initialForm);
    setDispenseError(null);
    setShowDispenseModal(true);
  }, []);

  const handleBatchSelect = useCallback((medId: string, batchId: string, checked: boolean) => {
    setDispenseForm(prev => ({
      ...prev,
      [medId]: {
        ...prev[medId],
        batchIds: checked 
          ? [...prev[medId].batchIds, batchId] 
          : prev[medId].batchIds.filter(id => id !== batchId)
      }
    }));
  }, []);

  const handleQuantityChange = useCallback((medId: string, quantity: number) => {
    setDispenseForm(prev => ({
      ...prev,
      [medId]: { ...prev[medId], quantity: Math.max(0, quantity) }
    }));
  }, []);

  const handleDispense = useCallback(async () => {
    if (!selectedPrescription) return;
    
    const dispensedMeds = Object.entries(dispenseForm).map(([medId, { quantity, batchIds }]) => ({
      medicationId: medId,
      quantityDispensed: quantity,
      batchNumbers: batchIds
    })).filter(d => d.quantityDispensed > 0);
    
    if (dispensedMeds.length === 0) {
      setDispenseError('Please enter quantities and select batches for at least one medication');
      return;
    }

    for (const [, { quantity, batchIds }] of Object.entries(dispenseForm)) {
      if (quantity > 0 && batchIds.length === 0) {
        setDispenseError('Please select batches for all medications with quantity > 0');
        return;
      }
    }

    setIsDispensing(true);
    setDispenseError(null);
    try {
      await onDispensePrescription(selectedPrescription.id, dispensedMeds);
      setShowDispenseModal(false);
      setSelectedPrescription(null);
    } catch (err) {
      setDispenseError(err instanceof Error ? err.message : 'Failed to dispense medications');
    } finally {
      setIsDispensing(false);
    }
  }, [selectedPrescription, dispenseForm, onDispensePrescription]);

  const handleShare = useCallback(async (
    prescription: EPrescription,
    method: 'WHATSAPP' | 'EMAIL' | 'PRINT' | 'SMS' | 'DOWNLOAD'
  ) => {
    setIsSharing(`${prescription.id}-${method}`);
    setShareError(null);
    try {
      if (method === 'DOWNLOAD') {
        downloadPrescriptionPDF(prescription, {
          name: props.pharmacyName,
          code: props.pharmacyCode,
        });
        await onSharePrescription(prescription.id, 'PRINT');
        setFeedbackMsg(`Prescription PDF downloaded for ${prescription.referenceNumber}`);
      } else if (method === 'PRINT') {
        printPrescriptionDocument(prescription, {
          name: props.pharmacyName,
          code: props.pharmacyCode,
        });
        await onSharePrescription(prescription.id, 'PRINT');
        setFeedbackMsg(`Sent prescription ${prescription.referenceNumber} to printer`);
      } else if (method === 'WHATSAPP') {
        const cleanPhone = (prescription.patientPhone || '').replace(/\D/g, '');
        const waText = `Namaskar ${prescription.patientName},\n\nYour digital e-prescription *(${prescription.referenceNumber})* from Dr. ${prescription.doctorName} at *${props.pharmacyName || 'Medi5'}*:\n\n*Diagnosis:* ${prescription.diagnosis}\n\n*Medications:*\n${prescription.medications.map(m => `• ${m.medicineName} (${m.dosage} ${m.dosageForm}) - ${m.frequency} x ${m.duration}`).join('\n')}\n\nThank you for choosing ${props.pharmacyName || 'our pharmacy'}! Stay healthy.`;
        const waUrl = cleanPhone 
          ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(waText)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        await onSharePrescription(prescription.id, 'WHATSAPP');
        setFeedbackMsg(`Opening WhatsApp to share with ${prescription.patientName}`);
      } else if (method === 'EMAIL') {
        const emailSubject = `E-Prescription ${prescription.referenceNumber} - ${props.pharmacyName || 'Medi5'}`;
        const emailBody = `Dear ${prescription.patientName},\n\nHere are your prescription details (${prescription.referenceNumber}) prescribed by Dr. ${prescription.doctorName}:\n\nDiagnosis: ${prescription.diagnosis}\n\nMedications:\n${prescription.medications.map(m => `- ${m.medicineName} (${m.dosage} ${m.dosageForm}) - ${m.frequency} for ${m.duration} (Qty: ${m.quantity})`).join('\n')}\n\nInstructions: ${prescription.clinicalNotes || 'None'}\n\nBest regards,\n${props.pharmacyName || 'Medi5 Pharmacy'}`;
        window.location.href = `mailto:${prescription.patientEmail || ''}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        await onSharePrescription(prescription.id, 'EMAIL');
        setFeedbackMsg(`Opening Email client to share with ${prescription.patientName}`);
      } else if (method === 'SMS') {
        const cleanPhone = (prescription.patientPhone || '').replace(/\D/g, '');
        const smsBody = `Medi5 Rx ${prescription.referenceNumber}: Dr ${prescription.doctorName}. Meds: ${prescription.medications.map(m => m.medicineName).join(', ')}. Details at pharmacy.`;
        if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(smsBody)}`;
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(smsBody);
        }
        await onSharePrescription(prescription.id, 'SMS');
        setFeedbackMsg(`SMS text prepared / copied for ${prescription.patientName} (${prescription.patientPhone})`);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : `Failed to share via ${method}`);
    } finally {
      setIsSharing(null);
    }
  }, [props.pharmacyName, props.pharmacyCode, onSharePrescription]);

  const handleRegisterPatient = useCallback((prescription: EPrescription) => {
    setShowPatientRegModal(prescription);
    setRegisterError(null);
  }, []);

  const confirmPatientRegistration = useCallback(async () => {
    if (!showPatientRegModal) return;
    setIsRegistering(true);
    setRegisterError(null);
    try {
      await onRegisterPatientFromPrescription(showPatientRegModal.id);
      setShowPatientRegModal(null);
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Failed to register patient');
    } finally {
      setIsRegistering(false);
    }
  }, [showPatientRegModal, onRegisterPatientFromPrescription]);

  const getAvailableBatches = useCallback((medicineName: string): MedicineBatch[] => {
    const med = medicines.find(m => m.name === medicineName);
    if (!med) return [];
    return batches.filter(b => b.medicineId === med.id && b.status === 'ACTIVE' && b.quantityRemaining > 0);
  }, [medicines, batches]);

  const formatDate = useCallback((isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDateOnly = useCallback((isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  const togglePrescriptionExpand = useCallback((id: string) => {
    setExpandedPrescriptionId(prev => prev === id ? null : id);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  const hasActiveFilters = Boolean(filters.status || filters.dateFrom || filters.dateTo || searchQuery.trim());

  return (
    <div className="opd-corner-container">
      <div className="opd-corner-header">
        <button type="button" className="btn-back-link" onClick={onBackToInventory}>
          <span>Back to Inventory</span>
        </button>
        <div>
          <h1 className="opd-corner-title">
            <FileText size={24} className="text-primary-green" />
            <span>OPD Corner <span className="title-sep">•</span> E-Prescriptions</span>
          </h1>
          <p className="opd-corner-subtitle">Manage and dispense e-prescriptions from Doctor's Corner</p>
        </div>
      </div>

      {feedbackMsg && (
        <div className="opd-feedback-banner" role="status">
          <CheckCircle2 size={16} />
          <span>{feedbackMsg}</span>
          <button type="button" className="feedback-dismiss" onClick={() => setFeedbackMsg(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
      {shareError && (
        <div className="opd-feedback-banner error" role="alert">
          <AlertCircle size={16} />
          <span>{shareError}</span>
          <button type="button" className="feedback-dismiss" onClick={() => setShareError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="opd-stats-bar">
        <div className="stat-card stat-pending">
          <span className="stat-icon"><FileText size={20} /></span>
          <div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-label">Pending Dispensing</div>
          </div>
        </div>
        <div className="stat-card stat-dispensed">
          <span className="stat-icon"><CheckCircle2 size={20} /></span>
          <div>
            <div className="stat-value">{dispensedCount}</div>
            <div className="stat-label">Dispensed</div>
          </div>
        </div>
        <div className="stat-card stat-total">
          <span className="stat-icon"><Clock size={20} /></span>
          <div>
            <div className="stat-value">{prescriptions.length}</div>
            <div className="stat-label">Total Prescriptions</div>
          </div>
        </div>
      </div>

      <div className="opd-tabs" role="tablist" aria-label="Prescription status tabs">
        {[
          { id: 'pending', label: 'Pending', count: pendingCount, icon: Clock },
          { id: 'dispensed', label: 'Dispensed', count: dispensedCount, icon: CheckCircle2 },
          { id: 'all', label: 'All', count: prescriptions.length, icon: FileText }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`opd-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as 'pending' | 'dispensed' | 'all')}
          >
            <tab.icon size={16} aria-hidden="true" />
            <span>{tab.label}</span>
            {tab.count > 0 && <span className="tab-badge" aria-label={`${tab.count} prescriptions`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="opd-filters">
        <div className="search-box">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="form-input"
            placeholder="Search by patient, doctor, medicine, ref#..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search prescriptions"
          />
        </div>
        <div className="filter-chips">
          {['ACTIVE', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED', 'EXPIRED'].map(status => (
            <button
              key={status}
              type="button"
              className={`filter-chip ${filters.status === status ? 'active' : ''}`}
              onClick={() => setFilters(prev => ({ ...prev, status: prev.status === status ? undefined : status as any }))}
              aria-pressed={filters.status === status}
            >
              {STATUS_LABELS[status as PrescriptionStatus]}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>
            <X size={14} /> Clear Filters
          </button>
        )}
        <button 
          type="button" 
          className="btn-secondary btn-sm" 
          onClick={() => setShowDateFilter(!showDateFilter)}
          aria-expanded={showDateFilter}
          aria-controls="date-filter-panel"
        >
          <Calendar size={14} /> Date Range
        </button>
      </div>

      {showDateFilter && (
        <div id="date-filter-panel" className="date-filter-panel" role="region" aria-label="Date range filter">
          <div className="filter-row">
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={filters.dateFrom || ''} 
                onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value || undefined }))}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={filters.dateTo || ''} 
                onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value || undefined }))}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <button type="button" className="btn-secondary btn-sm" style={{ marginTop: 'auto' }} onClick={() => setFilters(prev => ({ ...prev, dateFrom: undefined, dateTo: undefined }))}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="opd-prescription-list" role="list" aria-label="Prescriptions">
        {filteredPrescriptions.length === 0 ? (
          <div className="empty-state" role="status">
            <FileText size={48} className="text-muted" aria-hidden="true" />
            <h3>No prescriptions found</h3>
            <p className="text-muted">
              {activeTab === 'pending' 
                ? 'All pending prescriptions have been dispensed!' 
                : activeTab === 'dispensed'
                  ? 'No prescriptions have been dispensed yet.'
                  : 'No prescriptions match your filters.'}
            </p>
            {searchQuery && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => setSearchQuery('')}>
                <X size={14} /> Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredPrescriptions.map(prescription => {
            const statusColors = STATUS_COLORS[prescription.status];
            const nextFollowUp = prescription.nextFollowUpDate 
              ? formatDateOnly(prescription.nextFollowUpDate)
              : prescription.followUps.find(f => f.followUpDate) 
                ? formatDateOnly(prescription.followUps.find(f => f.followUpDate)!.followUpDate)
                : null;
            const isOverdue = nextFollowUp && new Date(nextFollowUp) < new Date();
            const isExpanded = expandedPrescriptionId === prescription.id;

            return (
              <article 
                key={prescription.id} 
                className={`prescription-card ${isExpanded ? 'expanded' : ''}`}
                role="listitem"
              >
                <div className="prescription-header">
                  <div className="prescription-ref">
                    <span className="ref-number">{prescription.referenceNumber}</span>
                    <span className="ref-date">{formatDate(prescription.generatedAt)}</span>
                  </div>
                  <span 
                    className="status-badge" 
                    style={{ 
                      backgroundColor: statusColors.bg, 
                      color: statusColors.text,
                      borderColor: statusColors.border
                    }}
                  >
                    {STATUS_LABELS[prescription.status]}
                  </span>
                </div>

                <div className="prescription-body" onClick={() => togglePrescriptionExpand(prescription.id)}>
                  <div className="patient-info">
                    <div className="patient-name-row">
                      <User size={16} aria-hidden="true" />
                      <strong>{prescription.patientName}</strong>
                      <span className="patient-age">Age: {prescription.patientAge} * {prescription.patientGender}</span>
                    </div>
                    <div className="patient-contact">
                      <span>Phone: {prescription.patientPhone}</span>
                      {prescription.patientEmail && <span>Email: {prescription.patientEmail}</span>}
                    </div>
                  </div>

                  <div className="doctor-info">
                    <Stethoscope size={14} aria-hidden="true" />
                    <span>Dr. {prescription.doctorName}</span>
                    <span className="doctor-specialization">{prescription.doctorSpecialization.replace('_', ' ')}</span>
                  </div>

                  <div className="medications-preview">
                    <Pill size={14} aria-hidden="true" />
                    <span>{prescription.medications.length} medication{prescription.medications.length > 1 ? 's' : ''}</span>
                    {prescription.medications.some(m => m.isLifetime) && (
                      <Zap size={14} className="lifetime-indicator" aria-label="Contains lifetime medication" />
                    )}
                  </div>

                  {nextFollowUp && (
                    <div className={`followup-info ${isOverdue ? 'overdue' : ''}`}>
                      <Calendar size={14} aria-hidden="true" />
                      <span>Next Follow-up: {nextFollowUp}</span>
                      {isOverdue && <AlertCircle size={14} className="overdue-icon" aria-label="Follow-up overdue" />}
                    </div>
                  )}

                  <div className="diagnosis-preview">
                    <span>Diagnosis: </span>
                    <span>{prescription.diagnosis.length > 50 ? prescription.diagnosis.substring(0, 50) + '...' : prescription.diagnosis}</span>
                  </div>
                </div>

                <div className="prescription-actions">
                  {prescription.status === 'ACTIVE' || prescription.status === 'PARTIALLY_DISPENSED' ? (
                    <>
                      <button 
                        type="button" 
                        className="btn-primary-action btn-sm" 
                        onClick={(e) => { e.stopPropagation(); openDispenseModal(prescription); }}
                        disabled={isDispensing}
                        aria-busy={isDispensing}
                      >
                        {isDispensing ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />} Dispense
                      </button>
                      {prescription.medications.some(m => m.isLifetime) && !patients.find(p => p.phone === prescription.patientPhone) && (
                        <button 
                          type="button" 
                          className="btn-secondary btn-sm" 
                          onClick={(e) => { e.stopPropagation(); handleRegisterPatient(prescription); }}
                          disabled={isRegistering}
                          aria-busy={isRegistering}
                        >
                          {isRegistering ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />} Register Patient
                        </button>
                      )}
                    </>
                  ) : prescription.status === 'DISPENSED' ? (
                    <span className="dispensed-label"><CheckCircle2 size={14} /> Dispensed by {prescription.dispensedBy || 'Pharmacist'}</span>
                  ) : (
                    <span className="cancelled-label">{STATUS_LABELS[prescription.status]}</span>
                  )}
                  
                  <div className="action-menu">
                    <button 
                      type="button" 
                      className="btn-toggle-expand" 
                      onClick={(e) => { e.stopPropagation(); togglePrescriptionExpand(prescription.id); }}
                      aria-label={`${isExpanded ? 'Collapse' : 'View'} prescription details for ${prescription.referenceNumber}`}
                      title={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {expandedPrescriptionId === prescription.id && (
                  <div className="prescription-detail-expanded" role="region" aria-label={`Prescription details for ${prescription.referenceNumber}`}>
                    <div className="detail-section">
                      <h3><User size={16} /> Patient Details</h3>
                      <div className="detail-grid">
                        <div><label>Name</label><span>{prescription.patientName}</span></div>
                        <div><label>Age / Gender</label><span>{prescription.patientAge} / {prescription.patientGender}</span></div>
                        <div><label>Phone</label><span>{prescription.patientPhone}</span></div>
                        <div><label>Email</label><span>{prescription.patientEmail || '--'}</span></div>
                        <div><label>Weight / Height</label><span>{prescription.patientWeight ? `${prescription.patientWeight} kg` : '--'} / {prescription.patientHeight ? `${prescription.patientHeight} cm` : '--'}</span></div>
                        <div><label>Allergies</label><span>{prescription.patientKnownAllergies || 'None reported'}</span></div>
                        <div><label>Address</label><span>{prescription.patientAddress || '--'}</span></div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h3><Stethoscope size={16} /> Doctor Details</h3>
                      <div className="detail-grid">
                        <div><label>Doctor Name</label><span>{prescription.doctorName.startsWith('Dr.') ? prescription.doctorName : `Dr. ${prescription.doctorName}`}</span></div>
                        <div><label>Designation</label><span>{prescription.doctorDesignation || 'Attending Physician'}</span></div>
                        <div><label>Specialization</label><span>{prescription.doctorSpecialization.replace(/_/g, ' ')}</span></div>
                        <div><label>Degree / Qualification</label><span>{prescription.doctorDegree || 'MBBS'}</span></div>
                        <div><label>Medical Reg. No.</label><span>{prescription.doctorRegistrationNumber || '--'}</span></div>
                        <div><label>Mobile / Phone</label><span>{prescription.doctorMobile || '--'}</span></div>
                        <div><label>Email Address</label><span>{prescription.doctorEmail || '--'}</span></div>
                        <div><label>Hospital / Clinic</label><span>{prescription.doctorHospitalClinic || '--'}</span></div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h3><Microscope size={16} /> Clinical Details</h3>
                      <div className="detail-grid">
                        <div style={{ gridColumn: '1 / -1' }}><label>Chief Complaint</label><span>{prescription.chiefComplaint}</span></div>
                        <div style={{ gridColumn: '1 / -1' }}><label>Diagnosis</label><span>{prescription.diagnosis}</span></div>
                        <div style={{ gridColumn: '1 / -1' }}><label>Checkups / Vitals</label><span>{prescription.checkupsDone}</span></div>
                        <div style={{ gridColumn: '1 / -1' }}><label>Notes</label><span>{prescription.clinicalNotes || '--'}</span></div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h3><Pill size={16} /> Medications ({prescription.medications.length})</h3>
                      <div className="medication-table">
                        <div className="med-table-header">
                          <span>Medicine</span>
                          <span>Strength</span>
                          <span>Dosage</span>
                          <span>Frequency</span>
                          <span>Duration</span>
                          <span>Qty</span>
                          <span>Instructions</span>
                          <span>Type</span>
                        </div>
                        {prescription.medications.map(med => (
                          <div key={med.id} className="med-table-row">
                            <span><strong>{med.medicineName}</strong> {med.genericName ? `(${med.genericName})` : ''}</span>
                            <span>{med.strength}</span>
                            <span>{med.dosage} {med.dosageForm}</span>
                            <span>{med.frequency}</span>
                            <span>{med.duration}</span>
                            <span>{med.quantity}</span>
                            <span>{med.instructions || '--'}</span>
                            <span className={med.isLifetime ? 'lifetime-badge' : ''}>
                              {med.isLifetime ? <><Zap size={12} aria-hidden="true" /> Lifetime</> : med.durationType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {prescription.dispensedMedications.length > 0 && (
                      <div className="detail-section">
                        <h3><Truck size={16} /> Dispensing Record</h3>
                        <div className="dispensing-log">
                          {prescription.dispensedMedications.map((disp, idx) => (
                            <div key={idx} className="dispense-entry">
                              <span>Dispensed: {formatDate(disp.dispensedAt)} by {disp.dispensedBy}</span>
                              <span>Qty: {disp.quantityDispensed} * Batches: {disp.batchNumbers.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(prescription.tests.length > 0 || prescription.followUps.length > 0) && (
                      <div className="detail-section">
                        <h3><Microscope size={16} /> Tests & Follow-ups</h3>
                        <div className="detail-grid">
                          {prescription.tests.map(test => (
                            <div key={test.id} style={{ gridColumn: '1 / -1' }}>
                              <label>{test.testName}</label>
<span>{test.instructions || '-'}{test.isUrgent && <span className="urgent-tag">Urgent</span>}</span>
                            </div>
                          ))}
                          {prescription.followUps.map(fu => (
                            <div key={fu.id}>
                              <label>Follow-up</label>
                              <span>{fu.followUpDate ? formatDateOnly(fu.followUpDate) : fu.frequency} {fu.notes ? `(${fu.notes})` : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="detail-actions">
                      {prescription.status === 'ACTIVE' || prescription.status === 'PARTIALLY_DISPENSED' ? (
                        <>
                          <button type="button" className="btn-primary-action" onClick={() => openDispenseModal(prescription)} disabled={isDispensing} aria-busy={isDispensing}>
                            <Truck size={16} /> Dispense Medications
                          </button>
                          {prescription.medications.some(m => m.isLifetime) && !patients.find(p => p.phone === prescription.patientPhone) && (
                            <button type="button" className="btn-secondary" onClick={() => handleRegisterPatient(prescription)} disabled={isRegistering} aria-busy={isRegistering}>
                              <User size={16} /> Register Patient Permanently
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="status-display">
                          <span className={`status-badge-display ${prescription.status.toLowerCase()}`}>
                            {STATUS_LABELS[prescription.status]}
                          </span>
                        </span>
                      )}
                      
                      <div className="share-actions">
                        <button 
                          type="button" 
                          className="btn-secondary btn-sm" 
                          onClick={() => handleShare(prescription, 'PRINT')} 
                          disabled={isSharing === `${prescription.id}-PRINT`} 
                          aria-busy={isSharing === `${prescription.id}-PRINT`}
                          title="Print e-prescription"
                        >
                          <FileText size={14} /> Print
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary btn-sm" 
                          onClick={() => handleShare(prescription, 'WHATSAPP')} 
                          disabled={isSharing === `${prescription.id}-WHATSAPP`} 
                          aria-busy={isSharing === `${prescription.id}-WHATSAPP`}
                          title="Share to patient via WhatsApp"
                        >
                          <MessageSquare size={14} /> WhatsApp
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary btn-sm" 
                          onClick={() => handleShare(prescription, 'EMAIL')} 
                          disabled={isSharing === `${prescription.id}-EMAIL`} 
                          aria-busy={isSharing === `${prescription.id}-EMAIL`}
                          title="Share via Email"
                        >
                          <Mail size={14} /> Email
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary btn-sm" 
                          onClick={() => handleShare(prescription, 'SMS')} 
                          disabled={isSharing === `${prescription.id}-SMS`} 
                          aria-busy={isSharing === `${prescription.id}-SMS`}
                          title="Share via SMS"
                        >
                          <Send size={14} /> SMS
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary btn-sm" 
                          onClick={() => handleShare(prescription, 'DOWNLOAD')} 
                          disabled={isSharing === `${prescription.id}-DOWNLOAD`} 
                          aria-busy={isSharing === `${prescription.id}-DOWNLOAD`}
                          title="Download PDF document"
                        >
                          <Download size={14} /> Download PDF
                        </button>
                      </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

      {selectedPrescription && !expandedPrescriptionId && (
        <div className="prescription-detail-overlay" onClick={() => setSelectedPrescription(null)} role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div className="prescription-detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2 id="detail-title">
                <FileText size={20} /> {selectedPrescription.referenceNumber}
              </h2>
              <button type="button" className="icon-btn-ghost" onClick={() => setSelectedPrescription(null)} aria-label="Close detail view"><X size={20} /></button>
            </div>

            <div className="detail-content">
              <div className="detail-section">
                <h3><User size={16} /> Patient Details</h3>
                <div className="detail-grid">
                  <div><label>Name</label><span>{selectedPrescription.patientName}</span></div>
                  <div><label>Age / Gender</label><span>{selectedPrescription.patientAge} / {selectedPrescription.patientGender}</span></div>
                  <div><label>Phone</label><span>{selectedPrescription.patientPhone}</span></div>
                  <div><label>Email</label><span>{selectedPrescription.patientEmail || '--'}</span></div>
                  <div><label>Weight / Height</label><span>{selectedPrescription.patientWeight ? `${selectedPrescription.patientWeight} kg` : '--'} / {selectedPrescription.patientHeight ? `${selectedPrescription.patientHeight} cm` : '--'}</span></div>
                  <div><label>Allergies</label><span>{selectedPrescription.patientKnownAllergies || 'None reported'}</span></div>
                  <div><label>Address</label><span>{selectedPrescription.patientAddress || '--'}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h3><Stethoscope size={16} /> Doctor Details</h3>
                <div className="detail-grid">
                  <div><label>Doctor Name</label><span>{selectedPrescription.doctorName.startsWith('Dr.') ? selectedPrescription.doctorName : `Dr. ${selectedPrescription.doctorName}`}</span></div>
                  <div><label>Designation</label><span>{selectedPrescription.doctorDesignation || 'Attending Physician'}</span></div>
                  <div><label>Specialization</label><span>{selectedPrescription.doctorSpecialization.replace(/_/g, ' ')}</span></div>
                  <div><label>Degree / Qualification</label><span>{selectedPrescription.doctorDegree || 'MBBS'}</span></div>
                  <div><label>Medical Reg. No.</label><span>{selectedPrescription.doctorRegistrationNumber || '--'}</span></div>
                  <div><label>Mobile / Phone</label><span>{selectedPrescription.doctorMobile || '--'}</span></div>
                  <div><label>Email Address</label><span>{selectedPrescription.doctorEmail || '--'}</span></div>
                  <div><label>Hospital / Clinic</label><span>{selectedPrescription.doctorHospitalClinic || '--'}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h3><Microscope size={16} /> Clinical Details</h3>
                <div className="detail-grid">
                  <div style={{ gridColumn: '1 / -1' }}><label>Chief Complaint</label><span>{selectedPrescription.chiefComplaint}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><label>Diagnosis</label><span>{selectedPrescription.diagnosis}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><label>Checkups / Vitals</label><span>{selectedPrescription.checkupsDone}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><label>Notes</label><span>{selectedPrescription.clinicalNotes || '--'}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h3><Pill size={16} /> Medications ({selectedPrescription.medications.length})</h3>
                <div className="medication-table">
                  <div className="med-table-header">
                    <span>Medicine</span>
                    <span>Strength</span>
                    <span>Dosage</span>
                    <span>Frequency</span>
                    <span>Duration</span>
                    <span>Qty</span>
                    <span>Instructions</span>
                    <span>Type</span>
                  </div>
                  {selectedPrescription.medications.map(med => (
                    <div key={med.id} className="med-table-row">
                      <span><strong>{med.medicineName}</strong> {med.genericName ? `(${med.genericName})` : ''}</span>
                      <span>{med.strength}</span>
                      <span>{med.dosage} {med.dosageForm}</span>
                      <span>{med.frequency}</span>
                      <span>{med.duration}</span>
                      <span>{med.quantity}</span>
                      <span>{med.instructions || '--'}</span>
                      <span className={med.isLifetime ? 'lifetime-badge' : ''}>
                        {med.isLifetime ? <><Zap size={12} aria-hidden="true" /> Lifetime</> : med.durationType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPrescription.dispensedMedications.length > 0 && (
                <div className="detail-section">
                  <h3><Truck size={16} /> Dispensing Record</h3>
                  <div className="dispensing-log">
                    {selectedPrescription.dispensedMedications.map((disp, idx) => (
                      <div key={idx} className="dispense-entry">
                        <span>Dispensed: {formatDate(disp.dispensedAt)} by {disp.dispensedBy}</span>
                        <span>Qty: {disp.quantityDispensed} * Batches: {disp.batchNumbers.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedPrescription.tests.length > 0 || selectedPrescription.followUps.length > 0) && (
                <div className="detail-section">
                  <h3><Microscope size={16} /> Tests & Follow-ups</h3>
                  <div className="detail-grid">
                    {selectedPrescription.tests.map(test => (
                      <div key={test.id} style={{ gridColumn: '1 / -1' }}>
                        <label>{test.testName}</label>
                        <span>{test.instructions || '-'}{test.isUrgent && <span className="urgent-tag">Urgent</span>}</span>
                      </div>
                    ))}
                    {selectedPrescription.followUps.map(fu => (
                      <div key={fu.id}>
                        <label>Follow-up</label>
                        <span>{fu.followUpDate ? formatDateOnly(fu.followUpDate) : fu.frequency} {fu.notes ? `(${fu.notes})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-actions">
                {selectedPrescription.status === 'ACTIVE' || selectedPrescription.status === 'PARTIALLY_DISPENSED' ? (
                  <>
                    <button type="button" className="btn-primary-action" onClick={() => openDispenseModal(selectedPrescription)} disabled={isDispensing} aria-busy={isDispensing}>
                      <Truck size={16} /> Dispense Medications
                    </button>
                    {selectedPrescription.medications.some(m => m.isLifetime) && !patients.find(p => p.phone === selectedPrescription.patientPhone) && (
                      <button type="button" className="btn-secondary" onClick={() => handleRegisterPatient(selectedPrescription)} disabled={isRegistering} aria-busy={isRegistering}>
                        <User size={16} /> Register Patient Permanently
                      </button>
                    )}
                  </>
                ) : (
                  <span className="status-display">
                    <span className={`status-badge-display ${selectedPrescription.status.toLowerCase()}`}>
                      {STATUS_LABELS[selectedPrescription.status]}
                    </span>
                  </span>
                )}
                
                <div className="share-actions">
                  <button 
                    type="button" 
                    className="btn-secondary btn-sm" 
                    onClick={() => handleShare(selectedPrescription, 'PRINT')} 
                    disabled={isSharing === `${selectedPrescription.id}-PRINT`} 
                    aria-busy={isSharing === `${selectedPrescription.id}-PRINT`}
                    title="Print e-prescription"
                  >
                    <FileText size={14} /> Print
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-sm" 
                    onClick={() => handleShare(selectedPrescription, 'WHATSAPP')} 
                    disabled={isSharing === `${selectedPrescription.id}-WHATSAPP`} 
                    aria-busy={isSharing === `${selectedPrescription.id}-WHATSAPP`}
                    title="Share via WhatsApp"
                  >
                    <MessageSquare size={14} /> WhatsApp
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-sm" 
                    onClick={() => handleShare(selectedPrescription, 'EMAIL')} 
                    disabled={isSharing === `${selectedPrescription.id}-EMAIL`} 
                    aria-busy={isSharing === `${selectedPrescription.id}-EMAIL`}
                    title="Share via Email"
                  >
                    <Mail size={14} /> Email
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-sm" 
                    onClick={() => handleShare(selectedPrescription, 'SMS')} 
                    disabled={isSharing === `${selectedPrescription.id}-SMS`} 
                    aria-busy={isSharing === `${selectedPrescription.id}-SMS`}
                    title="Share via SMS"
                  >
                    <Send size={14} /> SMS
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary btn-sm" 
                    onClick={() => handleShare(selectedPrescription, 'DOWNLOAD')} 
                    disabled={isSharing === `${selectedPrescription.id}-DOWNLOAD`} 
                    aria-busy={isSharing === `${selectedPrescription.id}-DOWNLOAD`}
                    title="Download PDF document"
                  >
                    <Download size={14} /> Download PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDispenseModal && selectedPrescription && (
        <div className="modal-backdrop" onClick={() => { setShowDispenseModal(false); setSelectedPrescription(null); setDispenseError(null); }} role="dialog" aria-modal="true" aria-labelledby="dispense-title">
          <div className="modal-card" style={{ maxWidth: '720px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="dispense-title">Dispense Medications</h3>
              <span className="ref-badge">{selectedPrescription.referenceNumber}</span>
              <button type="button" className="icon-btn-ghost" onClick={() => { setShowDispenseModal(false); setSelectedPrescription(null); setDispenseError(null); }} aria-label="Close dispense modal"><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <div className="patient-summary">
                <strong>{selectedPrescription.patientName}</strong> * Age {selectedPrescription.patientAge} * {selectedPrescription.patientPhone}
              </div>
              
              {selectedPrescription.medications.map(med => {
                const availableBatches = getAvailableBatches(med.medicineName);
                const form = dispenseForm[med.id] || { quantity: med.quantity, batchIds: [] };
                return (
                  <div key={med.id} className="dispense-med-card">
                    <div className="dispense-med-header">
                      <div>
                        <strong>{med.medicineName}</strong> {med.strength} {med.dosageForm}
                        <br />
                        <small>{med.dosage} * {med.frequency} * {med.duration}</small>
                      </div>
                      <span className="required-qty">Required: {med.quantity}</span>
                    </div>
                    
                    <div className="dispense-quantity">
                      <label>Quantity to Dispense</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        min="0" 
                        max={med.quantity}
                        value={form.quantity}
                        onChange={e => handleQuantityChange(med.id, parseInt(e.target.value) || 0)}
                      />
                    </div>

                    {availableBatches.length > 0 && (
                      <div className="dispense-batches">
                        <label>Select Batches (FEFO Order)</label>
                        <div className="batch-checkboxes">
                          {availableBatches.map(batch => (
                            <label key={batch.id} className="batch-checkbox">
                              <input
                                type="checkbox"
                                checked={form.batchIds.includes(batch.id)}
                                onChange={e => handleBatchSelect(med.id, batch.id, e.target.checked)}
                              />
                              <span className="batch-info">
                                <span className="batch-num">Batch: {batch.batchNumber}</span>
                                <span className="batch-expiry">Expiry: {batch.expiryDate}</span>
                                <span className="batch-stock">Avail: {batch.quantityRemaining} * MRP: {formatINR(batch.mrp)}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {availableBatches.length === 0 && (
                      <div className="no-stock-warning" role="alert">
                        <AlertCircle size={16} aria-hidden="true" /> No stock available for this medicine
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowDispenseModal(false); setSelectedPrescription(null); setDispenseError(null); }}>Cancel</button>
<button type="button" className="btn-primary-action" onClick={handleDispense} disabled={isDispensing || Object.values(dispenseForm).every(f => f.quantity === 0)} aria-busy={isDispensing}>
  {isDispensing ? (
    <>
      <Loader2 size={16} className="animate-spin" /> Dispensing...
    </>
  ) : (
    <>
      <Truck size={16} /> Confirm Dispensing
    </>
  )}
</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPatientRegModal && (
        <div className="modal-backdrop" onClick={() => { setShowPatientRegModal(null); setRegisterError(null); }} role="dialog" aria-modal="true" aria-labelledby="register-title">
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="register-title">Register Patient Permanently</h3>
              <button type="button" className="icon-btn-ghost" onClick={() => { setShowPatientRegModal(null); setRegisterError(null); }} aria-label="Close registration modal"><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              {registerError && <div className="form-error" role="alert" style={{ marginBottom: '16px' }}>{registerError}</div>}
              <div className="alert-info">
                <AlertCircle size={20} aria-hidden="true" />
                <div>
                  <strong>Lifetime Medication Detected</strong>
                  <p>This prescription contains lifetime/chronic medications. Registering the patient will add them to the Patients module for ongoing refill management.</p>
                </div>
              </div>
              
              <div className="patient-preview">
                <h4>Patient to be Registered:</h4>
                <div className="preview-item"><span>Name:</span> <strong>{showPatientRegModal.patientName}</strong></div>
                <div className="preview-item"><span>Age/Gender:</span> {showPatientRegModal.patientAge} / {showPatientRegModal.patientGender}</div>
                <div className="preview-item"><span>Phone:</span> {showPatientRegModal.patientPhone}</div>
                <div className="preview-item"><span>Lifetime Meds:</span> {showPatientRegModal.medications.filter(m => m.isLifetime).map(m => m.medicineName).join(', ')}</div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowPatientRegModal(null); setRegisterError(null); }}>Cancel</button>
                <button type="button" className="btn-primary-action" onClick={confirmPatientRegistration} disabled={isRegistering} aria-busy={isRegistering}>
                  {isRegistering ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />} {isRegistering ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dispenseError && (
        <div className="toast-banner toast-error" role="alert">
          <div className="toast-content">
            <AlertCircle size={16} />
            <span>{dispenseError}</span>
          </div>
          <button type="button" className="toast-close-btn" onClick={() => setDispenseError(null)}><X size={14} /></button>
        </div>
      )}
      {shareError && (
        <div className="toast-banner toast-error" role="alert">
          <div className="toast-content">
            <AlertCircle size={16} />
            <span>{shareError}</span>
          </div>
          <button type="button" className="toast-close-btn" onClick={() => setShareError(null)}><X size={14} /></button>
        </div>
      )}
      {registerError && (
        <div className="toast-banner toast-error" role="alert">
          <div className="toast-content">
            <AlertCircle size={16} />
            <span>{registerError}</span>
          </div>
          <button type="button" className="toast-close-btn" onClick={() => setRegisterError(null)}><X size={14} /></button>
        </div>
      )}
    </div>
  );
};

export default OPDCorner;