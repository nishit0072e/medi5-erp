/**
 * PDF Generation Utilities for Business Documents
 * 
 * Generates:
 * 1. Statement of Accounts (SOA)
 * 2. Profit & Loss Statement
 * 3. Income vs Expenditure Report
 * 
 * All documents are generated in real-time from current data - not stored.
 * Uses jsPDF for client-side PDF generation.
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatINR } from '../utils/moneyUtils';
import { PharmacyProfile } from '../types/pharmacy';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface PDFOptions {
  pharmacy: PharmacyProfile;
  generatedBy: string;
  generatedAt: string;
}

interface SOAData {
  pharmacy: PharmacyProfile;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  transactions: Array<{
    date: string;
    type: 'SALE' | 'PURCHASE' | 'PAYMENT' | 'RECEIPT' | 'EXPENSE' | 'ADJUSTMENT';
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  closingBalance: number;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalPaymentsReceived: number;
  totalPaymentsMade: number;
}

interface ProfitLossData {
  pharmacy: PharmacyProfile;
  periodStart: string;
  periodEnd: string;
  revenue: {
    sales: number;
    otherIncome: number;
    totalRevenue: number;
  };
  costOfGoodsSold: {
    openingStock: number;
    purchases: number;
    closingStock: number;
    totalCOGS: number;
  };
  grossProfit: number;
  expenses: Array<{
    category: string;
    amount: number;
  }>;
  totalExpenses: number;
  netProfit: number;
}

interface IncomeExpenditureData {
  pharmacy: PharmacyProfile;
  periodStart: string;
  periodEnd: string;
  income: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  expenditure: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  totalIncome: number;
  totalExpenditure: number;
  surplusDeficit: number;
}

/**
 * Generate Statement of Accounts (SOA) PDF
 */
