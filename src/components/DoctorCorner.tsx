import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  User, Search, Plus, FileText, 
  Pill, Clock, Stethoscope, Microscope,
  CheckCircle2, X, Edit3, Trash2, AlertCircle,
  Send, Zap, Loader2, ChevronLeft, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { Doctor, CreateDoctorInput, CreateEPrescriptionInput, EPrescriptionMedication, EPrescriptionTest, EPrescriptionFollowUp, MedicationDurationType, FollowUpFrequency, DoctorSpecialization } from '../types/eprescription';
import { Medicine } from '../types/inventory';

interface DoctorCornerProps {
  pharmacyCode: string;
  doctors: Doctor[];
  medicines: Medicine[];
  onCreatePrescription: (input: CreateEPrescriptionInput) => void;
  onCreateDoctor: (input: CreateDoctorInput) => void;
  onUpdateDoctor: (doctorId: string, input: Partial<CreateDoctorInput>) => void;
  onBackToInventory: () => void;
  _pharmacyId?: string;
  _pharmacyName?: string;
  _staffUser?: string;
}

const DURATION_TYPES: { value: MedicationDurationType; label: string }[] = [
  { value: 'LIFETIME', label: 'Lifetime / Chronic' },
  { value: 'SHORT_TERM', label: 'Short Term (Days/Weeks)' },
  { value: 'AS_NEEDED', label: 'As Needed (SOS)' }
];

const FREQUENCY_OPTIONS = [
  'OD (Once Daily)', 'BD (Twice Daily)', 'TDS (Three Times Daily)', 'QID (Four Times Daily)',
  'SOS (As Needed)', 'HS (At Bedtime)', 'AC (Before Meals)', 'PC (After Meals)',
  '1-0-1', '1-1-1', '0-1-0', '0-0-1', 'Weekly', 'Monthly'
];

const FOLLOWUP_FREQUENCIES: { value: FollowUpFrequency; label: string }[] = [
  { value: 'NONE', label: 'No Follow-up' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'CUSTOM', label: 'Custom Days' }
];

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Ointment', 'Eye Drops', 'Ear Drops', 'Nasal Spray', 'Inhaler', 'Patch', 'Suppository'];

const STEPS = [
  { num: 1, label: 'Doctor & Patient', icon: User, key: 'step1' },
  { num: 2, label: 'Clinical Details', icon: Stethoscope, key: 'step2' },
  { num: 3, label: 'Medications', icon: Pill, key: 'step3' },
  { num: 4, label: 'Tests & Follow-up', icon: Microscope, key: 'step4' }
] as const;

