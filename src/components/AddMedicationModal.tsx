import React, { useState } from 'react';
import { Pill, X, Clock } from 'lucide-react';
import { Patient, AddMedicationInput } from '../types/patient';
import { Medicine } from '../types/inventory';
import { calculateRefillDueDate } from '../utils/whatsappUtils';

interface AddMedicationModalProps {
  isOpen: boolean;
  patient: Patient;
  medicines: Medicine[];
  onClose: () => void;
  onSubmit: (input: AddMedicationInput) => void;
}

export const AddMedicationModal: React.FC<AddMedicationModalProps> = ({
  isOpen,
  patient,
  medicines,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedMedId, setSelectedMedId] = useState(medicines[0]?.id || '');
  const [dailyDosage, setDailyDosage] = useState('1 tab daily after breakfast');
  const [quantityPerRefill, setQuantityPerRefill] = useState(1);
  const [daysSupply, setDaysSupply] = useState(30);
  const [lastDispensedDate, setLastDispensedDate] = useState(todayStr);

  const selectedMed = medicines.find((m) => m.id === selectedMedId) || medicines[0];
  const calculatedDueDate = calculateRefillDueDate(lastDispensedDate, daysSupply);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) return;

    onSubmit({
      medicineId: selectedMed.id,
      medicineName: selectedMed.name,
      strength: selectedMed.strength,
      dosageForm: selectedMed.dosageForm,
      dailyDosage,
      quantityPerRefill,
      daysSupply,
      lastDispensedDate
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-med-title">
      <div className="modal-container modal-sm">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="icon-badge">
              <Pill size={18} />
            </div>
            <div>
              <h3 id="add-med-title" className="modal-title">Add Chronic Medication</h3>
              <p className="modal-subtitle">For {patient.name} (+91 {patient.phone})</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body modal-form">
          <div className="form-group">
            <label className="form-label">Select Medicine *</label>
            <select
              className="form-select font-bold"
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              required
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.strength}) • {m.dosageForm}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Dosage Instructions</label>
            <input
              type="text"
              className="form-input"
              value={dailyDosage}
              onChange={(e) => setDailyDosage(e.target.value)}
              placeholder="e.g. 1 tab twice daily"
              required
            />
            <div className="dosage-preset-tags">
              {['1 tab daily (morning)', '1-0-1 after meals', '0-0-1 night', '1 tab SOS'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="btn-dosage-preset"
                  onClick={() => setDailyDosage(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Quantity Per Refill</label>
              <input
                type="number"
                min="1"
                className="form-input font-mono font-bold"
                value={quantityPerRefill}
                onChange={(e) => setQuantityPerRefill(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Days Supply</label>
              <div style={{ display: 'flex', gap: '4px' }}>
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
          </div>

          <div className="form-group">
            <label className="form-label">Last Dispensed Date</label>
            <input
              type="date"
              className="form-input font-mono"
              value={lastDispensedDate}
              onChange={(e) => setLastDispensedDate(e.target.value)}
              required
            />
          </div>

          <div className="refill-preview-card">
            <Clock size={15} className="text-primary-green" />
            <span>
              Next Refill Due Date: <strong className="font-mono text-primary-green-dark">{calculatedDueDate}</strong> ({daysSupply} days)
            </span>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              <span>Add Medication</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
