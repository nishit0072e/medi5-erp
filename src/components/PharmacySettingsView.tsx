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
  ArrowRight,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  X
} from 'lucide-react';
import { PharmacyProfile, UpdatePharmacyInput, CreatePharmacyInput, AddMemberInput, MembershipRole, PharmacyMember } from '../types/pharmacy';
import { generateSecurePassword, getRegisteredCredentials, registerUserCredential } from '../utils/authService';

interface PharmacySettingsViewProps {
  pharmacies: PharmacyProfile[];
  activePharmacyId: string;
  isSuperAdmin?: boolean;
  onSwitchPharmacy: (pharmacyId: string) => void;
  onUpdateProfile: (pharmacyId: string, input: UpdatePharmacyInput) => void;
  onCreatePharmacy: (input: CreatePharmacyInput) => void;
  onAddMember: (pharmacyId: string, input: AddMemberInput) => void;
  onRemoveMember: (pharmacyId: string, memberId: string) => void;
  onBackToInventory?: () => void;
}

export const PharmacySettingsView: React.FC<PharmacySettingsViewProps> = ({
  pharmacies,
  activePharmacyId,
  isSuperAdmin = false,
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
  const [staffPassword, setStaffPassword] = useState(() => generateSecurePassword());
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Staff onboarding credentials feedback modal
  const [provisionedStaffCreds, setProvisionedStaffCreds] = useState<{
    name: string;
    role: string;
    email: string;
    password: string;
    pharmacyName: string;
  } | null>(null);

  // View / Reset staff credentials modal
  const [viewingMemberCreds, setViewingMemberCreds] = useState<{
    member: PharmacyMember;
    currentPassword: string;
  } | null>(null);

  const [copiedStaffText, setCopiedStaffText] = useState(false);
  const [copiedStaffLogin, setCopiedStaffLogin] = useState(false);
  const [copiedStaffPass, setCopiedStaffPass] = useState(false);
  const [copiedViewText, setCopiedViewText] = useState(false);
  const [copiedViewPass, setCopiedViewPass] = useState(false);

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
  const [newOwnerPassword, setNewOwnerPassword] = useState(() => generateSecurePassword());
  const [showNewOwnerPassword, setShowNewOwnerPassword] = useState(false);
  const [provisionedBranchCreds, setProvisionedBranchCreds] = useState<{
    storeName: string;
    dl: string;
    city: string;
    ownerName: string;
    loginId: string;
    password: string;
  } | null>(null);
  const [copiedBranchText, setCopiedBranchText] = useState(false);

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

      const finalEmail = (staffEmail.trim() || `${staffName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${activePharmacy.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.in`).toLowerCase();
      const finalPassword = staffPassword.trim() || generateSecurePassword();

      onAddMember(activePharmacy.id, {
        name: staffName.trim(),
        email: finalEmail,
        phone: staffPhone.trim(),
        role: staffRole,
        password: finalPassword
      });

      setProvisionedStaffCreds({
        name: staffName.trim(),
        role: staffRole,
        email: finalEmail,
        password: finalPassword,
        pharmacyName: activePharmacy.name
      });

      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffRole('STAFF');
      setStaffPassword(generateSecurePassword());
      setIsAddStaffOpen(false);
      setSuccessMsg(`Added ${staffName} as ${staffRole} to ${activePharmacy.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add staff member.');
    }
  };

  const handleViewMemberCredentials = (member: PharmacyMember) => {
    const creds = getRegisteredCredentials();
    const existing = creds.find((c) => c.email.toLowerCase() === member.email.toLowerCase());
    const pass = existing?.password || member.initialPassword || generateSecurePassword();
    setViewingMemberCreds({
      member,
      currentPassword: pass
    });
  };

  const handleResetMemberPassword = () => {
    if (!viewingMemberCreds) return;
    const newPass = generateSecurePassword();
    registerUserCredential({
      email: viewingMemberCreds.member.email,
      password: newPass,
      name: `${viewingMemberCreds.member.name} (${viewingMemberCreds.member.role})`,
      role: viewingMemberCreds.member.role,
      pharmacyId: activePharmacy.id,
      pharmacyName: activePharmacy.name
    });
    setViewingMemberCreds({
      ...viewingMemberCreds,
      currentPassword: newPass
    });
    setSuccessMsg(`Password for ${viewingMemberCreds.member.name} reset to ${newPass}.`);
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

      const finalOwnerEmail = (newEmail.trim() || `${newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '')}.owner@pharmacy.in`).toLowerCase();
      const finalOwnerPassword = newOwnerPassword.trim() || generateSecurePassword();

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
        email: finalOwnerEmail,
        expiryThresholdDays: 60,
        lowStockThresholdDefault: 15,
        ownerName: newOwnerName.trim() || 'New Store Owner',
        ownerPhone: newPhone.trim(),
        ownerEmail: finalOwnerEmail,
        ownerPassword: finalOwnerPassword
      });

      setProvisionedBranchCreds({
        storeName: newStoreName.trim(),
        dl: newDl.trim().toUpperCase(),
        city: newCity.trim(),
        ownerName: newOwnerName.trim() || 'New Store Owner',
        loginId: finalOwnerEmail,
        password: finalOwnerPassword
      });

      setIsNewStoreOpen(false);
      setNewStoreName('');
      setNewLegalName('');
      setNewDl('');
      setNewGstin('');
      setNewAddress('');
      setNewPincode('');
      setNewPhone('');
      setNewEmail('');
      setNewOwnerName('');
      setNewOwnerPassword(generateSecurePassword());
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

      {/* Active Tenant Card - Tenant Switcher is restricted strictly to Super Admin */}
      <div className="tenant-selector-card">
        <div className="tenant-selector-header">
          <div className="tenant-current-badge">
            <Store size={18} className="text-primary-green" />
            <div>
              <span className="tenant-label">{isSuperAdmin ? 'SUPER ADMIN INSPECTION TARGET:' : 'REGISTERED PHARMACY PROFILE:'}</span>
              <div className="tenant-name-row">
                <span className="tenant-active-name">{activePharmacy.name}</span>
                <span className="tenant-status-pill">ACTIVE • FORM 20/21</span>
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="tenant-switcher-actions">
              <span className="text-xs text-muted">Super Admin Switch Store:</span>
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
          )}
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

            {/* Statutory Drug License & Regulatory Expiry Watchdog */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                  <ShieldCheck size={16} className="text-primary-green" />
                  <span>Statutory Drug Licenses & Inspection Watchdog</span>
                </div>
                <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Rule 65 Compliance: 100%
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#ffffff', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Form 20B (Allopathic Retail)</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    {drugLicenseNumber || 'WB-KOL-20B-184920'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>● Active</span>
                    <span style={{ color: '#64748b' }}>Valid till 31 Mar 2027</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Form 21B (Schedules C & C1)</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                    {drugLicenseNumber ? drugLicenseNumber.replace('20B', '21B') : 'WB-KOL-21B-184921'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>● Active</span>
                    <span style={{ color: '#64748b' }}>Valid till 31 Mar 2027</span>
                  </div>
                </div>

                <div style={{ background: '#fffbeb', padding: '10px 12px', border: '1px solid #fde68a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#92400e' }}>FSSAI Nutraceuticals & Foods</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#78350f' }}>
                    12821013000492
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                    <span style={{ color: '#d97706', fontWeight: 700 }}>⚠️ Renewal Window</span>
                    <span style={{ color: '#92400e' }}>Due 15 Dec 2026 (38d)</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Registered Pharmacist In-Charge</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Priya Das, B.Pharm
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>Reg: WB-RPC-84920</span>
                    <span style={{ color: '#64748b' }}>Sec 42 Compliant</span>
                  </div>
                </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-icon-subtle"
                          onClick={() => handleViewMemberCredentials(m)}
                          title="View / Reset Login Credentials"
                          aria-label={`View credentials for ${m.name}`}
                          style={{ 
                            background: '#F0FDF4', 
                            border: '1px solid #BBF7D0', 
                            borderRadius: 'var(--radius-sm)', 
                            padding: '5px 7px', 
                            cursor: 'pointer', 
                            color: 'var(--primary-green)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-delete-member"
                          onClick={() => handleRemoveMemberClick(m.id, m.name)}
                          title="Remove member"
                          aria-label={`Remove ${m.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
          <div className="modal-container modal-patient-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} className="text-primary-green" />
                <div>
                  <h3 className="modal-title">Add Staff Member & Generate ID</h3>
                  <p className="modal-subtitle">Provision login credentials and RBAC access permissions</p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setIsAddStaffOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="modal-body modal-form">
              <div className="settings-grid-2">
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
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Login Email ID *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder={staffName ? `${staffName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${activePharmacy.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.in` : "sourav@pharmacy.in"}
                  />
                  <span className="text-xs text-muted">Used as the employee's username to sign into Medi5.</span>
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
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Initial Login Password *</label>
                  <button
                    type="button"
                    onClick={() => setStaffPassword(generateSecurePassword())}
                    className="btn-text-action text-xs"
                    style={{ background: 'none', border: 'none', color: 'var(--primary-green)', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Regenerate Password
                  </button>
                </div>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    className="form-input font-mono font-bold"
                    style={{ paddingRight: '40px' }}
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="e.g. Medi5@8492"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-xs text-muted" style={{ marginTop: '3px', display: 'block' }}>
                  The employee can use this password to sign into Medi5 ERP immediately.
                </span>
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
                  <span>Add Member & Provision ID</span>
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

            <form onSubmit={handleCreateStoreSubmit} className="modal-body modal-form">
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

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Owner Login Email / ID *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={newStoreName ? `${newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '')}.owner@pharmacy.in` : "owner@pharmacy.in"}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Owner Password *</label>
                    <button
                      type="button"
                      onClick={() => setNewOwnerPassword(generateSecurePassword())}
                      className="btn-text-action text-xs"
                      style={{ background: 'none', border: 'none', color: 'var(--primary-green)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Regenerate
                    </button>
                  </div>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <input
                      type={showNewOwnerPassword ? 'text' : 'password'}
                      className="form-input font-mono font-bold"
                      style={{ paddingRight: '40px' }}
                      value={newOwnerPassword}
                      onChange={(e) => setNewOwnerPassword(e.target.value)}
                      placeholder="e.g. Medi5@8492"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewOwnerPassword(!showNewOwnerPassword)}
                      aria-label={showNewOwnerPassword ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showNewOwnerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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

      {/* MODAL: STAFF ONBOARDING CREDENTIALS PROVISIONED */}
      {provisionedStaffCreds && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container modal-patient-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="icon-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Staff Member Onboarded</h3>
                  <p className="modal-subtitle">Login credentials successfully created for employee</p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setProvisionedStaffCreds(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body modal-form">
              <div className="provision-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <Users size={24} style={{ color: '#16A34A', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532D' }}>
                    {provisionedStaffCreds.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#15803D' }}>
                    Role: <span className="font-bold">{provisionedStaffCreds.role}</span> • Pharmacy: {provisionedStaffCreds.pharmacyName}
                  </div>
                </div>
              </div>

              <div className="creds-handoff-card" style={{ background: '#FAFDFB', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <KeyRound size={16} className="text-primary-green" />
                  <span style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>Employee Sign-In Credentials</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Login ID / Employee Email</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{provisionedStaffCreds.email}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionedStaffCreds.email);
                        setCopiedStaffLogin(true);
                        setTimeout(() => setCopiedStaffLogin(false), 2000);
                      }}
                      title="Copy Login ID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedStaffLogin ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Initial Password</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-green-dark)' }}>{provisionedStaffCreds.password}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionedStaffCreds.password);
                        setCopiedStaffPass(true);
                        setTimeout(() => setCopiedStaffPass(false), 2000);
                      }}
                      title="Copy Password"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedStaffPass ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Access Level</span>
                  <span className={`role-badge role-${provisionedStaffCreds.role.toLowerCase()}`}>{provisionedStaffCreds.role}</span>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const text = `Medi5 ERP Staff Access Credentials\nEmployee: ${provisionedStaffCreds.name}\nPharmacy: ${provisionedStaffCreds.pharmacyName}\nRole: ${provisionedStaffCreds.role}\nLogin ID: ${provisionedStaffCreds.email}\nPassword: ${provisionedStaffCreds.password}\nPortal: Sign in at Medi5 ERP Login Screen`;
                    navigator.clipboard.writeText(text);
                    setCopiedStaffText(true);
                    setTimeout(() => setCopiedStaffText(false), 2500);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Copy size={14} />
                  <span>{copiedStaffText ? 'Copied Full Details!' : 'Copy WhatsApp / SMS Invite'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => setProvisionedStaffCreds(null)}
                >
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW / RESET STAFF CREDENTIALS */}
      {viewingMemberCreds && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container modal-patient-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="icon-badge" style={{ backgroundColor: 'rgba(19, 99, 75, 0.1)', color: 'var(--primary-green)' }}>
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Staff Sign-In Credentials</h3>
                  <p className="modal-subtitle">Manage access for {viewingMemberCreds.member.name}</p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setViewingMemberCreds(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body modal-form">
              <div className="creds-handoff-card" style={{ background: '#FAFDFB', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Employee Name</span>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{viewingMemberCreds.member.name}</div>
                  </div>
                  <span className={`role-badge role-${viewingMemberCreds.member.role.toLowerCase()}`}>
                    {viewingMemberCreds.member.role}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Login ID / Registered Email</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{viewingMemberCreds.member.email}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingMemberCreds.member.email);
                        setCopiedViewText(true);
                        setTimeout(() => setCopiedViewText(false), 2000);
                      }}
                      title="Copy Login ID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedViewText ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Password</span>
                    <button
                      type="button"
                      onClick={handleResetMemberPassword}
                      className="btn-text-action text-xs"
                      style={{ background: 'none', border: 'none', color: '#B45309', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={12} />
                      <span>Reset Password</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-green-dark)' }}>{viewingMemberCreds.currentPassword}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingMemberCreds.currentPassword);
                        setCopiedViewPass(true);
                        setTimeout(() => setCopiedViewPass(false), 2000);
                      }}
                      title="Copy Password"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedViewPass ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                  Registered Phone: <span className="font-mono font-bold text-main">{viewingMemberCreds.member.phone}</span>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const text = `Medi5 ERP Credentials for ${viewingMemberCreds.member.name}\nRole: ${viewingMemberCreds.member.role}\nLogin ID: ${viewingMemberCreds.member.email}\nPassword: ${viewingMemberCreds.currentPassword}\nStore: ${activePharmacy.name}`;
                    navigator.clipboard.writeText(text);
                    setCopiedViewText(true);
                    setTimeout(() => setCopiedViewText(false), 2000);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Copy size={14} />
                  <span>{copiedViewText ? 'Copied Details!' : 'Copy Credentials'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => setViewingMemberCreds(null)}
                >
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BRANCH CREDENTIALS PROVISIONED */}
      {provisionedBranchCreds && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container modal-patient-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="icon-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="modal-title">New Branch Registered & Owner Provisioned</h3>
                  <p className="modal-subtitle">Ready for store owner handoff and immediate login</p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setProvisionedBranchCreds(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body modal-form">
              <div className="provision-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <Store size={24} style={{ color: '#16A34A', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532D' }}>
                    {provisionedBranchCreds.storeName} ({provisionedBranchCreds.city})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#15803D' }}>
                    DL: {provisionedBranchCreds.dl} • Owner: {provisionedBranchCreds.ownerName}
                  </div>
                </div>
              </div>

              <div className="creds-handoff-card" style={{ background: '#FAFDFB', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <KeyRound size={16} className="text-primary-green" />
                  <span style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>Owner Login Credentials</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Login ID / Registered Email</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{provisionedBranchCreds.loginId}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionedBranchCreds.loginId);
                      }}
                      title="Copy Login ID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      <Copy size={14} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Initial Password</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-green-dark)' }}>{provisionedBranchCreds.password}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionedBranchCreds.password);
                      }}
                      title="Copy Password"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      <Copy size={14} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const text = `Medi5 ERP — Store Owner Access Credentials\nStore: ${provisionedBranchCreds.storeName} (${provisionedBranchCreds.city})\nOwner: ${provisionedBranchCreds.ownerName}\nLogin ID: ${provisionedBranchCreds.loginId}\nInitial Password: ${provisionedBranchCreds.password}\nRole: OWNER\nPortal: Sign in at Medi5 ERP Login Screen`;
                    navigator.clipboard.writeText(text);
                    setCopiedBranchText(true);
                    setTimeout(() => setCopiedBranchText(false), 2500);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Copy size={14} />
                  <span>{copiedBranchText ? 'Copied Full Details!' : 'Copy Handoff Details'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => setProvisionedBranchCreds(null)}
                >
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
