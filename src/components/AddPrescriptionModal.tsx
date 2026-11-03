import React, { useState } from 'react';
import { FileText, X, AlertCircle } from 'lucide-react';
import { Patient, PrescriptionReference } from '../types/patient';

export type PrescriptionFormInput = Omit<
  PrescriptionReference,
  'id' | 'pharmacyId' | 'patientId' | 'createdAt' | 'updatedAt' | 'referenceNumber'
> & { referenceNumber: string };

interface AddPrescriptionModalProps {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSubmit: (input: PrescriptionFormInput) => void;
}

export const AddPrescriptionModal: React.FC<AddPrescriptionModalProps> = ({
  isOpen,
  patient,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [referenceNumber, setReferenceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayStr);
  const [expiryDate, setExpiryDate] = useState('');
  const [prescriberName, setPrescriberName] = useState('');
  const [prescriberRegistration, setPrescriberRegistration] = useState('');
  const [prescriberContact, setPrescriberContact] = useState('');
  const [hospitalClinic, setHospitalClinic] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!referenceNumber.trim()) {
      setErrorMessage('Prescription reference number is required.');
      return;
    }
    if (!issueDate) {
      setErrorMessage('Prescription issue date is required.');
      return;
    }
    if (expiryDate && expiryDate < issueDate) {
      setErrorMessage('Expiry date cannot be earlier than the issue date.');
      return;
    }

    try {
      onSubmit({
        referenceNumber: referenceNumber.trim().toUpperCase(),
        issueDate,
        expiryDate: expiryDate || undefined,
        prescriberName: prescriberName.trim() || undefined,
        prescriberRegistration: prescriberRegistration.trim() || undefined,
        prescriberContact: prescriberContact.trim() || undefined,
        hospitalClinic: hospitalClinic.trim() || undefined,
        notes: notes.trim() || undefined
      });
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save prescription');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-rx-title">
      <div className="modal-container">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="icon-badge">
              <FileText size={18} />
            </div>
            <div>
              <h3 id="add-rx-title" className="modal-title">Add Prescription Reference</h3>
              <p className="modal-subtitle">Store prescriber details for {patient.name}</p>
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

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Reference Number *</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="e.g. RX-2026-NDN-004"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Issue Date *</label>
              <input
                type="date"
                className="form-input font-mono"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Prescriber Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dr. A. Banerjee"
                value={prescriberName}
                onChange={(e) => setPrescriberName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Registration Number</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="e.g. WBMC-45821"
                value={prescriberRegistration}
                onChange={(e) => setPrescriberRegistration(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Hospital / Clinic</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Apollo Clinic, Salt Lake"
                value={hospitalClinic}
                onChange={(e) => setHospitalClinic(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prescriber Contact</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="e.g. 033-4000-1234"
                value={prescriberContact}
                onChange={(e) => setPrescriberContact(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Prescription Expiry Date</label>
              <input
                type="date"
                className="form-input font-mono"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 3-month course, review after 30 days"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              Save Prescription
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
