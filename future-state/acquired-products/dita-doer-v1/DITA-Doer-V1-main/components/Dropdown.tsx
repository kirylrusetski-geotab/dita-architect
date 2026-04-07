import React, { useState, useRef, useEffect } from 'react';

type DropdownItem = {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  feedbackLabel?: string;
};

type DividerItem = {
  type: 'divider';
};

type Item = DropdownItem | DividerItem;

interface DropdownProps {
  label: string;
  icon: React.ReactNode;
  items: Item[];
}

const Dropdown: React.FC<DropdownProps> = ({ label, icon, items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackItemLabel, setFeedbackItemLabel] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setFeedbackItemLabel(null);
    }
  }, [isOpen]);

  const handleItemClick = (item: DropdownItem) => {
    item.action();
    if (item.feedbackLabel) {
      setFeedbackItemLabel(item.label);
      timeoutRef.current = window.setTimeout(() => {
        setIsOpen(false);
      }, 1200);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors duration-200"
      >
        {icon}
        <span>{label}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-20">
          <ul className="py-1">
            {items.map((item, index) => {
              if ('type' in item && item.type === 'divider') {
                return <li key={index}><div className="h-px bg-gray-700 my-1" /></li>;
              }
              const dropdownItem = item as DropdownItem;
              const isFeedbackActive = feedbackItemLabel === dropdownItem.label;

              return (
                <li key={index}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!feedbackItemLabel) {
                        handleItemClick(dropdownItem);
                      }
                    }}
                    className={`flex items-center space-x-3 px-4 py-2 text-sm transition-colors duration-200 ${
                      isFeedbackActive
                        ? 'bg-green-500 text-white font-semibold'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {dropdownItem.icon && <span className="w-4 h-4">{dropdownItem.icon}</span>}
                    <span>{isFeedbackActive && dropdownItem.feedbackLabel ? dropdownItem.feedbackLabel : dropdownItem.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dropdown;