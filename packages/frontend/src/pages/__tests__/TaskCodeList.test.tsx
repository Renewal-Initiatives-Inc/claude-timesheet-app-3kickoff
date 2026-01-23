import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TaskCodeList } from '../TaskCodeList';
import * as useTaskCodesModule from '../../hooks/useTaskCodes';

vi.mock('../../hooks/useTaskCodes');

const mockTaskCodes = [
  {
    id: '1',
    code: 'F1',
    name: 'Field Harvesting - Light',
    description: 'Light crop harvesting',
    isAgricultural: true,
    isHazardous: false,
    supervisorRequired: 'for_minors' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    currentRate: 8.0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    code: 'R1',
    name: 'Farm Stand - Customer Service',
    description: 'Customer service at farm stand',
    isAgricultural: false,
    isHazardous: false,
    supervisorRequired: 'none' as const,
    soloCashHandling: false,
    drivingRequired: false,
    powerMachinery: false,
    minAgeAllowed: 12,
    isActive: true,
    currentRate: 15.0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    code: 'F5',
    name: 'Heavy Equipment Operation',
    description: 'Tractor and heavy machinery',
    isAgricultural: true,
    isHazardous: true,
    supervisorRequired: 'always' as const,
    soloCashHandling: false,
    drivingRequired: true,
    powerMachinery: true,
    minAgeAllowed: 18,
    isActive: false,
    currentRate: 8.0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <TaskCodeList />
    </BrowserRouter>
  );
};

describe('TaskCodeList', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTaskCodesModule.useTaskCodes).mockReturnValue({
      taskCodes: mockTaskCodes,
      total: mockTaskCodes.length,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('should render the page header', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: 'Task Codes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Add Task Code' })).toBeInTheDocument();
  });

  it('should render filter controls', () => {
    renderComponent();

    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Hazardous')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('should render task codes in a table', () => {
    renderComponent();

    expect(screen.getByText('F1')).toBeInTheDocument();
    expect(screen.getByText('Field Harvesting - Light')).toBeInTheDocument();
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.getByText('Farm Stand - Customer Service')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    vi.mocked(useTaskCodesModule.useTaskCodes).mockReturnValue({
      taskCodes: [],
      total: 0,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('Loading task codes...')).toBeInTheDocument();
  });

  it('should display error state with retry button', () => {
    vi.mocked(useTaskCodesModule.useTaskCodes).mockReturnValue({
      taskCodes: [],
      total: 0,
      loading: false,
      error: 'Failed to load task codes',
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('Error: Failed to load task codes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should call refetch when retry button is clicked', () => {
    vi.mocked(useTaskCodesModule.useTaskCodes).mockReturnValue({
      taskCodes: [],
      total: 0,
      loading: false,
      error: 'Failed to load task codes',
      refetch: mockRefetch,
    });

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should display empty state when no task codes', () => {
    vi.mocked(useTaskCodesModule.useTaskCodes).mockReturnValue({
      taskCodes: [],
      total: 0,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('No task codes found.')).toBeInTheDocument();
  });

  it('should show agricultural and non-agricultural badges', () => {
    renderComponent();

    const agriculturalBadges = screen.getAllByText('Agricultural');
    const nonAgriculturalBadges = screen.getAllByText('Non-Agricultural');

    expect(agriculturalBadges.length).toBeGreaterThan(0);
    expect(nonAgriculturalBadges.length).toBeGreaterThan(0);
  });

  it('should show hazardous badge for hazardous task codes', () => {
    renderComponent();

    expect(screen.getByText('Hazard')).toBeInTheDocument();
  });

  it('should show supervisor required badges', () => {
    renderComponent();

    expect(screen.getByText('Supv: Minors')).toBeInTheDocument();
    expect(screen.getByText('Supv: Always')).toBeInTheDocument();
  });

  it('should show status badges', () => {
    renderComponent();

    const activeBadges = screen.getAllByText('Active');
    const inactiveBadges = screen.getAllByText('Inactive');

    expect(activeBadges.length).toBe(2);
    expect(inactiveBadges.length).toBe(1);
  });

  it('should show current rate for each task code', () => {
    renderComponent();

    const rate8Elements = screen.getAllByText('$8.00/hr');
    expect(rate8Elements.length).toBe(2); // F1 and F5 both have $8.00/hr
    expect(screen.getByText('$15.00/hr')).toBeInTheDocument();
  });

  it('should show minimum age badges', () => {
    renderComponent();

    const age12Badges = screen.getAllByText('12+');
    expect(age12Badges.length).toBe(2);
    expect(screen.getByText('18+')).toBeInTheDocument();
  });

  it('should have links to task code details', () => {
    renderComponent();

    const viewLinks = screen.getAllByRole('link', { name: 'View' });
    expect(viewLinks.length).toBe(3);

    const f1Link = screen.getByRole('link', { name: 'F1' });
    expect(f1Link).toHaveAttribute('href', '/task-codes/1');
  });

  it('should call useTaskCodes with filter options when filters change', async () => {
    renderComponent();

    const typeFilter = screen.getByLabelText('Type');
    fireEvent.change(typeFilter, { target: { value: 'true' } });

    await waitFor(() => {
      expect(useTaskCodesModule.useTaskCodes).toHaveBeenCalledWith(
        expect.objectContaining({
          isAgricultural: 'true',
        })
      );
    });
  });
});
