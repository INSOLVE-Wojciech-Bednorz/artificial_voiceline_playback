import React, { useState, useRef, useEffect } from 'react';

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
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };

    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);
  
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
    <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200/60 bg-gradient-to-r from-white/50 to-gray-50/30">
      <div className="flex items-center gap-x-3 flex-grow">
        <div className="relative flex-grow max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            type="search"
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white/70 backdrop-blur-sm text-sm transition-all duration-200 placeholder:text-gray-500 hover:bg-white/90"
            placeholder="Szukaj linii głosowych..."
            value={query}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="inline-flex gap-x-2">
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="py-2.5 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200/60 bg-white/70 backdrop-blur-sm text-gray-800 shadow-sm hover:bg-white/90 hover:shadow-md disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              {getFilterLabel(activeFilter)}
              <svg className="ml-1 size-3 transition-transform duration-200" style={{ transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
              </svg>
            </button>
            {isFilterDropdownOpen && (
              <div className="absolute mt-2 w-48 bg-white/95 backdrop-blur-md border border-gray-200/60 rounded-lg shadow-xl shadow-gray-200/40 z-10 animate-slideIn">
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`block w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${activeFilter === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'} first:rounded-t-lg`}
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => handleFilterChange('active')}
                  className={`block w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${activeFilter === 'active' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  Tylko aktywne
                </button>
                <button
                  onClick={() => handleFilterChange('inactive')}
                  className={`block w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${activeFilter === 'inactive' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'} last:rounded-b-lg`}
                >
                  Tylko nieaktywne
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onAddClick}
            className="py-2.5 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg shadow-blue-600/20"
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