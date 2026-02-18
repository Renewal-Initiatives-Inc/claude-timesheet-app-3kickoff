import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  TimesheetWithEntries,
  TimesheetTotals,
  TimesheetEntryWithTaskCode,
  TaskCodeWithCurrentRate,
  EntryPreviewRequest,
  EntryCompliancePreview,
} from '@renewal/types';
import { TimeBlock } from './TimeBlock.js';
import { TaskAssignmentPopover } from './TaskAssignmentPopover.js';
import './TimelineView.css';

type EntryData = {
  workDate: string;
  taskCodeId: string;
  startTime: string;
  endTime: string;
  isSchoolDay: boolean;
  supervisorPresentName?: string | null;
  mealBreakConfirmed?: boolean | null;
  notes?: string | null;
  fundId?: number | null;
};

interface TimelineViewProps {
  timesheet: TimesheetWithEntries;
  totals: TimesheetTotals;
  employeeAge: number;
  taskCodes: TaskCodeWithCurrentRate[];
  onAddEntry: (entry: EntryData) => Promise<void>;
  onAddMultipleEntries?: (entries: EntryData[]) => Promise<void>;
  onPreviewEntry?: (entry: EntryPreviewRequest) => Promise<EntryCompliancePreview | null>;
  onUpdateEntriesSchoolDay?: (date: string, isSchoolDay: boolean) => Promise<void>;
  onEditEntry: (entryId: string) => void;
  onDeleteEntry: (entryId: string) => void;
  disabled?: boolean;
}

// Timeline configuration
const START_HOUR = 6; // 6 AM
const END_HOUR = 22; // 10 PM
const HOUR_HEIGHT_PX = 48; // Height of each hour row in pixels
const DAY_WIDTH_PX = 120; // Width of each day column

// Days of the week
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Get week dates for a timesheet (Sun-Sat)
 */
function getWeekDates(weekStartDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStartDate + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]!);
  }
  return dates;
}

/**
 * Format date like "Feb 3"
 */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Check if a date is a default school day (Mon-Fri during school year)
 */
function isDefaultSchoolDay(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();

  // Weekend = not a school day
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if within school year (Aug 28 - Jun 20)
  const month = date.getMonth();
  const day = date.getDate();

  // Aug 28 to Dec 31
  if (month > 7 || (month === 7 && day >= 28)) {
    return true;
  }
  // Jan 1 to Jun 20
  if (month < 5 || (month === 5 && day <= 20)) {
    return true;
  }

  return false;
}

/**
 * Convert pixel position to time (HH:MM)
 */
