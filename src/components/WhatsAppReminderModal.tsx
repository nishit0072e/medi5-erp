import React, { useState } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  ExternalLink 
} from 'lucide-react';
import { Patient, PatientMedication } from '../types/patient';
import { PharmacyProfile } from '../types/pharmacy';
import { 
  generateWhatsAppTemplateMessage, 
  getWhatsAppTemplateLabel,
  buildWhatsAppLink, 
  formatWhatsAppPhoneNumber,
  WhatsAppTemplateType
} from '../utils/whatsappUtils';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  patient: Patient;
  medication: PatientMedication;
  pharmacy: PharmacyProfile;
  staffUser: string;
  onClose: () => void;
  onSent: (logData: {
    patientId: string;
    medicationId: string;
    patientName: string;
    patientPhone: string;
    messageText: string;
    initiatedByStaff: string;
  }) => void;
}

export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = ({
  isOpen,
  patient,
  medication,
  pharmacy,
  staffUser,
  onClose,
  onSent
}) => {
  if (!isOpen) return null;

  const buildMessage = (template: WhatsAppTemplateType) =>
    generateWhatsAppTemplateMessage(template, {
      patientName: patient.name,
      pharmacyName: pharmacy.name,
      pharmacyPhone: pharmacy.phone,
      medicineName: medication.medicineName,
      strength: medication.strength,
      nextRefillDueDate: medication.nextRefillDueDate
    });

  const defaultMessage = buildMessage('REFILL_REMINDER');

  const [template, setTemplate] = useState<WhatsAppTemplateType>('REFILL_REMINDER');
  const [messageText, setMessageText] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  const handleTemplateChange = (next: WhatsAppTemplateType) => {
    setTemplate(next);
    setMessageText(buildMessage(next));
  };

  const formattedPhone = formatWhatsAppPhoneNumber(patient.phone);
  const waLink = buildWhatsAppLink(patient.phone, messageText);

  const handleLaunchWhatsApp = () => {
    // 1. Open the user-initiated WhatsApp link in a new window/tab
    window.open(waLink, '_blank', 'noopener,noreferrer');

    // 2. Record the communication event into the audit log
    onSent({
      patientId: patient.id,
      medicationId: medication.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      messageText,
      initiatedByStaff: staffUser
    });

    onClose();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="wa-modal-title">
      <div className="modal-container wa-reminder-modal">
        {/* Header */}
        <div className="modal-header wa-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="wa-icon-badge">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h3 id="wa-modal-title" className="modal-title">Confirm WhatsApp Refill Reminder</h3>
              <p className="modal-subtitle">User-initiated reminder confirmation before sending</p>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Recipient Overview Card */}
        <div className="wa-recipient-card">
          <div className="recipient-row">
            <span className="recipient-label">Patient:</span>
            <span className="recipient-value font-bold">{patient.name}</span>
          </div>
          <div className="recipient-row">
            <span className="recipient-label">WhatsApp Number:</span>
            <span className="recipient-value font-mono">
              +{formattedPhone.slice(0, 2)} {formattedPhone.slice(2, 7)} {formattedPhone.slice(7)}
            </span>
          </div>
          <div className="recipient-row">
            <span className="recipient-label">Prescription:</span>
            <span className="recipient-value font-bold text-primary-green">
              {medication.medicineName} ({medication.strength})
            </span>
          </div>
          <div className="recipient-row">
            <span className="recipient-label">Refill Due:</span>
            <span className="recipient-value font-mono">{medication.nextRefillDueDate}</span>
          </div>
        </div>

        {/* Notice */}
        <div className="wa-consent-notice">
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <span>
            The message will open in WhatsApp with the prefilled text below. You can edit the text before sending.
          </span>
        </div>

        {/* Template Selector */}
        <div className="wa-template-selector">
          {(['REFILL_REMINDER', 'ORDER_READY', 'FOLLOW_UP'] as WhatsAppTemplateType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`wa-template-pill ${template === t ? 'active' : ''}`}
              onClick={() => handleTemplateChange(t)}
            >
              {getWhatsAppTemplateLabel(t)}
            </button>
          ))}
        </div>

        {/* Message Editor */}
        <div className="form-group" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label">Message Preview & Customization</label>
            <button 
              type="button" 
              className="btn-copy-wa" 
              onClick={handleCopyText}
              title="Copy text to clipboard"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <textarea
            className="form-input wa-textarea"
            rows={7}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn-primary-action btn-whatsapp"
            onClick={handleLaunchWhatsApp}
          >
            <Send size={16} />
            <span>Open in WhatsApp</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
