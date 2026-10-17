import React from 'react';
import { Search, X } from 'lucide-react';
import { StockFilter, ExpiryFilter } from '../types/inventory';

interface ControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (filter: StockFilter) => void;
  expiryFilter: ExpiryFilter;
  onExpiryFilterChange: (filter: ExpiryFilter) => void;
  counts: {
    all: number;
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    expired: number;
  };
}

export const Controls: React.FC<ControlsProps> = ({
  searchQuery,
  onSearchChange,
  stockFilter,
  onStockFilterChange,
  expiryFilter,
  onExpiryFilterChange,
  counts
}) => {
  return (
    <div className="controls-section">
      <div className="search-input-wrapper">
        <Search className="search-icon" size={17} />
        <input
          type="text"
          className="search-input"
          placeholder="Search medicine, generic name, or batch..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search Inventory"
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            title="Clear search"
            type="button"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="filter-scroll-wrapper" role="tablist" aria-label="Inventory Filters">
        <button
          className={`filter-chip ${stockFilter === 'ALL' && expiryFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            onStockFilterChange('ALL');
            onExpiryFilterChange('ALL');
          }}
          type="button"
        >
          All Items
          <span className="filter-count">{counts.all}</span>
        </button>

        <button
          className={`filter-chip ${stockFilter === 'LOW_STOCK' ? 'active' : ''}`}
          onClick={() => {
            onStockFilterChange(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK');
            if (stockFilter !== 'LOW_STOCK') onExpiryFilterChange('ALL');
          }}
          type="button"
        >
          Low Stock
          <span className="filter-count">{counts.lowStock}</span>
        </button>

        <button
          className={`filter-chip ${expiryFilter === 'EXPIRING_SOON' ? 'active' : ''}`}
          onClick={() => {
            onExpiryFilterChange(expiryFilter === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON');
            if (expiryFilter !== 'EXPIRING_SOON') onStockFilterChange('ALL');
          }}
          type="button"
        >
          Expiring &lt;60d
          <span className="filter-count">{counts.expiringSoon}</span>
        </button>

        <button
          className={`filter-chip ${expiryFilter === 'EXPIRED' ? 'active' : ''}`}
          onClick={() => {
            onExpiryFilterChange(expiryFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED');
            if (expiryFilter !== 'EXPIRED') onStockFilterChange('ALL');
          }}
          type="button"
        >
          Expired
          <span className="filter-count">{counts.expired}</span>
        </button>

        <button
          className={`filter-chip ${stockFilter === 'OUT_OF_STOCK' ? 'active' : ''}`}
          onClick={() => {
            onStockFilterChange(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK');
            if (stockFilter !== 'OUT_OF_STOCK') onExpiryFilterChange('ALL');
          }}
          type="button"
        >
          Out of Stock
          <span className="filter-count">{counts.outOfStock}</span>
        </button>
      </div>
    </div>
  );
};
