import './WeekSelector.css';

interface WeekSelectorProps {
  selectedWeek: string; // ISO date of Sunday
  onWeekChange: (weekStartDate: string) => void;
  lockedWeeks?: string[];
}

/**
 * Format a date range like "Dec 29 - Jan 4, 2025"
 */
function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const endYear = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${endYear}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${endYear}`;
}

/**
 * Get current week's Sunday in YYYY-MM-DD format
 */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  return sunday.toISOString().split('T')[0]!;
}

/**
 * Add days to a date string and return new date string
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0]!;
}

export function WeekSelector({ selectedWeek, onWeekChange, lockedWeeks = [] }: WeekSelectorProps) {
  const currentWeek = getCurrentWeekStart();
  const _isFutureWeek = selectedWeek > currentWeek;
  const isCurrentWeek = selectedWeek === currentWeek;
  const isLocked = lockedWeeks.includes(selectedWeek) && !isCurrentWeek;

  const goToPreviousWeek = () => {
    onWeekChange(addDays(selectedWeek, -7));
  };

  const goToNextWeek = () => {
    const nextWeek = addDays(selectedWeek, 7);
    if (nextWeek <= currentWeek) {
      onWeekChange(nextWeek);
    }
  };

  const goToCurrentWeek = () => {
    onWeekChange(currentWeek);
  };

  const canGoNext = addDays(selectedWeek, 7) <= currentWeek;

  return (
    <div className="week-selector">
      <button
        className="week-nav-button"
        onClick={goToPreviousWeek}
        aria-label="Previous week"
        data-testid="week-previous-button"
      >
        &#8592;
      </button>

      <div className="week-display">
        <span className="week-range">{formatWeekRange(selectedWeek)}</span>
        {isLocked && (
          <span className="week-locked" title="This week is locked">
            &#128274;
          </span>
        )}
        {isCurrentWeek && <span className="week-current-badge">Current</span>}
      </div>

      <button
        className="week-nav-button"
        onClick={goToNextWeek}
        disabled={!canGoNext}
        aria-label="Next week"
        data-testid="week-next-button"
      >
        &#8594;
      </button>

      {!isCurrentWeek && (
        <button
          className="go-to-current-button"
          onClick={goToCurrentWeek}
          title="Go to current week"
          data-testid="week-today-button"
        >
          Today
        </button>
      )}
    </div>
  );
}
