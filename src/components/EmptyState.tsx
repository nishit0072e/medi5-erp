import React from 'react';
import { PackageSearch, RotateCcw } from 'lucide-react';

interface EmptyStateProps {
  searchQuery: string;
  hasActiveFilters: boolean;
  onReset: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchQuery,
  hasActiveFilters,
  onReset
}) => {
  return (
    <div className="empty-state">
      <PackageSearch className="empty-state-icon" />
      <h3>No Medicines Found</h3>
      <p>
        {searchQuery ? (
          <>No medicine matches &ldquo;<strong>{searchQuery}</strong>&rdquo; with current filter criteria.</>
        ) : (
          <>No medicines match the selected filter conditions.</>
        )}
      </p>
      {hasActiveFilters && (
        <button className="empty-reset-btn" onClick={onReset} type="button">
          <RotateCcw size={14} />
          <span>Reset Search &amp; Filters</span>
        </button>
      )}
    </div>
  );
};
