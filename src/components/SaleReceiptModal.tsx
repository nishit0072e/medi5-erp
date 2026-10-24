import React from 'react';
import { X, Printer, CheckCircle2, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { SaleRecord } from '../types/inventory';
import { formatDisplayDate } from '../utils/dateUtils';

interface SaleReceiptModalProps {
  sale: SaleRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onNewSale?: () => void;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  sale,
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div className="modal-content receipt-modal-card">
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
            <h3 className="store-name">Nandan Pharmacy</h3>
            <p className="store-sub">Retail Chemist & Druggist</p>
            <p className="store-address">Kolkata, West Bengal • Ph: +91 98300 00000</p>
            <div className="receipt-badge-pill">WALK-IN COUNTER SALE MEMO</div>
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

          {/* Statutory and Regulatory Non-Compliance Notice */}
          <div className="receipt-footer-notes">
            <p className="disclaimer-text">
              * Local In-Memory Demo Dispensing Memo.
            </p>
            <p className="disclaimer-text">
              This slip is an internal counter prototype demonstration and does NOT constitute a compliant GST Tax Invoice under Indian GST Law. Rounding, CGST/SGST breakdowns, and formal pharmacy drug license disclaimers are deferred.
            </p>
            <p className="footer-greeting">Thank You • Get Well Soon!</p>
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
