import React, { useState } from 'react';
import { UserPlus, X, AlertCircle, Clock } from 'lucide-react';
import { Medicine } from '../types/inventory';
import { CommunicationPreference, CreatePatientInput, Patient } from '../types/patient';
import { isValidIndianMobile, calculateRefillDueDate } from '../utils/whatsappUtils';

interface AddPatientModalProps {
  isOpen: boolean;
  medicines: Medicine[];
  patients: Patient[];
  onClose: () => void;
  onSubmit: (input: CreatePatientInput) => void;
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({
  isOpen,
  medicines,
  patients,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [communicationPreference, setCommunicationPreference] = useState<CommunicationPreference>('WHATSAPP');
  const [consentGiven, setConsentGiven] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Initial medication toggle
  const [addInitialMed, setAddInitialMed] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState(medicines[0]?.id || '');
  const [dailyDosage, setDailyDosage] = useState('1 tab daily after meals');
  const [daysSupply, setDaysSupply] = useState(30);
  const [quantityPerRefill, setQuantityPerRefill] = useState(1);
  const [lastDispensedDate, setLastDispensedDate] = useState(todayStr);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedMedicine = medicines.find((m) => m.id === selectedMedId) || medicines[0];
  const calculatedDueDate = calculateRefillDueDate(lastDispensedDate, daysSupply);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Patient full name is required.');
      return;
    }

    if (!isValidIndianMobile(phone)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 9830012345).');
      return;
    }

    const trimmedPhone = phone.trim();
    const duplicate = patients.find((patient) => patient.phone === trimmedPhone);
    if (duplicate) {
      setErrorMessage(
        `A patient named "${duplicate.name}" is already registered with this mobile number. Open their profile from the directory instead.`
      );
      return;
    }

    const patientInput: CreatePatientInput = {
      name: name.trim(),
      phone: trimmedPhone,
      email: email.trim() || undefined,
      communicationPreference,
      consentGiven,
      age: age ? parseInt(age, 10) : undefined,
      gender,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      initialMedication: addInitialMed && selectedMedicine ? {
        medicineId: selectedMedicine.id,
        medicineName: selectedMedicine.name,
        strength: selectedMedicine.strength,
        dosageForm: selectedMedicine.dosageForm,
        dailyDosage,
        quantityPerRefill,
        daysSupply,
        lastDispensedDate
      } : undefined
    };

    try {
      onSubmit(patientInput);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to register patient');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-pat-title">
      <div className="modal-container modal-patient-modal">
        <form onSubmit={handleSubmit} className="modal-dialog-form">
          {/* Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="icon-badge">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 id="add-pat-title" className="modal-title">Register New Patient</h3>
                <p className="modal-subtitle">Add patient details for chronic refill tracking & WhatsApp reminders</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {errorMessage && (
            <div className="settings-alert alert-error" role="alert" style={{ margin: '14px 16px 0 16px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Body (Scrollable) */}
          <div className="modal-body modal-dialog-scrollable">
            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Patient Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Chandra Das"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">WhatsApp Mobile Number *</label>
                <div className="input-with-icon">
                  <span className="input-icon font-mono font-bold text-xs" style={{ left: '10px' }}>+91</span>
                  <input
                    type="tel"
                    className="form-input pl-icon font-mono font-bold"
                    placeholder="9830012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. ramesh.das@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Contact Channel</label>
                <select
                  className="form-select"
                  value={communicationPreference}
                  onChange={(e) => setCommunicationPreference(e.target.value as CommunicationPreference)}
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="CALL">Phone Call</option>
                  <option value="NONE">Do Not Disturb</option>
                </select>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Age (Years)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className="form-input font-mono"
                  placeholder="e.g. 55"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address / Neighborhood</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 14/2 Rashbehari Avenue, Kolkata"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Patient Notes / Medical History</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Type 2 Diabetes, hypertension, prefers evening calls"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="initial-med-toggle-wrap">
              <label className="checkbox-label font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-green)' }}
                />
                <span>Patient has consented to receive refill reminders on their preferred channel</span>
              </label>
            </div>

            {/* Initial Medication Checkbox */}
            <div className="initial-med-toggle-wrap">
              <label className="checkbox-label font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={addInitialMed}
                  onChange={(e) => setAddInitialMed(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-green)' }}
                />
                <span>Add Initial Chronic Medication & Refill Reminder</span>
              </label>
            </div>

            {addInitialMed && (
              <div className="initial-med-box">
                <div className="form-group">
                  <label className="form-label">Select Medicine *</label>
                  <select
                    className="form-select font-bold"
                    value={selectedMedId}
                    onChange={(e) => setSelectedMedId(e.target.value)}
                  >
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.strength}) • {m.dosageForm}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-grid-2">
                  <div className="form-group">
                    <label className="form-label">Daily Dosage Instructions</label>
                    <input
                      type="text"
                      className="form-input"
                      value={dailyDosage}
                      onChange={(e) => setDailyDosage(e.target.value)}
                      placeholder="e.g. 1 tab twice daily"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity Per Refill (Strips/Units)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input font-mono font-bold"
                      value={quantityPerRefill}
                      onChange={(e) => setQuantityPerRefill(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="form-group">
                    <label className="form-label">Days Supply (Duration)</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[10, 15, 30, 60].map((days) => (
                        <button
                          key={days}
                          type="button"
                          className={`btn-days-preset ${daysSupply === days ? 'active' : ''}`}
                          onClick={() => setDaysSupply(days)}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Dispensed Date</label>
                    <input
                      type="date"
                      className="form-input font-mono"
                      value={lastDispensedDate}
                      onChange={(e) => setLastDispensedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="refill-preview-card">
                  <Clock size={15} className="text-primary-green" />
                  <span>
                    Next Refill Due Date: <strong className="font-mono text-primary-green-dark">{calculatedDueDate}</strong> ({daysSupply} days from {lastDispensedDate})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions Footer (Always pinned at bottom) */}
          <div className="modal-footer modal-dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              <span>Save & Register Patient</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
