# Medi5 ERP — Smart Pharmacy Assistant & Mobile ERP

Mobile-first, multi-tenant pharmacy ERP SaaS for inventory, batch expiry tracking, sales, patient reminders, and pharmacy analytics.

Designed initially for independent retail pharmacies in West Bengal, India.

---

## 1. Foundational Documents (Single Source of Truth)

- [PRD.md](file:///g:/ERP/PRD.md) — Product requirements, core workflows, and module definitions.
- [ARCHITECTURE.md](file:///g:/ERP/ARCHITECTURE.md) — System architecture, multi-tenant isolation model, domain schema, and security boundaries.
- [AI_RULES.md](file:///g:/ERP/AI_RULES.md) — Collaborative engineering guidelines and rules of engagement for human and AI contributors.
- [QA_CHECKLIST.md](file:///g:/ERP/QA_CHECKLIST.md) — Verification criteria, multi-tenant isolation tests, and release gates.
- [PARALLEL_REVIEW_PLAN.md](file:///g:/ERP/PARALLEL_REVIEW_PLAN.md) — Multi-agent foundation audit and coordination plan.

---

## 2. Current Status: Stage 1 Runnable Inventory Prototype

This repository contains the first runnable, debuggable frontend prototype of Medi5.

### Key Capabilities in this Prototype:
- **Strict Separation of Master vs. Physical Batches:** Medicine master data does not store static quantities. Medicine-level totals are dynamically computed from underlying batches.
- **Expiry Exclusions:** Expired batches (past the calendar boundary) are visually highlighted and strictly excluded from saleable stock calculations.
- **FEFO (First-Expired, First-Out) Display:** Identifies and prioritizes the earliest expiring valid batch for upcoming dispensing.
- **Expiry Convention:** If only Month/Year is provided (e.g. `YYYY-MM`), the expiry boundary is treated as the final calendar day of that month at 23:59:59.
- **Mobile-First UX:** Android smartphone layout (360px–412px viewport target) featuring custom Medi5 theme palette (`#13634B` primary green, `#DFECE6` light sage, `#FFFFFF` cards, `#D0E6DF` mint accents), safe-area spacing, and touch-friendly controls.
- **Isolated Synthetic Data:** Runs 100% offline using synthetic mock data. Requires no live Supabase database or secret keys.

---

## 3. Getting Started & Local Development

### Prerequisites
- Node.js (v20+ LTS recommended, tested on v22.20.0)
- npm (v10+, tested on v11.8.0)

> **Windows PowerShell Note:** If PowerShell blocks script execution (`npm.ps1`), use `npm.cmd` explicitly or launch in a standard command prompt.

### Installation
```bash
# Clone the repository (if not already cloned)
git clone https://github.com/nishit0072e/medi5-erp.git
cd medi5-erp

# Install dependencies (using npm.cmd on Windows)
npm.cmd install
```

### Running Locally
```bash
# Start Vite development server
npm.cmd run dev
```
Open `http://localhost:3000` in your mobile device emulator or browser.

### Type-Checking & Production Build
```bash
# Run TypeScript static check
npm.cmd run typecheck

# Build optimized production bundle
npm.cmd run build

# Preview production build locally
npm.cmd run preview
```

---

## 4. Environment Variables

A template `.env.example` is provided:
```bash
cp .env.example .env
```
In demo prototype mode, no actual API keys are required.
