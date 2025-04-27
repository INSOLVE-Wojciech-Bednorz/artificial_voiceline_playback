import React, { useState, useRef } from 'react';

interface SearchAndFilterBarProps {
  onSearch: (query: string) => void;
  onFilter: (filter: 'all' | 'active' | 'inactive') => void;
  activeFilter: 'all' | 'active' | 'inactive';
  onAddClick: () => void;
}

const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  onSearch,
  onFilter,
  activeFilter,
  onAddClick
}) => {
  const [query, setQuery] = useState('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };
  
  const handleFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    onFilter(filter);
    setIsFilterDropdownOpen(false);
  };

  const getFilterLabel = (filter: 'all' | 'active' | 'inactive') => {
    switch (filter) {
      case 'all': return 'Wszystkie';
      case 'active': return 'Tylko aktywne';
      case 'inactive': return 'Tylko nieaktywne';
    }
  };

  return (
    <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Linie głosowe
        </h2>
        <p className="text-sm text-gray-600">
          Zarządzaj liniami głosowymi dla swojego systemu.
        </p>
      </div>
      
      <div className="flex items-center gap-x-3">
        <div className="relative flex-grow mr-2 max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            type="search"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Szukaj linii głosowych..."
            value={query}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="inline-flex gap-x-2">
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-50"
            >
              {getFilterLabel(activeFilter)}
              <svg className="ml-1 size-3" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
              </svg>
            </button>
            {isFilterDropdownOpen && (
              <div className="absolute mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`block w-full text-left px-4 py-2 text-sm ${activeFilter === 'all' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => handleFilterChange('active')}
                  className={`block w-full text-left px-4 py-2 text-sm ${activeFilter === 'active' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Tylko aktywne
                </button>
                <button
                  onClick={() => handleFilterChange('inactive')}
                  className={`block w-full text-left px-4 py-2 text-sm ${activeFilter === 'inactive' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  Tylko nieaktywne
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onAddClick}
            className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Dodaj linię głosową
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilterBar;