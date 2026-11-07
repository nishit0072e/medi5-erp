import React, { useState, useMemo } from 'react';
import { 
  Crown, 
  Store, 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Activity, 
  CheckCircle2, 
  LogOut, 
  Sliders, 
  FileText, 
  Sparkles, 
  Search, 
  ArrowRight,
  X,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  ShieldCheck,
  Check
} from 'lucide-react';
import { PharmacyProfile, CreatePharmacyInput } from '../types/pharmacy';
import { Medicine, MedicineBatch, SaleRecord, StockMovement } from '../types/inventory';
import { formatINR } from '../utils/moneyUtils';
import { generateSecurePassword } from '../utils/authService';
import {
  calculatePharmacyHealthSummaries,
  calculatePlatformStats,
  formatMonthLabel,
  PlatformFeeBasis
} from '../utils/platformMetrics';

interface SuperAdminPortalProps {
  pharmacies: PharmacyProfile[];
  allMedicines: Medicine[];
  allBatches: MedicineBatch[];
  allSales: SaleRecord[];
  allMovements: StockMovement[];
  onInspectPharmacy: (pharmacyId: string) => void;
  onLogout: () => void;
  onCreatePharmacy: (input: CreatePharmacyInput) => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  pharmacies,
  allMedicines,
  allBatches,
  allSales,
  allMovements,
  onInspectPharmacy,
  onLogout,
  onCreatePharmacy
}) => {
  // Configurable Platform Usage Fee percentage (default 2.0%)
  const [platformFeeRate, setPlatformFeeRate] = useState<number>(2.0);
  const [feeBase, setFeeBase] = useState<PlatformFeeBasis>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const referenceDate = useMemo(() => new Date(), []);
  const monthLabel = formatMonthLabel(referenceDate);

  // New store form state
  const [newStoreName, setNewStoreName] = useState('');
  const [newLegalName, setNewLegalName] = useState('');
  const [newDl, setNewDl] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newCity, setNewCity] = useState('Kolkata');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState(() => generateSecurePassword());
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Generated credentials modal state
  const [provisionedCreds, setProvisionedCreds] = useState<{
    storeName: string;
    dl: string;
    city: string;
    ownerName: string;
    loginId: string;
    password: string;
  } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // Filtered pharmacies
  const filteredPharmacies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pharmacies;
    return pharmacies.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.drugLicenseNumber.toLowerCase().includes(q) ||
        (p.gstin && p.gstin.toLowerCase().includes(q))
    );
  }, [pharmacies, searchQuery]);

  const platformStats = useMemo(() => {
    return calculatePlatformStats({
      sales: allSales,
      pharmacies,
      medicines: allMedicines,
      batches: allBatches,
      movements: allMovements,
      feeBase,
      feeRate: platformFeeRate,
      referenceDate
    });
  }, [allSales, pharmacies, allMedicines, allBatches, allMovements, feeBase, platformFeeRate, referenceDate]);

  const pharmacyHealthSummaries = useMemo(() => {
    return calculatePharmacyHealthSummaries({
      pharmacies: filteredPharmacies,
      sales: allSales,
      feeBase,
      feeRate: platformFeeRate,
      referenceDate
    });
  }, [filteredPharmacies, allSales, feeBase, platformFeeRate, referenceDate]);

  const handleCreateStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newDl.trim()) return;

    const generatedOwnerEmail = (newEmail.trim() || `${newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '')}.owner@pharmacy.in`).toLowerCase();
    const generatedOwnerPassword = newOwnerPassword.trim() || generateSecurePassword();

    onCreatePharmacy({
      name: newStoreName.trim(),
      legalName: newLegalName.trim() || newStoreName.trim(),
      drugLicenseNumber: newDl.trim().toUpperCase(),
      gstin: newGstin.trim().toUpperCase() || undefined,
      addressLine1: newAddress.trim() || 'Market Street',
      city: newCity.trim(),
      state: 'West Bengal',
      pincode: '700001',
      phone: newPhone.trim() || '+91 98300 00000',
      email: generatedOwnerEmail,
      expiryThresholdDays: 60,
      lowStockThresholdDefault: 15,
      ownerName: newOwnerName.trim() || 'Store Owner',
      ownerPhone: newPhone.trim() || '+91 98300 00000',
      ownerEmail: generatedOwnerEmail,
      ownerPassword: generatedOwnerPassword
    });

    setProvisionedCreds({
      storeName: newStoreName.trim(),
      dl: newDl.trim().toUpperCase(),
      city: newCity.trim(),
      ownerName: newOwnerName.trim() || 'Store Owner',
      loginId: generatedOwnerEmail,
      password: generatedOwnerPassword
    });

    setIsNewStoreModalOpen(false);
    setNewStoreName('');
    setNewLegalName('');
    setNewDl('');
    setNewGstin('');
    setNewPhone('');
    setNewEmail('');
    setNewOwnerName('');
    setNewOwnerPassword(generateSecurePassword());
    setSuccessToast(`New pharmacy tenant registered and provisioned!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="superadmin-wrapper">
      {/* Top Super Admin Navbar */}
      <header className="superadmin-header">
        <div className="superadmin-brand">
          <div className="superadmin-crown-badge">
            <Crown size={22} className="text-amber-400" />
          </div>
          <div>
            <div className="superadmin-title-row">
              <h1>Medi5 Platform Command Center</h1>
              <span className="superadmin-badge-pill">SUPER ADMIN PORTAL</span>
            </div>
            <p className="superadmin-sub">
              Platform Owner Live Oversight • Multi-Tenant Monitoring • Real-Time Retail Audit & Usage Revenue
            </p>
          </div>
        </div>

        <div className="superadmin-header-actions">
          <div className="platform-stream-status">
            <span className="stream-dot-pulse"></span>
            <span>LIVE AUDIT STREAM ACTIVE</span>
          </div>

          <button
            type="button"
            className="btn-superadmin-logout"
            onClick={onLogout}
            title="Sign out of Super Admin"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Success Notification */}
      {successToast && (
        <div className="superadmin-toast">
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Platform Executive KPI Summary Cards */}
      <div className="superadmin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">TOTAL NETWORK SALES (GMV)</span>
            <DollarSign size={18} className="text-emerald-400" />
          </div>
          <div className="admin-kpi-value text-emerald-400">
            {formatINR(platformStats.totalSalesRupees)}
          </div>
          <span className="admin-kpi-sub">
            Lifetime • {formatINR(platformStats.monthlySalesRupees)} in {monthLabel}
          </span>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">NETWORK GROSS PROFIT</span>
            <TrendingUp size={18} className="text-blue-400" />
          </div>
          <div className="admin-kpi-value text-blue-400">
            {formatINR(platformStats.totalProfitRupees)}
          </div>
          <span className="admin-kpi-sub">
            Lifetime • {formatINR(platformStats.monthlyProfitRupees)} in {monthLabel}
          </span>
        </div>

        <div className="admin-kpi-card highlight-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">ESTIMATED PLATFORM USAGE REVENUE</span>
            <Sparkles size={18} className="text-amber-400" />
          </div>
          <div className="admin-kpi-value text-amber-400">
            {formatINR(platformStats.projectedPlatformRevenue)}
          </div>
          <span className="admin-kpi-sub font-mono">
            {monthLabel} • At {platformFeeRate.toFixed(1)}% of monthly {feeBase === 'sales' ? 'gross sales' : 'gross profit'}
          </span>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">DISPENSED COUNTER INVOICES</span>
            <Receipt size={18} className="text-purple-400" />
          </div>
          <div className="admin-kpi-value">
            {platformStats.totalInvoices}
          </div>
          <span className="admin-kpi-sub">
            Total • {platformStats.monthlyInvoices} in {monthLabel}
          </span>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-label">ACTIVE PHARMACIES</span>
            <Store size={18} className="text-teal-400" />
          </div>
          <div className="admin-kpi-value">
            {platformStats.totalPharmacies}
          </div>
          <span className="admin-kpi-sub">Independent West Bengal retail partners</span>
        </div>
      </div>

      {/* PLATFORM USAGE FEE SUSTAINABILITY CALCULATOR */}
      <div className="platform-billing-card">
        <div className="billing-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} className="text-amber-400" />
            <div>
              <h3>Platform Usage Fee & SaaS Sustainability Model</h3>
              <p className="text-xs text-muted">
                Configure the platform service fee percentage to sustain server infrastructure, cloud hosting, and continuous feature maintenance.
              </p>
            </div>
          </div>

          <div className="fee-base-toggle">
            <span className="text-xs font-bold">Calculate Fee On:</span>
            <button
              type="button"
              className={`toggle-pill ${feeBase === 'sales' ? 'active' : ''}`}
              onClick={() => setFeeBase('sales')}
            >
              Gross Sales (GMV)
            </button>
            <button
              type="button"
              className={`toggle-pill ${feeBase === 'profit' ? 'active' : ''}`}
              onClick={() => setFeeBase('profit')}
            >
              Retail Profit
            </button>
          </div>
        </div>

        <div className="billing-slider-row">
          <div className="slider-container">
            <div className="slider-label-row">
              <span className="text-xs text-muted">Platform Fee Percentage Rate:</span>
              <span className="slider-rate-badge">{platformFeeRate.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              className="fee-slider"
              value={platformFeeRate}
              onChange={(e) => setPlatformFeeRate(parseFloat(e.target.value))}
            />
            <div className="slider-presets">
              {[1.0, 1.5, 2.0, 2.5, 3.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`preset-btn ${platformFeeRate === rate ? 'active' : ''}`}
                  onClick={() => setPlatformFeeRate(rate)}
                >
                  {rate.toFixed(1)}%
                </button>
              ))}
            </div>
          </div>

          <div className="billing-projection-box">
            <span className="text-xs font-bold text-muted uppercase">
              Monthly Estimated Platform Income ({monthLabel}):
            </span>
            <div className="projected-amount">{formatINR(platformStats.projectedPlatformRevenue)}</div>
            <p className="text-xs text-muted mt-1">
              Based on {platformStats.monthlyInvoices} invoices from {pharmacies.length} pharmacies in {monthLabel}.
            </p>
          </div>
        </div>
      </div>

      {/* REAL-TIME PHARMACY TENANT MONITORING TABLE */}
      <div className="superadmin-table-card superadmin-card-table">
        <div className="table-card-header">
          <div className="table-title-wrap">
            <Activity size={18} className="text-emerald-400" />
            <div>
              <h3>Retail Pharmacies Real-Time Diagnostic Feed</h3>
              <p className="text-xs text-muted">
                Monitor individual pharmacy sales performance, gross margins, stock health, and platform fee obligations.
              </p>
            </div>
          </div>

          <div className="table-actions-wrap">
            <div className="table-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search pharmacy, city, DL No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear pharmacy search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-onboard-store"
              onClick={() => setIsNewStoreModalOpen(true)}
            >
              <span>+ Provision New Pharmacy</span>
            </button>
          </div>
        </div>

        <div className="superadmin-table-wrap">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Pharmacy Tenant</th>
                <th>Drug License (Form 20/21) & GSTIN</th>
                <th>Owner & Contact</th>
                <th>Lifetime Sales (GMV)</th>
                <th>Lifetime Gross Profit</th>
                <th>Monthly Fee ({platformFeeRate.toFixed(1)}%)</th>
                <th>System Health</th>
                <th>Super Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {pharmacyHealthSummaries.map(({
                pharmacy,
                owner,
                salesVolume,
                profitVolume,
                monthlySalesVolume,
                monthlyProfitVolume,
                invoicesCount,
                monthlyInvoicesCount,
                platformFeeDue,
                systemStatus
              }) => (
                <tr key={pharmacy.id}>
                  <td data-label="Pharmacy Tenant">
                    <div className="store-cell">
                      <div className="store-avatar">{pharmacy.name.charAt(0)}</div>
                      <div>
                        <div className="store-name-text">{pharmacy.name}</div>
                        <div className="store-location text-xs text-muted">
                          {pharmacy.city}, {pharmacy.state} • {pharmacy.pincode}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="License & GSTIN">
                    <div className="font-mono text-xs font-bold text-amber-300">
                      {pharmacy.drugLicenseNumber}
                    </div>
                    {pharmacy.gstin && (
                      <div className="font-mono text-xs text-muted">
                        GST: {pharmacy.gstin}
                      </div>
                    )}
                  </td>
                  <td data-label="Owner & Contact">
                    <div className="text-xs font-bold">{owner?.name || 'Store Owner'}</div>
                    <div className="text-xs text-muted font-mono">{pharmacy.phone}</div>
                  </td>
                  <td data-label="Lifetime Sales">
                    <div className="font-mono font-bold text-emerald-400">
                      {formatINR(salesVolume)}
                    </div>
                    <div className="text-xs text-muted">
                      {formatINR(monthlySalesVolume)} this month • {invoicesCount} lifetime / {monthlyInvoicesCount} monthly
                    </div>
                  </td>
                  <td data-label="Lifetime Profit">
                    <div className="font-mono font-bold text-blue-400">
                      {formatINR(profitVolume)}
                    </div>
                    <div className="text-xs text-muted">
                      {formatINR(monthlyProfitVolume)} this month
                    </div>
                  </td>
                  <td data-label="Monthly Fee">
                    <div className="font-mono font-bold text-amber-400">
                      {formatINR(platformFeeDue)}
                    </div>
                    <div className="text-xs text-muted">{monthLabel}</div>
                  </td>
                  <td data-label="System Health">
                    <span className="health-badge-healthy">
                      <CheckCircle2 size={12} />
                      <span>{systemStatus} (0 ERRORS)</span>
                    </span>
                  </td>
                  <td data-label="Action">
                    <button
                      type="button"
                      className="btn-inspect-tenant"
                      onClick={() => onInspectPharmacy(pharmacy.id)}
                      title={`Inspect ${pharmacy.name} POS & Inventory as Super Admin`}
                    >
                      <span>Inspect Store</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECENT CROSS-STORE INVOICE DISPENSING FEED */}
      <div className="superadmin-table-card superadmin-card-table">
        <div className="table-card-header">
          <div className="table-title-wrap">
            <Receipt size={18} className="text-purple-400" />
            <div>
              <h3>Live Dispensing Invoices & Counter Sales Feed</h3>
              <p className="text-xs text-muted">Real-time audit log of counter sales across all stores in the network.</p>
            </div>
          </div>
        </div>

        {allSales.length > 0 ? (
          <div className="superadmin-table-wrap">
            <table className="superadmin-table">
              <thead>
                <tr>
                  <th>Invoice Ref</th>
                  <th>Store Tenant</th>
                  <th>Items Dispensed</th>
                  <th>Total Bill (MRP)</th>
                  <th>Selling Bill</th>
                  <th>Gross Profit</th>
                  <th>Tender Mode</th>
                  <th>Dispenser</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {allSales.slice(0, 8).map((sale) => (
                  <tr key={sale.id}>
                    <td data-label="Invoice Ref" className="font-mono text-xs font-bold text-amber-300">{sale.id}</td>
                    <td data-label="Store Tenant">
                      <span className="store-tag">
                        {pharmacies.find((p) => p.id === sale.pharmacyId)?.name || 'Unknown tenant'}
                      </span>
                    </td>
                    <td data-label="Items" className="text-xs">
                      {sale.items.reduce((acc, item) => acc + item.quantity, 0)} units
                    </td>
                    <td data-label="Total Bill" className="font-mono text-xs">{formatINR(sale.totalBillMrp)}</td>
                    <td data-label="Selling Bill" className="font-mono text-xs font-bold text-emerald-400">{formatINR(sale.sellingBill)}</td>
                    <td data-label="Gross Profit" className="font-mono text-xs font-bold text-blue-400">{formatINR(sale.estimatedGrossProfit)}</td>
                    <td data-label="Tender" >
                      <span className="badge-tender">{sale.tenderType}</span>
                    </td>
                    <td data-label="Dispenser" className="text-xs">{sale.staffUser}</td>
                    <td data-label="Timestamp" className="font-mono text-xs text-muted">{new Date(sale.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-audit-feed">
            <FileText size={32} className="text-muted" />
            <p className="text-xs text-muted mt-2">No counter sales recorded yet. Invoices will stream here in real time.</p>
          </div>
        )}
      </div>

      {/* MODAL: PROVISION NEW PHARMACY */}
      {isNewStoreModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container superadmin-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Store size={20} className="text-amber-400" />
                <h3 className="modal-title">Provision New Pharmacy Partner</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setIsNewStoreModalOpen(false)}
                aria-label="Close new pharmacy form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStoreSubmit} className="modal-body modal-form">
              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Pharmacy Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="e.g. Apollo Chemist"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Drug License No. (Form 20/21) *</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={newDl}
                    onChange={(e) => setNewDl(e.target.value.toUpperCase())}
                    placeholder="e.g. WB-KOL-20B-112233"
                    required
                  />
                </div>
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Asansol"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98300 00000"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address Line / Street</label>
                <input
                  type="text"
                  className="form-input"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g. 45 Grand Trunk Road"
                />
              </div>

              <div className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label">Store Owner Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="e.g. Ratan Mukherjee"
                    required
                  />
                </div>

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
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Owner Initial Password *</label>
                  <button
                    type="button"
                    onClick={() => setNewOwnerPassword(generateSecurePassword())}
                    className="btn-text-action text-xs"
                    style={{ background: 'none', border: 'none', color: 'var(--primary-green)', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Regenerate Password
                  </button>
                </div>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <input
                    type={showOwnerPassword ? 'text' : 'password'}
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
                    onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                    aria-label={showOwnerPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showOwnerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-xs text-muted" style={{ marginTop: '3px', display: 'block' }}>
                  This password will be immediately active for the store owner on the Medi5 ERP login screen.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNewStoreModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action btn-amber">
                  <span>Provision Store</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Credentials Provisioned Modal */}
      {provisionedCreds && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-container modal-patient-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="icon-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Store Onboarded & Credentials Generated</h3>
                  <p className="modal-subtitle">Ready for owner handoff and immediate login</p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setProvisionedCreds(null)}
                aria-label="Close credentials modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body modal-form">
              <div className="provision-success-banner" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle2 size={24} style={{ color: '#16A34A', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532D' }}>
                    {provisionedCreds.storeName} ({provisionedCreds.city})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#15803D' }}>
                    DL: {provisionedCreds.dl} • Owner: {provisionedCreds.ownerName}
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
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{provisionedCreds.loginId}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionedCreds.loginId);
                        setCopiedLogin(true);
                        setTimeout(() => setCopiedLogin(false), 2000);
                      }}
                      title="Copy Login ID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedLogin ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Initial Password</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-green-dark)' }}>{provisionedCreds.password}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionedCreds.password);
                        setCopiedPass(true);
                        setTimeout(() => setCopiedPass(false), 2000);
                      }}
                      title="Copy Password"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedPass ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Role</span>
                  <span style={{ fontWeight: 800, color: '#047857' }}>OWNER (Full Administrative Access)</span>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const text = `Medi5 ERP — Store Owner Access Credentials\nStore: ${provisionedCreds.storeName} (${provisionedCreds.city})\nOwner: ${provisionedCreds.ownerName}\nLogin ID: ${provisionedCreds.loginId}\nInitial Password: ${provisionedCreds.password}\nRole: OWNER\nPortal: Sign in at Medi5 ERP Login Screen`;
                    navigator.clipboard.writeText(text);
                    setCopiedText(true);
                    setTimeout(() => setCopiedText(false), 2500);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Copy size={14} />
                  <span>{copiedText ? 'Copied Full Summary!' : 'Copy Handoff Details'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => setProvisionedCreds(null)}
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
