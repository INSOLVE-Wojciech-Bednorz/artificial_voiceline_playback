import React, { useState, useEffect, useRef } from 'react';
import { useAppContext, VoiceLine } from '../lib/context/AppContext';
import VoiceLineTable from './VoiceLineTable';
import SearchAndFilterBar from './SearchAndFilterBar';
import BulkActions from './BulkActions';
import EditVoiceLine from './EditVoiceLine';
import AddVoiceLineModal from './AddVoiceLineModal';
import LoadingState from './ui/LoadingState';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';

const VoiceLinesList: React.FC = () => {
  // Access context data
  const { 
    voiceLines,
    voiceLinesLoading,
    voiceLinesError,
    refreshVoiceLines
  } = useAppContext();

  // Local state
  const [filteredLines, setFilteredLines] = useState<VoiceLine[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [lineToEdit, setLineToEdit] = useState<{id: number, text: string, active: boolean} | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  // Apply filtering based on search and active status
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

    setFilteredLines(result);
  }, [voiceLines, searchQuery, activeFilter]);

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

  // Show error state
  if (voiceLinesError) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-2 h-full flex flex-col">
        <ErrorState 
          title="Błąd połączenia" 
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
                {/* Search and Filter Bar */}
                <SearchAndFilterBar 
                  onSearch={handleSearch}
                  onFilter={handleFilterChange}
                  activeFilter={activeFilter}
                  onAddClick={() => setAddModalOpen(true)}
                />

                {/* Bulk Actions moved to the top */}
                {selectedIds.length > 0 && (
                  <div className="px-6 py-3 border-t border-gray-200">
                    <BulkActions 
                      selectedIds={selectedIds} 
                      onActionComplete={() => {
                        refreshVoiceLines();
                        handleClearSelection();
                      }}
                      onClearSelection={handleClearSelection} 
                    />
                  </div>
                )}

                {/* Voice Lines Table */}
                <VoiceLineTable
                  lines={filteredLines}
                  selectedIds={selectedIds}
                  selectAll={selectAll}
                  onSelectAll={handleSelectAll}
                  onToggleSelect={handleToggleCheckbox}
                  onEdit={handleEdit}
                />

                {/* Table Footer */}
                <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{filteredLines.length}</span> wyników
                    </p>
                  </div>
                </div>
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