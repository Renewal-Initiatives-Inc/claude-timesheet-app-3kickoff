import { useState, useRef, useEffect, useCallback } from 'react';
import './MultiSelectDropdown.css';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  testIdPrefix?: string;
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'All',
  testIdPrefix = 'multi-select',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleToggle = useCallback(
    (value: string) => {
      const newSelected = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      onChange(newSelected);
    },
    [selected, onChange]
  );

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // Display text
  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length <= 3
        ? selected.join(', ')
        : `${selected.length} selected`;

  return (
    <div className="multi-select-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`multi-select-dropdown-trigger ${isOpen ? 'multi-select-dropdown-trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`${testIdPrefix}-trigger`}
      >
        <span className="multi-select-dropdown-trigger-text">{displayText}</span>
        <span className="multi-select-dropdown-arrow">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isOpen && (
        <div className="multi-select-dropdown-menu" data-testid={`${testIdPrefix}-menu`}>
          {selected.length > 0 && (
            <button
              type="button"
              className="multi-select-dropdown-clear"
              onClick={handleClear}
              data-testid={`${testIdPrefix}-clear`}
            >
              Clear all
            </button>
          )}
          {options.map((option) => (
            <label
              key={option.value}
              className="multi-select-dropdown-option"
              data-testid={`${testIdPrefix}-option-${option.value}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => handleToggle(option.value)}
                data-testid={`${testIdPrefix}-checkbox-${option.value}`}
              />
              <span className="multi-select-dropdown-option-label">{option.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <div className="multi-select-dropdown-empty">No options available</div>
          )}
        </div>
      )}
    </div>
  );
}
