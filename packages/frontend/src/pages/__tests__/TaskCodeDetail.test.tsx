import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TaskCodeDetail } from '../TaskCodeDetail';
import * as useTaskCodesModule from '../../hooks/useTaskCodes';

vi.mock('../../hooks/useTaskCodes');

const mockTaskCode = {
  id: '1',
  code: 'F1',
  name: 'Field Harvesting - Light',
  description: 'Light crop harvesting, berry picking',
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
  rateHistory: [
    {
      id: 'rate-1',
      taskCodeId: '1',
      hourlyRate: '8.00',
      effectiveDate: '2024-01-01',
      justificationNotes: 'Initial rate',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
};

const renderComponent = (taskCodeId = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/task-codes/${taskCodeId}`]}>
      <Routes>
        <Route path="/task-codes/:id" element={<TaskCodeDetail />} />
        <Route path="/task-codes" element={<div>Task Code List</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('TaskCodeDetail', () => {
  const mockRefetch = vi.fn();
  const mockArchiveTaskCode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTaskCodesModule.useTaskCode).mockReturnValue({
      taskCode: mockTaskCode,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
    vi.mocked(useTaskCodesModule.useTaskCodeActions).mockReturnValue({
      createTaskCode: vi.fn(),
      updateTaskCode: vi.fn(),
      addRate: vi.fn(),
      archiveTaskCode: mockArchiveTaskCode,
      loading: false,
      error: null,
    });
  });

  it('should render the task code header', () => {
    renderComponent();

    expect(
      screen.getByRole('heading', { name: /F1.*Field Harvesting - Light/i })
    ).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    renderComponent();

    expect(screen.getByRole('link', { name: /Back to Task Codes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
  });

  it('should display task code information', () => {
    renderComponent();

    expect(screen.getByText('Task Code Information')).toBeInTheDocument();
    expect(screen.getByText('Light crop harvesting, berry picking')).toBeInTheDocument();
    expect(screen.getByText('Agricultural')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('$8.00/hr')).toBeInTheDocument();
    expect(screen.getByText('12+')).toBeInTheDocument();
  });

  it('should display compliance attributes', () => {
    renderComponent();

    expect(screen.getByText('Compliance Attributes')).toBeInTheDocument();
    expect(screen.getByText('Hazardous Work')).toBeInTheDocument();
    expect(screen.getByText('Supervisor Required')).toBeInTheDocument();
    expect(screen.getByText('For Minors')).toBeInTheDocument();
    expect(screen.getByText('Solo Cash Handling')).toBeInTheDocument();
    expect(screen.getByText('Driving Required')).toBeInTheDocument();
    expect(screen.getByText('Power Machinery')).toBeInTheDocument();
  });

  it('should display rate history', () => {
    renderComponent();

    expect(screen.getByText('Rate History')).toBeInTheDocument();
    expect(screen.getByText('$8.00')).toBeInTheDocument();
    expect(screen.getByText('Initial rate')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    vi.mocked(useTaskCodesModule.useTaskCode).mockReturnValue({
      taskCode: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('Loading task code...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    vi.mocked(useTaskCodesModule.useTaskCode).mockReturnValue({
      taskCode: null,
      loading: false,
      error: 'Failed to load task code',
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('Error: Failed to load task code')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Task Codes' })).toBeInTheDocument();
  });

  it('should show archive button for active task codes', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('should not show archive button for inactive task codes', () => {
    vi.mocked(useTaskCodesModule.useTaskCode).mockReturnValue({
      taskCode: { ...mockTaskCode, isActive: false },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
  });

  it('should show archive confirmation modal when archive button clicked', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(screen.getByText('Archive Task Code')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to archive task code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // There should now be two Archive buttons (header + modal)
    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    expect(archiveButtons.length).toBe(2);
  });

  it('should close archive modal when cancel clicked', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Archive Task Code')).not.toBeInTheDocument();
  });

  it('should call archiveTaskCode when confirm clicked', async () => {
    mockArchiveTaskCode.mockResolvedValueOnce({ ...mockTaskCode, isActive: false });
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    // Find the confirm button in the modal (second Archive button)
    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    fireEvent.click(archiveButtons[1]);

    await waitFor(() => {
      expect(mockArchiveTaskCode).toHaveBeenCalledWith('1');
    });
  });

  it('should have add new rate button', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: '+ Add New Rate' })).toBeInTheDocument();
  });

  it('should show no rates message when rate history is empty', () => {
    vi.mocked(useTaskCodesModule.useTaskCode).mockReturnValue({
      taskCode: { ...mockTaskCode, rateHistory: [] },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('No rate history available.')).toBeInTheDocument();
  });

  it('should show "No description provided" when description is empty', () => {
    vi.mocked(useTaskCodesModule.useTaskCode).mockReturnValue({
      taskCode: { ...mockTaskCode, description: null },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderComponent();

    expect(screen.getByText('No description provided')).toBeInTheDocument();
  });
});
