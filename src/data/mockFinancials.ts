/**
 * Medi5 ERP - Synthetic Financial Health Demonstration Seed Data (Phase 4)
 * 
 * Realistic, investor-ready demonstration records for:
 * 1. Operational Expenses (Rent, Salaries, Utilities, Logistics, Software)
 * 2. Supplier Payables & Aging Invoices
 * 3. Synthetic Historical Sales for Revenue & Profitability Trends
 * 
 * Tenant-isolated by pharmacyId. Clearly marked as synthetic demonstration data.
 */

import { ExpenseRecord, SupplierPayable } from '../types/financials';
import { SaleRecord, DosageForm } from '../types/inventory';

export const MOCK_EXPENSES: ExpenseRecord[] = [
  // ================= Nandan Pharmacy (pharm-nandan-kolkata) =================
  {
    id: 'exp-nandan-01',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'RENT',
    title: 'Pharmacy Retail Store Monthly Rent',
    amount: 35000,
    date: '2026-11-01',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'NEFT-AXIS-99214',
    vendorName: 'Sen Commercial Realty',
    notes: 'Premises lease for Rashbehari Avenue branch',
    createdAt: '2026-11-01T10:00:00.000Z'
  },
  {
    id: 'exp-nandan-02',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'SALARIES',
    title: 'Pharmacist & Dispensing Staff Payroll',
    amount: 48000,
    date: '2026-11-02',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'SAL-PAYROLL-NOV26',
    vendorName: 'Direct Staff Accounts',
    notes: 'Salary for 2 pharmacists and 1 retail assistant',
    createdAt: '2026-11-02T11:30:00.000Z'
  },
  {
    id: 'exp-nandan-03',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'ELECTRICITY',
    title: 'Cold Storage & Storefront Power Bill',
    amount: 8450,
    date: '2026-10-28',
    paymentMethod: 'UPI',
    referenceNumber: 'CESC-BILL-781920',
    vendorName: 'CESC Kolkata',
    notes: 'Includes continuous vaccine freezer backup line',
    createdAt: '2026-10-28T14:15:00.000Z'
  },
  {
    id: 'exp-nandan-04',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'INTERNET',
    title: 'High-speed Fiber & Backup 4G Dongle',
    amount: 1499,
    date: '2026-10-25',
    paymentMethod: 'UPI',
    referenceNumber: 'AIRTEL-FIBER-8812',
    vendorName: 'Airtel Broadband Ltd.',
    notes: 'POS terminal connectivity and cloud sync',
    createdAt: '2026-10-25T09:20:00.000Z'
  },
  {
    id: 'exp-nandan-05',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'TRANSPORTATION',
    title: 'Wholesale Depot Stock Delivery Logistics',
    amount: 2200,
    date: '2026-10-20',
    paymentMethod: 'CASH',
    referenceNumber: 'PETTY-LOG-441',
    vendorName: 'Rapid Courier Services',
    notes: 'Express transit for emergency oncology batches',
    createdAt: '2026-10-20T16:00:00.000Z'
  },
  {
    id: 'exp-nandan-06',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'SOFTWARE',
    title: 'Medi5 ERP Cloud Subscription (Annual Discount)',
    amount: 2999,
    date: '2026-10-15',
    paymentMethod: 'UPI',
    referenceNumber: 'MED-SUB-INV-2026',
    vendorName: 'Medi5 Health Technologies',
    notes: 'Multi-device retail license and WhatsApp alerts module',
    createdAt: '2026-10-15T12:00:00.000Z'
  },
  {
    id: 'exp-nandan-07',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'MAINTENANCE',
    title: 'Deep Freeze & AC Compressor Servicing',
    amount: 3200,
    date: '2026-10-10',
    paymentMethod: 'CASH',
    referenceNumber: 'VOUCHER-MNT-910',
    vendorName: 'CoolCare Engineering',
    notes: 'Quarterly compliance check for insulin cold chain',
    createdAt: '2026-10-10T17:45:00.000Z'
  },
  {
    id: 'exp-nandan-08',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'MISCELLANEOUS',
    title: 'Sanitization, Thermal Rolls & Dispensing Bags',
    amount: 1850,
    date: '2026-10-05',
    paymentMethod: 'CASH',
    referenceNumber: 'PETTY-MISC-302',
    vendorName: 'Bhattacharya Stationers',
    notes: 'Consumables for counter billing printer',
    createdAt: '2026-10-05T11:10:00.000Z'
  },
  {
    id: 'exp-nandan-09',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'RENT',
    title: 'Pharmacy Retail Store Monthly Rent (October)',
    amount: 35000,
    date: '2026-10-01',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'NEFT-AXIS-88201',
    vendorName: 'Sen Commercial Realty',
    notes: 'October monthly premises lease',
    createdAt: '2026-10-01T10:00:00.000Z'
  },
  {
    id: 'exp-nandan-10',
    pharmacyId: 'pharm-nandan-kolkata',
    category: 'SALARIES',
    title: 'Pharmacist & Staff Payroll (October)',
    amount: 48000,
    date: '2026-10-02',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'SAL-PAYROLL-OCT26',
    vendorName: 'Direct Staff Accounts',
    notes: 'October salaries',
    createdAt: '2026-10-02T11:00:00.000Z'
  },

  // ================= MedPlus Chemist (pharm-medplus-saltlake) =================
  {
    id: 'exp-medplus-01',
    pharmacyId: 'pharm-medplus-saltlake',
    category: 'RENT',
    title: 'Sector V Commercial Complex Store Lease',
    amount: 52000,
    date: '2026-11-01',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'HDFC-RTGS-77218',
    vendorName: 'DLF Retail IT Parks',
    notes: 'Prime footfall corner unit lease',
    createdAt: '2026-11-01T10:00:00.000Z'
  },
  {
    id: 'exp-medplus-02',
    pharmacyId: 'pharm-medplus-saltlake',
    category: 'SALARIES',
    title: 'Dispensing Pharmacists Payroll',
    amount: 62000,
    date: '2026-11-02',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'SAL-MP-NOV26',
    vendorName: 'Direct Payroll Accounts',
    notes: '3 Registered pharmacists on rotating 2-shift roster',
    createdAt: '2026-11-02T11:00:00.000Z'
  },
  {
    id: 'exp-medplus-03',
    pharmacyId: 'pharm-medplus-saltlake',
    category: 'ELECTRICITY',
    title: 'Commercial Air Conditioning & Illumination',
    amount: 11200,
    date: '2026-10-29',
    paymentMethod: 'UPI',
    referenceNumber: 'WBSEDCL-22019',
    vendorName: 'WBSEDCL Salt Lake',
    notes: 'October high-efficiency HVAC power',
    createdAt: '2026-10-29T15:00:00.000Z'
  }
];

