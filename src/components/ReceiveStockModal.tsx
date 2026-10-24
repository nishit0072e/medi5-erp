import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle, PackagePlus, Info } from 'lucide-react';
import { Medicine, DosageForm, ReceiveStockInput, MedicineBatch } from '../types/inventory';
import { parseRupees, toPaise } from '../utils/moneyUtils';
import { parseExpiryDate } from '../utils/dateUtils';

interface ReceiveStockModalProps {
  medicines: Medicine[];
  existingBatches?: MedicineBatch[];
  isOpen: boolean;
  onClose: () => void;
  onReceive: (input: ReceiveStockInput) => void;
}

export const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({
  medicines,
  existingBatches = [],
  isOpen,
  onClose,
  onReceive
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  
  // Existing medicine selection
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>(
    medicines.length > 0 ? medicines[0].id : ''
  );

  // New medicine form fields
  const [newName, setNewName] = useState('');
  const [newGenericName, setNewGenericName] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newDosageForm, setNewDosageForm] = useState<DosageForm>('Tablet');
  const [newUnitLabel, setNewUnitLabel] = useState('Strips (10 tabs)');
  const [newCategory, setNewCategory] = useState('General');
  const [newLowStockThreshold, setNewLowStockThreshold] = useState('15');

  // Batch specific fields
  const [supplierName, setSupplierName] = useState('Bengal Med Distributors (Fictional)');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState(''); // e.g. '2027-10' or '2027-10-31'
  const [purchaseCost, setPurchaseCost] = useState('');
  const [mrp, setMrp] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live duplicate batch detection
  const cleanBatch = batchNumber.trim().toUpperCase();
  const matchingBatch = useMemo(() => {
    if (!cleanBatch || mode !== 'existing' || !selectedMedicineId) return null;
    return existingBatches.find(
      (b) => b.medicineId === selectedMedicineId && b.batchNumber.toUpperCase() === cleanBatch
    ) || null;
  }, [cleanBatch, existingBatches, mode, selectedMedicineId]);

  // Live duplicate conflict evaluation
  const batchConflict = useMemo(() => {
    if (!matchingBatch) return null;
    let hasConflict = false;
    const reasons: string[] = [];

    if (expiryDate.trim()) {
      try {
        const expTime = parseExpiryDate(expiryDate.trim()).getTime();
        const existingExpTime = parseExpiryDate(matchingBatch.expiryDate).getTime();
        if (expTime !== existingExpTime) {
          hasConflict = true;
          reasons.push(`expiry date differs (existing: ${matchingBatch.expiryDate})`);
        }
      } catch {
        // ignore incomplete date
      }
    }

    if (purchaseCost.trim()) {
      try {
        const cost = parseRupees(purchaseCost);
        if (toPaise(cost) !== toPaise(matchingBatch.purchaseCost)) {
          hasConflict = true;
          reasons.push(`purchase cost differs (existing: ₹${matchingBatch.purchaseCost.toFixed(2)})`);
        }
      } catch {
        // ignore
      }
    }

    if (mrp.trim()) {
      try {
        const m = parseRupees(mrp);
        if (toPaise(m) !== toPaise(matchingBatch.mrp)) {
          hasConflict = true;
          reasons.push(`MRP differs (existing: ₹${matchingBatch.mrp.toFixed(2)})`);
        }
      } catch {
        // ignore
      }
    }

    return { hasConflict, reasons };
  }, [matchingBatch, expiryDate, purchaseCost, mrp]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const rawQty = Number(quantity);
      if (isNaN(rawQty) || !Number.isInteger(rawQty) || rawQty <= 0) {
        throw new Error('Quantity received must be a positive integer.');
      }
      const parsedCost = parseRupees(purchaseCost);
      const parsedMrp = parseRupees(mrp);

      if (parsedMrp < parsedCost) {
        throw new Error(`MRP (₹${parsedMrp.toFixed(2)}) cannot be lower than purchase cost (₹${parsedCost.toFixed(2)}).`);
      }
      if (!batchNumber.trim()) {
        throw new Error('Batch number is required.');
      }
      if (!expiryDate.trim()) {
        throw new Error('Expiry date (YYYY-MM or YYYY-MM-DD) is required.');
      }

      const payload: ReceiveStockInput = {
        supplierName: supplierName.trim() || 'Direct Wholesaler',
        batchNumber: batchNumber.trim(),
        expiryDate: expiryDate.trim(),
        purchaseCost: parsedCost,
        mrp: parsedMrp,
        quantity: rawQty,
        notes: notes.trim() || undefined
      };

      if (mode === 'existing') {
        if (!selectedMedicineId) {
          throw new Error('Please select an existing medicine.');
        }
        payload.medicineId = selectedMedicineId;
      } else {
        if (!newName.trim()) throw new Error('Medicine name is required.');
        if (!newStrength.trim()) throw new Error('Strength is required (e.g. 500 mg).');

        payload.newMedicine = {
          name: newName.trim(),
          genericName: newGenericName.trim() || newName.trim(),
          strength: newStrength.trim(),
          dosageForm: newDosageForm,
          unitLabel: newUnitLabel.trim() || 'Strips',
          category: newCategory.trim() || 'General',
          lowStockThreshold: parseInt(newLowStockThreshold, 10) || 10
        };
      }

      onReceive(payload);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid form submission');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receive-modal-title">
      <div className="modal-container">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <PackagePlus size={20} className="icon-green" />
            <h3 id="receive-modal-title">Receive Medicine Batch</h3>
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="modal-body modal-form">
          {errorMessage && (
            <div className="modal-alert-box modal-alert-error" role="alert">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="form-radio-tabs" role="tablist">
            <button
              type="button"
              className={`radio-tab-btn ${mode === 'existing' ? 'active' : ''}`}
              onClick={() => {
                setMode('existing');
                setErrorMessage(null);
              }}
            >
              Existing Medicine Master
            </button>
            <button
              type="button"
              className={`radio-tab-btn ${mode === 'new' ? 'active' : ''}`}
              onClick={() => {
                setMode('new');
                setErrorMessage(null);
              }}
            >
              + Create New Medicine
            </button>
          </div>

          {/* Existing Medicine Selector */}
          {mode === 'existing' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="select-med">
                Select Medicine <span className="required-star">*</span>
              </label>
              <select
                id="select-med"
                className="form-select"
                value={selectedMedicineId}
                onChange={(e) => setSelectedMedicineId(e.target.value)}
                required
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.strength} ({m.genericName}) — {m.unitLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* New Medicine Fields */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-name">
                    Brand Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dolo"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-strength">
                    Strength <span className="required-star">*</span>
                  </label>
                  <input
                    id="new-strength"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 650 mg"
                    value={newStrength}
                    onChange={(e) => setNewStrength(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2col">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-generic">Generic Salt</label>
                  <input
                    id="new-generic"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Paracetamol"
                    value={newGenericName}
                    onChange={(e) => setNewGenericName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-form">Dosage Form</label>
                  <select
                    id="new-form"
                    className="form-select"
                    value={newDosageForm}
                    onChange={(e) => setNewDosageForm(e.target.value as DosageForm)}
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Eye Drops">Eye Drops</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-3col">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-unit">Dispense Unit</label>
                  <input
                    id="new-unit"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Strips (15 tabs)"
                    value={newUnitLabel}
                    onChange={(e) => setNewUnitLabel(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-cat">Category</label>
                  <input
                    id="new-cat"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Analgesic"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-threshold">Low Stock Alert</label>
                  <input
                    id="new-threshold"
                    type="number"
                    className="form-input"
                    placeholder="e.g. 20"
                    value={newLowStockThreshold}
                    onChange={(e) => setNewLowStockThreshold(e.target.value)}
                    min="1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Physical Batch Details */}
          <div className="form-group" style={{ marginTop: '4px' }}>
            <label className="form-label" htmlFor="batch-supplier">Supplier / Wholesaler</label>
            <input
              id="batch-supplier"
              type="text"
              className="form-input"
              placeholder="e.g. Bengal Med Distributors"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>

          <div className="form-grid-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="batch-no">
                Batch Number <span className="required-star">*</span>
              </label>
              <input
                id="batch-no"
                type="text"
                className="form-input"
                placeholder="e.g. SYN-DL-26B"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="batch-exp">
                Expiry Date <span className="required-star">*</span>
              </label>
              <input
                id="batch-exp"
                type="text"
                className="form-input"
                placeholder="YYYY-MM (e.g. 2027-11)"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Active Duplicate / Compatibility Hint */}
          {matchingBatch && (
            <div className={`existing-batch-callout ${batchConflict?.hasConflict ? 'conflict' : 'match'}`}>
              {batchConflict?.hasConflict ? (
                <AlertTriangle size={15} className="callout-icon" style={{ color: '#DC2626' }} />
              ) : (
                <Info size={15} className="callout-icon" />
              )}
              <div className="callout-content">
                <span className="callout-title">
                  {batchConflict?.hasConflict ? 'Conflicting Batch Details Detected' : `Batch ${matchingBatch.batchNumber} already exists`}
                </span>
                <p className="callout-desc">
                  {batchConflict?.hasConflict ? (
                    <>
                      Existing batch specifications differ: {batchConflict.reasons.join(', ')}. Submitting conflicting details will be rejected. Use a distinct batch suffix (e.g. {matchingBatch.batchNumber}-B) or review specifications.
                    </>
                  ) : (
                    <>
                      Existing batch has {matchingBatch.quantityRemaining} units (Cost ₹{matchingBatch.purchaseCost.toFixed(2)}, MRP ₹{matchingBatch.mrp.toFixed(2)}). Matching stock will be safely added into this batch.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="form-grid-3col">
            <div className="form-group">
              <label className="form-label" htmlFor="batch-qty">
                Quantity <span className="required-star">*</span>
              </label>
              <input
                id="batch-qty"
                type="number"
                className="form-input"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="batch-cost">
                Cost Price (₹) <span className="required-star">*</span>
              </label>
              <div className="input-with-affix">
                <span className="input-prefix">₹</span>
                <input
                  id="batch-cost"
                  type="number"
                  step="0.01"
                  className="form-input input-prefixed"
                  placeholder="24.50"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="batch-mrp">
                MRP (₹) <span className="required-star">*</span>
              </label>
              <div className="input-with-affix">
                <span className="input-prefix">₹</span>
                <input
                  id="batch-mrp"
                  type="number"
                  step="0.01"
                  className="form-input input-prefixed"
                  placeholder="33.00"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  min="0"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="batch-notes">Receipt Notes / PO Reference</label>
            <input
              id="batch-notes"
              type="text"
              className="form-input"
              placeholder="e.g. Challan #CH-8821, received in good condition"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ margin: '0 -18px -16px -18px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <CheckCircle2 size={15} />
              Confirm Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
