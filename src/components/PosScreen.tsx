import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  ArrowRight, 
  Pill, 
  Receipt, 
  Info,
  Layers,
  RotateCcw
} from 'lucide-react';
import { 
  Medicine, 
  MedicineBatch, 
  CartLineItem, 
  SaleRecord, 
  ProcessSaleInput 
} from '../types/inventory';
import { calculateCartAllocations, getEligibleFefoBatches } from '../utils/fefoAllocation';
import { toPaise, fromPaise, parseRupees } from '../utils/moneyUtils';
import { formatDisplayDate } from '../utils/dateUtils';

interface PosScreenProps {
  medicines: Medicine[];
  batches: MedicineBatch[];
  sales: SaleRecord[];
  onCheckout: (input: ProcessSaleInput) => Promise<boolean> | boolean;
  onViewReceipt: (sale: SaleRecord) => void;
  staffUser?: string;
}

export const PosScreen: React.FC<PosScreenProps> = ({
  medicines,
  batches,
  sales,
  onCheckout,
  onViewReceipt,
  staffUser = 'Nandan Owner (Demo)'
}) => {
  // Catalog search state
  const [catalogSearch, setCatalogSearch] = useState('');
  
  // Cart state: array of CartLineItem
  const [cart, setCart] = useState<CartLineItem[]>([]);

  // Selling Bill customization state
  const [customSellingBill, setCustomSellingBill] = useState<string | null>(null);
  const [tenderType, setTenderType] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [confirmedBelowCost, setConfirmedBelowCost] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active view inside POS: 'counter' or 'history'
  const [posTab, setPosTab] = useState<'counter' | 'history'>('counter');

  // Stable clientSaleToken for current cart session (idempotency)
  const [clientSaleToken, setClientSaleToken] = useState<string>(() => generateSaleToken());

  function generateSaleToken(): string {
    return `tok-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // Pre-calculate available saleable stock per medicine using pure FEFO eligibility
  const medicineStockMap = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();

    for (const med of medicines) {
      const eligible = getEligibleFefoBatches(med.id, batches, now);
      const total = eligible.reduce((acc, b) => acc + b.quantityRemaining, 0);
      map.set(med.id, total);
    }
    return map;
  }, [medicines, batches]);

  // Filter catalog based on search
  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return medicines;

    return medicines.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.strength.toLowerCase().includes(q) ||
        m.dosageForm.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [catalogSearch, medicines]);

  // Real-time pure FEFO allocation computation for current cart
  const cartEvaluation = useMemo(() => {
    if (cart.length === 0) {
      return {
        lineAllocations: [],
        totalBillMrp: 0,
        estimatedCogs: 0,
        isFullyFulfillable: true,
        unfulfilledLines: []
      };
    }
    try {
      return calculateCartAllocations(cart, medicines, batches);
    } catch (err) {
      return {
        lineAllocations: [],
        totalBillMrp: 0,
        estimatedCogs: 0,
        isFullyFulfillable: false,
        unfulfilledLines: [{ medicineName: 'Calculation Error', missingQty: 1 }]
      };
    }
  }, [cart, medicines, batches]);

  const { lineAllocations, totalBillMrp, estimatedCogs, isFullyFulfillable, unfulfilledLines } = cartEvaluation;

  // Derive active Selling Bill (without silently clamping invalid or negative values)
  const activeSellingBillNumber = useMemo(() => {
    if (customSellingBill !== null) {
      try {
        return parseRupees(customSellingBill);
      } catch {
        return NaN;
      }
    }
    return totalBillMrp;
  }, [customSellingBill, totalBillMrp]);

  // Discount: Total Bill (MRP) - Selling Bill
  const discountAmount = useMemo(() => {
    if (isNaN(activeSellingBillNumber)) return 0;
    const totalPaise = toPaise(totalBillMrp);
    const sellingPaise = toPaise(activeSellingBillNumber);
    return fromPaise(totalPaise - sellingPaise);
  }, [totalBillMrp, activeSellingBillNumber]);

  // Estimated Gross Profit: Selling Bill - COGS
  const estimatedGrossProfit = useMemo(() => {
    if (isNaN(activeSellingBillNumber)) return 0;
    const sellingPaise = toPaise(activeSellingBillNumber);
    const cogsPaise = toPaise(estimatedCogs);
    return fromPaise(sellingPaise - cogsPaise);
  }, [activeSellingBillNumber, estimatedCogs]);

  // Below-cost condition check
  const isBelowCost = useMemo(() => {
    if (cart.length === 0 || isNaN(activeSellingBillNumber)) return false;
    return toPaise(activeSellingBillNumber) < toPaise(estimatedCogs);
  }, [activeSellingBillNumber, estimatedCogs, cart.length]);

  // Reset below-cost confirmation if price changes back to profitable
  useEffect(() => {
    if (!isBelowCost) {
      setConfirmedBelowCost(false);
    }
  }, [isBelowCost]);

  // Add medicine to cart
  const handleAddToCart = (medicine: Medicine) => {
    setErrorMessage(null);
    const available = medicineStockMap.get(medicine.id) || 0;
    if (available <= 0) {
      setErrorMessage(`Cannot add ${medicine.name}: Out of saleable stock.`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.medicineId === medicine.id);
      if (existing) {
        if (existing.quantity >= available) {
          setErrorMessage(`Cannot add more ${medicine.name}: Maximum saleable stock (${available} units) reached.`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.medicineId === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { medicineId: medicine.id, quantity: 1 }];
      }
    });
  };

  // Modify cart item quantity
  const handleUpdateQuantity = (medicineId: string, newQty: number) => {
    setErrorMessage(null);
    const available = medicineStockMap.get(medicineId) || 0;

    if (newQty <= 0) {
      handleRemoveItem(medicineId);
      return;
    }

    if (newQty > available) {
      setErrorMessage(`Requested quantity exceeds available saleable stock (${available} units).`);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.medicineId === medicineId ? { ...item, quantity: newQty } : item
      )
    );
  };

  // Remove item from cart
  const handleRemoveItem = (medicineId: string) => {
    setCart((prev) => prev.filter((item) => item.medicineId !== medicineId));
    setErrorMessage(null);
  };

  // Clear entire cart
  const handleClearCart = () => {
    setCart([]);
    setCustomSellingBill(null);
    setConfirmedBelowCost(false);
    setErrorMessage(null);
    setClientSaleToken(generateSaleToken());
  };

  // Handle Selling Bill input change
  const handleSellingBillChange = (val: string) => {
    setErrorMessage(null);
    setCustomSellingBill(val);
  };

  const handleResetToMrp = () => {
    setCustomSellingBill(null);
    setConfirmedBelowCost(false);
    setErrorMessage(null);
  };

  // Handle final checkout
  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Add medicines from the catalog to proceed.');
      return;
    }

    if (!isFullyFulfillable) {
      const missing = unfulfilledLines.map((l) => `${l.medicineName} (${l.missingQty} short)`).join(', ');
      setErrorMessage(`Checkout rejected: Insufficient stock for ${missing}.`);
      return;
    }

    if (activeSellingBillNumber < 0 || isNaN(activeSellingBillNumber)) {
      setErrorMessage('Selling Bill must be a valid non-negative amount.');
      return;
    }

    if (isBelowCost && !confirmedBelowCost) {
      setErrorMessage('This sale is below estimated COGS. Please check the deliberate confirmation checkbox.');
      return;
    }

    setIsCheckingOut(true);
    try {
      const input: ProcessSaleInput = {
        clientSaleToken,
        cart,
        sellingBill: activeSellingBillNumber,
        tenderType,
        staffUser,
        confirmedBelowCost: isBelowCost ? confirmedBelowCost : false
      };

      const success = await onCheckout(input);
      if (success) {
        // Clear cart and generate a fresh token for the next sale
        setCart([]);
        setCustomSellingBill(null);
        setConfirmedBelowCost(false);
        setClientSaleToken(generateSaleToken());
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="pos-container">
      {/* POS Top Navigation Bar */}
      <div className="pos-nav-header">
        <div className="pos-header-left">
          <div className="pos-title-badge">
            <ShoppingCart size={18} />
            <h2>Counter Sales POS</h2>
          </div>
          <span className="demo-mode-chip">DEMO SIMULATION</span>
        </div>

        <div className="pos-view-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={posTab === 'counter'}
            className={`pos-tab-btn ${posTab === 'counter' ? 'active' : ''}`}
            onClick={() => setPosTab('counter')}
          >
            <Pill size={14} />
            <span>Counter Register</span>
            {cart.length > 0 && <span className="cart-badge-count">{cart.length}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={posTab === 'history'}
            className={`pos-tab-btn ${posTab === 'history' ? 'active' : ''}`}
            onClick={() => setPosTab('history')}
          >
            <History size={14} />
            <span>Sales History</span>
            <span className="history-badge-count">{sales.length}</span>
          </button>
        </div>
      </div>

      {posTab === 'history' ? (
        /* SALES HISTORY VIEW */
        <div className="pos-history-view">
          <div className="history-header-bar">
            <div>
              <h3>Completed Walk-In Counter Sales</h3>
              <p className="text-muted text-xs">
                Auditable demo dispensing transactions with recorded FEFO batch allocations.
              </p>
            </div>
            <button
              type="button"
              className="btn-back-counter"
              onClick={() => setPosTab('counter')}
            >
              <ShoppingCart size={14} />
              <span>Back to Counter</span>
            </button>
          </div>

          {sales.length === 0 ? (
            <div className="pos-empty-state">
              <Receipt size={40} className="empty-icon text-muted" />
              <h4>No counter sales recorded yet</h4>
              <p>Complete a counter sale in the register to see sales history and receipt details.</p>
              <button 
                type="button" 
                className="btn-primary-action"
                onClick={() => setPosTab('counter')}
              >
                Go to Counter
              </button>
            </div>
          ) : (
            <div className="sales-history-table-wrapper">
              <table className="sales-history-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Date & Time</th>
                    <th>Items & Batches</th>
                    <th className="text-right">Total Bill (MRP)</th>
                    <th className="text-right">Selling Bill</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">COGS</th>
                    <th className="text-right">Est. Gross Profit</th>
                    <th className="text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="history-row">
                      <td className="font-mono font-bold text-xs">{sale.id}</td>
                      <td className="text-xs">
                        {formatDisplayDate(sale.timestamp)}
                        <span className="block text-muted text-xxs">
                          {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <div className="history-items-summary">
                          {sale.items.map((item, iIdx) => (
                            <div key={iIdx} className="history-item-line">
                              <strong>{item.quantity}x</strong> {item.medicineName}
                              <div className="history-batch-pills">
                                {item.allocations.map((alloc, aIdx) => (
                                  <span key={aIdx} className="history-batch-pill">
                                    Lot {alloc.batchNumber}: {alloc.quantity}u
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="text-right font-mono text-xs">₹{sale.totalBillMrp.toFixed(2)}</td>
                      <td className="text-right font-mono font-bold text-xs text-primary-dark">
                        ₹{sale.sellingBill.toFixed(2)}
                      </td>
                      <td className="text-right font-mono text-xs text-success">
                        {sale.discount > 0 ? `₹${sale.discount.toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="text-right font-mono text-xs text-muted">₹{sale.estimatedCogs.toFixed(2)}</td>
                      <td className="text-right font-mono text-xs">
                        <span className={sale.estimatedGrossProfit >= 0 ? 'text-success font-medium' : 'text-danger font-bold'}>
                          ₹{sale.estimatedGrossProfit.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-view-receipt-mini"
                          onClick={() => onViewReceipt(sale)}
                          title="View & Print Dispensing Memo"
                        >
                          <Receipt size={14} />
                          <span>Memo</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* COUNTER REGISTER VIEW (Split Column Layout / Responsive Stacking) */
        <div className="pos-grid-layout">
          {/* LEFT COLUMN: Medicine Catalog Search & Quick Add */}
          <div className="pos-catalog-panel">
            <div className="panel-header">
              <div className="catalog-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search medicine brand, generic name, category..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="catalog-search-input"
                  aria-label="Search medicine catalog for sales"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setCatalogSearch('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Catalog Item List */}
            <div className="pos-catalog-list">
              {filteredCatalog.length === 0 ? (
                <div className="pos-empty-catalog">
                  <p>No medicines found matching "{catalogSearch}".</p>
                </div>
              ) : (
                filteredCatalog.map((med) => {
                  const available = medicineStockMap.get(med.id) || 0;
                  const inCartItem = cart.find((item) => item.medicineId === med.id);
                  const inCartQty = inCartItem ? inCartItem.quantity : 0;
                  const isOutOfStock = available <= 0;
                  const isMaxInCart = inCartQty >= available && available > 0;

                  return (
                    <div 
                      key={med.id} 
                      className={`pos-catalog-card ${isOutOfStock ? 'is-out-of-stock' : ''}`}
                    >
                      <div className="med-info-col">
                        <div className="med-title-row">
                          <h4 className="med-name">{med.name}</h4>
                          <span className="med-strength-tag">{med.strength}</span>
                        </div>
                        <p className="med-generic">{med.genericName}</p>
                        <div className="med-meta-tags">
                          <span className="med-dosage-tag">{med.dosageForm}</span>
                          <span className="med-unit-tag">{med.unitLabel}</span>
                          <span className="med-category-tag">{med.category}</span>
                        </div>
                      </div>

                      <div className="med-action-col">
                        <div className="stock-availability-box">
                          <span className={`stock-badge ${isOutOfStock ? 'badge-out' : available <= med.lowStockThreshold ? 'badge-low' : 'badge-ok'}`}>
                            {isOutOfStock ? 'Out of Stock' : `${available} in stock`}
                          </span>
                          {inCartQty > 0 && (
                            <span className="cart-qty-indicator">{inCartQty} in cart</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`btn-add-cart ${isOutOfStock || isMaxInCart ? 'disabled' : ''}`}
                          onClick={() => handleAddToCart(med)}
                          disabled={isOutOfStock || isMaxInCart}
                          title={isOutOfStock ? 'Out of stock' : isMaxInCart ? 'Maximum available in cart' : 'Add to cart'}
                        >
                          <Plus size={14} />
                          <span>{isOutOfStock ? 'Unavailable' : isMaxInCart ? 'Max in Cart' : 'Add to Cart'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Active Cart & Checkout Calculation */}
          <div className="pos-checkout-panel">
            <div className="panel-header cart-panel-header">
              <div className="cart-header-title">
                <ShoppingCart size={16} />
                <h3>Active Counter Cart</h3>
                <span className="cart-count-pill">{cart.length} items</span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  className="btn-clear-cart"
                  onClick={handleClearCart}
                  title="Clear all items in cart"
                >
                  <RotateCcw size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Error / Warning Alert Banner */}
            {errorMessage && (
              <div className="pos-error-banner" role="alert">
                <AlertTriangle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Cart Items List */}
            <div className="pos-cart-items-list">
              {cart.length === 0 ? (
                <div className="pos-cart-empty">
                  <ShoppingCart size={32} className="text-muted empty-cart-icon" />
                  <p className="empty-cart-title">Cart is empty</p>
                  <p className="empty-cart-subtitle">
                    Select medicines from the catalog on the left to ring up items.
                  </p>
                </div>
              ) : (
                lineAllocations.map((line) => {
                  const available = line.availableQuantity;
                  const isShort = !line.isFullyAllocated;

                  return (
                    <div key={line.medicine.id} className="pos-cart-card">
                      <div className="cart-card-top">
                        <div className="cart-card-title">
                          <h5>{line.medicine.name}</h5>
                          <span className="cart-med-strength">{line.medicine.strength}</span>
                          <span className="cart-med-unit">({line.medicine.unitLabel})</span>
                        </div>

                        <button
                          type="button"
                          className="btn-remove-line"
                          onClick={() => handleRemoveItem(line.medicine.id)}
                          aria-label={`Remove ${line.medicine.name}`}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Quantity Stepper & Line MRP */}
                      <div className="cart-stepper-row">
                        <div className="stepper-controls">
                          <button
                            type="button"
                            className="btn-step"
                            onClick={() => handleUpdateQuantity(line.medicine.id, line.requestedQuantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={available}
                            value={line.requestedQuantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) handleUpdateQuantity(line.medicine.id, v);
                            }}
                            className="stepper-input font-mono"
                            aria-label="Item quantity"
                          />
                          <button
                            type="button"
                            className="btn-step"
                            onClick={() => handleUpdateQuantity(line.medicine.id, line.requestedQuantity + 1)}
                            disabled={line.requestedQuantity >= available}
                            aria-label="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                          <span className="unit-label-small">units</span>
                        </div>

                        <div className="cart-line-price font-mono">
                          <span className="mrp-label-tiny">Total MRP:</span>
                          <strong>₹{line.lineTotalMrp.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* FEFO Pre-Checkout Allocation Preview */}
                      <div className="cart-fefo-preview">
                        <div className="fefo-preview-header">
                          <Layers size={12} />
                          <span>FEFO Batch Allocation:</span>
                        </div>

                        {line.allocations.length === 0 ? (
                          <div className="fefo-no-stock text-danger text-xs">
                            ⚠️ No eligible non-expired batches available!
                          </div>
                        ) : (
                          <div className="fefo-batch-tags">
                            {line.allocations.map((alloc, idx) => (
                              <span key={idx} className="fefo-tag">
                                <strong>Lot {alloc.batchNumber}</strong> (Exp {alloc.expiryDate}): {alloc.quantity} units @ ₹{alloc.mrp.toFixed(2)} MRP (Cost ₹{alloc.purchaseCost.toFixed(2)})
                              </span>
                            ))}
                          </div>
                        )}

                        {isShort && (
                          <div className="fefo-short-alert text-danger text-xs font-bold">
                            ⚠️ Insufficient stock! Requested {line.requestedQuantity}, but only {available} units available.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* CHECKOUT SUMMARY WITH EXACT REQUIRED LABELS */}
            {cart.length > 0 && (
              <form onSubmit={handleSubmitCheckout} className="pos-summary-box">
                <h4 className="summary-heading">Checkout & Billing Summary</h4>

                <div className="summary-rows">
                  {/* Total Bill (MRP) */}
                  <div className="summary-row">
                    <span className="summary-label">Total Bill (MRP)</span>
                    <span className="summary-value font-mono font-bold">
                      ₹{totalBillMrp.toFixed(2)}
                    </span>
                  </div>

                  {/* Selling Bill (immediately below Total Bill (MRP)) */}
                  <div className="summary-row selling-bill-row">
                    <div className="selling-label-group">
                      <span className="summary-label font-bold text-primary-dark">Selling Bill</span>
                      <span className="text-xxs text-muted">(Actual charged amount)</span>
                    </div>
                    <div className="selling-input-wrap">
                      <span className="rupee-prefix">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customSellingBill !== null ? customSellingBill : totalBillMrp.toFixed(2)}
                        onChange={(e) => handleSellingBillChange(e.target.value)}
                        className="selling-bill-input font-mono font-bold"
                        aria-label="Selling Bill"
                        required
                      />
                      {customSellingBill !== null && (
                        <button
                          type="button"
                          className="btn-reset-mrp"
                          onClick={handleResetToMrp}
                          title="Reset to MRP"
                        >
                          MRP
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="summary-row">
                    <span className="summary-label">Discount</span>
                    <span className="summary-value font-mono text-success">
                      {discountAmount > 0 ? `- ₹${discountAmount.toFixed(2)}` : '₹0.00'}
                    </span>
                  </div>

                  <div className="summary-divider"></div>

                  {/* Internal Profitability Estimates */}
                  <div className="internal-estimates-container">
                    <div className="internal-label-bar">
                      <Info size={11} />
                      <span>Internal Pharmacy Cost Estimates (Not on customer slip)</span>
                    </div>

                    {/* Estimated COGS */}
                    <div className="summary-row text-xs">
                      <span className="summary-label text-muted">Estimated COGS</span>
                      <span className="summary-value font-mono text-muted">
                        ₹{estimatedCogs.toFixed(2)}
                      </span>
                    </div>

                    {/* Estimated Gross Profit */}
                    <div className="summary-row text-xs">
                      <span className="summary-label text-muted">Estimated Gross Profit</span>
                      <span className={`summary-value font-mono font-bold ${estimatedGrossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                        ₹{estimatedGrossProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Below-Cost Warning and Mandatory Deliberate Confirmation */}
                  {isBelowCost && (
                    <div className="below-cost-warning-card">
                      <div className="warning-card-head">
                        <AlertTriangle size={16} className="text-warning-icon" />
                        <div>
                          <strong>Loss-Making Sale Warning!</strong>
                          <p className="text-xs">
                            Selling Bill (₹{activeSellingBillNumber.toFixed(2)}) is lower than batch acquisition cost (₹{estimatedCogs.toFixed(2)}). Loss: ₹{(estimatedCogs - activeSellingBillNumber).toFixed(2)}.
                          </p>
                        </div>
                      </div>

                      <label className="below-cost-confirm-checkbox">
                        <input
                          type="checkbox"
                          checked={confirmedBelowCost}
                          onChange={(e) => setConfirmedBelowCost(e.target.checked)}
                          id="confirm-below-cost"
                        />
                        <span>I confirm this deliberate loss-making / subsidized sale</span>
                      </label>
                    </div>
                  )}

                  {/* Tender Selection */}
                  <div className="tender-selection-row">
                    <span className="summary-label text-xs">Tender Mode:</span>
                    <div className="tender-pills">
                      {(['CASH', 'UPI', 'CARD'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`tender-pill ${tenderType === t ? 'active' : ''}`}
                          onClick={() => setTenderType(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Complete Sale Button */}
                <button
                  type="submit"
                  className={`btn-complete-sale ${isCheckingOut || !isFullyFulfillable || isNaN(activeSellingBillNumber) || (isBelowCost && !confirmedBelowCost) ? 'disabled' : ''}`}
                  disabled={isCheckingOut || !isFullyFulfillable || isNaN(activeSellingBillNumber) || (isBelowCost && !confirmedBelowCost)}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {isCheckingOut 
                      ? 'Processing Sale...' 
                      : !isFullyFulfillable 
                      ? 'Insufficient Stock' 
                      : isNaN(activeSellingBillNumber)
                      ? 'Invalid Selling Bill'
                      : isBelowCost && !confirmedBelowCost 
                      ? 'Confirm Loss Override' 
                      : `Complete Sale (₹${activeSellingBillNumber.toFixed(2)})`}
                  </span>
                  <ArrowRight size={15} />
                </button>

                <p className="pos-fineprint text-center text-muted text-xxs">
                  * Demo counter transaction. Decrements batches under FEFO and records immutable stock movement audit entries.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
