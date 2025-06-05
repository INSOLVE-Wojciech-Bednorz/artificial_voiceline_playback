import React from 'react';

interface StatusBadgeProps {
  active: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ active }) => {
  if (active) {
    return (
      <span className="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-semibold bg-gradient-to-r from-emerald-500/90 to-green-500/90 text-white rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-white/20">
        <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
        </svg>
        <span className="relative">
          Aktywna
        </span>
      </span>
    );
  } else {
    return (
      <span className="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-semibold bg-gradient-to-r from-red-500/90 to-pink-500/90 text-white rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-white/20">
        <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
        </svg>
        Nieaktywna
      </span>
    );
  }
};

export default StatusBadge;