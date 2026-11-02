/**
 * Synthetic Sample Data for Medi5 ERP Prototype
 * 
 * DISCLAIMER: All medicine names, batch numbers, prices, and supplier entities
 * are entirely synthetic and for demonstration and testing purposes only.
 * No real patient or proprietary pharmacy data is included.
 */

import { Medicine, MedicineBatch, StockMovement } from '../types/inventory';

export const MOCK_MEDICINES: Medicine[] = [
  {
    id: 'med-dolo-650',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Dolo 650',
    genericName: 'Paracetamol',
    strength: '650 mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (15 tabs)',
    category: 'Antipyretic / Analgesic',
    lowStockThreshold: 25,
    notes: 'Schedule H drug, over-the-counter dispense common'
  },
  {
    id: 'med-augmentin-625',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin + Clavulanic Acid',
    strength: '500mg + 125mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (10 tabs)',
    category: 'Antibiotic',
    lowStockThreshold: 15,
    notes: 'Requires doctor prescription, store below 25°C'
  },
  {
    id: 'med-cetirizine-10',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Cetzine 10',
    genericName: 'Cetirizine Hydrochloride',
    strength: '10 mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (10 tabs)',
    category: 'Antihistamine',
    lowStockThreshold: 20,
    notes: 'Non-sedating antihistamine for allergic rhinitis'
  },
  {
    id: 'med-azithral-500',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Azithral 500',
    genericName: 'Azithromycin',
    strength: '500 mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (5 tabs)',
    category: 'Macrolide Antibiotic',
    lowStockThreshold: 10,
    notes: 'Short course antibiotic'
  },
  {
    id: 'med-pantocid-dsr',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Pantocid DSR',
    genericName: 'Pantoprazole + Domperidone',
    strength: '40mg + 30mg',
    dosageForm: 'Capsule',
    unitLabel: 'Strips (15 caps)',
    category: 'Antacid / Prokinetic',
    lowStockThreshold: 20,
    notes: 'Take 30 mins before morning breakfast'
  },
  {
    id: 'med-glycomet-500',
    pharmacyId: 'pharm-nandan-kolkata',
    name: 'Glycomet 500 SR',
    genericName: 'Metformin Hydrochloride',
    strength: '500 mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (20 tabs)',
    category: 'Anti-Diabetic',
    lowStockThreshold: 30,
    notes: 'Chronic refill medicine for type 2 diabetes'
  },

  // ==========================================================================
  // Deshbandhu Medical Hall (pharm-deshbandhu-siliguri) — isolated tenant seed
  // ==========================================================================
  {
    id: 'med-desh-atorva-10',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Atorva 10',
    genericName: 'Atorvastatin Calcium',
    strength: '10 mg',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (15 tabs)',
    category: 'Cardiovascular / Lipid Lowering',
    lowStockThreshold: 20,
    notes: 'Synthetic tenant-isolation fixture'
  },
  {
    id: 'med-desh-shelcal-500',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Shelcal 500',
    genericName: 'Calcium Carbonate + Vitamin D3',
    strength: '500mg + 250IU',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (15 tabs)',
    category: 'Nutritional Supplement',
    lowStockThreshold: 25,
    notes: 'Synthetic tenant-isolation fixture'
  },
  {
    id: 'med-desh-zincovit',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    name: 'Zincovit',
    genericName: 'Multivitamin + Zinc',
    strength: 'Multivitamin',
    dosageForm: 'Tablet',
    unitLabel: 'Strips (15 tabs)',
    category: 'Multivitamin',
    lowStockThreshold: 15,
    notes: 'Synthetic tenant-isolation fixture'
  }
];