export const MOCK_SUPPLIER_PAYABLES: SupplierPayable[] = [
  // ================= Nandan Pharmacy =================
  {
    id: 'sup-nandan-01',
    pharmacyId: 'pharm-nandan-kolkata',
    supplierName: 'Bengal Pharma Wholesale Agency',
    invoiceNumber: 'BPW/26/8941',
    invoiceDate: '2026-10-05',
    dueDate: '2026-11-05',
    totalAmount: 42500,
    paidAmount: 20000,
    status: 'PARTIAL',
    paymentHistory: [
      {
        id: 'pay-rec-01',
        amount: 20000,
        paymentDate: '2026-10-20',
        method: 'BANK_TRANSFER',
        reference: 'NEFT-551982',
        recordedBy: 'Nandan Sen'
      }
    ],
    notes: 'Bulk purchase of Paracetamol & Amoxicillin batches'
  },
  {
    id: 'sup-nandan-02',
    pharmacyId: 'pharm-nandan-kolkata',
    supplierName: 'Sun Lifesciences Distributing Co.',
    invoiceNumber: 'SLD-WB-2026-112',
    invoiceDate: '2026-10-12',
    dueDate: '2026-10-31',
    totalAmount: 28400,
    paidAmount: 0,
    status: 'OVERDUE',
    paymentHistory: [],
    notes: 'Cardiology line delivery (Telmisartan & Atorvastatin). Overdue 2 days.'
  },
  {
    id: 'sup-nandan-03',
    pharmacyId: 'pharm-nandan-kolkata',
    supplierName: 'Cipla Regional Stockist (Howrah)',
    invoiceNumber: 'CIP-HOW-7712',
    invoiceDate: '2026-10-22',
    dueDate: '2026-11-08',
    totalAmount: 36200,
    paidAmount: 0,
    status: 'DUE_SOON',
    paymentHistory: [],
    notes: 'Inhalers, Montelukast, and cough syrup stock. Due in 6 days.'
  },
  {
    id: 'sup-nandan-04',
    pharmacyId: 'pharm-nandan-kolkata',
    supplierName: 'Apollo Surgical & Diagnostics Ltd.',
    invoiceNumber: 'ASD-MED-4910',
    invoiceDate: '2026-10-18',
    dueDate: '2026-11-18',
    totalAmount: 14800,
    paidAmount: 14800,
    status: 'PAID',
    paymentHistory: [
      {
        id: 'pay-rec-02',
        amount: 14800,
        paymentDate: '2026-10-26',
        method: 'UPI',
        reference: 'UPI-RAZOR-3301',
        recordedBy: 'Ratan Biswas'
      }
    ],
    notes: 'Accu-Chek test strips, digital thermometers, and disposable syringes'
  },
  {
    id: 'sup-nandan-05',
    pharmacyId: 'pharm-nandan-kolkata',
    supplierName: 'Torrent Diagnostics & Remedies',
    invoiceNumber: 'TDR-OCT-9901',
    invoiceDate: '2026-10-29',
    dueDate: '2026-11-28',
    totalAmount: 19500,
    paidAmount: 0,
    status: 'PENDING',
    paymentHistory: [],
    notes: 'Antacid tablets, Pantoprazole, and ORS sachets'
  },

  // ================= MedPlus Chemist =================
  {
    id: 'sup-medplus-01',
    pharmacyId: 'pharm-medplus-saltlake',
    supplierName: 'East India Pharmaceutical Works',
    invoiceNumber: 'EIPW-SL-1029',
    invoiceDate: '2026-10-10',
    dueDate: '2026-11-10',
    totalAmount: 58000,
    paidAmount: 30000,
    status: 'PARTIAL',
    paymentHistory: [
      {
        id: 'pay-rec-03',
        amount: 30000,
        paymentDate: '2026-10-25',
        method: 'BANK_TRANSFER',
        reference: 'RTGS-99120',
        recordedBy: 'MedPlus Admin'
      }
    ],
    notes: 'Metformin and Glimepiride chronic care replenishment'
  },
  {
    id: 'sup-medplus-02',
    pharmacyId: 'pharm-medplus-saltlake',
    supplierName: 'Zydus Cadila Direct Depo',
    invoiceNumber: 'ZYD-KOL-5510',
    invoiceDate: '2026-10-15',
    dueDate: '2026-11-01',
    totalAmount: 31200,
    paidAmount: 0,
    status: 'OVERDUE',
    paymentHistory: [],
    notes: 'Antibiotics and pain management shipment'
  }
];

