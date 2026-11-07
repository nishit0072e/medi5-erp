import React, { useState } from 'react';
import { UserCog, X, AlertCircle } from 'lucide-react';
import { Patient, PatientStatus, CommunicationPreference, UpdatePatientInput } from '../types/patient';
import { isValidIndianMobile } from '../utils/whatsappUtils';

interface EditPatientModalProps {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSubmit: (patientId: string, input: UpdatePatientInput) => void;
}

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  isOpen,
  patient,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone);
  const [email, setEmail] = useState(patient.email || '');
  const [age, setAge] = useState(patient.age ? String(patient.age) : '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>(patient.gender || 'MALE');
  const [address, setAddress] = useState(patient.address || '');
  const [notes, setNotes] = useState(patient.notes || '');
  const [status, setStatus] = useState<PatientStatus>(patient.status);
  const [communicationPreference, setCommunicationPreference] = useState<CommunicationPreference>(
    patient.communicationPreference
  );
  const [consentGiven, setConsentGiven] = useState(patient.consentGiven);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const input: UpdatePatientInput = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      age: age ? parseInt(age, 10) : undefined,
      gender,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      communicationPreference,
      consentGiven
    };

    try {
      onSubmit(patient.id, input);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update patient');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-pat-title">
      <div className="modal-container modal-patient-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="icon-badge">
              <UserCog size={18} />
            </div>
            <div>
              <h3 id="edit-pat-title" className="modal-title">Edit Patient Profile</h3>
              <p className="modal-subtitle">Update demographics, status and communication consent</p>
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

        <form onSubmit={handleSubmit} className="modal-body modal-form">
          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Patient Full Name *</label>
              <input
                type="text"
                className="form-input"
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
                placeholder="patient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Age (Years)</label>
              <input
                type="number"
                min="1"
                max="120"
                className="form-input font-mono"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-grid-2">
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

            <div className="form-group">
              <label className="form-label">Patient Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as PatientStatus)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address / Neighborhood</label>
            <input
              type="text"
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Patient Notes / Medical History</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Preferred Communication Channel</label>
              <select
                className="form-select"
                value={communicationPreference}
                onChange={(e) => setCommunicationPreference(e.target.value as CommunicationPreference)}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="CALL">Phone Call</option>
                <option value="NONE">Do Not Contact</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Communication Consent</label>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingTop: '10px' }}>
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-green)' }}
                />
                <span className="text-xs">Patient consents to refill reminders</span>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
