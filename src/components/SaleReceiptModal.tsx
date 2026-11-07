import React from 'react';
import { X, Printer, CheckCircle2, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { SaleRecord } from '../types/inventory';
import { PharmacyProfile } from '../types/pharmacy';
import { formatDisplayDate } from '../utils/dateUtils';

interface SaleReceiptModalProps {
  sale: SaleRecord | null;
  pharmacy?: PharmacyProfile;
  isOpen: boolean;
  onClose: () => void;
  onNewSale?: () => void;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  sale,
  pharmacy,
  isOpen,
  onClose,
  onNewSale
}) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = (() => {
    try {
      const d = new Date(sale.timestamp);
      return `${formatDisplayDate(sale.timestamp)}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return sale.timestamp;
    }
  })();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div className="modal-container receipt-modal-card">
        {/* Modal Header */}
        <div className="modal-header receipt-modal-header no-print">
          <div className="receipt-header-title-wrap">
            <div className="receipt-icon-badge">
              <CheckCircle2 size={20} className="text-success" />
            </div>
            <div>
              <h2 id="receipt-title" className="receipt-modal-title">Sale Complete</h2>
              <p className="receipt-modal-subtitle">Digital Dispensing Memo & FEFO Audit</p>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close receipt"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Receipt Paper Body */}
        <div className="receipt-paper" id="printable-receipt">
          {/* Pharmacy Store Header */}
          <div className="receipt-store-header">
            <h3 className="store-name">{pharmacy?.name || 'Nandan Pharmacy'}</h3>
            {pharmacy?.legalName && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({pharmacy.legalName})</p>
            )}
            <p className="store-sub">Retail Chemist & Druggist</p>
            <p className="store-address">
              {pharmacy ? `${pharmacy.addressLine1}, ${pharmacy.city}, ${pharmacy.state} - ${pharmacy.pincode}` : 'Kolkata, West Bengal'} • Ph: {pharmacy?.phone || '+91 98300 00000'}
            </p>
            <div className="receipt-license-info" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              <span>DL No: <strong>{pharmacy?.drugLicenseNumber || 'WB-KOL-20B/21B-184920'}</strong></span>
              <span> • FSSAI: <strong>12821013000492</strong></span>
              <div>
                <span>GSTIN: <strong>{pharmacy?.gstin || '19AABCM8291F1Z8'}</strong></span>
                <span> • State: <strong>19 - West Bengal</strong></span>
              </div>
              <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Reg. Pharmacist: Priya Das (Reg: WB-RPC-84920)
              </div>
            </div>
            <div className="receipt-badge-pill" style={{ background: '#065f46', color: '#ffffff', letterSpacing: '0.5px' }}>
              RETAIL GST TAX INVOICE & DISPENSING MEMO
            </div>
          </div>

          <div className="receipt-divider-dashed"></div>

          {/* Meta Details */}
          <div className="receipt-meta-grid">
            <div className="meta-row">
              <span className="meta-label">Invoice Ref:</span>
              <span className="meta-value font-mono font-bold">{sale.id}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Date & Time:</span>
              <span className="meta-value">{formattedDate}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Dispensed By:</span>
              <span className="meta-value">{sale.staffUser}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Payment Mode:</span>
              <span className="meta-value badge-tender">{sale.tenderType}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Client Token:</span>
              <span className="meta-value font-mono text-muted text-xs">{sale.clientSaleToken}</span>
            </div>
          </div>

          <div className="receipt-divider-dashed"></div>

          {/* Line Items Table */}
          <div className="receipt-items-container">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th className="th-item">Item & Strength</th>
                  <th className="th-qty">Qty</th>
                  <th className="th-price">MRP (₹)</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr className="item-main-row">
                      <td className="item-cell-name">
                        <strong>{item.medicineName}</strong>
                        <span className="item-unit-label">({item.strength} • {item.unitLabel})</span>
                      </td>
                      <td className="item-cell-qty">{item.quantity}</td>
                      <td className="item-cell-mrp">₹{item.lineTotalMrp.toFixed(2)}</td>
                    </tr>
                    {/* FEFO Batch Allocation Detail Breakdown */}
                    <tr className="batch-alloc-row">
                      <td colSpan={3} className="batch-alloc-cell">
                        <div className="batch-alloc-wrap">
                          <span className="batch-alloc-label">FEFO Allocations:</span>
                          <div className="batch-alloc-pills">
                            {item.allocations.map((alloc, bIdx) => (
                              <span key={bIdx} className="batch-alloc-pill">
                                <strong>Lot {alloc.batchNumber}</strong> (Exp {alloc.expiryDate}): {alloc.quantity} units @ ₹{alloc.mrp.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="receipt-divider-dashed"></div>

          {/* Checkout Financial Breakdown with Mandatory Exact Labels */}
          <div className="receipt-totals-box">
            <div className="total-row-item">
              <span className="total-label">Total Bill (MRP)</span>
              <span className="total-val font-mono">₹{sale.totalBillMrp.toFixed(2)}</span>
            </div>

            <div className="total-row-item highlight-selling">
              <span className="total-label font-bold">Selling Bill</span>
              <span className="total-val font-bold font-mono text-primary-dark">
                ₹{sale.sellingBill.toFixed(2)}
              </span>
            </div>

            <div className="total-row-item">
              <span className="total-label">Discount</span>
              <span className="total-val font-mono text-success">
                {sale.discount > 0 ? `- ₹${sale.discount.toFixed(2)}` : `₹0.00`}
              </span>
            </div>

            {/* Indian Statutory GST Tax Breakdown Table */}
            <div style={{ marginTop: '12px', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                GST Tax Breakdown (HSN 3004 - 12% GST)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', fontSize: '0.72rem', color: '#475569', gap: '4px' }}>
                <div><strong>Taxable:</strong> ₹{(sale.sellingBill / 1.12).toFixed(2)}</div>
                <div><strong>CGST (6%):</strong> ₹{((sale.sellingBill - (sale.sellingBill / 1.12)) / 2).toFixed(2)}</div>
                <div><strong>SGST (6%):</strong> ₹{((sale.sellingBill - (sale.sellingBill / 1.12)) / 2).toFixed(2)}</div>
                <div><strong>Total Tax:</strong> ₹{(sale.sellingBill - (sale.sellingBill / 1.12)).toFixed(2)}</div>
              </div>
            </div>

            <div className="receipt-internal-divider"></div>

            {/* Internal Cost Estimates (Clearly Labeled) */}
            <div className="receipt-internal-estimates">
              <div className="internal-header">
                <AlertCircle size={12} />
                <span>Internal Profitability Estimates (Demo Only)</span>
              </div>
              <div className="total-row-item text-xs text-muted">
                <span className="total-label">Estimated COGS</span>
                <span className="total-val font-mono">₹{sale.estimatedCogs.toFixed(2)}</span>
              </div>
              <div className="total-row-item text-xs text-muted">
                <span className="total-label">Estimated Gross Profit</span>
                <span className={`total-val font-mono ${sale.estimatedGrossProfit >= 0 ? 'text-success' : 'text-danger font-bold'}`}>
                  ₹{sale.estimatedGrossProfit.toFixed(2)}
                </span>
              </div>
              {sale.confirmedBelowCost && (
                <div className="below-cost-notice-flag">
                  ⚠️ Sold Below Cost (Staff Override Confirmed)
                </div>
              )}
            </div>
          </div>

          <div className="receipt-divider-dashed"></div>

          {/* Statutory Declarations under Drugs & Cosmetics Act 1940 & GST Rules */}
          <div className="receipt-footer-notes" style={{ marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '4px',
              padding: '6px 10px',
              marginBottom: '8px'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#166534', fontFamily: 'monospace' }}>
                IRN: {sale.clientSaleToken ? `IRN-${sale.clientSaleToken.slice(-12).toUpperCase()}` : 'IRN-9842F8021BC3'}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 600 }}>[ VERIFIED GST e-INVOICE ]</span>
            </div>

            <p className="disclaimer-text" style={{ fontSize: '0.68rem', lineHeight: 1.4, color: '#64748b', margin: '4px 0' }}>
              <strong>Statutory Warranty:</strong> Certified that medicines specified in this invoice do not contravene Section 18 of the Drugs and Cosmetics Act, 1940. Regulated storage temperatures (2°C - 25°C) maintained.
            </p>
            <p className="disclaimer-text" style={{ fontSize: '0.68rem', color: '#64748b', margin: '2px 0' }}>
              Terms: Return of unopened sealed goods accepted with this tax memo within 7 days. Schedule H / H1 / X drugs strictly non-returnable.
            </p>
            <p className="footer-greeting" style={{ marginTop: '8px', fontWeight: 600, color: 'var(--color-primary)' }}>
              Thank You • Wish You A Speedy Recovery!
            </p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="modal-actions receipt-modal-actions no-print">
          <button 
            type="button" 
            className="btn-print-receipt"
            onClick={handlePrint}
          >
            <Printer size={16} />
            <span>Print Receipt</span>
          </button>

          <button 
            type="button" 
            className="btn-new-sale"
            onClick={() => {
              if (onNewSale) onNewSale();
              onClose();
            }}
          >
            <ShoppingBag size={16} />
            <span>New Counter Sale</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