/**
 * Seed historical sales for realistic financial trends across the last 90 days.
 * Generates ~60 balanced transactions for Nandan Pharmacy and MedPlus Chemist.
 */
export function generateSyntheticHistoricalSales(pharmacyId: string = 'pharm-nandan-kolkata'): SaleRecord[] {
  const sales: SaleRecord[] = [];
  const reference = new Date('2026-11-02T20:00:00.000Z');

  // Baseline SKU profiles for realistic demo sales
  const skuProfiles = [
    {
      medicineId: 'med-paracetamol-650',
      medicineName: 'Dolo 650',
      genericName: 'Paracetamol',
      strength: '650mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 33.60,
      cogs: 22.00,
      category: 'Analgesics & Antipyretics'
    },
    {
      medicineId: 'med-amoxicillin-500',
      medicineName: 'Augmentin 625 Duo',
      genericName: 'Amoxicillin + Potassium Clavulanate',
      strength: '625mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 201.50,
      cogs: 145.00,
      category: 'Antibiotics'
    },
    {
      medicineId: 'med-pantoprazole-40',
      medicineName: 'Pan 40',
      genericName: 'Pantoprazole Sodium',
      strength: '40mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 155.00,
      cogs: 95.00,
      category: 'Gastrointestinal'
    },
    {
      medicineId: 'med-azithromycin-500',
      medicineName: 'Azee 500',
      genericName: 'Azithromycin',
      strength: '500mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 119.50,
      cogs: 72.00,
      category: 'Antibiotics'
    },
    {
      medicineId: 'med-metformin-500',
      medicineName: 'Glycomet 500 SR',
      genericName: 'Metformin Hydrochloride',
      strength: '500mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 48.00,
      cogs: 30.00,
      category: 'Anti-Diabetic'
    },
    {
      medicineId: 'med-telmisartan-40',
      medicineName: 'Telma 40',
      genericName: 'Telmisartan',
      strength: '40mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 142.00,
      cogs: 88.00,
      category: 'Cardiovascular'
    },
    {
      medicineId: 'med-atorvastatin-10',
      medicineName: 'Atorva 10',
      genericName: 'Atorvastatin Calcium',
      strength: '10mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 185.00,
      cogs: 115.00,
      category: 'Cardiovascular'
    },
    {
      medicineId: 'med-cetirizine-10',
      medicineName: 'Cetzine',
      genericName: 'Cetirizine Hydrochloride',
      strength: '10mg',
      dosageForm: 'TABLET' as DosageForm,
      unitLabel: 'strip',
      mrp: 24.50,
      cogs: 12.00,
      category: 'Antihistamines'
    }
  ];

  const tenderTypes: ('CASH' | 'UPI' | 'CARD')[] = ['UPI', 'CASH', 'UPI', 'CASH', 'CARD', 'UPI'];

  // Seed sales across 60 days
  let saleCounter = 1001;
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    // 1 to 3 sales per day
    const salesToday = daysAgo % 2 === 0 ? 2 : (daysAgo % 5 === 0 ? 3 : 1);
    
    for (let s = 0; s < salesToday; s++) {
      const saleDate = new Date(reference);
      saleDate.setDate(reference.getDate() - daysAgo);
      saleDate.setHours(9 + (s * 4), 15 + (s * 20), 0, 0);

      const tender = tenderTypes[(daysAgo + s) % tenderTypes.length];
      const selectedSku = skuProfiles[(daysAgo * 3 + s) % skuProfiles.length];
      const selectedSku2 = skuProfiles[(daysAgo * 5 + s + 2) % skuProfiles.length];

      const qty1 = ((daysAgo + s) % 3) + 1;
      const qty2 = s % 2 === 0 ? 1 : 0;

      const mrp1 = selectedSku.mrp * qty1;
      const cogs1 = selectedSku.cogs * qty1;
      const mrp2 = qty2 > 0 ? selectedSku2.mrp * qty2 : 0;
      const cogs2 = qty2 > 0 ? selectedSku2.cogs * qty2 : 0;

      const totalMrp = Math.round((mrp1 + mrp2) * 100) / 100;
      const totalCogs = Math.round((cogs1 + cogs2) * 100) / 100;
      
      // Believable 5% - 8% patient discount on chronic medicines
      const discount = Math.round((totalMrp * 0.05) * 100) / 100;
      const sellingBill = Math.round((totalMrp - discount) * 100) / 100;
      const grossProfit = Math.round((sellingBill - totalCogs) * 100) / 100;

      const items = [
        {
          medicineId: selectedSku.medicineId,
          medicineName: selectedSku.medicineName,
          genericName: selectedSku.genericName,
          strength: selectedSku.strength,
          dosageForm: selectedSku.dosageForm as DosageForm,
          unitLabel: selectedSku.unitLabel,
          quantity: qty1,
          lineTotalMrp: mrp1,
          lineTotalCogs: cogs1,
          allocations: [
            {
              batchId: `batch-${selectedSku.medicineId}-01`,
              batchNumber: `BAT-2026-${(daysAgo % 9) + 10}`,
              quantity: qty1,
              mrp: selectedSku.mrp,
              purchaseCost: selectedSku.cogs,
              expiryDate: '2027-08-31'
            }
          ]
        }
      ];

      if (qty2 > 0) {
        items.push({
          medicineId: selectedSku2.medicineId,
          medicineName: selectedSku2.medicineName,
          genericName: selectedSku2.genericName,
          strength: selectedSku2.strength,
          dosageForm: selectedSku2.dosageForm as DosageForm,
          unitLabel: selectedSku2.unitLabel,
          quantity: qty2,
          lineTotalMrp: mrp2,
          lineTotalCogs: cogs2,
          allocations: [
            {
              batchId: `batch-${selectedSku2.medicineId}-01`,
              batchNumber: `BAT-2026-${((daysAgo + 3) % 9) + 10}`,
              quantity: qty2,
              mrp: selectedSku2.mrp,
              purchaseCost: selectedSku2.cogs,
              expiryDate: '2027-10-31'
            }
          ]
        });
      }

      sales.push({
        id: `INV-2026-${saleCounter++}-DEMO`,
        pharmacyId,
        clientSaleToken: `token-hist-${saleCounter}`,
        timestamp: saleDate.toISOString(),
        items,
        totalBillMrp: totalMrp,
        sellingBill,
        discount,
        estimatedCogs: totalCogs,
        estimatedGrossProfit: grossProfit,
        tenderType: tender,
        staffUser: 'Nandan Sen (Pharmacist)',
        confirmedBelowCost: false
      });
    }
  }

  // Sort descending by timestamp
  return sales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
