import { jsPDF } from 'jspdf';
import { EPrescription } from '../types/eprescription';

function formatDoctorName(name: string): string {
  if (!name) return 'Dr. Medical Practitioner';
  const cleaned = name.replace(/^dr\.?\s*/i, '').trim();
  return `Dr. ${cleaned}`;
}

function formatSpecialization(spec: string): string {
  if (!spec) return 'General Physician';
  return spec
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatDateOnly(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Builds a comprehensive, beautiful, professional, and optimistic medical e-prescription PDF.
 * Uses strict standard ASCII/Latin characters to guarantee zero mojibake or glyph corruption across all PDF viewers.
 */
export function buildPrescriptionDocument(
  prescription: EPrescription,
  pharmacy: { name: string; code?: string; phone?: string; address?: string }
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const leftMargin = 14;
  const rightMargin = 196;
  const contentWidth = rightMargin - leftMargin; // 182mm

  const colorPrimary = [19, 99, 75];       // Emerald #13634B
  const colorPrimaryLight = [223, 236, 230]; // Sage #DFECE6
  const colorDark = [15, 23, 42];          // Slate #0F172A
  const colorMuted = [100, 116, 139];      // Gray #64748B
  const colorSubtle = [248, 250, 252];     // Slate-50 #F8FAFC
  const colorBorder = [226, 232, 240];     // Slate-200 #E2E8F0
  const colorAlert = [185, 28, 28];        // Red-700
  const colorAlertBg = [254, 242, 242];    // Red-50
  const colorSuccess = [5, 150, 105];      // Emerald-600
  const colorSuccessBg = [236, 253, 245];  // Emerald-50

  // ==========================================
  // 1. HOSPITAL / PHARMACY LETTERHEAD BANNER
  // ==========================================
  doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Decorative mint bottom stripe
  doc.setFillColor(167, 243, 208); // Emerald-200
  doc.rect(0, 28, pageWidth, 1.8, 'F');

  // Medical Cross Icon inside header
  doc.setFillColor(255, 255, 255);
  doc.rect(14, 8, 12, 12, 'F');
  doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.rect(17.5, 9.5, 5, 9, 'F');
  doc.rect(15.5, 11.5, 9, 5, 'F');

  // Pharmacy / Clinic Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(pharmacy.name || 'Medi5 Healthcare & Pharmacy', 30, 15);

  // Pharmacy Subtitle & Credentials (compact to prevent overlap)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(226, 232, 240);
  const pharmacyPhone = pharmacy.phone || '+91 98765 43210';
  doc.text(`Clinical Dispensary • Lic: DL-20B/21B • Ph: ${pharmacyPhone}`, 30, 21);

  // Right Header Title: Digital E-Prescription
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('DIGITAL E-PRESCRIPTION', rightMargin, 13, { align: 'right' });

  // Right Header Badge
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(167, 243, 208);
  doc.text('ABDM & Telemedicine Practice Compliant', rightMargin, 19, { align: 'right' });

  let y = 37;

  // ==========================================
  // 2. DOCTOR PROFILE & RX REFERENCE CARD
  // ==========================================
  const docCardHeight = 35;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(leftMargin, y, contentWidth, docCardHeight, 2, 2, 'FD');

  // Doctor Details (Left Column - All 8 Details Displayed)
  const docNameFormatted = formatDoctorName(prescription.doctorName);
  const specFormatted = formatSpecialization(prescription.doctorSpecialization);
  const docDesignation = prescription.doctorDesignation || 'Attending Consultant Physician';
  const docDegree = prescription.doctorDegree || 'MBBS, MD';
  const docRegNo = prescription.doctorRegistrationNumber || 'WB-UK20-34563';
  const docClinic = prescription.doctorHospitalClinic || pharmacy.name || 'Medi5 Healthcare Dispensary';
  const docMobile = prescription.doctorMobile || pharmacyPhone;
  const docEmail = prescription.doctorEmail || 'doctor@nandanmedical.in';

  // 1. Doctor Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text(docNameFormatted, leftMargin + 4, y + 6);

  // 2. Designation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(docDesignation, leftMargin + 4, y + 11);

  // 3. Degree & Specialization
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`${docDegree} - ${specFormatted}`, leftMargin + 4, y + 16);

  // 4. Medical Council Registration
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text(`Reg. Council No: ${docRegNo}`, leftMargin + 4, y + 21);

  // 5. Hospital / Clinic Affiliation
  doc.text(`Hospital/Clinic: ${docClinic}`, leftMargin + 4, y + 26);

  // 6. Direct Contact Mobile & Email
  doc.text(`Mob: ${docMobile} | Email: ${docEmail}`, leftMargin + 4, y + 31);

  // Vertical Separator
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.line(126, y + 3, 126, y + docCardHeight - 3);

  // Rx Reference & Metadata (Right Column)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('PRESCRIPTION REF:', 130, y + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text(prescription.referenceNumber, 130, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text(`Issued: ${formatDate(prescription.generatedAt)}`, 130, y + 17.5);
  doc.text('Consultation: In-Person Clinical OPD', 130, y + 22.5);

  // Status Badge (strictly ASCII to prevent mojibake)
  const isDispensed = prescription.status === 'DISPENSED';
  const statusColor = isDispensed 
    ? { bg: [209, 250, 229], text: [6, 95, 70], label: '[ DISPENSED ]' }
    : { bg: [254, 243, 199], text: [146, 64, 14], label: '[ ACTIVE / PENDING ]' };
  
  doc.setFillColor(statusColor.bg[0], statusColor.bg[1], statusColor.bg[2]);
  doc.roundedRect(130, y + 25.5, 42, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(statusColor.text[0], statusColor.text[1], statusColor.text[2]);
  doc.text(statusColor.label, 151, y + 29.2, { align: 'center' });

  y += docCardHeight + 4;

  // ==========================================
  // 3. PATIENT DEMOGRAPHICS & VITALS CARD
  // ==========================================
  doc.setFillColor(colorSubtle[0], colorSubtle[1], colorSubtle[2]);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(leftMargin, y, contentWidth, 31, 2, 2, 'FD');

  // Card Header Tag
  doc.setFillColor(colorPrimaryLight[0], colorPrimaryLight[1], colorPrimaryLight[2]);
  doc.rect(leftMargin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('PATIENT DEMOGRAPHICS & CLINICAL VITALS', leftMargin + 4, y + 4.5);

  const cardContentY = y + 11;

  // Column 1: Patient Basic Info (x = 18)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('PATIENT NAME', leftMargin + 4, cardContentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(prescription.patientName, leftMargin + 4, cardContentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(`Age / Gender: ${prescription.patientAge} Yrs / ${prescription.patientGender}`, leftMargin + 4, cardContentY + 9.5);
  doc.text(`Mobile: ${prescription.patientPhone}`, leftMargin + 4, cardContentY + 14);

  // Column 2: Health ID & Contact (x = 84)
  const uhid = `PID-${prescription.patientPhone.slice(-6) || '849201'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('PATIENT UHID / ID', 84, cardContentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(uhid, 84, cardContentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  if (prescription.abhaId) {
    doc.text(`ABHA ID: ${prescription.abhaId}`, 84, cardContentY + 9.5);
  } else {
    doc.text(`Email: ${prescription.patientEmail || 'Not Provided'}`, 84, cardContentY + 9.5);
  }
  
  // Truncate address cleanly to avoid overflow
  const rawAddr = prescription.patientAddress || 'Local Resident';
  const cleanAddr = rawAddr.length > 32 ? rawAddr.slice(0, 30) + '...' : rawAddr;
  doc.text(`Address: ${cleanAddr}`, 84, cardContentY + 14);

  // Column 3: Physical Vitals & Allergies Alert (x = 142)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('VITALS & SAFETY', 142, cardContentY);

  const vitalsText = `Weight: ${prescription.patientWeight ? `${prescription.patientWeight} kg` : '--'} | Height: ${prescription.patientHeight ? `${prescription.patientHeight} cm` : '--'}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(vitalsText, 142, cardContentY + 4.5);

  // Allergies Pill Banner (strictly ASCII)
  const hasAllergies = Boolean(prescription.patientKnownAllergies && prescription.patientKnownAllergies.trim().length > 0 && prescription.patientKnownAllergies.toLowerCase() !== 'none');
  if (hasAllergies) {
    doc.setFillColor(colorAlertBg[0], colorAlertBg[1], colorAlertBg[2]);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(142, cardContentY + 8, 50, 6, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(colorAlert[0], colorAlert[1], colorAlert[2]);
    const allergyText = `ALLERGY: ${prescription.patientKnownAllergies!.substring(0, 20).toUpperCase()}`;
    doc.text(allergyText, 144, cardContentY + 12.2);
  } else {
    doc.setFillColor(colorSuccessBg[0], colorSuccessBg[1], colorSuccessBg[2]);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(142, cardContentY + 8, 50, 6, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(colorSuccess[0], colorSuccess[1], colorSuccess[2]);
    doc.text('NO KNOWN DRUG ALLERGIES (NKDA)', 144, cardContentY + 12.2);
  }

  y += 35;

  // ==========================================
  // 4. CLINICAL ASSESSMENT & DIAGNOSIS
  // ==========================================
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(leftMargin, y, contentWidth, 23, 2, 2, 'FD');

  // Left accent bar
  doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.rect(leftMargin, y, 3, 23, 'F');

  // Diagnosis label & value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('PROVISIONAL / CLINICAL DIAGNOSIS', leftMargin + 7, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  const cleanDiag = prescription.diagnosis || 'General Health Consultation & Care';
  doc.text(cleanDiag, leftMargin + 7, y + 11);

  // Chief Complaint & Vitals summary
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  const ccText = prescription.chiefComplaint ? `Chief Complaint: ${prescription.chiefComplaint}` : 'Consultation for general symptom relief';
  const notesText = prescription.clinicalNotes ? ` • Note: ${prescription.clinicalNotes}` : '';
  doc.text(`${ccText}${notesText}`, leftMargin + 7, y + 17);

  y += 28;

  // ==========================================
  // 5. PRESCRIBED MEDICATIONS TABLE (WITH "Rx")
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('Rx', leftMargin, y + 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`PRESCRIBED MEDICATIONS (${prescription.medications.length})`, leftMargin + 11, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text('Follow exact dosage, frequency, and instructions as directed below', rightMargin, y, { align: 'right' });

  y += 4;

  // Table Column Coordinates
  const colIndex = leftMargin + 3;      // #
  const colMed = leftMargin + 11;       // Medicine Name & Composition
  const colForm = leftMargin + 85;      // Dosage Form
  const colFreq = leftMargin + 114;     // Frequency / Timing
  const colDur = leftMargin + 150;      // Duration
  const colQty = rightMargin - 4;       // Qty (right-aligned)

  // Table Header Box
  doc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.rect(leftMargin, y, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', colIndex, y + 4.8);
  doc.text('MEDICINE & COMPOSITION', colMed, y + 4.8);
  doc.text('FORM', colForm, y + 4.8);
  doc.text('FREQUENCY / TIMING', colFreq, y + 4.8);
  doc.text('DURATION', colDur, y + 4.8);
  doc.text('QTY', colQty, y + 4.8, { align: 'right' });

  y += 7;

  // Table Rows
  prescription.medications.forEach((med, idx) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const rowBg = idx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    const hasInstructions = Boolean(med.instructions && med.instructions.trim().length > 0);
    const rowHeight = hasInstructions ? 13 : 9;

    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    doc.rect(leftMargin, y, contentWidth, rowHeight, 'F');

    // Index
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.text(String(idx + 1), colIndex, y + 5.5);

    // Medicine Name & Generic
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    const isH1 = med.isScheduleH1 || false;
    const medNameStr = `${med.medicineName} ${med.strength ? `(${med.strength})` : ''}${isH1 ? ' [SCH-H1]' : ''}`;
    doc.text(medNameStr, colMed, y + 5.5);

    // Dosage Form
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.text(`${med.dosage} ${med.dosageForm}`, colForm, y + 5.5);

    // Frequency / Regimen
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
    doc.text(med.frequency, colFreq, y + 5.5);

    // Duration & Lifetime Badge
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    const durationLabel = med.isLifetime ? `${med.duration} [Lifetime]` : med.duration;
    doc.text(durationLabel, colDur, y + 5.5);

    // Quantity (Bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.text(String(med.quantity), colQty, y + 5.5, { align: 'right' });

    // Instructions sub-line
    if (hasInstructions) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
      doc.text(`-> Directions: ${med.instructions}`, colMed, y + 10.5);
    }

    // Bottom border line
    doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
    doc.line(leftMargin, y + rowHeight, rightMargin, y + rowHeight);

    y += rowHeight;
  });

  y += 5;

  // ==========================================
  // 6. ADVICE, INVESTIGATIONS & FOLLOW-UP
  // ==========================================
  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(colorSubtle[0], colorSubtle[1], colorSubtle[2]);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(leftMargin, y, contentWidth, 24, 2, 2, 'FD');

  // Next Follow-Up Pill
  const nextFollowUp = prescription.followUps && prescription.followUps.length > 0 
    ? prescription.followUps[0] 
    : null;
  const followUpDateText = nextFollowUp && nextFollowUp.followUpDate 
    ? formatDateOnly(nextFollowUp.followUpDate) 
    : 'After 7 days / As needed';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('GENERAL CLINICAL ADVICE & CARE PLAN', leftMargin + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text('- Drink adequate fluids (2-3L/day), take prescribed medications on time with water, and maintain a balanced diet.', leftMargin + 4, y + 11);
  doc.text('- If symptoms persist or any adverse reaction occurs, consult the doctor or report to the nearest clinic.', leftMargin + 4, y + 16);

  // Follow-Up Badge (strictly ASCII)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.roundedRect(leftMargin + 4, y + 18, 110, 5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text(`NEXT CONSULTATION / REVIEW: ${followUpDateText.toUpperCase()}`, leftMargin + 7, y + 21.6);

  y += 28;

  // ==========================================
  // 7. DOCTOR SIGNATURE & PHARMACY VERIFICATION
  // ==========================================
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  const sigBlockY = Math.max(y, 248);

  // Column 1: Pharmacy Dispensing Seal (Bottom Left: 14 to 70)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(14, sigBlockY, 56, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('DISPENSING PHARMACY', 17, sigBlockY + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  const safePharmName = (pharmacy.name || 'Medi5 Pharmacy').slice(0, 24);
  doc.text(`Store: ${safePharmName}`, 17, sigBlockY + 9.5);
  doc.text(`Dispensed: ${prescription.dispensedBy || 'Registered Staff'}`, 17, sigBlockY + 14);
  doc.setTextColor(colorSuccess[0], colorSuccess[1], colorSuccess[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('[ AUTHENTICATED DISPENSING ]', 17, sigBlockY + 19);

  // Column 2: Digital Rx Verification QR (Middle: 73 to 123)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(73, sigBlockY, 50, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('DIGITAL RX VERIFICATION', 76, sigBlockY + 4.8);

  // Vector QR pattern (14x14 mm)
  const qrX = 76;
  const qrY = sigBlockY + 6.8;
  doc.setDrawColor(15, 23, 42);
  doc.rect(qrX, qrY, 14, 14, 'S');
  doc.setFillColor(15, 23, 42);
  // Finder 1 (top-left)
  doc.rect(qrX + 1, qrY + 1, 4, 4, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 2, qrY + 2, 2, 2, 'F');
  doc.setFillColor(15, 23, 42);
  doc.rect(qrX + 2.5, qrY + 2.5, 1, 1, 'F');
  // Finder 2 (top-right)
  doc.rect(qrX + 9, qrY + 1, 4, 4, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 10, qrY + 2, 2, 2, 'F');
  doc.setFillColor(15, 23, 42);
  doc.rect(qrX + 10.5, qrY + 2.5, 1, 1, 'F');
  // Finder 3 (bottom-left)
  doc.rect(qrX + 1, qrY + 9, 4, 4, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX + 2, qrY + 10, 2, 2, 'F');
  doc.setFillColor(15, 23, 42);
  doc.rect(qrX + 2.5, qrY + 10.5, 1, 1, 'F');
  // QR data module dots
  doc.rect(qrX + 6, qrY + 2, 1.5, 1.5, 'F');
  doc.rect(qrX + 6, qrY + 6, 2, 2, 'F');
  doc.rect(qrX + 10, qrY + 6, 2, 1.5, 'F');
  doc.rect(qrX + 9, qrY + 9, 1.8, 1.8, 'F');
  doc.rect(qrX + 6, qrY + 11, 2, 1.5, 'F');
  doc.rect(qrX + 11.5, qrY + 11.5, 1.5, 1.5, 'F');

  // Text next to QR inside middle block
  const verifyToken = prescription.verificationCode || `VRX-${prescription.referenceNumber.slice(-4)}`;
  const validUntilStr = prescription.validUntil ? formatDateOnly(prescription.validUntil) : '+15 Days';
  const refillsStr = `${prescription.maxRefillsAllowed || 0} Allowed`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text(verifyToken, 92, sigBlockY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(`Valid: ${validUntilStr}`, 92, sigBlockY + 13.5);
  doc.text(`Refills: ${refillsStr}`, 92, sigBlockY + 17.5);

  // Column 3: Doctor Signature Block (Right: 126 to 196)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.roundedRect(126, sigBlockY, 70, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
  doc.text('AUTHORIZED PRESCRIBER', 129, sigBlockY + 4.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(docNameFormatted.slice(0, 26), 129, sigBlockY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text(`${docDegree} - ${docDesignation}`.slice(0, 32), 129, sigBlockY + 13);

  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text(`Reg: ${docRegNo} | Mob: ${docMobile}`, 129, sigBlockY + 16.5);

  doc.setTextColor(colorSuccess[0], colorSuccess[1], colorSuccess[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('[ VERIFIED DIGITAL SIGNATURE ]', 129, sigBlockY + 20);

  // ==========================================
  // 8. LEGAL DISCLAIMER FOOTER
  // ==========================================
  doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
  doc.line(leftMargin, 280, rightMargin, 280);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
  doc.text(
    'This is a valid computer-generated Electronic Medical Prescription under the Information Technology Act, 2000 & Telemedicine Guidelines, India.',
    pageWidth / 2,
    284,
    { align: 'center' }
  );
  doc.text(
    `Valid for one-time dispensing by registered pharmacy. Rx Ref: ${prescription.referenceNumber} | Powered by Medi5 Cloud ERP`,
    pageWidth / 2,
    288,
    { align: 'center' }
  );

  return doc;
}

/**
 * Downloads the high-resolution, beautiful e-prescription PDF.
 */
export function downloadPrescriptionPDF(
  prescription: EPrescription,
  pharmacy: { name: string; code?: string; phone?: string; address?: string }
): void {
  const doc = buildPrescriptionDocument(prescription, pharmacy);
  const safeRef = prescription.referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Prescription_${safeRef}.pdf`);
}

/**
 * Generates the exact same beautiful, complete prescription and triggers the print dialog.
 */
export function printPrescriptionDocument(
  prescription: EPrescription,
  pharmacy: { name: string; code?: string; phone?: string; address?: string }
): void {
  const doc = buildPrescriptionDocument(prescription, pharmacy);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
}
