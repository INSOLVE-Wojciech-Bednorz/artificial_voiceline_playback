import React, { useState, useEffect } from 'react';
import { useAppContext, VoiceLine } from '../utils/context/AppContext';
import { useConnectionContext } from '../utils/context/ConnectionContext';
import VoiceLineTable from './VoiceLineTable';
import SearchAndFilterBar from './SearchAndFilterBar';
import BulkActions from './BulkActions';
import EditVoiceLine from './EditVoiceLine';
import AddVoiceLineModal from './AddVoiceLineModal';
import LoadingState from './ui/LoadingState';
import ErrorState from './ui/ErrorState';
import ConnectionErrorState from './ui/ConnectionErrorState';
import EmptyState from './ui/EmptyState';

// Type for sort direction
type SortDirection = 'asc' | 'desc';

const VoiceLinesList: React.FC = () => {
  // Access context data
  const { 
    voiceLines,
    voiceLinesLoading,
    voiceLinesError,
    refreshVoiceLines
  } = useAppContext();
  
  // Access connection status
  const { isConnected, isChecking, lastError, lastChecked, diagnostics, retryCount, retryConnection, getDetailedDiagnostics } = useConnectionContext();

  // Local state
  const [filteredLines, setFilteredLines] = useState<VoiceLine[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [lineToEdit, setLineToEdit] = useState<{id: number, text: string, active: boolean} | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  
  // Sorting state (default: newest items first - id desc)
  const [sortField, setSortField] = useState<'id'>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle sorting
  const handleSort = (field: 'id') => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Apply filtering and sorting based on search, active status, and sort settings
  useEffect(() => {
    let result = [...voiceLines];

    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(line => 
        line.text.toLowerCase().includes(query) || 
        line.id.toString().includes(query)
      );
    }

    // Apply active status filter
    if (activeFilter === 'active') {
      result = result.filter(line => line.active);
    } else if (activeFilter === 'inactive') {
      result = result.filter(line => !line.active);
    }

    // Apply sorting
    if (sortField === 'id') {
      result.sort((a, b) => {
        return sortDirection === 'asc' 
          ? a.id - b.id 
          : b.id - a.id;
      });
    }

    setFilteredLines(result);
    
    // Update selections to only include items that are still visible
    setSelectedIds(prev => {
      const visibleIds = result.map(line => line.id);
      return prev.filter(id => visibleIds.includes(id));
    });
  }, [voiceLines, searchQuery, activeFilter, sortField, sortDirection]);

  // Update selectAll state when selectedIds or filteredLines change
  useEffect(() => {
    if (filteredLines.length === 0) {
      setSelectAll(false);
    } else {
      const allVisible = filteredLines.every(line => selectedIds.includes(line.id));
      setSelectAll(allVisible);
    }
  }, [selectedIds, filteredLines]);

  // Handle search input change
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Handle filter change
  const handleFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    setActiveFilter(filter);
  };

  // Handle "select all" checkbox
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setSelectAll(isChecked);
    
    if (isChecked) {
      // Select all visible lines
      setSelectedIds(filteredLines.map(line => line.id));
    } else {
      // Deselect all
      setSelectedIds([]);
    }
  };

  // Function to handle checkbox selection
  const handleToggleCheckbox = (lineId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const isChecked = event.target.checked;
    
    setSelectedIds(prev => {
      if (isChecked && !prev.includes(lineId)) {
        return [...prev, lineId];
      } else if (!isChecked && prev.includes(lineId)) {
        return prev.filter(id => id !== lineId);
      }
      return prev;
    });
  };

  // Handle edit button click
  const handleEdit = (lineId: number) => {
    // Find the voice line to edit
    const lineToEdit = voiceLines.find(line => line.id === lineId);
    if (lineToEdit) {
      setLineToEdit({
        id: lineToEdit.id,
        text: lineToEdit.text,
        active: lineToEdit.active
      });
      setEditModalOpen(true);
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedIds([]);
    setSelectAll(false);
  };

  // Show loading state
  if (voiceLinesLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-2 h-full flex flex-col">
        <LoadingState title="Linie głosowe" subtitle="Ładowanie linii głosowych..." />
      </div>
    );
  }

  // Show backend connection error state
  if (!isConnected && !isChecking) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-2 h-full flex flex-col">
        <ConnectionErrorState 
          onRetry={async () => {
            const connected = await retryConnection();
            if (connected) {
              refreshVoiceLines();
            }
          }}
          lastError={lastError}
          lastChecked={lastChecked}
          diagnostics={diagnostics}
          retryCount={retryCount}
          onGetDetailedDiagnostics={getDetailedDiagnostics}
        />
      </div>
    );
  }
  
  // Show other error states (when connected but other errors occur)
  if (voiceLinesError && isConnected) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-2 h-full flex flex-col">
        <ErrorState 
          title="Błąd" 
          message={voiceLinesError} 
          onRetry={() => refreshVoiceLines()} 
        />
      </div>
    );
  }

  // Show empty state if no voice lines
  if (voiceLines.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-2 h-full flex flex-col">
        <EmptyState 
          title="Brak linii głosowych" 
          message="Nie znaleziono żadnych linii głosowych." 
          onAddNew={() => setAddModalOpen(true)}
          onRefresh={() => refreshVoiceLines()}
        />
        <AddVoiceLineModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onVoiceLineAdded={() => {
            refreshVoiceLines();
            setAddModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-2 h-full flex flex-col">
      <div className="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
        <div className="flex flex-col">
          <div className="-m-1.5 overflow-x-auto">
            <div className="p-1.5 min-w-full inline-block align-middle">
              <div className="bg-white/80 backdrop-blur-md border border-gray-200/60 rounded-xl shadow-xl shadow-gray-200/40 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-gray-200/50 animate-slideIn">
                {/* Header Section */}
                <div className="px-6 py-6 bg-gradient-to-r from-gray-50/80 to-blue-50/60 border-b border-gray-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">Linie głosowe</h1>
                      <p className="text-sm text-gray-600">Zarządzaj liniami głosowymi dla swojego systemu.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-500">
                        <span className="font-medium text-gray-700">{filteredLines.length}</span> wyników
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search and Filter Bar */}
                <SearchAndFilterBar 
                  onSearch={handleSearch}
                  onFilter={handleFilterChange}
                  activeFilter={activeFilter}
                  onAddClick={() => setAddModalOpen(true)}
                />

                {/* Bulk Actions */}
                <div className="px-6 py-3 border-t border-gray-200/60 bg-gray-50/30">
                  <BulkActions 
                    selectedIds={selectedIds} 
                    onActionComplete={() => {
                      refreshVoiceLines();
                      handleClearSelection();
                    }}
                    onClearSelection={handleClearSelection} 
                  />
                </div>

                {/* Voice Lines Table */}
                <VoiceLineTable
                  lines={filteredLines}
                  selectedIds={selectedIds}
                  selectAll={selectAll}
                  onSelectAll={handleSelectAll}
                  onToggleSelect={handleToggleCheckbox}
                  onEdit={handleEdit}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {lineToEdit && (
        <EditVoiceLine
          lineId={lineToEdit.id}
          currentText={lineToEdit.text}
          isActive={lineToEdit.active}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setLineToEdit(null);
          }}
          onVoiceLineUpdated={() => refreshVoiceLines()}
        />
      )}

      {/* Add Modal */}
      <AddVoiceLineModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onVoiceLineAdded={() => {
          refreshVoiceLines();
          setAddModalOpen(false);
        }}
      />
    </div>
  );
};

export default VoiceLinesList;