export const DoctorCorner: React.FC<DoctorCornerProps> = ({
  pharmacyCode,
  doctors,
  medicines,
  onCreatePrescription,
  onCreateDoctor,
  onUpdateDoctor,
  onBackToInventory
}) => {
  // Doctor Lookup State
  const [searchDoctorName, setSearchDoctorName] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorForm, setDoctorForm] = useState<CreateDoctorInput>({
    name: '', mobile: '', email: '', designation: '', degree: '',
    specialization: 'GENERAL_PHYSICIAN', registrationNumber: '', hospitalClinic: ''
  });
  const [doctorModalError, setDoctorModalError] = useState<string | null>(null);

  // Prescription Form State
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4>(1);
  const [patient, setPatient] = useState({
    patientId: '',
    patientName: '',
    patientAge: '',
    patientGender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    patientPhone: '',
    patientEmail: '',
    patientAddress: '',
    patientWeight: '',
    patientHeight: '',
    patientKnownAllergies: '',
    abhaId: ''
  });
  const [validityDays, setValidityDays] = useState<number>(15);
  const [maxRefillsAllowed, setMaxRefillsAllowed] = useState<number>(0);
  const [clinical, setClinical] = useState({
    chiefComplaint: '',
    diagnosis: '',
    checkupsDone: '',
    clinicalNotes: ''
  });
  const [medications, setMedications] = useState<EPrescriptionMedication[]>([
    { id: '1', medicineId: '', medicineName: '', genericName: '', strength: '', dosageForm: 'Tablet', dosage: '', frequency: 'OD', duration: '', durationType: 'SHORT_TERM', quantity: 1, instructions: '', isLifetime: false }
  ]);
  const [tests, setTests] = useState<EPrescriptionTest[]>([]);
  const [followUps, setFollowUps] = useState<EPrescriptionFollowUp[]>([
    { id: '1', followUpDate: '', frequency: 'NONE', isCompleted: false }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastPrescriptionRef, setLastPrescriptionRef] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Clinical Schedule H1 Controlled Substances List
  const SCHEDULE_H1_KEYWORDS = useMemo(() => [
    'alprazolam', 'tramadol', 'diazepam', 'zolpidem', 'clonazepam',
    'lorazepam', 'codeine', 'cefixime', 'meropenem', 'moxifloxacin',
    'pregabalin', 'clobazam', 'nitrazepam', 'pentazocine'
  ], []);

  const isMedScheduleH1 = useCallback((med: EPrescriptionMedication) => {
    const text = `${med.medicineName || ''} ${med.genericName || ''}`.toLowerCase();
    return SCHEDULE_H1_KEYWORDS.some(kw => text.includes(kw));
  }, [SCHEDULE_H1_KEYWORDS]);

  // Real-time Drug-Allergy Warning Engine
  const allergyAlerts = useMemo(() => {
    if (!patient.patientKnownAllergies?.trim()) return [];
    const allergens = patient.patientKnownAllergies
      .toLowerCase()
      .split(/[,;/+]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3);
    if (allergens.length === 0) return [];

    const alerts: { medName: string; allergen: string }[] = [];
    medications.forEach(m => {
      if (!m.medicineName.trim()) return;
      const text = `${m.medicineName} ${m.genericName || ''}`.toLowerCase();
      allergens.forEach(allergen => {
        if (text.includes(allergen)) {
          alerts.push({ medName: m.medicineName, allergen });
        }
      });
    });
    return alerts;
  }, [patient.patientKnownAllergies, medications]);

  // Doctor Search Results with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchDoctorName);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDoctorName]);

  const filteredDoctors = useMemo(() => {
    if (!searchDebounce.trim()) return [];
    const query = searchDebounce.toLowerCase().trim();
    return doctors.filter(d => 
      d.name.toLowerCase().includes(query) && d.isActive
    ).slice(0, 10);
  }, [searchDebounce, doctors]);

  const selectedDoctorDetails = useMemo(() => {
    if (!selectedDoctor) return null;
    return doctors.find(d => d.id === selectedDoctor.id) || selectedDoctor;
  }, [selectedDoctor, doctors]);

  // Validation
  const validateStep1 = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!selectedDoctor) errors.doctor = 'Please select a prescribing doctor';
    if (!patient.patientName.trim()) errors.patientName = 'Patient name is required';
    if (!patient.patientAge) {
      errors.patientAge = 'Age is required';
    } else {
      const parsedAge = parseInt(patient.patientAge, 10);
      if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120) {
        errors.patientAge = 'Enter a valid age (0-120)';
      }
    }
    const cleanDigits = patient.patientPhone.replace(/\D/g, '');
    if (!patient.patientPhone.trim()) {
      errors.patientPhone = 'Phone number is required';
    } else if (cleanDigits.length < 7 || cleanDigits.length > 15) {
      errors.patientPhone = 'Enter a valid phone number (7-15 digits)';
    }
    setValidationErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, [selectedDoctor, patient]);

  const validateStep2 = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!clinical.chiefComplaint.trim()) errors.chiefComplaint = 'Chief complaint is required';
    if (!clinical.diagnosis.trim()) errors.diagnosis = 'Diagnosis is required';
    setValidationErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, [clinical]);

  const validateStep3 = useCallback(() => {
    const errors: Record<string, string> = {};
    const validMeds = medications.filter(m => m.medicineName.trim());
    if (validMeds.length === 0) {
      errors.medications = 'At least one prescribed medication is required';
    } else {
      validMeds.forEach((med, idx) => {
        if (!med.medicineName.trim()) errors[`medName_${idx}`] = 'Medicine name is required';
        if (med.quantity < 1) errors[`medQty_${idx}`] = 'Quantity must be at least 1';
      });
    }
    setValidationErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, [medications]);

  const isStep1Valid = () => Boolean(selectedDoctor && patient.patientName.trim() && patient.patientAge && patient.patientPhone.trim());
  const isStep2Valid = () => Boolean(clinical.chiefComplaint.trim() && clinical.diagnosis.trim());
  const isStep3Valid = () => medications.some(m => Boolean(m.medicineName.trim()));

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSearchDoctorName(doctor.name);
  };

  const handleDoctorSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchDoctorName(value);
    if (selectedDoctor && value !== selectedDoctor.name) {
      setSelectedDoctor(null);
    }
  };

  const openDoctorModal = () => {
    setEditingDoctor(null);
    setDoctorForm({ name: '', mobile: '', email: '', designation: '', degree: '', specialization: 'GENERAL_PHYSICIAN', registrationNumber: '', hospitalClinic: '' });
    setDoctorModalError(null);
    setShowDoctorModal(true);
  };

  const openEditDoctorModal = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      name: doctor.name,
      mobile: doctor.mobile,
      email: doctor.email,
      designation: doctor.designation,
      degree: doctor.degree,
      specialization: doctor.specialization,
      registrationNumber: doctor.registrationNumber,
      hospitalClinic: doctor.hospitalClinic || ''
    });
    setDoctorModalError(null);
    setShowDoctorModal(true);
  };

  const validateDoctorForm = () => {
    const errors: string[] = [];
    if (!doctorForm.name.trim()) errors.push('Name is required');
    if (!doctorForm.mobile.trim()) errors.push('Mobile is required');
    if (!doctorForm.email.trim()) errors.push('Email is required');
    if (!doctorForm.designation.trim()) errors.push('Designation is required');
    if (!doctorForm.degree.trim()) errors.push('Degree is required');
    if (!doctorForm.registrationNumber.trim()) errors.push('Registration number is required');
    return errors;
  };

  const handleDoctorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateDoctorForm();
    if (errors.length > 0) {
      setDoctorModalError(errors.join(', '));
      return;
    }
    if (editingDoctor) {
      onUpdateDoctor(editingDoctor.id, doctorForm);
    } else {
      onCreateDoctor(doctorForm);
    }
    setShowDoctorModal(false);
  };

  const addMedication = () => {
    setMedications([...medications, { 
      id: Date.now().toString(), 
      medicineId: '', medicineName: '', genericName: '', strength: '', 
      dosageForm: 'Tablet', dosage: '', frequency: 'OD', duration: '', 
      durationType: 'SHORT_TERM', quantity: 1, instructions: '', isLifetime: false 
    }]);
  };

  const removeMedication = (id: string) => {
    if (medications.length <= 1) return;
    if (!window.confirm('Remove this medication?')) return;
    setMedications(medications.filter(m => m.id !== id));
  };

  const updateMedication = (id: string, field: keyof EPrescriptionMedication, value: any) => {
    setMedications(medications.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: value };
      if (field === 'medicineName' && typeof value === 'string') {
        const query = value.trim().toLowerCase();
        const matched = medicines.find(med => med.name.toLowerCase() === query);
        if (matched) {
          updated.medicineId = matched.id;
          if (!updated.genericName) updated.genericName = matched.genericName;
          if (!updated.strength) updated.strength = matched.strength;
          if (matched.dosageForm) updated.dosageForm = matched.dosageForm;
        }
      }
      return updated;
    }));
    // Clear validation error for this field
    setValidationErrors(prev => {
      const next = { ...prev };
      Object.keys(prev).forEach(key => {
        if (key.startsWith(`med`) && key.endsWith(`_${medications.findIndex(m => m.id === id)}`)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const addTest = () => {
    setTests([...tests, { id: Date.now().toString(), testName: '', instructions: '', isUrgent: false }]);
  };

  const removeTest = (id: string) => {
    if (!window.confirm('Remove this test?')) return;
    setTests(tests.filter(t => t.id !== id));
  };

  const updateTest = (id: string, field: keyof EPrescriptionTest, value: any) => {
    setTests(tests.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addFollowUp = () => {
    setFollowUps([...followUps, { id: Date.now().toString(), followUpDate: '', frequency: 'NONE', isCompleted: false }]);
  };

  const removeFollowUp = (id: string) => {
    if (followUps.length <= 1) return;
    if (!window.confirm('Remove this follow-up?')) return;
    setFollowUps(followUps.filter(f => f.id !== id));
  };

  const updateFollowUp = (id: string, field: keyof EPrescriptionFollowUp, value: any) => {
    setFollowUps(followUps.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const generateReferenceNumber = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${pharmacyCode}-EP-${dateStr}-${random}`;
  };

  const handleSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!selectedDoctorDetails) {
      setFormStep(1);
      setSubmitError('Please select a prescribing doctor in Step 1.');
      return;
    }

    const v1 = validateStep1();
    if (!v1) {
      setFormStep(1);
      setSubmitError('Please complete required patient details in Step 1.');
      return;
    }

    const v2 = validateStep2();
    if (!v2) {
      setFormStep(2);
      setSubmitError('Please enter clinical complaint and diagnosis in Step 2.');
      return;
    }

    const v3 = validateStep3();
    if (!v3) {
      setFormStep(3);
      setSubmitError('Please add at least one medication in Step 3.');
      return;
    }

    setIsSubmitting(true);
    try {
      const doctor = selectedDoctorDetails;
      const refNumber = generateReferenceNumber();
      
      const input: CreateEPrescriptionInput = {
        doctorId: doctor.id,
        patientId: patient.patientId || undefined,
        patientName: patient.patientName.trim(),
        patientAge: parseInt(patient.patientAge, 10) || 30,
        patientGender: patient.patientGender,
        patientPhone: patient.patientPhone.trim(),
        patientEmail: patient.patientEmail.trim() || undefined,
        patientAddress: patient.patientAddress.trim() || undefined,
        patientWeight: patient.patientWeight ? parseFloat(patient.patientWeight) : undefined,
        patientHeight: patient.patientHeight ? parseFloat(patient.patientHeight) : undefined,
        patientKnownAllergies: patient.patientKnownAllergies.trim() || undefined,
        abhaId: patient.abhaId.trim() || undefined,
        validityDays,
        maxRefillsAllowed,
        chiefComplaint: clinical.chiefComplaint.trim() || 'General OPD consultation',
        diagnosis: clinical.diagnosis.trim() || 'General health evaluation',
        checkupsDone: clinical.checkupsDone.trim() || 'Routine vitals examined',
        clinicalNotes: clinical.clinicalNotes.trim() || undefined,
        medications: medications.filter(m => m.medicineName.trim()).map(m => ({
          ...m,
          strength: m.strength.trim() || 'Standard',
          dosage: m.dosage.trim() || '1 unit',
          duration: m.duration.trim() || '3 days',
          isLifetime: m.durationType === 'LIFETIME'
        })),
        tests: tests.filter(t => t.testName.trim()),
        followUps: followUps.filter(f => f.followUpDate).map(f => ({
          ...f,
          isCompleted: false
        }))
      };

      onCreatePrescription(input);
      setSubmitSuccess(true);
      setLastPrescriptionRef(refNumber);
      setIsSubmitting(false);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
        resetForm();
      }, 2500);
    } catch (err) {
      setIsSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'Failed to create prescription');
      console.error('Failed to create prescription:', err);
    }
  };

  const resetForm = () => {
    setFormStep(1);
    setPatient({ patientId: '', patientName: '', patientAge: '', patientGender: 'MALE', patientPhone: '', patientEmail: '', patientAddress: '', patientWeight: '', patientHeight: '', patientKnownAllergies: '', abhaId: '' });
    setValidityDays(15);
    setMaxRefillsAllowed(0);
    setClinical({ chiefComplaint: '', diagnosis: '', checkupsDone: '', clinicalNotes: '' });
    setMedications([{ id: '1', medicineId: '', medicineName: '', genericName: '', strength: '', dosageForm: 'Tablet', dosage: '', frequency: 'OD', duration: '', durationType: 'SHORT_TERM', quantity: 1, instructions: '', isLifetime: false }]);
    setTests([]);
    setFollowUps([{ id: '1', followUpDate: '', frequency: 'NONE', isCompleted: false }]);
    setSelectedDoctor(null);
    setSearchDoctorName('');
    setValidationErrors({});
    setSubmitError(null);
  };

  const confirmClearForm = () => {
    setShowClearConfirm(true);
  };

  const handleClearConfirm = () => {
    resetForm();
    setShowClearConfirm(false);
  };

  const minFollowUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Tomorrow

  return (
    <div className="doctor-corner-container">
      {/* Toast */}
      {(submitSuccess || submitError) && (
        <div className={`toast-banner toast-${submitSuccess ? 'success' : 'error'}`} role="alert">
          <div className="toast-content">
            {submitSuccess ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{submitSuccess ? `E-Prescription created successfully! Reference: ${lastPrescriptionRef}` : submitError}</span>
          </div>
          <button type="button" className="toast-close-btn" onClick={() => { setSubmitSuccess(false); setSubmitError(null); }}><X size={14} /></button>
        </div>
      )}

      {/* Clear Form Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-card" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Clear Form?</h3>
            </div>
            <div style={{ padding: '16px' }}>
              <p>This will clear all entered data. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleClearConfirm}>Clear Form</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="doctor-corner-header">
        <button type="button" className="btn-back-link" onClick={onBackToInventory}>
          <ChevronLeft size={16} /> Back to Inventory
        </button>
        <div>
          <h1 className="doctor-corner-title">
            <Stethoscope size={24} className="text-primary-green" />
            Doctor's Corner — E-Prescription
          </h1>
          <p className="doctor-corner-subtitle">Create digital prescriptions for OPD patients</p>
        </div>
        <div className="doctor-corner-actions">
          <button type="button" className="btn-secondary" onClick={confirmClearForm} disabled={isSubmitting}>
            <X size={16} /> Clear Form
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="prescription-steps" role="navigation" aria-label="Prescription steps">
        {STEPS.map((step, _idx) => (
          <button
            key={step.key}
            type="button"
            className={`step ${formStep === step.num ? 'active' : ''} ${formStep > step.num ? 'completed' : ''}`}
            onClick={() => {
              // Only allow clicking completed steps
              if (step.num < formStep) setFormStep(step.num as 1 | 2 | 3 | 4);
            }}
            disabled={step.num > formStep}
            aria-current={formStep === step.num ? 'step' : undefined}
          >
            <div className="step-circle">{step.num}</div>
            <div className="step-label">{step.label}</div>
            {_idx < 3 && <div className={`step-line ${formStep > step.num ? 'completed' : ''}`} />}
          </button>
        ))}
      </div>

      {/* Doctor Lookup Section */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">
            <User size={18} /> Step 1: Doctor & Patient Details
          </h2>
        </div>

        {/* Doctor Lookup */}
        <div className="form-group">
          <label className="form-label">Search Doctor by Name</label>
          <div className="input-with-icon">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              className="form-input pl-icon"
              value={searchDoctorName}
              onChange={handleDoctorSearchInput}
              placeholder="Type doctor name to auto-fetch details..."
              autoComplete="off"
              aria-describedby="doctor-search-hint"
            />
          </div>
          <div id="doctor-search-hint" className="form-hint">Type at least 2 characters to search registered doctors</div>
          
          {searchDebounce.length >= 2 && filteredDoctors.length === 0 && (
            <div className="empty-state-small" style={{ marginTop: '8px' }}>No doctors found matching "{searchDebounce}"</div>
          )}
          
          {searchDebounce.length >= 2 && filteredDoctors.length > 0 && !selectedDoctor && (
            <div className="doctor-suggestions" role="listbox" aria-label="Doctor suggestions">
              {filteredDoctors.map(doc => (
                <button
                  key={doc.id}
                  type="button"
                  className="doctor-suggestion-item"
                  onClick={() => handleDoctorSelect(doc)}
                  role="option"
                >
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">
                    <span>{doc.designation}</span>
                    <span>•</span>
                    <span>{doc.specialization.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{doc.mobile}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedDoctor && (
            <div className="selected-doctor-card">
              <div className="doc-info">
                <div className="doc-avatar" aria-hidden="true">
                  {selectedDoctor.name.charAt(0)}
                </div>
                <div>
                  <h4>{selectedDoctor.name}</h4>
                  <p className="doc-designation">{selectedDoctor.designation} • {selectedDoctor.degree}</p>
                  <p className="doc-contact">
                    <span>📞 {selectedDoctor.mobile}</span>
                    <span>✉️ {selectedDoctor.email}</span>
                  </p>
                  <p className="doc-specialization">
                    {selectedDoctor.specialization.replace('_', ' ')} • Reg: {selectedDoctor.registrationNumber}
                    {selectedDoctor.hospitalClinic && ` • ${selectedDoctor.hospitalClinic}`}
                  </p>
                </div>
              </div>
              <div className="doc-actions">
                <button type="button" className="btn-secondary btn-sm" onClick={() => openEditDoctorModal(selectedDoctor)}>
                  <Edit3 size={14} /> Edit
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => { setSelectedDoctor(null); setSearchDoctorName(''); }}>
                  <X size={14} /> Change
                </button>
              </div>
            </div>
          )}

          {validationErrors.doctor && (
            <div className="form-error" role="alert">{validationErrors.doctor}</div>
          )}

          <div className="form-actions-inline">
            <button type="button" className="btn-secondary" onClick={openDoctorModal} disabled={isSubmitting}>
              <Plus size={14} /> Register New Doctor
            </button>
          </div>
        </div>

        {/* Patient Details */}
        <div className="form-grid-2col" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Patient Name *</label>
            <input 
              type="text" 
              className={`form-input ${validationErrors.patientName ? 'error' : ''}`} 
              placeholder="Full name" 
              value={patient.patientName} 
              onChange={e => { setPatient({...patient, patientName: e.target.value}); setValidationErrors(prev => { const n={...prev}; delete n.patientName; return n; }); }} 
              required 
              aria-invalid={!!validationErrors.patientName}
              aria-describedby={validationErrors.patientName ? 'patientName-error' : undefined}
            />
            {validationErrors.patientName && <div id="patientName-error" className="form-error" role="alert">{validationErrors.patientName}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Age *</label>
            <input 
              type="number" 
              className={`form-input ${validationErrors.patientAge ? 'error' : ''}`} 
              placeholder="Age in years" 
              value={patient.patientAge} 
              onChange={e => { setPatient({...patient, patientAge: e.target.value}); setValidationErrors(prev => { const n={...prev}; delete n.patientAge; return n; }); }} 
              min="0" max="120" required
              aria-invalid={!!validationErrors.patientAge}
              aria-describedby={validationErrors.patientAge ? 'patientAge-error' : undefined}
            />
            {validationErrors.patientAge && <div id="patientAge-error" className="form-error" role="alert">{validationErrors.patientAge}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Gender *</label>
            <select className="form-input" value={patient.patientGender} onChange={e => setPatient({...patient, patientGender: e.target.value as 'MALE'|'FEMALE'|'OTHER'})}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input 
              type="tel" 
              className={`form-input ${validationErrors.patientPhone ? 'error' : ''}`} 
              placeholder="+91 98765 43210" 
              value={patient.patientPhone} 
              onChange={e => { setPatient({...patient, patientPhone: e.target.value}); setValidationErrors(prev => { const n={...prev}; delete n.patientPhone; return n; }); }} 
              required
              aria-invalid={!!validationErrors.patientPhone}
              aria-describedby={validationErrors.patientPhone ? 'patientPhone-error' : undefined}
            />
            {validationErrors.patientPhone && <div id="patientPhone-error" className="form-error" role="alert">{validationErrors.patientPhone}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="patient@email.com" value={patient.patientEmail} onChange={e => setPatient({...patient, patientEmail: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Weight (kg)</label>
            <input type="number" className="form-input" placeholder="e.g. 70" value={patient.patientWeight} onChange={e => setPatient({...patient, patientWeight: e.target.value})} step="0.1" min="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Height (cm)</label>
            <input type="number" className="form-input" placeholder="e.g. 170" value={patient.patientHeight} onChange={e => setPatient({...patient, patientHeight: e.target.value})} step="0.1" min="0" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Address</label>
            <textarea className="form-input" rows={2} placeholder="Complete address" value={patient.patientAddress} onChange={e => setPatient({...patient, patientAddress: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">ABHA ID / Digital Health Account (Optional)</label>
            <input type="text" className="form-input" placeholder="e.g. 14-digit ABHA or name@abdm" value={patient.abhaId} onChange={e => setPatient({...patient, abhaId: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Known Allergies (Penicillin, Sulfa, Aspirin...)</label>
            <input type="text" className="form-input" placeholder="e.g. Penicillin, Sulfa drugs, Paracetamol" value={patient.patientKnownAllergies} onChange={e => setPatient({...patient, patientKnownAllergies: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Clinical Details */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">
            <Stethoscope size={18} /> Step 2: Clinical Details
          </h2>
        </div>
        <div className="form-grid-2col">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Chief Complaint *</label>
            <textarea 
              className={`form-input ${validationErrors.chiefComplaint ? 'error' : ''}`} 
              rows={3} 
              placeholder="e.g. Fever since 3 days, cough, breathlessness" 
              value={clinical.chiefComplaint} 
              onChange={e => { setClinical({...clinical, chiefComplaint: e.target.value}); setValidationErrors(prev => { const n={...prev}; delete n.chiefComplaint; return n; }); }} 
              required
              aria-invalid={!!validationErrors.chiefComplaint}
              aria-describedby={validationErrors.chiefComplaint ? 'chiefComplaint-error' : undefined}
            />
            {validationErrors.chiefComplaint && <div id="chiefComplaint-error" className="form-error" role="alert">{validationErrors.chiefComplaint}</div>}
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Diagnosis *</label>
            <textarea 
              className={`form-input ${validationErrors.diagnosis ? 'error' : ''}`} 
              rows={3} 
              placeholder="e.g. Acute bronchitis, Hypertension" 
              value={clinical.diagnosis} 
              onChange={e => { setClinical({...clinical, diagnosis: e.target.value}); setValidationErrors(prev => { const n={...prev}; delete n.diagnosis; return n; }); }} 
              required
              aria-invalid={!!validationErrors.diagnosis}
              aria-describedby={validationErrors.diagnosis ? 'diagnosis-error' : undefined}
            />
            {validationErrors.diagnosis && <div id="diagnosis-error" className="form-error" role="alert">{validationErrors.diagnosis}</div>}
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Checkups Done / Vitals *</label>
            <textarea 
              className={`form-input ${validationErrors.checkupsDone ? 'error' : ''}`} 
              rows={3} 
              placeholder="e.g. BP: 130/85, Pulse: 88/min, Temp: 99.2°F, SpO2: 97%, Chest: Clear" 
              value={clinical.checkupsDone} 
              onChange={e => { setClinical({...clinical, checkupsDone: e.target.value}); setValidationErrors(prev => { const n={...prev}; delete n.checkupsDone; return n; }); }} 
              required
              aria-invalid={!!validationErrors.checkupsDone}
              aria-describedby={validationErrors.checkupsDone ? 'checkupsDone-error' : undefined}
            />
            {validationErrors.checkupsDone && <div id="checkupsDone-error" className="form-error" role="alert">{validationErrors.checkupsDone}</div>}
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Clinical Notes</label>
            <textarea className="form-input" rows={2} placeholder="Additional observations, advice, precautions..." value={clinical.clinicalNotes} onChange={e => setClinical({...clinical, clinicalNotes: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Medications */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">
            <Pill size={18} /> Step 3: Medications Prescribed
          </h2>
          <button type="button" className="btn-primary-action btn-sm" onClick={addMedication} disabled={isSubmitting}>
            <Plus size={14} /> Add Medication
          </button>
        </div>

        {allergyAlerts.length > 0 && (
          <div className="allergy-warning-banner" role="alert" style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderLeft: '4px solid #e11d48',
            borderRadius: '8px',
            padding: '12px 16px',
            margin: '16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 600 }}>
              <AlertTriangle size={18} />
              <span>CLINICAL ALLERGY ALERT: Documented Patient Allergy Conflict</span>
            </div>
            <div style={{ fontSize: '13px', color: '#9f1239', lineHeight: 1.5 }}>
              {allergyAlerts.map((alert, i) => (
                <div key={i}>
                  • Prescribed <strong>{alert.medName}</strong> may conflict with patient's documented allergy to <strong>"{alert.allergen}"</strong>. Re-evaluate or consider therapeutic substitution.
                </div>
              ))}
            </div>
          </div>
        )}

        {medications.map((med, _idx) => (
          <div key={med.id} className="medication-card">
            <div className="med-header">
              <span className="med-number">Medication {_idx + 1}</span>
              <button type="button" className="btn-ghost btn-sm" onClick={() => removeMedication(med.id)} disabled={medications.length <= 1 || isSubmitting} aria-label={`Remove medication ${_idx + 1}`}>
                <Trash2 size={14} />
              </button>
            </div>

            <div className="med-grid">
              <div className="form-group">
                <label className="form-label">Medicine Name *</label>
                <div className="input-with-icon">
                  <Search size={16} className="input-icon" />
                  <input
                    type="text"
                    className={`form-input pl-icon ${validationErrors[`medName_${_idx}`] ? 'error' : ''}`}
                    placeholder="Search medicine or type manually"
                    value={med.medicineName}
                    onChange={e => { updateMedication(med.id, 'medicineName', e.target.value); setValidationErrors(prev => { const n={...prev}; delete n[`medName_${_idx}`]; return n; }); }}
                    list={`medicines-${med.id}`}
                    aria-invalid={!!validationErrors[`medName_${_idx}`]}
                    aria-describedby={validationErrors[`medName_${_idx}`] ? `medName_${_idx}-error` : undefined}
                  />
                  <datalist id={`medicines-${med.id}`}>
                    {medicines.map(m => <option key={m.id} value={m.name} />)}
                  </datalist>
                </div>
                {validationErrors[`medName_${_idx}`] && <div id={`medName_${_idx}-error`} className="form-error" role="alert">{validationErrors[`medName_${_idx}`]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Generic Name</label>
                <input type="text" className="form-input" placeholder="e.g. Paracetamol" value={med.genericName} onChange={e => updateMedication(med.id, 'genericName', e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Strength *</label>
                <input 
                  type="text" 
                  className={`form-input ${validationErrors[`medStrength_${_idx}`] ? 'error' : ''}`} 
                  placeholder="e.g. 500mg, 250mg/5ml" 
                  value={med.strength} 
                  onChange={e => { updateMedication(med.id, 'strength', e.target.value); setValidationErrors(prev => { const n={...prev}; delete n[`medStrength_${_idx}`]; return n; }); }} 
                  required
                  aria-invalid={!!validationErrors[`medStrength_${_idx}`]}
                  aria-describedby={validationErrors[`medStrength_${_idx}`] ? `medStrength_${_idx}-error` : undefined}
                />
                {validationErrors[`medStrength_${_idx}`] && <div id={`medStrength_${_idx}-error`} className="form-error" role="alert">{validationErrors[`medStrength_${_idx}`]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Dosage Form *</label>
                <select className="form-input" value={med.dosageForm} onChange={e => updateMedication(med.id, 'dosageForm', e.target.value)}>
                  {DOSAGE_FORMS.map(df => <option key={df} value={df}>{df}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Dosage *</label>
                <input 
                  type="text" 
                  className={`form-input ${validationErrors[`medDosage_${_idx}`] ? 'error' : ''}`} 
                  placeholder="e.g. 1 tab, 5 ml, 1 cap" 
                  value={med.dosage} 
                  onChange={e => { updateMedication(med.id, 'dosage', e.target.value); setValidationErrors(prev => { const n={...prev}; delete n[`medDosage_${_idx}`]; return n; }); }} 
                  required
                  aria-invalid={!!validationErrors[`medDosage_${_idx}`]}
                  aria-describedby={validationErrors[`medDosage_${_idx}`] ? `medDosage_${_idx}-error` : undefined}
                />
                {validationErrors[`medDosage_${_idx}`] && <div id={`medDosage_${_idx}-error`} className="form-error" role="alert">{validationErrors[`medDosage_${_idx}`]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Frequency *</label>
                <select className="form-input" value={med.frequency} onChange={e => updateMedication(med.id, 'frequency', e.target.value)} required>
                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Duration *</label>
                <input 
                  type="text" 
                  className={`form-input ${validationErrors[`medDuration_${_idx}`] ? 'error' : ''}`} 
                  placeholder="e.g. 7 days, 30 days, Lifetime" 
                  value={med.duration} 
                  onChange={e => { updateMedication(med.id, 'duration', e.target.value); setValidationErrors(prev => { const n={...prev}; delete n[`medDuration_${_idx}`]; return n; }); }} 
                  required
                  aria-invalid={!!validationErrors[`medDuration_${_idx}`]}
                  aria-describedby={validationErrors[`medDuration_${_idx}`] ? `medDuration_${_idx}-error` : undefined}
                />
                {validationErrors[`medDuration_${_idx}`] && <div id={`medDuration_${_idx}-error`} className="form-error" role="alert">{validationErrors[`medDuration_${_idx}`]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Duration Type *</label>
                <select className="form-input" value={med.durationType} onChange={e => {
                  const newType = e.target.value as MedicationDurationType;
                  updateMedication(med.id, 'durationType', newType);
                  updateMedication(med.id, 'isLifetime', newType === 'LIFETIME');
                  if (newType === 'LIFETIME') {
                    updateMedication(med.id, 'duration', 'Lifetime');
                  } else if (newType === 'AS_NEEDED') {
                    updateMedication(med.id, 'duration', 'As needed');
                  }
                }}>
                  {DURATION_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input 
                  type="number" 
                  className={`form-input ${validationErrors[`medQty_${_idx}`] ? 'error' : ''}`} 
                  placeholder="Total quantity" 
                  value={med.quantity} 
                  onChange={e => { updateMedication(med.id, 'quantity', parseInt(e.target.value) || 1); setValidationErrors(prev => { const n={...prev}; delete n[`medQty_${_idx}`]; return n; }); }} 
                  min="1" required
                  aria-invalid={!!validationErrors[`medQty_${_idx}`]}
                  aria-describedby={validationErrors[`medQty_${_idx}`] ? `medQty_${_idx}-error` : undefined}
                />
                {validationErrors[`medQty_${_idx}`] && <div id={`medQty_${_idx}-error`} className="form-error" role="alert">{validationErrors[`medQty_${_idx}`]}</div>}
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Instructions</label>
                <input type="text" className="form-input" placeholder="e.g. After meals, Before bed, Empty stomach" value={med.instructions} onChange={e => updateMedication(med.id, 'instructions', e.target.value)} />
              </div>
            </div>

            {med.isLifetime && (
              <div className="lifetime-badge" role="status">
                <Zap size={14} /> Lifetime / Chronic Medication — Will register patient permanently
              </div>
            )}

            {isMedScheduleH1(med) && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #f87171',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                marginTop: '8px'
              }}>
                <ShieldAlert size={14} /> Schedule H1 Controlled Drug: D&C Act mandatory register audit upon dispensing
              </div>
            )}
          </div>
        ))}
        {medications.length === 0 && (
          <div className="empty-state-small">No medications added. Click "Add Medication" to start.</div>
        )}

        {/* Prescription Validity & Refill Controls */}
        <div style={{
          marginTop: '20px',
          padding: '14px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Prescription Validity Window</label>
            <select
              className="form-input"
              value={validityDays}
              onChange={e => setValidityDays(parseInt(e.target.value, 10))}
            >
              <option value={7}>7 Days (Acute illness / Antibiotics)</option>
              <option value={15}>15 Days (Standard OPD)</option>
              <option value={30}>30 Days (1 Month Maintenance)</option>
              <option value={60}>60 Days (2 Months Chronic)</option>
              <option value={90}>90 Days (Quarterly Evaluation)</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#334155' }}>Chronic Refills Authorized</label>
            <select
              className="form-input"
              value={maxRefillsAllowed}
              onChange={e => setMaxRefillsAllowed(parseInt(e.target.value, 10))}
            >
              <option value={0}>0 Refills (Single Dispensing Only)</option>
              <option value={1}>1 Authorized Refill (+30 days)</option>
              <option value={2}>2 Authorized Refills (+60 days)</option>
              <option value={3}>3 Authorized Refills (+90 days)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tests & Follow-up */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">
            <Microscope size={18} /> Step 4: Tests & Follow-up Schedule
          </h2>
        </div>

        {/* Tests */}
        <div className="subsection">
          <div className="subsection-header">
            <h3>Investigations / Tests</h3>
            <button type="button" className="btn-secondary btn-sm" onClick={addTest} disabled={isSubmitting}>
              <Plus size={14} /> Add Test
            </button>
          </div>
          {tests.length === 0 ? (
            <div className="empty-state-small">No tests prescribed. Add if required.</div>
          ) : (
            tests.map(test => (
              <div key={test.id} className="test-item">
                <input type="text" className="form-input" placeholder="Test name (e.g. CBC, LFT, KFT, X-Ray Chest)" value={test.testName} onChange={e => updateTest(test.id, 'testName', e.target.value)} />
                <input type="text" className="form-input" placeholder="Instructions (e.g. Fasting, Morning sample)" value={test.instructions || ''} onChange={e => updateTest(test.id, 'instructions', e.target.value)} />
                <label className="checkbox-label">
                  <input type="checkbox" checked={test.isUrgent} onChange={e => updateTest(test.id, 'isUrgent', e.target.checked)} />
                  <span>Urgent</span>
                </label>
                <button type="button" className="btn-ghost btn-sm" onClick={() => { if (window.confirm('Remove this test?')) removeTest(test.id); }} disabled={tests.length <= 1} aria-label={`Remove test ${test.testName || ''}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Follow-up */}
        <div className="subsection" style={{ marginTop: '16px' }}>
          <h3>Follow-up Schedule</h3>
          {followUps.map((fu, _idx) => (
            <div key={fu.id} className="followup-item">
              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input type="date" className="form-input" value={fu.followUpDate} onChange={e => updateFollowUp(fu.id, 'followUpDate', e.target.value)} min={minFollowUpDate} />
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-input" value={fu.frequency} onChange={e => updateFollowUp(fu.id, 'frequency', e.target.value as FollowUpFrequency)}>
                  {FOLLOWUP_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              {fu.frequency === 'CUSTOM' && (
                <div className="form-group">
                  <label className="form-label">Custom Interval (Days)</label>
                  <input type="number" className="form-input" placeholder="e.g. 14" value={fu.customDays || ''} onChange={e => updateFollowUp(fu.id, 'customDays', parseInt(e.target.value) || 0)} min="1" />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <input type="text" className="form-input" placeholder="Follow-up instructions" value={fu.notes || ''} onChange={e => updateFollowUp(fu.id, 'notes', e.target.value)} />
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { if (window.confirm('Remove this follow-up?')) removeFollowUp(fu.id); }} disabled={followUps.length <= 1} aria-label={`Remove follow-up ${_idx + 1}`}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={addFollowUp} disabled={isSubmitting} style={{ marginTop: '8px' }}>
            <Plus size={14} /> Add Follow-up
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="prescription-submit-bar">
        <div className="submit-info">
          <div className="info-item">
            <Clock size={16} /> Generated: {new Date().toLocaleString()}
          </div>
          <div className="info-item">
            <FileText size={16} /> Ref: {generateReferenceNumber()}
          </div>
          <div className="info-item">
            <User size={16} /> Dr: {selectedDoctor?.name || 'Select doctor'}
          </div>
        </div>
        <button 
          type="submit" 
          className="btn-primary-action btn-lg"
          onClick={handleSubmitPrescription}
          disabled={isSubmitting || !isStep1Valid() || !isStep2Valid() || !isStep3Valid() || !selectedDoctor}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <> <Loader2 size={16} className="animate-spin" /> Creating... </> 
          ) : (
            <> Create E-Prescription <Send size={16} /></>
          )}
        </button>
      </div>

      {/* Doctor Modal */}
      {showDoctorModal && (
        <div className="modal-backdrop" onClick={() => { setShowDoctorModal(false); setDoctorModalError(null); }}>
          <div className="modal-card" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingDoctor ? 'Edit Doctor' : 'Register New Doctor'}</h3>
              <button type="button" className="icon-btn-ghost" onClick={() => { setShowDoctorModal(false); setDoctorModalError(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleDoctorSubmit} style={{ padding: '16px' }}>
              {doctorModalError && <div className="form-error" role="alert" style={{ marginBottom: '12px' }}>{doctorModalError}</div>}
              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-input" value={doctorForm.name} onChange={e => setDoctorForm({...doctorForm, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile *</label>
                  <input type="tel" className="form-input" value={doctorForm.mobile} onChange={e => setDoctorForm({...doctorForm, mobile: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" value={doctorForm.email} onChange={e => setDoctorForm({...doctorForm, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Designation *</label>
                  <input type="text" className="form-input" value={doctorForm.designation} onChange={e => setDoctorForm({...doctorForm, designation: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Degree *</label>
                  <input type="text" className="form-input" value={doctorForm.degree} onChange={e => setDoctorForm({...doctorForm, degree: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Specialization *</label>
                  <select className="form-input" value={doctorForm.specialization} onChange={e => setDoctorForm({...doctorForm, specialization: e.target.value as DoctorSpecialization})}>
                    {['GENERAL_PHYSICIAN','CARDIOLOGIST','DERMATOLOGIST','ORTHOPEDIC','PEDIATRICIAN','GYNECOLOGIST','NEUROLOGIST','PSYCHIATRIST','ENT','OPHTHALMOLOGIST','DENTIST','OTHER'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Registration Number *</label>
                  <input type="text" className="form-input" value={doctorForm.registrationNumber} onChange={e => setDoctorForm({...doctorForm, registrationNumber: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hospital / Clinic</label>
                  <input type="text" className="form-input" value={doctorForm.hospitalClinic} onChange={e => setDoctorForm({...doctorForm, hospitalClinic: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowDoctorModal(false); setDoctorModalError(null); }}>Cancel</button>
                <button type="submit" className="btn-primary-action" disabled={isSubmitting}>{editingDoctor ? 'Update' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorCorner;