import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Store, 
  Clock, 
  Sliders, 
  ArrowRight
} from 'lucide-react';
import { PharmacyProfile, UpdatePharmacyInput, AddMemberInput, MembershipRole } from '../types/pharmacy';

interface PharmacySettingsViewProps {
  pharmacies: PharmacyProfile[];
  activePharmacyId: string;
  onSwitchPharmacy: (pharmacyId: string) => void;
  onUpdateProfile: (pharmacyId: string, input: UpdatePharmacyInput) => void;
  onCreatePharmacy: (input: UpdatePharmacyInput & { ownerName: string; ownerPhone: string; ownerEmail: string }) => void;
  onAddMember: (pharmacyId: string, input: AddMemberInput) => void;
  onRemoveMember: (pharmacyId: string, memberId: string) => void;
  onBackToInventory?: () => void;
}

export const PharmacySettingsView: React.FC<PharmacySettingsViewProps> = ({
  pharmacies,
  activePharmacyId,
  onSwitchPharmacy,
  onUpdateProfile,
  onCreatePharmacy,
  onAddMember,
  onRemoveMember,
  onBackToInventory
}) => {
  const activePharmacy = pharmacies.find((p) => p.id === activePharmacyId) || pharmacies[0];

  // Tab navigation inside settings: 'profile' | 'staff' | 'receipt_preview' | 'tenants'
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'staff' | 'receipt_preview' | 'tenants'>('profile');

  // Form states for profile editing
  const [name, setName] = useState(activePharmacy.name);
  const [legalName, setLegalName] = useState(activePharmacy.legalName || '');
  const [drugLicenseNumber, setDrugLicenseNumber] = useState(activePharmacy.drugLicenseNumber);
  const [gstin, setGstin] = useState(activePharmacy.gstin || '');
  const [addressLine1, setAddressLine1] = useState(activePharmacy.addressLine1);
  const [addressLine2, setAddressLine2] = useState(activePharmacy.addressLine2 || '');
  const [city, setCity] = useState(activePharmacy.city);
  const [state, setState] = useState(activePharmacy.state || 'West Bengal');
  const [pincode, setPincode] = useState(activePharmacy.pincode);
  const [phone, setPhone] = useState(activePharmacy.phone);
  const [email, setEmail] = useState(activePharmacy.email);
  const [expiryThresholdDays, setExpiryThresholdDays] = useState(activePharmacy.expiryThresholdDays.toString());
  const [lowStockThresholdDefault, setLowStockThresholdDefault] = useState(activePharmacy.lowStockThresholdDefault.toString());

  // Keep form in sync when active pharmacy changes
  React.useEffect(() => {
    setName(activePharmacy.name);
    setLegalName(activePharmacy.legalName || '');
    setDrugLicenseNumber(activePharmacy.drugLicenseNumber);
    setGstin(activePharmacy.gstin || '');
    setAddressLine1(activePharmacy.addressLine1);
    setAddressLine2(activePharmacy.addressLine2 || '');
    setCity(activePharmacy.city);
    setState(activePharmacy.state || 'West Bengal');
    setPincode(activePharmacy.pincode);
    setPhone(activePharmacy.phone);
    setEmail(activePharmacy.email);
    setExpiryThresholdDays(activePharmacy.expiryThresholdDays.toString());
    setLowStockThresholdDefault(activePharmacy.lowStockThresholdDefault.toString());
  }, [activePharmacy]);

  // Form states for adding new staff member
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState<MembershipRole>('STAFF');

  // Form states for creating a new pharmacy tenant
  const [isNewStoreOpen, setIsNewStoreOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newLegalName, setNewLegalName] = useState('');
  const [newDl, setNewDl] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newCity, setNewCity] = useState('Kolkata');
  const [newAddress, setNewAddress] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');

  // Local feedback message
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      const expDays = parseInt(expiryThresholdDays, 10);
      const lowStock = parseInt(lowStockThresholdDefault, 10);

      onUpdateProfile(activePharmacy.id, {
        name,
        legalName,
        drugLicenseNumber,
        gstin: gstin.trim() || undefined,
        addressLine1,
        addressLine2: addressLine2.trim() || undefined,
        city,
        state,
        pincode,
        phone,
        email,
        expiryThresholdDays: isNaN(expDays) ? 60 : expDays,
        lowStockThresholdDefault: isNaN(lowStock) ? 15 : lowStock
      });

      setSuccessMsg('Pharmacy profile and operational settings saved successfully!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update pharmacy profile.');
    }
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      if (!staffName.trim()) throw new Error('Staff name is required.');
      if (!staffPhone.trim()) throw new Error('Phone number is required.');

      onAddMember(activePharmacy.id, {
        name: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim(),
        role: staffRole
      });

      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffRole('STAFF');
      setIsAddStaffOpen(false);
      setSuccessMsg(`Added ${staffName} as ${staffRole} to ${activePharmacy.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add staff member.');
    }
  };

  const handleRemoveMemberClick = (memberId: string, memberName: string) => {
    clearMessages();
    if (window.confirm(`Are you sure you want to remove ${memberName} from this pharmacy?`)) {
      try {
        onRemoveMember(activePharmacy.id, memberId);
        setSuccessMsg(`Removed ${memberName} from staff list.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to remove member.');
      }
    }
  };

  const handleCreateStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      if (!newStoreName.trim()) throw new Error('Store trade name is required.');
      if (!newDl.trim()) throw new Error('Drug License Number (Form 20/21) is required.');
      if (!newPhone.trim()) throw new Error('Store phone is required.');

      onCreatePharmacy({
        name: newStoreName.trim(),
        legalName: newLegalName.trim() || newStoreName.trim(),
        drugLicenseNumber: newDl.trim().toUpperCase(),
        gstin: newGstin.trim().toUpperCase() || undefined,
        addressLine1: newAddress.trim() || 'Main Market Road',
        city: newCity.trim(),
        state: 'West Bengal',
        pincode: newPincode.trim() || '700001',
        phone: newPhone.trim(),
        email: newEmail.trim() || `${newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
        expiryThresholdDays: 60,
        lowStockThresholdDefault: 15,
        ownerName: newOwnerName.trim() || 'New Store Owner',
        ownerPhone: newPhone.trim(),
        ownerEmail: newEmail.trim() || 'owner@pharmacy.in'
      });

      setIsNewStoreOpen(false);
      setNewStoreName('');
      setNewLegalName('');
      setNewDl('');
      setNewGstin('');
      setNewPhone('');
      setNewEmail('');
      setNewOwnerName('');
      setSuccessMsg(`New pharmacy tenant registered and activated!`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register new pharmacy.');
    }
  };

  return (
    <div className="settings-container">
      {/* Settings Header Bar */}
      <div className="settings-header">
        <div className="settings-header-title">
          <div className="settings-icon-badge">
            <Building2 size={22} />
          </div>
          <div>
            <h2>Pharmacy Profile & Tenancy Settings</h2>
            <p className="settings-subtitle">
              Manage legal business details, drug licensing (Form 20/21), multi-store branches, and staff RBAC permissions.
            </p>
          </div>
        </div>

        {onBackToInventory && (
          <button 
            type="button" 
            className="btn-back-counter"
            onClick={onBackToInventory}
          >
            <span>Back to Inventory</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Active Tenant Switcher Bar */}
      <div className="tenant-selector-card">
        <div className="tenant-selector-header">
          <div className="tenant-current-badge">
            <Store size={18} className="text-primary-green" />
            <div>
              <span className="tenant-label">ACTIVE PHARMACY TENANT:</span>
              <div className="tenant-name-row">
                <span className="tenant-active-name">{activePharmacy.name}</span>
                <span className="tenant-status-pill">ACTIVE • FORM 20/21</span>
              </div>
            </div>
          </div>

          <div className="tenant-switcher-actions">
            <span className="text-xs text-muted">Switch Tenant:</span>
            <div className="tenant-pill-group">
              {pharmacies.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`tenant-pill-btn ${p.id === activePharmacy.id ? 'active' : ''}`}
                  onClick={() => onSwitchPharmacy(p.id)}
                >
                  <span className="tenant-dot"></span>
                  <span>{p.name} ({p.city})</span>
                </button>
              ))}
              <button
                type="button"
                className="btn-add-store-pill"
                onClick={() => setIsNewStoreOpen(true)}
                title="Register a new pharmacy branch"
              >
                <Plus size={14} />
                <span>New Store</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="settings-alert alert-success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {errorMsg && (
        <div className="settings-alert alert-error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
          <button type="button" className="alert-close" onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsTab === 'profile'}
          className={`settings-tab-btn ${activeSettingsTab === 'profile' ? 'active' : ''}`}
          onClick={() => { clearMessages(); setActiveSettingsTab('profile'); }}
        >
          <Building2 size={15} />
          <span>Store & Legal Profile</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsTab === 'staff'}
          className={`settings-tab-btn ${activeSettingsTab === 'staff' ? 'active' : ''}`}
          onClick={() => { clearMessages(); setActiveSettingsTab('staff'); }}
        >
          <Users size={15} />
          <span>Staff & RBAC Roles ({activePharmacy.members.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsTab === 'receipt_preview'}
          className={`settings-tab-btn ${activeSettingsTab === 'receipt_preview' ? 'active' : ''}`}
          onClick={() => { clearMessages(); setActiveSettingsTab('receipt_preview'); }}
        >
          <FileText size={15} />
          <span>Dispensing Receipt Preview</span>
        </button>
      </div>

      {/* TAB 1: STORE & LEGAL PROFILE FORM */}
      {activeSettingsTab === 'profile' && (
        <div className="settings-content-card">
          <form onSubmit={handleSaveProfile} className="settings-form">
            <div className="form-section-header">
              <ShieldCheck size={18} className="text-primary-green" />
              <div>
                <h3>Legal Entity & Regulatory Compliance</h3>
                <p className="text-muted text-xs">
                  Required on dispensing receipts under West Bengal Drug Control & GST regulations.
                </p>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Pharmacy Trade Name *</label>
                <input
                  type="text"
                  className="form-input font-bold"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nandan Pharmacy"
                  required
                />
                <span className="field-hint">Display name used on POS counters and receipts</span>
              </div>

              <div className="form-group">
                <label className="form-label">Registered Legal Entity Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Nandan Chemist & Druggist Pvt. Ltd."
                />
                <span className="field-hint">Registered business entity as per Trade License</span>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Drug License Number (Form 20/21) *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={drugLicenseNumber}
                  onChange={(e) => setDrugLicenseNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. WB-KOL-20B-184920"
                  required
                />
                <span className="field-hint">Issued by Directorate of Drugs Control, West Bengal</span>
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN (Goods & Services Tax No.)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 19AABCN8572P1Z5"
                  maxLength={15}
                />
                <span className="field-hint">15-digit State Code (19 for WB) + PAN + Entity Code</span>
              </div>
            </div>

            <div className="form-divider"></div>

            <div className="form-section-header">
              <MapPin size={18} className="text-primary-green" />
              <div>
                <h3>Physical Location & Contact</h3>
                <p className="text-muted text-xs">Printed on invoices and patient WhatsApp refill memos.</p>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Address Line 1 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. 142 Rashbehari Avenue"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address Line 2 / Landmark</label>
                <input
                  type="text"
                  className="form-input"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="e.g. Near Triangular Park"
                />
              </div>
            </div>

            <div className="settings-grid-3">
              <div className="form-group">
                <label className="form-label">City *</label>
                <input
                  type="text"
                  className="form-input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Kolkata"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  className="form-input"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="West Bengal"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pincode *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 700029"
                  required
                />
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Official Store Phone / WhatsApp *</label>
                <div className="input-with-icon">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input pl-icon"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98300 00000"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Official Store Email</label>
                <div className="input-with-icon">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    className="form-input pl-icon"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="store@pharmacy.in"
                  />
                </div>
              </div>
            </div>

            <div className="form-divider"></div>

            <div className="form-section-header">
              <Sliders size={18} className="text-primary-green" />
              <div>
                <h3>Operational Thresholds & Alert Windows</h3>
                <p className="text-muted text-xs">Fine-tune inventory alerts and low-stock indicators.</p>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Expiry Alert Window (Days) *</label>
                <div className="input-with-icon">
                  <Clock size={15} className="input-icon" />
                  <input
                    type="number"
                    min="1"
                    max="180"
                    className="form-input pl-icon font-mono font-bold"
                    value={expiryThresholdDays}
                    onChange={(e) => setExpiryThresholdDays(e.target.value)}
                    required
                  />
                </div>
                <span className="field-hint">
                  Batches expiring within this number of days will be flagged as "Expiring Soon" in FEFO allocation.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Default Low Stock Threshold (Units)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="form-input font-mono font-bold"
                  value={lowStockThresholdDefault}
                  onChange={(e) => setLowStockThresholdDefault(e.target.value)}
                />
                <span className="field-hint">
                  Default threshold assigned to newly received medicines unless overridden at the medicine level.
                </span>
              </div>
            </div>

            <div className="form-actions-bar">
              <button type="submit" className="btn-primary-action">
                <CheckCircle2 size={16} />
                <span>Save Pharmacy Profile</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: STAFF & RBAC ROLES */}
      {activeSettingsTab === 'staff' && (
        <div className="settings-content-card">
          <div className="staff-header-row">
            <div>
              <h3>Authorized Staff & Role Memberships</h3>
              <p className="text-muted text-xs">
                Role-Based Access Control (RBAC) governing checkout, catalog editing, and audit ledger visibility.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary-action btn-sm"
              onClick={() => setIsAddStaffOpen(true)}
            >
              <Plus size={14} />
              <span>Add Staff Member</span>
            </button>
          </div>

          {/* Members Table */}
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Contact Info</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activePharmacy.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="staff-name-wrap">
                        <span className="staff-avatar">{m.name.charAt(0)}</span>
                        <div>
                          <div className="staff-name">{m.name}</div>
                          <div className="staff-id text-muted font-mono text-xs">{m.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-xs">{m.phone}</div>
                      <div className="text-xs text-muted">{m.email}</div>
                    </td>
                    <td>
                      <span className={`role-badge role-${m.role.toLowerCase()}`}>
                        {m.role}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge-active">
                        <span className="dot-active"></span>
                        {m.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted font-mono">{m.joinedDate}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-delete-member"
                        onClick={() => handleRemoveMemberClick(m.id, m.name)}
                        title="Remove member"
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Role Capabilities Reference */}
          <div className="role-permissions-guide">
            <h4 className="text-sm font-bold mb-2">Role Permissions Matrix:</h4>
            <div className="role-cards-grid">
              <div className="role-card">
                <span className="role-badge role-owner">OWNER</span>
                <p className="text-xs text-muted mt-1">
                  Full administrative ownership. Legal licensing, profile updates, staff invitation, financial analytics, store closure.
                </p>
              </div>
              <div className="role-card">
                <span className="role-badge role-manager">MANAGER</span>
                <p className="text-xs text-muted mt-1">
                  Store supervisor. Medicine catalog management, stock receiving, manual audit corrections, supplier purchase orders.
                </p>
              </div>
              <div className="role-card">
                <span className="role-badge role-staff">STAFF</span>
                <p className="text-xs text-muted mt-1">
                  Counter dispenser. POS checkout, medicine search, batch status lookup, dispensing receipts. Cannot alter purchase costs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECEIPT PREVIEW */}
      {activeSettingsTab === 'receipt_preview' && (
        <div className="settings-content-card">
          <div className="receipt-preview-header">
            <div>
              <h3>Walk-In Dispensing Memo Preview</h3>
              <p className="text-muted text-xs">
                This shows how your updated legal details, drug license, and contact info appear on patient receipts.
              </p>
            </div>
          </div>

          <div className="receipt-preview-box">
            <div className="receipt-paper preview-scale">
              <div className="receipt-store-header">
                <h3 className="store-name">{activePharmacy.name}</h3>
                {activePharmacy.legalName && (
                  <p className="text-xs text-muted">({activePharmacy.legalName})</p>
                )}
                <p className="store-sub">Retail Chemist & Druggist</p>
                <p className="store-address">
                  {activePharmacy.addressLine1}
                  {activePharmacy.addressLine2 ? `, ${activePharmacy.addressLine2}` : ''}, {activePharmacy.city}, {activePharmacy.state} - {activePharmacy.pincode}
                </p>
                <p className="store-address font-mono text-xs">
                  Ph: {activePharmacy.phone} • Email: {activePharmacy.email}
                </p>
                <div className="receipt-license-info">
                  <span>DL No: <strong>{activePharmacy.drugLicenseNumber}</strong></span>
                  {activePharmacy.gstin && (
                    <span> • GSTIN: <strong>{activePharmacy.gstin}</strong></span>
                  )}
                </div>
                <div className="receipt-badge-pill">WALK-IN COUNTER SALE MEMO</div>
              </div>

              <div className="receipt-divider-dashed"></div>

              <div className="receipt-meta-grid">
                <div className="meta-row">
                  <span className="meta-label">Invoice Ref:</span>
                  <span className="meta-value font-mono font-bold">INV-2026-0042-DEMO</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Dispensed By:</span>
                  <span className="meta-value">{activePharmacy.members[0]?.name || 'Nandan Sen'} (Demo)</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Payment Mode:</span>
                  <span className="meta-value badge-tender">UPI / CASH</span>
                </div>
              </div>

              <div className="receipt-divider-dashed"></div>

              <div className="text-xs text-muted text-center py-2 font-mono">
                [ Sample items dispensed under FEFO rules will appear here ]
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF MEMBER */}
      {isAddStaffOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container modal-sm">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} className="text-primary-green" />
                <h3 className="modal-title">Add Staff Member</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setIsAddStaffOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Sourav Ghosh"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-input font-mono"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="+91 98300 00000"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="sourav@pharmacy.in"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Role *</label>
                <select
                  className="form-select font-bold"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as MembershipRole)}
                >
                  <option value="STAFF">STAFF (Counter dispensing, stock lookup)</option>
                  <option value="MANAGER">MANAGER (Stock receipt, audit adjustments)</option>
                  <option value="OWNER">OWNER (Full ownership, legal profile, billing)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddStaffOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  <span>Add Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW PHARMACY BRANCH */}
      {isNewStoreOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={18} className="text-primary-green" />
                <h3 className="modal-title">Register New Pharmacy Branch</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setIsNewStoreOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateStoreSubmit} className="modal-form">
              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Store Trade Name *</label>
                  <input
                    type="text"
                    className="form-input font-bold"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="e.g. Anandamoyee Pharmacy"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Drug License No (Form 20/21) *</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={newDl}
                    onChange={(e) => setNewDl(e.target.value.toUpperCase())}
                    placeholder="e.g. WB-HOW-20B-789012"
                    required
                  />
                </div>
              </div>

              <div className="settings-grid-3">
                <div className="form-group">
                  <label className="form-label">Address Line *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="e.g. 12 GT Road"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Howrah"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value)}
                    placeholder="e.g. 711101"
                  />
                </div>
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Store Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98300 00000"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Store Owner Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="e.g. Dipankar Sen"
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNewStoreOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  <span>Register & Activate Pharmacy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
