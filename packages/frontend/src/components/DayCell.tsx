import { useState } from 'react';
import type { TimesheetEntryWithTaskCode } from '@renewal/types';
import './DayCell.css';

interface DayCellProps {
  date: string;
  dayOfWeek: string;
  entries: TimesheetEntryWithTaskCode[];
  dailyTotal: number;
  dailyLimit: number;
  employeeAge: number;
  isSchoolDay: boolean;
  onAddEntry: () => void;
  onEditEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  disabled?: boolean;
}

/**
 * Format date like "Jan 15"
 */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format time like "9:00 AM"
 */
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours! >= 12 ? 'PM' : 'AM';
  const displayHours = hours! % 12 || 12;
  return `${displayHours}:${minutes!.toString().padStart(2, '0')} ${period}`;
}

export function DayCell({
  date,
  dayOfWeek,
  entries,
  dailyTotal,
  dailyLimit,
  employeeAge,
  isSchoolDay,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  disabled,
}: DayCellProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isApproachingLimit = dailyTotal >= dailyLimit * 0.8 && dailyTotal < dailyLimit;
  const isAtLimit = dailyTotal >= dailyLimit;

  const handleDeleteClick = (entryId: string) => {
    if (confirmDelete === entryId) {
      onDeleteEntry(entryId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(entryId);
    }
  };

  const cellClassName = [
    'day-cell',
    isApproachingLimit ? 'approaching-limit' : '',
    isAtLimit ? 'at-limit' : '',
    disabled ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cellClassName}>
      <div className="day-header">
        <div className="day-info">
          <span className="day-name">{dayOfWeek.slice(0, 3)}</span>
          <span className="day-date">{formatShortDate(date)}</span>
        </div>
        {employeeAge < 18 && (
          <span
            className={`school-day-indicator ${isSchoolDay ? 'is-school-day' : ''}`}
            title={isSchoolDay ? 'School day' : 'Non-school day'}
          >
            {isSchoolDay ? 'S' : ''}
          </span>
        )}
      </div>

      <div className="entries-list">
        {entries.length === 0 ? (
          <div className="no-entries">No entries</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="entry-item">
              <div className="entry-info">
                <span className="entry-task">{entry.taskCode.code}</span>
                <span className="entry-times">
                  {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                </span>
                <span className="entry-hours">{parseFloat(entry.hours).toFixed(1)}h</span>
              </div>
              {!disabled && (
                <div className="entry-actions">
                  <button
                    className="entry-action-button edit"
                    onClick={() => onEditEntry(entry.id)}
                    title="Edit entry"
                    data-testid={`entry-edit-button-${entry.id}`}
                  >
                    &#9998;
                  </button>
                  <button
                    className={`entry-action-button delete ${confirmDelete === entry.id ? 'confirm' : ''}`}
                    onClick={() => handleDeleteClick(entry.id)}
                    title={confirmDelete === entry.id ? 'Click to confirm' : 'Delete entry'}
                    onBlur={() => setConfirmDelete(null)}
                    data-testid={`entry-delete-button-${entry.id}`}
                  >
                    {confirmDelete === entry.id ? '?' : '&#10005;'}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!disabled && (
        <button
          className="add-entry-button"
          onClick={onAddEntry}
          disabled={isAtLimit}
          title={isAtLimit ? 'Daily limit reached' : 'Add entry'}
          data-testid={`day-add-entry-button-${date}`}
        >
          + Add
        </button>
      )}

      <div className="daily-total">
        <span className="total-hours">{dailyTotal.toFixed(1)}</span>
        <span className="total-separator">/</span>
        <span className="total-limit">{dailyLimit}</span>
        <span className="total-unit">hrs</span>
      </div>
    </div>
  );
}
