import React, { useState } from 'react';
import { Activity, X, Heart, Thermometer, Wind, Scale, CheckCircle2 } from 'lucide-react';
import { DoctorAppointment, PatientVitals } from '../types/appointment';

interface RecordVitalsModalProps {
  isOpen: boolean;
  appointment: DoctorAppointment | null;
  onClose: () => void;
  onSubmit: (appointmentId: string, vitals: PatientVitals) => void;
  staffName?: string;
}

export const RecordVitalsModal: React.FC<RecordVitalsModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onSubmit,
  staffName = 'Staff Reception'
}) => {
  if (!isOpen || !appointment) return null;

  const [bp, setBp] = useState(appointment.vitals?.bp || '');
  const [pulse, setPulse] = useState(appointment.vitals?.pulse || '');
  const [temp, setTemp] = useState(appointment.vitals?.temp || '');
  const [spo2, setSpo2] = useState(appointment.vitals?.spo2 || '');
  const [weightKg, setWeightKg] = useState<number | ''>(appointment.vitals?.weightKg || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(appointment.id, {
      bp: bp.trim() || undefined,
      pulse: pulse.trim() ? (pulse.includes('bpm') ? pulse.trim() : `${pulse.trim()} bpm`) : undefined,
      temp: temp.trim() ? (temp.includes('°F') ? temp.trim() : `${temp.trim()} °F`) : undefined,
      spo2: spo2.trim() ? (spo2.includes('%') ? spo2.trim() : `${spo2.trim()}%`) : undefined,
      weightKg: typeof weightKg === 'number' && !isNaN(weightKg) ? weightKg : undefined,
      recordedBy: staffName
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="vitals-title">
      <div className="modal-container" style={{ maxWidth: '440px' }}>
        <form onSubmit={handleSubmit} className="modal-dialog-form">
          {/* Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="icon-badge">
                <Activity size={18} />
              </div>
              <div>
                <h3 id="vitals-title" className="modal-title">Record Patient Vitals</h3>
                <p className="modal-subtitle">Token #{appointment.tokenNumber} • {appointment.patientName}</p>
              </div>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="modal-body modal-dialog-scrollable">
            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Heart size={13} className="text-red-500" />
                  <span>Blood Pressure (BP)</span>
                </label>
                <input
                  type="text"
                  className="form-input font-mono font-bold"
                  placeholder="e.g. 120/80"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={13} className="text-emerald-500" />
                  <span>Pulse Rate (bpm)</span>
                </label>
                <input
                  type="text"
                  className="form-input font-mono font-bold"
                  placeholder="e.g. 74"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Thermometer size={13} className="text-amber-500" />
                  <span>Temperature (°F)</span>
                </label>
                <input
                  type="text"
                  className="form-input font-mono font-bold"
                  placeholder="e.g. 98.6"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Wind size={13} className="text-blue-500" />
                  <span>Blood Oxygen (SpO2)</span>
                </label>
                <input
                  type="text"
                  className="form-input font-mono font-bold"
                  placeholder="e.g. 98"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Scale size={13} className="text-purple-500" />
                <span>Body Weight (kg)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="300"
                className="form-input font-mono font-bold"
                placeholder="e.g. 68.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? parseFloat(e.target.value) : '')}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer modal-dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-action">
              <CheckCircle2 size={16} />
              <span>Save Vitals</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
