import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { KpiSummary } from './components/KpiSummary';
import { Controls } from './components/Controls';
import { MedicineCard } from './components/MedicineCard';
import { EmptyState } from './components/EmptyState';
import { BottomNav } from './components/BottomNav';

import { MOCK_MEDICINES, MOCK_BATCHES } from './data/mockInventory';
import { calculateAllSummaries, calculateInventoryKpis } from './utils/inventoryCalculations';
import { StockFilter, ExpiryFilter } from './types/inventory';

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['med-dolo-650'])); // Expand first multi-batch medicine by default
  const [activeTab, setActiveTab] = useState<'inventory' | 'patients' | 'analytics' | 'settings'>('inventory');

  // Derive inventory summaries directly from batch data
  const allSummaries = useMemo(() => {
    return calculateAllSummaries(MOCK_MEDICINES, MOCK_BATCHES);
  }, []);

  // Calculate live aggregate KPIs
  const kpis = useMemo(() => {
    return calculateInventoryKpis(allSummaries);
  }, [allSummaries]);

  // Count pills for filters
  const filterCounts = useMemo(() => {
    return {
      all: allSummaries.length,
      lowStock: allSummaries.filter((s) => s.isLowStock).length,
      outOfStock: allSummaries.filter((s) => s.isOutOfStock).length,
      expiringSoon: allSummaries.filter((s) => s.hasExpiringSoonBatches).length,
      expired: allSummaries.filter((s) => s.hasExpiredBatches).length
    };
  }, [allSummaries]);

  // Filtered summaries based on search and selected filter pills
  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allSummaries.filter((summary) => {
      // 1. Text Search matching name, generic name, or individual batch numbers
      if (q) {
        const matchesName = summary.medicine.name.toLowerCase().includes(q);
        const matchesGeneric = summary.medicine.genericName.toLowerCase().includes(q);
        const matchesBatch = summary.batches.some((b) => b.batchNumber.toLowerCase().includes(q));
        const matchesCategory = summary.medicine.category.toLowerCase().includes(q);

        if (!matchesName && !matchesGeneric && !matchesBatch && !matchesCategory) {
          return false;
        }
      }

      // 2. Stock level filter
      if (stockFilter === 'IN_STOCK' && (summary.isLowStock || summary.isOutOfStock)) {
        return false;
      }
      if (stockFilter === 'LOW_STOCK' && !summary.isLowStock) {
        return false;
      }
      if (stockFilter === 'OUT_OF_STOCK' && !summary.isOutOfStock) {
        return false;
      }

      // 3. Expiry status filter
      if (expiryFilter === 'EXPIRING_SOON' && !summary.hasExpiringSoonBatches) {
        return false;
      }
      if (expiryFilter === 'EXPIRED' && !summary.hasExpiredBatches) {
        return false;
      }
      if (expiryFilter === 'VALID' && (summary.hasExpiredBatches || summary.hasExpiringSoonBatches)) {
        return false;
      }

      return true;
    });
  }, [allSummaries, searchQuery, stockFilter, expiryFilter]);

  // Toggle card expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Reset all search and filter conditions
  const resetFilters = () => {
    setSearchQuery('');
    setStockFilter('ALL');
    setExpiryFilter('ALL');
  };

  // Handle KPI card clicks for quick filtering
  const handleKpiFilterClick = (filter: string) => {
    if (filter === 'ALL') {
      resetFilters();
    } else if (filter === 'LOW_STOCK') {
      setStockFilter('LOW_STOCK');
      setExpiryFilter('ALL');
    } else if (filter === 'EXPIRING') {
      if (filterCounts.expired > 0) {
        setExpiryFilter('EXPIRED');
      } else {
        setExpiryFilter('EXPIRING_SOON');
      }
      setStockFilter('ALL');
    }
  };

  return (
    <div className="app-container">
      {/* Brand Header & Active Tenant Context */}
      <Header pharmacyName="Nandan Pharmacy" location="Kolkata, WB" />

      {/* Aggregate KPI Overview */}
      <KpiSummary 
        kpis={kpis} 
        activeFilter={stockFilter}
        onFilterClick={handleKpiFilterClick}
      />

      {/* Search Input & Filter Pills */}
      <Controls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        expiryFilter={expiryFilter}
        onExpiryFilterChange={setExpiryFilter}
        counts={filterCounts}
      />

      {/* Medicine & Batch Ledger */}
      <main className="inventory-list-section" role="region" aria-label="Medicine Inventory List">
        {filteredSummaries.length > 0 ? (
          filteredSummaries.map((summary) => (
            <MedicineCard
              key={summary.medicine.id}
              summary={summary}
              isExpanded={expandedIds.has(summary.medicine.id)}
              onToggleExpand={() => toggleExpand(summary.medicine.id)}
            />
          ))
        ) : (
          <EmptyState
            searchQuery={searchQuery}
            hasActiveFilters={Boolean(searchQuery || stockFilter !== 'ALL' || expiryFilter !== 'ALL')}
            onReset={resetFilters}
          />
        )}
      </main>

      {/* 4-Tab Bottom Navigation */}
      <BottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        inventoryCount={filteredSummaries.length}
      />
    </div>
  );
};

export default App;
