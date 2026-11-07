import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  RotateCcw,
  Wallet,
  Banknote,
  Lock,
  Barcode
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

  // Active view inside POS: 'counter' | 'history' | 'shift'
  const [posTab, setPosTab] = useState<'counter' | 'history' | 'shift'>('counter');

  // Shift & Cash Drawer Reconciliation State
  const [openingFloat, setOpeningFloat] = useState<number>(() => {
    const saved = localStorage.getItem('medi5_pos_opening_float');
    return saved ? parseFloat(saved) || 2000 : 2000;
  });
  const [actualCashCounted, setActualCashCounted] = useState<string>('');
  const [handoverNote, setHandoverNote] = useState<string>('');
  const [isShiftReconciled, setIsShiftReconciled] = useState<boolean>(false);

  // Stable clientSaleToken for current cart session (idempotency)
  const [clientSaleToken, setClientSaleToken] = useState<string>(() => generateSaleToken());

  function generateSaleToken(): string {
    return `tok-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // Shift Financial Metrics computed live from recorded sales
  const shiftMetrics = useMemo(() => {
    let cashSalesTotal = 0;
    let upiSalesTotal = 0;
    let cardSalesTotal = 0;
    let totalSalesCount = 0;

    for (const s of sales) {
      totalSalesCount++;
      if (s.tenderType === 'CASH') {
        cashSalesTotal += s.sellingBill;
      } else if (s.tenderType === 'UPI') {
        upiSalesTotal += s.sellingBill;
      } else {
        cardSalesTotal += s.sellingBill;
      }
    }

    const totalRevenue = cashSalesTotal + upiSalesTotal + cardSalesTotal;
    const expectedCashInTill = openingFloat + cashSalesTotal;
    const actualCash = actualCashCounted !== '' ? (parseFloat(actualCashCounted) || 0) : expectedCashInTill;
    const variance = actualCash - expectedCashInTill;

    return {
      cashSalesTotal,
      upiSalesTotal,
      cardSalesTotal,
      totalRevenue,
      totalSalesCount,
      expectedCashInTill,
      actualCash,
      variance
    };
  }, [sales, openingFloat, actualCashCounted]);

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
  const handleAddToCart = useCallback((medicine: Medicine) => {
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
  }, [medicineStockMap]);

  // Barcode Scanner Engine & Audio Feedback
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanToast, setScanToast] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);

  // Play crisp acoustic confirmation beep via Web Audio API (standard supermarket POS tone)
  const playScannerBeep = useCallback((success: boolean = true) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      if (success) {
        osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High pitch crisp beep (A6)
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else {
        osc.frequency.setValueAtTime(320, audioCtx.currentTime); // Low warning buzz
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch {
      // AudioContext not supported or restricted by autoplay policy
    }
  }, []);

  // Barcode resolution logic: matches barcode, batch lot number, or SKU
  const processScannedCode = useCallback((code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    setLastScannedCode(cleanCode);

    // 1. Try matching physical batch lot number directly (e.g. "DOL-2024-01")
    const matchedBatch = batches.find(
      b => b.batchNumber.toLowerCase() === cleanCode.toLowerCase() && b.status === 'ACTIVE'
    );
    let targetMedicine: Medicine | undefined;
    if (matchedBatch) {
      targetMedicine = medicines.find(m => m.id === matchedBatch.medicineId);
    }

    // 2. Try matching medicine barcode, name, or SKU ID
    if (!targetMedicine) {
      targetMedicine = medicines.find(
        m => (m as any).barcode === cleanCode ||
             m.id.toLowerCase() === cleanCode.toLowerCase() ||
             m.name.toLowerCase() === cleanCode.toLowerCase()
      );
    }

    // 3. Fallback: partial name match
    if (!targetMedicine) {
      targetMedicine = medicines.find(m =>
        cleanCode.toLowerCase().includes(m.name.toLowerCase()) ||
        m.name.toLowerCase().includes(cleanCode.toLowerCase())
      );
    }

    if (targetMedicine) {
      const stock = medicineStockMap.get(targetMedicine.id) || 0;
      if (stock > 0) {
        handleAddToCart(targetMedicine);
        playScannerBeep(true);
        setScanToast({
          message: `⚡ Scanned: ${targetMedicine.name} (${cleanCode}) added to cart via FEFO!`,
          type: 'success'
        });
      } else {
        playScannerBeep(false);
        setScanToast({
          message: `⚠️ Scanned: ${targetMedicine.name} is OUT OF STOCK.`,
          type: 'warn'
        });
      }
    } else {
      playScannerBeep(false);
      setScanToast({
        message: `❌ Unrecognized barcode or lot: "${cleanCode}". Item not found in catalog.`,
        type: 'warn'
      });
    }
  }, [batches, medicines, medicineStockMap, handleAddToCart, playScannerBeep]);

  // Global USB Barcode Wedge listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && (!isInput || timeDiff < 60)) {
          processScannedCode(buffer);
          buffer = '';
          if (isInput) e.preventDefault();
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length !== 1) return;

      if (timeDiff > 80) {
        buffer = e.key;
      } else {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processScannedCode]);

  useEffect(() => {
    if (scanToast) {
      const t = setTimeout(() => setScanToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [scanToast]);

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
      {/* Laser Scanner Instant Feedback Toast */}
      {scanToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: scanToast.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          <Barcode size={20} />
          <span>{scanToast.message}</span>
        </div>
      )}

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

          <button
            type="button"
            role="tab"
            aria-selected={posTab === 'shift'}
            className={`pos-tab-btn ${posTab === 'shift' ? 'active' : ''}`}
            onClick={() => setPosTab('shift')}
          >
            <Wallet size={14} />
            <span>Shift & Till Register</span>
          </button>
        </div>
      </div>

      {posTab === 'shift' ? (
        /* SHIFT MANAGEMENT & TILL RECONCILIATION VIEW */
        <div className="pos-history-view">
          <div className="history-header-bar">
            <div>
              <h3>Cash Drawer Shift Management & Till Reconciliation</h3>
              <p className="text-muted text-xs">
                Real-time cash till monitoring, expected cash computation, opening float control, and handover reconciliation.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`status-pill ${isShiftReconciled ? 'status-pill-success' : 'status-pill-info'}`}>
                {isShiftReconciled ? 'Shift Reconciled & Closed' : 'Active Shift Session'}
              </span>
            </div>
          </div>

          {/* Shift Metrics Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div className="kpi-card">
              <span className="kpi-label">Opening Float</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="font-mono font-bold text-lg">₹</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '120px', padding: '4px 8px', fontSize: '15px', fontWeight: 600 }}
                  value={openingFloat}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setOpeningFloat(val);
                    localStorage.setItem('medi5_pos_opening_float', String(val));
                  }}
                  disabled={isShiftReconciled}
                />
              </div>
              <span className="text-xs text-muted" style={{ marginTop: '4px' }}>Cash retained in drawer at shift start</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Cash Sales Collected</span>
              <span className="font-mono font-bold text-lg text-primary-green" style={{ marginTop: '4px' }}>
                ₹{shiftMetrics.cashSalesTotal.toFixed(2)}
              </span>
              <span className="text-xs text-muted" style={{ marginTop: '4px' }}>From {sales.filter(s => s.tenderType === 'CASH').length} cash transactions</span>
            </div>

            <div className="kpi-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <span className="kpi-label" style={{ color: '#166534' }}>Expected Cash in Drawer</span>
              <span className="font-mono font-bold text-xl text-primary-dark" style={{ marginTop: '4px' }}>
                ₹{shiftMetrics.expectedCashInTill.toFixed(2)}
              </span>
              <span className="text-xs text-muted" style={{ marginTop: '4px' }}>Float (₹{openingFloat.toFixed(2)}) + Cash Sales</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">UPI & Digital Collections</span>
              <span className="font-mono font-bold text-lg text-primary-dark" style={{ marginTop: '4px' }}>
                ₹{shiftMetrics.upiSalesTotal.toFixed(2)}
              </span>
              <span className="text-xs text-muted" style={{ marginTop: '4px' }}>Card: ₹{shiftMetrics.cardSalesTotal.toFixed(2)}</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Total Shift Revenue</span>
              <span className="font-mono font-bold text-lg text-primary-green" style={{ marginTop: '4px' }}>
                ₹{shiftMetrics.totalRevenue.toFixed(2)}
              </span>
              <span className="text-xs text-muted" style={{ marginTop: '4px' }}>Across {shiftMetrics.totalSalesCount} total invoices</span>
            </div>
          </div>

          {/* Reconciliation & Physical Count Calculator */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Banknote size={18} className="text-primary-green" />
              <span>Physical Till Count & Handover Verification</span>
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Actual Cash Counted in Drawer (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={`e.g. ${shiftMetrics.expectedCashInTill.toFixed(2)}`}
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(e.target.value)}
                  style={{ fontSize: '16px', fontWeight: 600, padding: '8px 12px' }}
                  disabled={isShiftReconciled}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                  Count all currency notes and coins physically present in the counter drawer.
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Reconciliation Result</label>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  backgroundColor: Math.abs(shiftMetrics.variance) < 0.01
                    ? '#f0fdf4'
                    : shiftMetrics.variance < 0
                      ? '#fff1f2'
                      : '#eff6ff',
                  borderColor: Math.abs(shiftMetrics.variance) < 0.01
                    ? '#bbf7d0'
                    : shiftMetrics.variance < 0
                      ? '#fecdd3'
                      : '#bfdbfe',
                  color: Math.abs(shiftMetrics.variance) < 0.01
                    ? '#166534'
                    : shiftMetrics.variance < 0
                      ? '#be123c'
                      : '#1e40af'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px' }}>
                    {Math.abs(shiftMetrics.variance) < 0.01 ? (
                      <> <CheckCircle2 size={16} /> Till Balanced Perfectly (₹0.00 Variance) </>
                    ) : shiftMetrics.variance < 0 ? (
                      <> <AlertTriangle size={16} /> Cash Shortage: -₹{Math.abs(shiftMetrics.variance).toFixed(2)} </>
                    ) : (
                      <> <CheckCircle2 size={16} /> Cash Surplus: +₹{shiftMetrics.variance.toFixed(2)} </>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Expected: ₹{shiftMetrics.expectedCashInTill.toFixed(2)} | Counted: ₹{shiftMetrics.actualCash.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Shift Handover Notes / Drawer Audit Log</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="e.g. ₹2,000 float retained for incoming shift cashier. Day's excess cash sealed in drop envelope #402."
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                disabled={isShiftReconciled}
              />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {!isShiftReconciled ? (
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => {
                    setIsShiftReconciled(true);
                  }}
                >
                  <Lock size={15} />
                  <span>Lock & Reconcile Shift</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsShiftReconciled(false)}
                >
                  <RotateCcw size={14} />
                  <span>Re-open Shift Drawer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : posTab === 'history' ? (
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

              {/* Hardware Barcode Scanner Status & Simulation Trigger */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center',
                marginTop: '10px',
                padding: '6px 10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#15803d',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  <Barcode size={15} />
                  <span>USB Laser Scanner: Listening {lastScannedCode ? `(Last Scanned: ${lastScannedCode})` : '• Scan Anytime'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Simulate Scan:</span>
                  <select
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        processScannedCode(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="" disabled>-- Trigger Laser Scan --</option>
                    {batches.slice(0, 10).map(b => (
                      <option key={b.id} value={b.batchNumber}>
                        Lot: {b.batchNumber} • {medicines.find(m => m.id === b.medicineId)?.name}
                      </option>
                    ))}
                  </select>
                </div>
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
