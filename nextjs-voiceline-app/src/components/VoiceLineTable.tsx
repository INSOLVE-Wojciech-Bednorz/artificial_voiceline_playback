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
}

const VoiceLineTable: React.FC<VoiceLineTableProps> = ({
  lines,
  selectedIds,
  selectAll,
  onSelectAll,
  onToggleSelect,
  onEdit
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

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="ps-6 py-3 text-start">
            <label htmlFor="select-all-checkbox" className="flex">
              <input 
                type="checkbox" 
                className="shrink-0 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500 checked:border-blue-500 disabled:opacity-50 disabled:pointer-events-none" 
                id="select-all-checkbox" 
                checked={selectAll}
                onChange={onSelectAll}
              />
              <span className="sr-only">Select all</span>
            </label>
          </th>

          <th scope="col" className="ps-6 lg:ps-3 xl:ps-0 pe-6 py-3 text-start">
            <div className="flex items-center gap-x-2">
              <span className="text-xs font-semibold uppercase text-gray-800">
                ID
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

      <tbody className="divide-y divide-gray-200">
        {lines.map((line) => (
          <tr key={line.id} className="hover:bg-gray-50">
            <td className="size-px whitespace-nowrap">
              <div className="ps-6 py-3">
                <label htmlFor={`checkbox-${line.id}`} className="flex">
                  <input 
                    id={`checkbox-${line.id}`}
                    type="checkbox"
                    checked={selectedIds.includes(line.id)}
                    onChange={(e) => onToggleSelect(line.id, e)}
                    className="shrink-0 border-gray-300 rounded-sm text-blue-600 focus:ring-blue-500 checked:border-blue-500 disabled:opacity-50 disabled:pointer-events-none"
                  />
                  <span className="sr-only">Checkbox</span>
                </label>
              </div>
            </td>
            
            <td className="size-px whitespace-nowrap">
              <div className="ps-6 lg:ps-3 xl:ps-0 pe-6 py-3">
                <span className="text-sm font-medium text-gray-800">{line.id}</span>
              </div>
            </td>
            
            <td className="size-px">
              <div className="px-6 py-3">
                <span className="text-sm font-medium text-gray-800">{line.text}</span>
              </div>
            </td>
            
            <td className="size-px whitespace-nowrap">
              <div className="px-6 py-3">
                <StatusBadge active={line.active} />
              </div>
            </td>
            
            <td className="size-px whitespace-nowrap">
              <div className="px-6 py-1.5">
                <button 
                  className="inline-flex items-center gap-x-1 text-sm text-blue-600 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium cursor-pointer" 
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
  );
};

export default VoiceLineTable;