export const MOCK_BATCHES: MedicineBatch[] = [
  // 1. Dolo 650: Two different batches (one expiring sooner in Nov 2026, one in Dec 2027)
  // Demonstrates FEFO sorting and multi-batch tracking.
  {
    id: 'batch-dolo-01',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-dolo-650',
    batchNumber: 'SYN-DL-24A',
    expiryDate: '2026-11-30', // Expiring soon (~44 days from Oct 17)
    purchaseCost: 24.50,
    mrp: 34.00,
    quantityReceived: 100,
    quantityRemaining: 18,
    supplierName: 'Bengal Med Distributors (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2025-06-12'
  },
  {
    id: 'batch-dolo-02',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-dolo-650',
    batchNumber: 'SYN-DL-25K',
    expiryDate: '2027-12-31', // Far future expiry
    purchaseCost: 25.80,
    mrp: 35.00,
    quantityReceived: 150,
    quantityRemaining: 140,
    supplierName: 'Kolkata Life Sciences (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-08-20'
  },

  // 2. Augmentin 625: Low stock (saleable: 6 strips, threshold: 15 strips)
  {
    id: 'batch-aug-01',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-augmentin-625',
    batchNumber: 'SYN-AG-62X',
    expiryDate: '2027-05-31',
    purchaseCost: 142.00,
    mrp: 185.00,
    quantityReceived: 50,
    quantityRemaining: 6, // Low stock!
    supplierName: 'Apex Pharma Wholesalers (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-02-14'
  },

  // 3. Cetzine 10: Has an EXPIRED batch (expired in Aug 2026) + an ACTIVE batch
  // Demonstrates that the expired batch is excluded from saleable quantity!
  {
    id: 'batch-cet-exp',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-cetirizine-10',
    batchNumber: 'SYN-CT-EXP01',
    expiryDate: '2026-08-31', // Already expired!
    purchaseCost: 14.00,
    mrp: 22.50,
    quantityReceived: 60,
    quantityRemaining: 15, // 15 expired strips! Must NOT be saleable!
    supplierName: 'Hooghly Pharma Wholesale (Fictional)',
    status: 'EXPIRED',
    receivedDate: '2025-01-10'
  },
  {
    id: 'batch-cet-active',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-cetirizine-10',
    batchNumber: 'SYN-CT-25B',
    expiryDate: '2027-09-30',
    purchaseCost: 15.20,
    mrp: 24.00,
    quantityReceived: 80,
    quantityRemaining: 45,
    supplierName: 'Hooghly Pharma Wholesale (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-05-04'
  },

  // 4. Azithral 500: Future expiry, good healthy stock
  {
    id: 'batch-azi-01',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-azithral-500',
    batchNumber: 'SYN-AZ-99F',
    expiryDate: '2028-03-31',
    purchaseCost: 98.00,
    mrp: 132.50,
    quantityReceived: 40,
    quantityRemaining: 32,
    supplierName: 'Bengal Med Distributors (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-07-15'
  },

  // 5. Pantocid DSR: Single batch, medium stock
  {
    id: 'batch-panto-01',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-pantocid-dsr',
    batchNumber: 'SYN-PAN-88D',
    expiryDate: '2027-08-31',
    purchaseCost: 185.00,
    mrp: 245.00,
    quantityReceived: 60,
    quantityRemaining: 24,
    supplierName: 'Kolkata Life Sciences (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-04-18'
  },

  // 6. Glycomet 500 SR: Out of stock (0 remaining) to test out-of-stock badge & filtering
  {
    id: 'batch-glyco-01',
    pharmacyId: 'pharm-nandan-kolkata',
    medicineId: 'med-glycomet-500',
    batchNumber: 'SYN-GLY-01',
    expiryDate: '2027-01-31',
    purchaseCost: 32.00,
    mrp: 46.50,
    quantityReceived: 100,
    quantityRemaining: 0, // OUT OF STOCK!
    supplierName: 'Bengal Med Distributors (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-01-08'
  },

  // Deshbandhu Medical Hall isolated tenant batches
  {
    id: 'batch-desh-atorva-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    medicineId: 'med-desh-atorva-10',
    batchNumber: 'DSH-ATV-26A',
    expiryDate: '2027-06-30',
    purchaseCost: 42.00,
    mrp: 58.00,
    quantityReceived: 90,
    quantityRemaining: 72,
    supplierName: 'North Bengal Pharma Distributors (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-03-12'
  },
  {
    id: 'batch-desh-shelcal-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    medicineId: 'med-desh-shelcal-500',
    batchNumber: 'DSH-SHL-26B',
    expiryDate: '2028-02-29',
    purchaseCost: 78.00,
    mrp: 98.00,
    quantityReceived: 60,
    quantityRemaining: 44,
    supplierName: 'Himalayan Health Supplies (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-05-18'
  },
  {
    id: 'batch-desh-zincovit-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    medicineId: 'med-desh-zincovit',
    batchNumber: 'DSH-ZNC-26C',
    expiryDate: '2027-09-30',
    purchaseCost: 28.00,
    mrp: 38.00,
    quantityReceived: 120,
    quantityRemaining: 105,
    supplierName: 'North Bengal Pharma Distributors (Fictional)',
    status: 'ACTIVE',
    receivedDate: '2026-06-02'
  }
];

