import React from 'react';
import { VoiceLine } from '../utils/context/AppContext';
import StatusBadge from './ui/StatusBadge';

interface VoiceLineTableProps {
  lines: VoiceLine[];
  selectedIds: number[];
  selectAll: boolean;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSelect: (lineId: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onEdit: (lineId: number) => void;
  sortField?: 'id';
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: 'id') => void;
}

const VoiceLineTable: React.FC<VoiceLineTableProps> = ({
  lines,
  selectedIds,
  selectAll,
  onSelectAll,
  onToggleSelect,
  onEdit,
  sortField = 'id',
  sortDirection = 'desc',
  onSort
}) => {

  if (lines.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="text-gray-400 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </div>
        <h3 className="text-xl font-medium text-gray-700 mb-2">Brak linii głosowych</h3>
        <p className="text-gray-500 mb-6">Nie znaleziono żadnych linii głosowych do wyświetlenia.</p>
      </div>
    );
  }

  // Function to render sort indicator
  const renderSortIndicator = (field: 'id') => {
    if (sortField !== field) return null;
    
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="inline" viewBox="0 0 16 16">
            <path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="inline" viewBox="0 0 16 16">
            <path d="M7.646 11.854a.5.5 0 0 0 .708 0l6-6a.5.5 0 0 0-.708-.708L8 10.793 2.354 5.146a.5.5 0 1 0-.708.708l6 6z"/>
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200/60 table-fixed">
        <colgroup>
          <col className="w-12" />
          <col className="w-16" />
          <col className="w-[65%]" />
          <col className="w-28" />
          <col className="w-20" />
        </colgroup>
        <thead className="bg-gradient-to-r from-gray-50/80 to-blue-50/40">
          <tr>
            <th scope="col" className="ps-6 py-3 text-start">
              <label htmlFor="select-all-checkbox" className="flex">
                <input 
                  type="checkbox" 
                  className="shrink-0 border-gray-300/60 rounded text-blue-600 focus:ring-blue-500/20 focus:ring-2 checked:border-blue-500 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200" 
                  id="select-all-checkbox" 
                  checked={selectAll}
                  onChange={onSelectAll}
                />
                <span className="sr-only">Select all</span>
              </label>
            </th>

            <th 
              scope="col" 
              className="ps-6 lg:ps-3 xl:ps-0 pe-6 py-3 text-start cursor-pointer hover:bg-gray-100/50 transition-colors duration-150 rounded-lg"
              onClick={() => onSort && onSort('id')}
            >
              <div className="flex items-center gap-x-2">
                <span className="text-xs font-semibold uppercase text-gray-800">
                  ID {renderSortIndicator('id')}
                </span>
              </div>
            </th>

            <th scope="col" className="px-6 py-3 text-start">
              <div className="flex items-center gap-x-2">
                <span className="text-xs font-semibold uppercase text-gray-800">
                  Tekst
                </span>
              </div>
            </th>

            <th scope="col" className="px-6 py-3 text-start">
              <div className="flex items-center gap-x-2">
                <span className="text-xs font-semibold uppercase text-gray-800">
                  Status
                </span>
              </div>
            </th>

            <th scope="col" className="px-6 py-3 text-end"></th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200/60 bg-white/50">
          {lines.map((line, index) => (
            <tr key={line.id} className="hover:bg-blue-50/30 hover:shadow-sm group transition-all duration-200 border-l-4 border-transparent hover:border-blue-400/30">
              <td className="whitespace-nowrap">
                <div className="ps-6 py-3">
                  <label htmlFor={`checkbox-${line.id}`} className="flex cursor-pointer">
                    <input 
                      id={`checkbox-${line.id}`}
                      type="checkbox"
                      checked={selectedIds.includes(line.id)}
                      onChange={(e) => onToggleSelect(line.id, e)}
                      className="shrink-0 border-gray-300/60 rounded text-blue-600 focus:ring-blue-500/20 focus:ring-2 checked:border-blue-500 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all duration-200"
                    />
                    <span className="sr-only">Checkbox</span>
                  </label>
                </div>
              </td>
              
              <td className="whitespace-nowrap">
                <div 
                  className="ps-6 lg:ps-3 xl:ps-0 pe-6 py-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle the checkbox for this line
                    const checkbox = document.getElementById(`checkbox-${line.id}`) as HTMLInputElement;
                    if (checkbox) {
                      checkbox.checked = !checkbox.checked;
                      const event = new Event('change', { bubbles: true });
                      checkbox.dispatchEvent(event);
                    }
                  }}
                >
                  <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors duration-200">{line.id}</span>
                </div>
              </td>
              
              <td>
                <div className="px-6 py-3">
                  <div className="group-hover:line-clamp-none line-clamp-2 text-sm text-gray-800 break-words leading-relaxed">
                    {line.text}
                  </div>
                </div>
              </td>
              
              <td className="whitespace-nowrap">
                <div className="px-6 py-3">
                  <StatusBadge active={line.active} />
                </div>
              </td>
              
              <td className="whitespace-nowrap text-right">
                <div className="px-6 py-1.5">
                  <button 
                    className="inline-flex items-center gap-x-1 text-sm text-blue-600 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium cursor-pointer hover:text-blue-700 transition-colors duration-200 px-2 py-1 rounded hover:bg-blue-50/50" 
                    onClick={() => onEdit(line.id)}
                  >
                    Edytuj
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VoiceLineTable;