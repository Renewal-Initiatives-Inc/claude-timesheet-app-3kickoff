import type { TimesheetEntryWithTaskCode } from '@renewal/types';
import './TaskColorLegend.css';

interface TaskColorLegendProps {
  entries: TimesheetEntryWithTaskCode[];
}

/**
 * Generate a consistent color from a string (task code ID)
 * This must match the function in TimeBlock.tsx
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
  const match = hslColor.match(/hsl\(\d+,\s*\d+%,\s*(\d+)%\)/);
  const lightness = match ? parseInt(match[1]!, 10) : 50;
  return lightness > 55 ? '#1a1a1a' : '#ffffff';
}

/**
 * TaskColorLegend shows a legend of task codes and their colors
 * Only shows task codes that are used in the current timesheet
 */
export function TaskColorLegend({ entries }: TaskColorLegendProps) {
  // Get unique task codes from entries
  const taskCodeMap = new Map<string, { code: string; name: string; color: string }>();

  for (const entry of entries) {
    if (!taskCodeMap.has(entry.taskCodeId)) {
      const color = stringToColor(entry.taskCodeId);
      taskCodeMap.set(entry.taskCodeId, {
        code: entry.taskCode.code,
        name: entry.taskCode.name,
        color,
      });
    }
  }

  const taskCodes = Array.from(taskCodeMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  if (taskCodes.length === 0) {
    return null;
  }

  return (
    <div className="task-color-legend" data-testid="task-color-legend">
      <h4 className="legend-title">Task Colors</h4>
      <div className="legend-items">
        {taskCodes.map((task) => (
          <div key={task.code} className="legend-item" data-testid={`legend-item-${task.code}`}>
            <span
              className="legend-color"
              style={{
                backgroundColor: task.color,
                color: getContrastColor(task.color),
              }}
            >
              {task.code}
            </span>
            <span className="legend-name">{task.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