export const MOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov-dolo-01',
    pharmacyId: 'pharm-nandan-kolkata',
    batchId: 'batch-dolo-01',
    medicineId: 'med-dolo-650',
    medicineName: 'Dolo 650',
    batchNumber: 'SYN-DL-24A',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 100,
    balanceBefore: 0,
    balanceAfter: 100,
    reason: 'Initial purchase from Bengal Med Distributors',
    timestamp: '2025-06-12T10:30:00.000Z',
    performedBy: 'Nandan Owner (Demo)'
  },
  {
    id: 'mov-dolo-02',
    pharmacyId: 'pharm-nandan-kolkata',
    batchId: 'batch-dolo-02',
    medicineId: 'med-dolo-650',
    medicineName: 'Dolo 650',
    batchNumber: 'SYN-DL-25K',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 150,
    balanceBefore: 0,
    balanceAfter: 150,
    reason: 'Restocking purchase from Kolkata Life Sciences',
    timestamp: '2026-08-20T14:15:00.000Z',
    performedBy: 'Nandan Owner (Demo)'
  },
  {
    id: 'mov-aug-01',
    pharmacyId: 'pharm-nandan-kolkata',
    batchId: 'batch-aug-01',
    medicineId: 'med-augmentin-625',
    medicineName: 'Augmentin 625 Duo',
    batchNumber: 'SYN-AG-62X',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 50,
    balanceBefore: 0,
    balanceAfter: 50,
    reason: 'Inbound stock receipt from Apex Pharma',
    timestamp: '2026-02-14T11:00:00.000Z',
    performedBy: 'Nandan Owner (Demo)'
  },
  {
    id: 'mov-cet-01',
    pharmacyId: 'pharm-nandan-kolkata',
    batchId: 'batch-cet-exp',
    medicineId: 'med-cetirizine-10',
    medicineName: 'Cetzine 10',
    batchNumber: 'SYN-CT-EXP01',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 60,
    balanceBefore: 0,
    balanceAfter: 60,
    reason: 'Purchase receipt',
    timestamp: '2025-01-10T09:45:00.000Z',
    performedBy: 'Nandan Owner (Demo)'
  },
  {
    id: 'mov-cet-exp-adj',
    pharmacyId: 'pharm-nandan-kolkata',
    batchId: 'batch-cet-exp',
    medicineId: 'med-cetirizine-10',
    medicineName: 'Cetzine 10',
    batchNumber: 'SYN-CT-EXP01',
    movementType: 'EXPIRED_WRITE_OFF',
    quantityChange: -45,
    balanceBefore: 60,
    balanceAfter: 15,
    reason: 'Dispensed historical stock prior to August 2026 expiry',
    timestamp: '2026-08-30T17:00:00.000Z',
    performedBy: 'Subhas Staff (Demo)'
  },
  {
    id: 'mov-cet-02',
    pharmacyId: 'pharm-nandan-kolkata',
    batchId: 'batch-cet-active',
    medicineId: 'med-cetirizine-10',
    medicineName: 'Cetzine 10',
    batchNumber: 'SYN-CT-25B',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 80,
    balanceBefore: 0,
    balanceAfter: 80,
    reason: 'Fresh batch receipt from Hooghly Pharma',
    timestamp: '2026-05-04T12:20:00.000Z',
    performedBy: 'Nandan Owner (Demo)'
  },

  // Deshbandhu Medical Hall isolated tenant ledger
  {
    id: 'mov-desh-atorva-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    batchId: 'batch-desh-atorva-01',
    medicineId: 'med-desh-atorva-10',
    medicineName: 'Atorva 10 (10 mg)',
    batchNumber: 'DSH-ATV-26A',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 90,
    balanceBefore: 0,
    balanceAfter: 90,
    reason: 'Initial purchase from North Bengal Pharma Distributors',
    timestamp: '2026-03-12T10:00:00.000Z',
    performedBy: 'Subhash Mukherjee (Demo)'
  },
  {
    id: 'mov-desh-atorva-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    batchId: 'batch-desh-atorva-01',
    medicineId: 'med-desh-atorva-10',
    medicineName: 'Atorva 10 (10 mg)',
    batchNumber: 'DSH-ATV-26A',
    movementType: 'SALE_DISPENSE',
    quantityChange: -18,
    balanceBefore: 90,
    balanceAfter: 72,
    reason: 'Counter Sale DSH-INV-2026-0001',
    referenceId: 'DSH-INV-2026-0001',
    timestamp: '2026-09-28T15:10:00.000Z',
    performedBy: 'Aniket Roy (Demo)'
  },
  {
    id: 'mov-desh-shelcal-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    batchId: 'batch-desh-shelcal-01',
    medicineId: 'med-desh-shelcal-500',
    medicineName: 'Shelcal 500 (500mg + 250IU)',
    batchNumber: 'DSH-SHL-26B',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 60,
    balanceBefore: 0,
    balanceAfter: 60,
    reason: 'Initial purchase from Himalayan Health Supplies',
    timestamp: '2026-05-18T11:30:00.000Z',
    performedBy: 'Subhash Mukherjee (Demo)'
  },
  {
    id: 'mov-desh-shelcal-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    batchId: 'batch-desh-shelcal-01',
    medicineId: 'med-desh-shelcal-500',
    medicineName: 'Shelcal 500 (500mg + 250IU)',
    batchNumber: 'DSH-SHL-26B',
    movementType: 'SALE_DISPENSE',
    quantityChange: -16,
    balanceBefore: 60,
    balanceAfter: 44,
    reason: 'Counter Sale DSH-INV-2026-0002',
    referenceId: 'DSH-INV-2026-0002',
    timestamp: '2026-10-02T12:45:00.000Z',
    performedBy: 'Aniket Roy (Demo)'
  },
  {
    id: 'mov-desh-zincovit-01',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    batchId: 'batch-desh-zincovit-01',
    medicineId: 'med-desh-zincovit',
    medicineName: 'Zincovit (Multivitamin)',
    batchNumber: 'DSH-ZNC-26C',
    movementType: 'PURCHASE_RECEIPT',
    quantityChange: 120,
    balanceBefore: 0,
    balanceAfter: 120,
    reason: 'Initial purchase from North Bengal Pharma Distributors',
    timestamp: '2026-06-02T09:15:00.000Z',
    performedBy: 'Subhash Mukherjee (Demo)'
  },
  {
    id: 'mov-desh-zincovit-02',
    pharmacyId: 'pharm-deshbandhu-siliguri',
    batchId: 'batch-desh-zincovit-01',
    medicineId: 'med-desh-zincovit',
    medicineName: 'Zincovit (Multivitamin)',
    batchNumber: 'DSH-ZNC-26C',
    movementType: 'SALE_DISPENSE',
    quantityChange: -15,
    balanceBefore: 120,
    balanceAfter: 105,
    reason: 'Counter Sale DSH-INV-2026-0003',
    referenceId: 'DSH-INV-2026-0003',
    timestamp: '2026-10-06T17:00:00.000Z',
    performedBy: 'Aniket Roy (Demo)'
  }
];
