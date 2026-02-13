import { useState } from 'react';
import type { TimesheetEntryWithTaskCode } from '@renewal/types';
import './TimeBlock.css';

interface TimeBlockProps {
  entry: TimesheetEntryWithTaskCode;
  dayIndex: number;
  dayWidth: number;
  hourHeight: number;
  startHour: number;
  isSelected?: boolean;
  isFocused?: boolean;
  tabIndex?: number;
  onSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResizeStart?: (edge: 'top' | 'bottom') => void;
  onKeyDown?: (e: React.KeyboardEvent, entryId: string) => void;
  disabled?: boolean;
}

/**
 * Generate a consistent color from a string (task code ID)
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use HSL for more pleasing colors
  const hue = Math.abs(hash % 360);
  const saturation = 65 + (hash % 20); // 65-85%
  const lightness = 45 + (hash % 15); // 45-60%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get contrasting text color (white or black) based on background
 */
function getContrastColor(hslColor: string): string {
  // Extract lightness from HSL
  const match = hslColor.match(/hsl\(\d+,\s*\d+%,\s*(\d+)%\)/);
  const lightness = match ? parseInt(match[1]!, 10) : 50;
  return lightness > 55 ? '#1a1a1a' : '#ffffff';
}

/**
 * Format time like "9:00 AM"
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const hour12 = (hours ?? 0) > 12 ? (hours ?? 0) - 12 : (hours ?? 0) === 0 ? 12 : (hours ?? 0);
  const ampm = (hours ?? 0) >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes ?? 0).padStart(2, '0')} ${ampm}`;
}

export function TimeBlock({
  entry,
  dayIndex,
  dayWidth,
  hourHeight,
  startHour,
  isSelected,
  isFocused,
  tabIndex = 0,
  onSelect,
  onEdit,
  onDelete,
  onResizeStart,
  onKeyDown,
  disabled,
}: TimeBlockProps) {
  const [showActions, setShowActions] = useState(false);

  // Handle click - select first, then edit on double-click or action button
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();

    if (isSelected) {
      // Already selected, open edit
      onEdit();
    } else {
      // Select this block
      onSelect?.();
    }
  };

  // Handle resize handle mousedown
  const handleResizeMouseDown = (edge: 'top' | 'bottom') => (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    onResizeStart?.(edge);
  };

  // Calculate position from entry times
  const [startH, startM] = entry.startTime.split(':').map(Number);
  const [endH, endM] = entry.endTime.split(':').map(Number);
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  const top = ((startMinutes - startHour * 60) / 60) * hourHeight;
  const height = ((endMinutes - startMinutes) / 60) * hourHeight;
  const left = dayIndex * dayWidth + 2; // 2px padding
  const width = dayWidth - 4; // 4px total padding

  // Generate color from task code
  const bgColor = stringToColor(entry.taskCodeId);
  const textColor = getContrastColor(bgColor);

  // Calculate hours
  const hours = parseFloat(entry.hours);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  // Build accessible label for screen readers
  const accessibleLabel = `${entry.taskCode.name}, ${formatTime(entry.startTime)} to ${formatTime(entry.endTime)}, ${hours.toFixed(1)} hours${entry.notes ? `, Notes: ${entry.notes}` : ''}`;

  return (
    <div
      className={`time-block ${disabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 20)}px`,
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: bgColor,
        color: textColor,
      }}
      onClick={handleClick}
      onKeyDown={(e) => onKeyDown?.(e, entry.id)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      title={`${entry.taskCode.name}\n${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}\n${hours.toFixed(1)} hours\n$${entry.taskCode.currentRate.toFixed(2)}/hr${entry.notes ? `\n---\n${entry.notes}` : ''}`}
      tabIndex={disabled ? -1 : tabIndex}
      role="button"
      aria-label={accessibleLabel}
      aria-pressed={isSelected}
      data-testid={`time-block-${entry.id}`}
    >
      {/* Resize handles - only show when selected and not disabled */}
      {isSelected && !disabled && (
        <>
          <div
            className="resize-handle resize-handle-top"
            onMouseDown={handleResizeMouseDown('top')}
            data-testid={`time-block-resize-top-${entry.id}`}
          />
          <div
            className="resize-handle resize-handle-bottom"
            onMouseDown={handleResizeMouseDown('bottom')}
            data-testid={`time-block-resize-bottom-${entry.id}`}
          />
        </>
      )}
      <div className="block-content">
        <span className="block-task-code">{entry.taskCode.code}</span>
        {height >= 35 && (
          <span className="block-task-name">{entry.taskCode.name}</span>
        )}
        {height >= 55 && (
          <span className="block-times">
            {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
          </span>
        )}
        {height >= 75 && <span className="block-hours">{hours.toFixed(1)}h</span>}
      </div>

      {/* Action buttons on hover */}
      {showActions && !disabled && (
        <div className="block-actions">
          <button
            className="block-action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit"
            data-testid={`time-block-edit-${entry.id}`}
          >
            ✎
          </button>
          <button
            className="block-action-btn delete"
            onClick={handleDeleteClick}
            title="Delete"
            data-testid={`time-block-delete-${entry.id}`}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