export function generateSOAPDF(data: SOAData, options: PDFOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Helper functions
  const addHeader = () => {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75); // Primary green
    doc.text('STATEMENT OF ACCOUNTS', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.pharmacy.name, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`${data.pharmacy.addressLine1}, ${data.pharmacy.city} - ${data.pharmacy.pincode}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Phone: ${data.pharmacy.phone} | Email: ${data.pharmacy.email}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Drug License: ${data.pharmacy.drugLicenseNumber}${data.pharmacy.gstin ? ` | GSTIN: ${data.pharmacy.gstin}` : ''}`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Period: ${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)}`, pageWidth / 2, y, { align: 'center' });
    doc.text(`Generated: ${formatDateTime(options.generatedAt)} by ${options.generatedBy}`, pageWidth / 2, y + 5, { align: 'center' });
    y += 14;
  };

  const addOpeningBalance = () => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Opening Balance', margin, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${formatINR(data.openingBalance)}`, margin + 5, y);
    y += 8;
  };

  const addTransactionsTable = () => {
    if (data.transactions.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No transactions in this period.', margin, y);
      y += 8;
      return;
    }

    const tableData = data.transactions.map((txn, idx) => [
      idx + 1,
      formatDate(txn.date),
      txn.type,
      txn.reference,
      txn.description.length > 40 ? txn.description.substring(0, 40) + '...' : txn.description,
      txn.debit > 0 ? formatINR(txn.debit) : '',
      txn.credit > 0 ? formatINR(txn.credit) : '',
      formatINR(txn.balance)
    ]);

    doc.autoTable({
      startY: y,
      head: [['#', 'Date', 'Type', 'Ref #', 'Description', 'Debit', 'Credit', 'Balance']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [19, 99, 75], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: 30 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 50 },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: { pageNumber: number }) => {
        // Add page number
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
      }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  const addClosingBalance = () => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('Closing Balance', margin, y);
    y += 6;
    doc.setFontSize(12);
    doc.text(formatINR(data.closingBalance), margin, y);
    y += 10;
  };

  const addSummary = () => {
    doc.setDrawColor(19, 99, 75);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const summaryData = [
      ['Total Sales', formatINR(data.totalSales)],
      ['Total Purchases', formatINR(data.totalPurchases)],
      ['Total Expenses', formatINR(data.totalExpenses)],
      ['Payments Received', formatINR(data.totalPaymentsReceived)],
      ['Payments Made', formatINR(data.totalPaymentsMade)],
      ['Net Movement', formatINR(data.closingBalance - data.openingBalance)]
    ];

    doc.autoTable({
      startY: y,
      body: summaryData,
      theme: 'plain',
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 40, halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('This is a computer-generated document. No signature required.', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    doc.text(`Medi5 ERP | Generated on ${new Date().toLocaleString()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
  };

  // Build PDF
  addHeader();
  addOpeningBalance();
  addTransactionsTable();
  addClosingBalance();
  addSummary();
  addFooter();

  return doc;
}

/**
 * Generate Profit & Loss Statement PDF
 */
export function generateProfitLossPDF(data: ProfitLossData, options: PDFOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  const addHeader = () => {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('PROFIT & LOSS STATEMENT', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.pharmacy.name, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`${data.pharmacy.addressLine1}, ${data.pharmacy.city} - ${data.pharmacy.pincode}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Phone: ${data.pharmacy.phone} | Email: ${data.pharmacy.email}`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Period: ${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)}`, pageWidth / 2, y, { align: 'center' });
    doc.text(`Generated: ${formatDateTime(options.generatedAt)} by ${options.generatedBy}`, pageWidth / 2, y + 5, { align: 'center' });
    y += 14;
  };

  const addRevenueSection = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('REVENUE', margin, y);
    y += 8;

    const revenueData = [
      ['Sales Revenue', formatINR(data.revenue.sales)],
      ['Other Income', formatINR(data.revenue.otherIncome)],
      ['Total Revenue', formatINR(data.revenue.totalRevenue)]
    ];

    doc.autoTable({
      startY: y,
      body: revenueData,
      theme: 'striped',
      headStyles: { fillColor: [19, 99, 75], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 60, halign: 'right' } },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total Revenue: ${formatINR(data.revenue.totalRevenue)}`, margin, y);
    y += 10;
  };

  const addCOGSSection = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red for costs
    doc.text('COST OF GOODS SOLD', margin, y);
    y += 8;

    const cogsData = [
      ['Opening Stock', formatINR(data.costOfGoodsSold.openingStock)],
      ['Purchases', formatINR(data.costOfGoodsSold.purchases)],
      ['Less: Closing Stock', formatINR(data.costOfGoodsSold.closingStock)],
      ['Total COGS', formatINR(data.costOfGoodsSold.totalCOGS)]
    ];

    doc.autoTable({
      startY: y,
      body: cogsData,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 60, halign: 'right' } },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text(`Total COGS: ${formatINR(data.costOfGoodsSold.totalCOGS)}`, margin, y);
    y += 10;
  };

  const addGrossProfit = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text(`GROSS PROFIT: ${formatINR(data.grossProfit)}`, margin, y);
    y += 10;
  };

  const addExpensesSection = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('OPERATING EXPENSES', margin, y);
    y += 8;

    if (data.expenses.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No expenses recorded in this period.', margin, y);
      y += 8;
    } else {
      const expenseData = data.expenses.map(e => [e.category, formatINR(e.amount)]);
      expenseData.push(['Total Expenses', formatINR(data.totalExpenses)]);

      doc.autoTable({
        startY: y,
        body: expenseData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 60, halign: 'right' } },
        margin: { left: margin, right: margin }
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Expenses: ${formatINR(data.totalExpenses)}`, margin, y);
    y += 10;
  };

  const addNetProfit = () => {
    doc.setDrawColor(19, 99, 75);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 6;

    const profitColor: [number, number, number] = data.netProfit >= 0 ? [19, 99, 75] : [220, 38, 38];
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...profitColor);
    doc.text(`NET PROFIT: ${formatINR(data.netProfit)}`, margin, y);
    y += 12;
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('This is a computer-generated document. No signature required.', 105, 287, { align: 'center' });
    doc.text(`Medi5 ERP | Generated on ${new Date().toLocaleString()}`, 105, 292, { align: 'center' });
  };

  addHeader();
  addRevenueSection();
  addCOGSSection();
  addGrossProfit();
  addExpensesSection();
  addNetProfit();
  addFooter();

  return doc;
}

/**
 * Generate Income vs Expenditure Report PDF
 */
export function generateIncomeExpenditurePDF(data: IncomeExpenditureData, options: PDFOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = 15;

  const addIncomeSection = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('INCOME', margin, y);
    y += 8;

    if (data.income.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No income recorded in this period.', margin, y);
      y += 8;
    } else {
      const incomeData = data.income.map(item => [
        item.category,
        formatINR(item.amount),
        `${item.percentage.toFixed(1)}%`
      ]);
      incomeData.push(['Total Income', formatINR(data.totalIncome), '100.0%']);

      doc.autoTable({
        startY: y,
        head: [['Category', 'Amount', '% of Total']],
        body: incomeData,
        theme: 'striped',
        headStyles: { fillColor: [19, 99, 75], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 80, fontStyle: 'bold' }, 1: { cellWidth: 50, halign: 'right' }, 2: { cellWidth: 30, halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(19, 99, 75);
    doc.text(`Total Income: ${formatINR(data.totalIncome)}`, margin, y);
    y += 10;
  };

  const addExpenditureSection = () => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('EXPENDITURE', margin, y);
    y += 8;

    if (data.expenditure.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No expenditure recorded in this period.', margin, y);
      y += 8;
    } else {
      const expData = data.expenditure.map(item => [
        item.category,
        formatINR(item.amount),
        `${item.percentage.toFixed(1)}%`
      ]);
      expData.push(['Total Expenditure', formatINR(data.totalExpenditure), '100.0%']);

      doc.autoTable({
        startY: y,
        head: [['Category', 'Amount', '% of Total']],
        body: expData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 80, fontStyle: 'bold' }, 1: { cellWidth: 50, halign: 'right' }, 2: { cellWidth: 30, halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text(`Total Expenditure: ${formatINR(data.totalExpenditure)}`, margin, y);
    y += 10;
  };

  const addSummary = () => {
    doc.setDrawColor(19, 99, 75);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 6;

    const surplusColor: [number, number, number] = data.surplusDeficit >= 0 ? [19, 99, 75] : [220, 38, 38];
    const label = data.surplusDeficit >= 0 ? 'SURPLUS' : 'DEFICIT';
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...surplusColor);
    doc.text(`${label}: ${formatINR(Math.abs(data.surplusDeficit))}`, margin, y);
    y += 12;

    // Summary table
    const summaryData = [
      ['Total Income', formatINR(data.totalIncome)],
      ['Total Expenditure', formatINR(data.totalExpenditure)],
      [label, formatINR(Math.abs(data.surplusDeficit))]
    ];

    doc.autoTable({
      startY: y,
      body: summaryData,
      theme: 'plain',
      bodyStyles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' }, 1: { cellWidth: 60, halign: 'right' } },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  };

  const addHeaderSection = () => {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('INCOME vs EXPENDITURE REPORT', 105, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(data.pharmacy.name, 105, y, { align: 'center' });
    y += 5;
    doc.text(`${data.pharmacy.addressLine1}, ${data.pharmacy.city} - ${data.pharmacy.pincode}`, 105, y, { align: 'center' });
    y += 5;
    doc.text(`Phone: ${data.pharmacy.phone} | Email: ${data.pharmacy.email}`, 105, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Period: ${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)}`, 105, y, { align: 'center' });
    doc.text(`Generated: ${formatDateTime(options.generatedAt)} by ${options.generatedBy}`, 105, y + 5, { align: 'center' });
    y += 14;
  };

  // Build PDF
  addHeaderSection();
  addIncomeSection();
  addExpenditureSection();
  addSummary();
  
  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('This is a computer-generated document. No signature required.', 105, 287, { align: 'center' });
  doc.text(`Medi5 ERP | Generated on ${new Date().toLocaleString()}`, 105, 292, { align: 'center' });

  return doc;
}

/**
 * Generate E-Prescription PDF
 */
export function generatePrescriptionPDF(prescription: any, pharmacy: any): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 99, 75);
  doc.text('E-PRESCRIPTION', pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(pharmacy.name, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(`${pharmacy.addressLine1}, ${pharmacy.city} - ${pharmacy.pincode}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(`Phone: ${pharmacy.phone} | Email: ${pharmacy.email}`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Reference & Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`Ref: ${prescription.referenceNumber}`, margin, y);
  doc.text(`Date: ${new Date(prescription.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, y, { align: 'right' });
  y += 10;

  // Doctor Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 99, 75);
  doc.text('PRESCRIBING DOCTOR', margin, y);
  y += 6;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  const doctorLines = [
    `Dr. ${prescription.doctorName}`,
    `${prescription.doctorDesignation} • ${prescription.doctorDegree}`,
    `Specialization: ${prescription.doctorSpecialization.replace('_', ' ')}`,
    `Reg. No: ${prescription.doctorRegistrationNumber}`,
    `Mobile: ${prescription.doctorMobile} | Email: ${prescription.doctorEmail}`,
    prescription.doctorHospitalClinic ? `Hospital/Clinic: ${prescription.doctorHospitalClinic}` : ''
  ].filter(Boolean);
  
  doctorLines.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  // Patient Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 99, 75);
  doc.text('PATIENT DETAILS', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  const patientLines = [
    `Name: ${prescription.patientName}`,
    `Age: ${prescription.patientAge}  |  Gender: ${prescription.patientGender}`,
    `Phone: ${prescription.patientPhone}  ${prescription.patientEmail ? '|  Email: ' + prescription.patientEmail : ''}`,
    `Weight: ${prescription.patientWeight || '—'} kg  |  Height: ${prescription.patientHeight || '—'} cm`,
    `Allergies: ${prescription.patientKnownAllergies || 'None reported'}`,
    `Address: ${prescription.patientAddress || 'Not provided'}`
  ];
  
  patientLines.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  // Clinical Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 99, 75);
  doc.text('CLINICAL DETAILS', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const clinicalLines = [
    `Chief Complaint: ${prescription.chiefComplaint}`,
    `Diagnosis: ${prescription.diagnosis}`,
    `Checkups/Vitals: ${prescription.checkupsDone}`,
    prescription.clinicalNotes ? `Notes: ${prescription.clinicalNotes}` : ''
  ].filter(Boolean);
  
  clinicalLines.forEach(line => {
    const splitLines = doc.splitTextToSize(line, 180);
    splitLines.forEach((l: string) => {
      doc.text(l, margin, y);
      y += 5;
    });
  });
  y += 4;

  // Medications
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 99, 75);
  doc.text('MEDICATIONS PRESCRIBED', margin, y);
  y += 6;

  const medTableData = prescription.medications.map((med: any, idx: number) => [
    idx + 1,
    `${med.medicineName} ${med.genericName ? `(${med.genericName})` : ''}`,
    med.strength,
    `${med.dosage} ${med.dosageForm}`,
    med.frequency,
    med.duration,
    med.quantity,
    med.instructions || '-',
    med.isLifetime ? 'Lifetime' : med.durationType
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Medicine', 'Strength', 'Dosage', 'Frequency', 'Duration', 'Qty', 'Instructions', 'Type']],
    body: medTableData,
    theme: 'striped',
    headStyles: { fillColor: [19, 99, 75], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 30 },
      8: { cellWidth: 18, halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Tests
  if (prescription.tests && prescription.tests.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('INVESTIGATIONS / TESTS', margin, y);
    y += 6;

    const testData = prescription.tests.map((t: any, idx: number) => [
      idx + 1,
      t.testName,
      t.instructions || '-',
      t.isUrgent ? 'Yes' : 'No'
    ]);

    doc.autoTable({
      startY: y,
      head: [['#', 'Test', 'Instructions', 'Urgent']],
      body: testData,
      theme: 'striped',
      headStyles: { fillColor: [19, 99, 75], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 70 }, 3: { cellWidth: 20, halign: 'center' } },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Follow-ups
  if (prescription.followUps && prescription.followUps.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 99, 75);
    doc.text('FOLLOW-UP SCHEDULE', margin, y);
    y += 6;

    const fuData = prescription.followUps.map((fu: any, idx: number) => [
      idx + 1,
      fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString('en-IN') : fu.frequency,
      fu.frequency,
      fu.notes || '-'
    ]);

    doc.autoTable({
      startY: y,
      head: [['#', 'Date', 'Frequency', 'Notes']],
      body: fuData,
      theme: 'striped',
      headStyles: { fillColor: [19, 99, 75], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 80 } },
      margin: { left: margin, right: margin }
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('This is a computer-generated e-prescription. Valid without signature when digitally verified.', pageWidth / 2, 285, { align: 'center' });
  doc.text(`Ref: ${prescription.referenceNumber} | Generated: ${new Date(prescription.generatedAt).toLocaleString()}`, pageWidth / 2, 292, { align: 'center' });

  return doc;
}

// Helper functions
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}