function pixelToTime(y: number, gridTop: number): string {
  const relativeY = y - gridTop;
  const totalMinutes = Math.floor((relativeY / HOUR_HEIGHT_PX) * 60) + START_HOUR * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round((totalMinutes % 60) / 15) * 15; // Round to 15-min increments
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Convert time (HH:MM) to pixel position
 */
function timeToPixel(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours ?? 0) * 60 + (minutes ?? 0);
  return ((totalMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT_PX;
}

/**
 * Get day index from pixel position
 */
function pixelToDayIndex(x: number, gridLeft: number): number {
  const relativeX = x - gridLeft;
  return Math.max(0, Math.min(6, Math.floor(relativeX / DAY_WIDTH_PX)));
}

interface DragState {
  isActive: boolean;
  startDayIndex: number;
  endDayIndex: number;
  startTime: string;
  endTime: string;
}

interface PopoverState {
  isOpen: boolean;
  dayIndices: number[];
  startTime: string;
  endTime: string;
}

type DragWarningType = 'school-hours' | 'exceeds-daily' | 'exceeds-weekly' | null;

// Resize state for edge dragging
interface ResizeState {
  isActive: boolean;
  entryId: string;
  edge: 'top' | 'bottom';
  originalStartTime: string;
  originalEndTime: string;
  currentTime: string;
  dayIndex: number;
}

export function TimelineView({
  timesheet,
  totals,
  employeeAge,
  taskCodes,
  onAddEntry,
  onAddMultipleEntries,
  onPreviewEntry,
  onUpdateEntriesSchoolDay,
  onEditEntry,
  onDeleteEntry,
  disabled,
}: TimelineViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isActive: false,
    startDayIndex: 0,
    endDayIndex: 0,
    startTime: '08:00',
    endTime: '08:00',
  });
  const [popover, setPopover] = useState<PopoverState>({
    isOpen: false,
    dayIndices: [],
    startTime: '',
    endTime: '',
  });
  const [dragWarning, setDragWarning] = useState<DragWarningType>(null);

  // Block selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  // Ref for focus management after modal close
  const lastFocusedBlockRef = useRef<string | null>(null);

  // Announcement for screen readers
  const [announcement, setAnnouncement] = useState<string>('');

  // Resize state for edge dragging
  const [resizeState, setResizeState] = useState<ResizeState>({
    isActive: false,
    entryId: '',
    edge: 'bottom',
    originalStartTime: '',
    originalEndTime: '',
    currentTime: '',
    dayIndex: 0,
  });

  const weekDates = getWeekDates(timesheet.weekStartDate);
  const isMinor = employeeAge < 18;

  // Track school day overrides with reasons (for snow days, in-service days, etc.)
  const [schoolDayOverrides, setSchoolDayOverrides] = useState<
    Map<number, { isSchoolDay: boolean; reason?: string }>
  >(new Map());

  // State for school day reason modal
  const [schoolDayModal, setSchoolDayModal] = useState<{
    isOpen: boolean;
    dayIndex: number;
    date: string;
  } | null>(null);

  // Group entries by date
  const entriesByDate = new Map<string, TimesheetEntryWithTaskCode[]>();
  for (const entry of timesheet.entries) {
    const existing = entriesByDate.get(entry.workDate) || [];
    existing.push(entry);
    entriesByDate.set(entry.workDate, existing);
  }

  // Get school day status for each date (with override support)
  const schoolDayStatus = weekDates.map((date, index) => {
    // Check for manual override first (current session)
    const override = schoolDayOverrides.get(index);
    if (override !== undefined) {
      return override.isSchoolDay;
    }
    // Then check existing entries - if ANY entry says non-school day, respect that
    // (once verified as snow day/holiday, should persist)
    const entries = entriesByDate.get(date);
    if (entries && entries.length > 0) {
      const anyNonSchoolDay = entries.some((e) => e.isSchoolDay === false);
      if (anyNonSchoolDay) {
        return false; // Day was marked non-school for at least one entry
      }
      return entries[0]!.isSchoolDay;
    }
    // Fall back to default calendar logic
    return isDefaultSchoolDay(date);
  });

  // Get override reason for a day (if any)
  const getOverrideReason = (dayIndex: number): string | undefined => {
    return schoolDayOverrides.get(dayIndex)?.reason;
  };

  // Calculate drag warning based on current drag state
  const calculateDragWarning = useCallback(
    (startTime: string, endTime: string, startDayIndex: number, endDayIndex: number): DragWarningType => {
      const minDay = Math.min(startDayIndex, endDayIndex);
      const maxDay = Math.max(startDayIndex, endDayIndex);

      // Parse times
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
      const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
      const minMinutes = Math.min(startMinutes, endMinutes);
      const maxMinutes = Math.max(startMinutes, endMinutes);

      // Calculate proposed hours
      const proposedHours = (maxMinutes - minMinutes) / 60;

      // School hours check for minors (7 AM = 420 minutes, 3 PM = 900 minutes)
      if (isMinor) {
        for (let day = minDay; day <= maxDay; day++) {
          if (schoolDayStatus[day]) {
            // Check if drag overlaps school hours (7 AM - 3 PM)
            const schoolStart = 7 * 60; // 7 AM in minutes
            const schoolEnd = 15 * 60; // 3 PM in minutes
            if (minMinutes < schoolEnd && maxMinutes > schoolStart) {
              return 'school-hours';
            }
          }
        }
      }

      // Daily limit check - check each day
      for (let day = minDay; day <= maxDay; day++) {
        const date = weekDates[day];
        if (!date) continue;

        // Get existing hours for this day
        const existingEntries = entriesByDate.get(date) || [];
        const existingDailyHours = existingEntries.reduce((sum, e) => {
          const [sh, sm] = e.startTime.split(':').map(Number);
          const [eh, em] = e.endTime.split(':').map(Number);
          const hours = ((eh ?? 0) * 60 + (em ?? 0) - (sh ?? 0) * 60 - (sm ?? 0)) / 60;
          return sum + hours;
        }, 0);

        const projectedDaily = existingDailyHours + proposedHours;
        if (projectedDaily > totals.limits.dailyLimit) {
          return 'exceeds-daily';
        }
      }

      // Weekly limit check
      const dayCount = maxDay - minDay + 1;
      const totalProposedHours = proposedHours * dayCount;
      if (totals.weekly + totalProposedHours > totals.limits.weeklyLimit) {
        return 'exceeds-weekly';
      }

      return null;
    },
    [isMinor, schoolDayStatus, weekDates, entriesByDate, totals]
  );

  // Handle school day toggle click - show modal if turning off, otherwise toggle directly
  const handleSchoolDayClick = async (dayIndex: number) => {
    if (disabled) return;
    const currentStatus = schoolDayStatus[dayIndex];
    const date = weekDates[dayIndex];

    if (currentStatus) {
      // Currently a school day - show modal to capture reason for marking as no-school
      setSchoolDayModal({
        isOpen: true,
        dayIndex,
        date: weekDates[dayIndex]!,
      });
    } else {
      // Currently marked as no-school - restore to school day (no reason needed)
      setSchoolDayOverrides((prev) => {
        const next = new Map(prev);
        next.set(dayIndex, { isSchoolDay: true });
        return next;
      });

      // Update existing entries on this date to have isSchoolDay: true
      if (date && onUpdateEntriesSchoolDay) {
        try {
          await onUpdateEntriesSchoolDay(date, true);
        } catch {
          console.error('Failed to update entries school day status');
        }
      }
    }
  };

  // Handle school day modal submission
  const handleSchoolDayReasonSubmit = async (reason: string) => {
    if (!schoolDayModal) return;

    const date = weekDates[schoolDayModal.dayIndex];

    // Update local state override
    setSchoolDayOverrides((prev) => {
      const next = new Map(prev);
      next.set(schoolDayModal.dayIndex, { isSchoolDay: false, reason });
      return next;
    });

    // Update existing entries on this date to have isSchoolDay: false
    if (date && onUpdateEntriesSchoolDay) {
      try {
        await onUpdateEntriesSchoolDay(date, false);
      } catch {
        // Error will be shown by the hook, but don't block UI
        console.error('Failed to update entries school day status');
      }
    }

    setSchoolDayModal(null);
  };

  // Handle mouse down - start drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || popover.isOpen) return;
      if (!gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const dayIndex = pixelToDayIndex(e.clientX, rect.left);
      const time = pixelToTime(e.clientY, rect.top);

      setDragState({
        isActive: true,
        startDayIndex: dayIndex,
        endDayIndex: dayIndex,
        startTime: time,
        endTime: time,
      });
    },
    [disabled, popover.isOpen]
  );

  // Handle mouse move - update drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.isActive || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const dayIndex = pixelToDayIndex(e.clientX, rect.left);
      const time = pixelToTime(e.clientY, rect.top);

      setDragState((prev) => ({
        ...prev,
        endDayIndex: dayIndex,
        endTime: time,
      }));

      // Calculate warning for the current drag
      const warning = calculateDragWarning(dragState.startTime, time, dragState.startDayIndex, dayIndex);
      setDragWarning(warning);
    },
    [dragState.isActive, dragState.startTime, dragState.startDayIndex, calculateDragWarning]
  );

  // Handle mouse up - end drag and show popover
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.isActive) return;

      // Calculate the drag result
      const minDay = Math.min(dragState.startDayIndex, dragState.endDayIndex);
      const maxDay = Math.max(dragState.startDayIndex, dragState.endDayIndex);
      const [startH, startM] = dragState.startTime.split(':').map(Number);
      const [endH, endM] = dragState.endTime.split(':').map(Number);
      const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
      const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

      const minTime =
        startMinutes <= endMinutes ? dragState.startTime : dragState.endTime;
      const maxTime =
        startMinutes <= endMinutes ? dragState.endTime : dragState.startTime;

      // Minimum 15 minute block
      if (minTime === maxTime) {
        setDragState((prev) => ({ ...prev, isActive: false }));
        return;
      }

      // Get all day indices in range
      const dayIndices: number[] = [];
      for (let i = minDay; i <= maxDay; i++) {
        dayIndices.push(i);
      }

      // Show popover for task assignment
      setPopover({
        isOpen: true,
        dayIndices,
        startTime: minTime,
        endTime: maxTime,
      });

      setDragState((prev) => ({ ...prev, isActive: false }));
      setDragWarning(null);
    },
    [dragState]
  );

  // Handle task assignment from popover
  const handleTaskAssignment = async (
    taskCodeId: string,
    supervisorName?: string,
    mealBreakConfirmed?: boolean,
    notes?: string,
    fundId?: number | null
  ) => {
    // Build entries for each selected day
    const entries: EntryData[] = popover.dayIndices.map((dayIndex) => ({
      workDate: weekDates[dayIndex]!,
      taskCodeId,
      startTime: popover.startTime,
      endTime: popover.endTime,
      isSchoolDay: schoolDayStatus[dayIndex]!,
      supervisorPresentName: supervisorName ?? null,
      mealBreakConfirmed: mealBreakConfirmed ?? null,
      notes: notes ?? null,
      fundId: fundId ?? null,
    }));

    // Use bulk endpoint if available and multiple days, otherwise create one at a time
    if (entries.length > 1 && onAddMultipleEntries) {
      await onAddMultipleEntries(entries);
    } else {
      // Single entry or no bulk endpoint - create one at a time
      for (const entry of entries) {
        await onAddEntry(entry);
      }
    }

    setPopover((prev) => ({ ...prev, isOpen: false }));
  };

  // Close popover and restore focus
  const handleClosePopover = useCallback(() => {
    setPopover((prev) => ({ ...prev, isOpen: false }));
    // Restore focus to the last focused block after a brief delay
    setTimeout(() => {
      if (lastFocusedBlockRef.current) {
        const element = document.querySelector(
          `[data-testid="time-block-${lastFocusedBlockRef.current}"]`
        ) as HTMLElement;
        element?.focus();
      }
    }, 100);
  }, []);

  // Get all entries sorted by day then start time for keyboard navigation
  const getSortedEntries = useCallback((): TimesheetEntryWithTaskCode[] => {
    const allEntries: { entry: TimesheetEntryWithTaskCode; dayIndex: number }[] = [];
    weekDates.forEach((date, dayIndex) => {
      const entries = entriesByDate.get(date) || [];
      entries.forEach((entry) => {
        allEntries.push({ entry, dayIndex });
      });
    });
    // Sort by day index first, then by start time
    allEntries.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return a.entry.startTime.localeCompare(b.entry.startTime);
    });
    return allEntries.map((e) => e.entry);
  }, [weekDates, entriesByDate]);

  // Handle block selection (unused but kept for potential future use)
  const _handleBlockSelect = (entryId: string) => {
    setSelectedBlockId((prev) => (prev === entryId ? null : entryId));
  };

  // Handle clicking on empty grid area to deselect
  const handleGridClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on grid, not on a block
    if (e.target === gridRef.current) {
      setSelectedBlockId(null);
    }
  };

  // Handle resize start from TimeBlock
  const handleResizeStart = (
    entry: TimesheetEntryWithTaskCode,
    dayIndex: number,
    edge: 'top' | 'bottom'
  ) => {
    setResizeState({
      isActive: true,
      entryId: entry.id,
      edge,
      originalStartTime: entry.startTime,
      originalEndTime: entry.endTime,
      currentTime: edge === 'top' ? entry.startTime : entry.endTime,
      dayIndex,
    });
    setSelectedBlockId(entry.id);
  };

  // Handle resize move
  const handleResizeMove = useCallback(
    (e: React.MouseEvent) => {
      if (!resizeState.isActive || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const newTime = pixelToTime(e.clientY, rect.top);

      setResizeState((prev) => ({
        ...prev,
        currentTime: newTime,
      }));
    },
    [resizeState.isActive]
  );

  // Handle resize end
  const handleResizeEnd = useCallback(async () => {
    if (!resizeState.isActive) return;

    const { entryId, edge, originalStartTime, originalEndTime, currentTime } = resizeState;

    // Calculate new times
    let newStartTime = originalStartTime;
    let newEndTime = originalEndTime;

    if (edge === 'top') {
      newStartTime = currentTime;
    } else {
      newEndTime = currentTime;
    }

    // Ensure start is before end
    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);
    const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

    if (startMinutes >= endMinutes) {
      // Invalid resize, reset
      setResizeState((prev) => ({ ...prev, isActive: false }));
      return;
    }

    // Find the entry and update it
    const entry = timesheet.entries.find((e) => e.id === entryId);
    if (entry) {
      try {
        // Call the edit handler to update times via API
        // We need to trigger an update - for now, open edit modal
        onEditEntry(entryId);
      } catch {
        // Failed to update
      }
    }

    setResizeState((prev) => ({ ...prev, isActive: false }));
  }, [resizeState, timesheet.entries, onEditEntry]);

  // Handle keyboard navigation on individual time blocks
  const handleBlockKeyDown = useCallback(
    (e: React.KeyboardEvent, entryId: string) => {
      if (disabled) return;

      const sortedEntries = getSortedEntries();
      const currentIndex = sortedEntries.findIndex((entry) => entry.id === entryId);

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          onDeleteEntry(entryId);
          // Focus next or previous entry after delete
          if (sortedEntries.length > 1) {
            const nextIndex = currentIndex < sortedEntries.length - 1 ? currentIndex + 1 : currentIndex - 1;
            const nextEntry = sortedEntries[nextIndex];
            if (nextEntry) {
              setFocusedBlockId(nextEntry.id);
              setTimeout(() => {
                const nextElement = document.querySelector(`[data-testid="time-block-${nextEntry.id}"]`) as HTMLElement;
                nextElement?.focus();
              }, 0);
            }
          }
          setSelectedBlockId(null);
          break;

        case 'Escape':
          e.preventDefault();
          setSelectedBlockId(null);
          setFocusedBlockId(null);
          (e.target as HTMLElement).blur();
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          setSelectedBlockId(entryId);
          onEditEntry(entryId);
          lastFocusedBlockRef.current = entryId;
          break;

        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < sortedEntries.length - 1) {
            const nextEntry = sortedEntries[currentIndex + 1];
            if (nextEntry) {
              setFocusedBlockId(nextEntry.id);
              const nextElement = document.querySelector(`[data-testid="time-block-${nextEntry.id}"]`) as HTMLElement;
              nextElement?.focus();
              // Announce for screen readers
              setAnnouncement(`${nextEntry.taskCode.name}, ${nextEntry.startTime} to ${nextEntry.endTime}`);
            }
          }
          break;

        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const prevEntry = sortedEntries[currentIndex - 1];
            if (prevEntry) {
              setFocusedBlockId(prevEntry.id);
              const prevElement = document.querySelector(`[data-testid="time-block-${prevEntry.id}"]`) as HTMLElement;
              prevElement?.focus();
              // Announce for screen readers
              setAnnouncement(`${prevEntry.taskCode.name}, ${prevEntry.startTime} to ${prevEntry.endTime}`);
            }
          }
          break;

        case 'Home':
          e.preventDefault();
          if (sortedEntries.length > 0) {
            const firstEntry = sortedEntries[0];
            if (firstEntry) {
              setFocusedBlockId(firstEntry.id);
              const firstElement = document.querySelector(`[data-testid="time-block-${firstEntry.id}"]`) as HTMLElement;
              firstElement?.focus();
            }
          }
          break;

        case 'End':
          e.preventDefault();
          if (sortedEntries.length > 0) {
            const lastEntry = sortedEntries[sortedEntries.length - 1];
            if (lastEntry) {
              setFocusedBlockId(lastEntry.id);
              const lastElement = document.querySelector(`[data-testid="time-block-${lastEntry.id}"]`) as HTMLElement;
              lastElement?.focus();
            }
          }
          break;
      }
    },
    [disabled, getSortedEntries, onDeleteEntry, onEditEntry, setAnnouncement]
  );

  // Global keyboard handler for selected block (when not focused on a specific block)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if there's a selected block and we're not focused on an input/button
      if (!selectedBlockId || disabled) return;
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'SELECT' || activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteEntry(selectedBlockId);
        setSelectedBlockId(null);
      } else if (e.key === 'Escape') {
        setSelectedBlockId(null);
        setFocusedBlockId(null);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        lastFocusedBlockRef.current = selectedBlockId;
        onEditEntry(selectedBlockId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, disabled, onDeleteEntry, onEditEntry]);

  // Calculate drag preview position
  const getDragPreviewStyle = () => {
    if (!dragState.isActive) return { display: 'none' };

    const minDay = Math.min(dragState.startDayIndex, dragState.endDayIndex);
    const maxDay = Math.max(dragState.startDayIndex, dragState.endDayIndex);
    const [startH, startM] = dragState.startTime.split(':').map(Number);
    const [endH, endM] = dragState.endTime.split(':').map(Number);
    const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

    const minMinutes = Math.min(startMinutes, endMinutes);
    const maxMinutes = Math.max(startMinutes, endMinutes);

    const top = ((minMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT_PX;
    const height = ((maxMinutes - minMinutes) / 60) * HOUR_HEIGHT_PX;
    const left = minDay * DAY_WIDTH_PX;
    const width = (maxDay - minDay + 1) * DAY_WIDTH_PX;

    return {
      display: 'block',
      top: `${top}px`,
      height: `${Math.max(height, HOUR_HEIGHT_PX / 4)}px`,
      left: `${left}px`,
      width: `${width}px`,
    };
  };

  // Generate hour labels
  const hourLabels = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    hourLabels.push(
      <div key={h} className="hour-label" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT_PX}px` }}>
        {hour12} {ampm}
      </div>
    );
  }

  // Generate hour grid lines
  const hourLines = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hourLines.push(
      <div
        key={h}
        className="hour-line"
        style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT_PX}px` }}
      />
    );
  }

  // Format week range for aria-label
  const weekRangeLabel = `Week of ${formatShortDate(weekDates[0]!)} to ${formatShortDate(weekDates[6]!)}`;

  return (
    <div
      className="timeline-view"
      data-testid="timeline-view"
      role="application"
      aria-label={`Timesheet timeline for ${weekRangeLabel}. Use Tab to navigate between time blocks, arrow keys to move between blocks, Enter to edit, Delete to remove.`}
    >
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Header row with day labels */}
      <div className="timeline-header" role="row">
        <div className="time-gutter-header" role="columnheader" aria-label="Time" />
        {weekDates.map((date, index) => {
          const isSchoolDay = schoolDayStatus[index];
          const defaultIsSchoolDay = isDefaultSchoolDay(date);
          const isOverridden = schoolDayOverrides.has(index);

          return (
            <div key={date} className="day-header" style={{ width: `${DAY_WIDTH_PX}px` }}>
              <span className="day-name">{DAYS[index]}</span>
              <span className="day-date">{formatShortDate(date)}</span>
              {isMinor && defaultIsSchoolDay && (
                <button
                  type="button"
                  className={`school-indicator ${isSchoolDay ? 'active' : 'inactive'} ${isOverridden ? 'overridden' : ''}`}
                  onClick={() => handleSchoolDayClick(index)}
                  title={
                    isSchoolDay
                      ? 'School day - Click to mark as no school (snow day, in-service, etc.)'
                      : `No school: ${getOverrideReason(index) || 'reason not specified'} - Click to restore as school day`
                  }
                  disabled={disabled}
                  data-testid={`school-day-toggle-${index}`}
                >
                  S
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main grid area */}
      <div className="timeline-body">
        {/* Hour labels column */}
        <div className="time-gutter">{hourLabels}</div>

        {/* Grid area */}
        <div
          ref={gridRef}
          className={`timeline-grid ${disabled ? 'disabled' : ''} ${resizeState.isActive ? 'resizing' : ''}`}
          style={{
            width: `${DAY_WIDTH_PX * 7}px`,
            height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT_PX}px`,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            if (resizeState.isActive) {
              handleResizeMove(e);
            } else {
              handleMouseMove(e);
            }
          }}
          onMouseUp={(e) => {
            if (resizeState.isActive) {
              handleResizeEnd();
            } else {
              handleMouseUp(e);
            }
          }}
          onMouseLeave={() => {
            if (dragState.isActive) {
              setDragState((prev) => ({ ...prev, isActive: false }));
              setDragWarning(null);
            }
            if (resizeState.isActive) {
              setResizeState((prev) => ({ ...prev, isActive: false }));
            }
          }}
          onClick={handleGridClick}
        >
          {/* Hour grid lines */}
          {hourLines}

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => {
            // Calculate daily hours used for this day
            const dayEntries = entriesByDate.get(date) || [];
            const dailyHoursUsed = dayEntries.reduce((sum, e) => {
              const [sh, sm] = e.startTime.split(':').map(Number);
              const [eh, em] = e.endTime.split(':').map(Number);
              const hours = ((eh ?? 0) * 60 + (em ?? 0) - (sh ?? 0) * 60 - (sm ?? 0)) / 60;
              return sum + hours;
            }, 0);

            // Calculate where to show the limit indicator (if any hours logged)
            const showLimitIndicator = isMinor && dailyHoursUsed > 0;
            const limitHoursRemaining = totals.limits.dailyLimit - dailyHoursUsed;

            return (
              <div
                key={date}
                className="day-column"
                style={{ left: `${dayIndex * DAY_WIDTH_PX}px`, width: `${DAY_WIDTH_PX}px` }}
              >
                {/* School hours overlay for minors */}
                {isMinor && schoolDayStatus[dayIndex] && (
                  <div
                    className="school-hours-overlay"
                    style={{
                      top: `${(7 - START_HOUR) * HOUR_HEIGHT_PX}px`, // 7 AM
                      height: `${8 * HOUR_HEIGHT_PX}px`, // 7 AM - 3 PM = 8 hours
                    }}
                    title="School hours (7 AM - 3 PM) - Cannot work during this time"
                    aria-hidden="true"
                  />
                )}
                {/* Daily limit indicator line - show if approaching limit */}
                {showLimitIndicator && limitHoursRemaining <= 2 && limitHoursRemaining > 0 && (
                  <div
                    className="daily-limit-indicator"
                    style={{
                      top: `${(totals.limits.dailyLimit + START_HOUR) * HOUR_HEIGHT_PX}px`,
                    }}
                    data-limit-label={`${limitHoursRemaining.toFixed(1)}h left`}
                    title={`Daily limit: ${totals.limits.dailyLimit}h. ${limitHoursRemaining.toFixed(1)} hours remaining.`}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}

          {/* Existing time blocks */}
          {weekDates.map((date, dayIndex) => {
            const entries = entriesByDate.get(date) || [];
            return entries.map((entry) => (
              <TimeBlock
                key={entry.id}
                entry={entry}
                dayIndex={dayIndex}
                dayWidth={DAY_WIDTH_PX}
                hourHeight={HOUR_HEIGHT_PX}
                startHour={START_HOUR}
                isSelected={selectedBlockId === entry.id}
                isFocused={focusedBlockId === entry.id}
                tabIndex={0}
                onSelect={() => setSelectedBlockId(entry.id)}
                onEdit={() => {
                  lastFocusedBlockRef.current = entry.id;
                  onEditEntry(entry.id);
                }}
                onDelete={() => onDeleteEntry(entry.id)}
                onResizeStart={(edge) => handleResizeStart(entry, dayIndex, edge)}
                onKeyDown={handleBlockKeyDown}
                disabled={disabled}
              />
            ));
          })}

          {/* Drag preview */}
          <div
            className={`drag-preview ${dragWarning ? `drag-warning drag-warning-${dragWarning}` : ''}`}
            style={getDragPreviewStyle()}
            title={
              dragWarning === 'school-hours'
                ? 'Cannot work during school hours (7 AM - 3 PM)'
                : dragWarning === 'exceeds-daily'
                  ? 'This would exceed the daily hour limit'
                  : dragWarning === 'exceeds-weekly'
                    ? 'This would exceed the weekly hour limit'
                    : undefined
            }
          />

          {/* Resize preview */}
          {resizeState.isActive && (() => {
            const entry = timesheet.entries.find((e) => e.id === resizeState.entryId);
            if (!entry) return null;

            const newStartTime = resizeState.edge === 'top' ? resizeState.currentTime : entry.startTime;
            const newEndTime = resizeState.edge === 'bottom' ? resizeState.currentTime : entry.endTime;

            const [startH, startM] = newStartTime.split(':').map(Number);
            const [endH, endM] = newEndTime.split(':').map(Number);
            const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
            const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

            if (endMinutes <= startMinutes) return null;

            const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT_PX;
            const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX;
            const hours = (endMinutes - startMinutes) / 60;

            return (
              <div
                className="resize-preview"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left: `${resizeState.dayIndex * DAY_WIDTH_PX + 2}px`,
                  width: `${DAY_WIDTH_PX - 4}px`,
                }}
                data-testid="resize-preview"
              >
                <span className="resize-preview-time">{newStartTime} - {newEndTime}</span>
                <span className="resize-preview-hours">{hours.toFixed(1)}h</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Footer with totals */}
      <div className="timeline-footer">
        <div className="weekly-total">
          <span className="total-label">Weekly Total:</span>
          <span
            className={`total-hours ${
              totals.weekly >= totals.limits.weeklyLimit
                ? 'at-limit'
                : totals.weekly >= totals.limits.weeklyLimit * 0.8
                  ? 'approaching-limit'
                  : ''
            }`}
          >
            {totals.weekly.toFixed(1)}
          </span>
          <span className="total-separator">/</span>
          <span className="total-limit">{totals.limits.weeklyLimit}</span>
          <span className="total-unit">hours</span>
        </div>
      </div>

      {/* Task assignment popover */}
      {popover.isOpen && (
        <TaskAssignmentPopover
          taskCodes={taskCodes}
          startTime={popover.startTime}
          endTime={popover.endTime}
          dayCount={popover.dayIndices.length}
          employeeAge={employeeAge}
          workDates={popover.dayIndices.map((i) => weekDates[i]!)}
          schoolDayStatus={popover.dayIndices.map((i) => schoolDayStatus[i]!)}
          onPreview={onPreviewEntry}
          onAssign={handleTaskAssignment}
          onClose={handleClosePopover}
        />
      )}

      {/* School day reason modal */}
      {schoolDayModal && (
        <SchoolDayReasonModal
          date={schoolDayModal.date}
          onSubmit={handleSchoolDayReasonSubmit}
          onClose={() => setSchoolDayModal(null)}
        />
      )}
    </div>
  );
}

/**
 * Modal for capturing the reason why a school day is being marked as no-school
 */
function SchoolDayReasonModal({
  date,
  onSubmit,
  onClose,
}: {
  date: string;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const commonReasons = [
    { value: 'snow_day', label: 'Snow day / Weather closure' },
    { value: 'teacher_inservice', label: 'Teacher in-service day' },
    { value: 'holiday', label: 'School holiday' },
    { value: 'school_break', label: 'School break (spring/winter)' },
    { value: 'other', label: 'Other reason' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reason =
      selectedReason === 'other'
        ? customReason
        : commonReasons.find((r) => r.value === selectedReason)?.label || selectedReason;
    if (reason) {
      onSubmit(reason);
    }
  };

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="school-day-modal-backdrop" onClick={onClose}>
      <div
        className="school-day-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="school-day-reason-modal"
      >
        <div className="modal-header">
          <h4>Mark as No School</h4>
          <button className="close-btn" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-date">{formattedDate}</p>
          <p className="modal-description">
            Please select a reason for marking this day as no school. This helps supervisors verify
            timesheet accuracy.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="reason-options">
              {commonReasons.map((reason) => (
                <label key={reason.value} className="reason-option">
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                  />
                  <span>{reason.label}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'other' && (
              <div className="custom-reason">
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please specify the reason..."
                  required
                  autoFocus
                  data-testid="school-day-custom-reason"
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn"
                disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim())}
                data-testid="school-day-reason-submit"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
