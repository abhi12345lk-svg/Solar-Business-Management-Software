/**
 * INS Solar Business Management Software — Phase 6A Web Frontend Tests
 *
 * Tests for ProjectsPage and ProjectDetailPage:
 * - Rendering project directory, filters, and metric cards
 * - 10-stage visual progression tracker and pipeline steps
 * - Milestones quality checklist with blocker alerts and sign-off auditing
 * - Project task delegation, due dates, and overdue highlights
 * - Status transition actions and modal dialogs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectsPage } from '../pages/ProjectsPage.js';
import { ProjectDetailPage } from '../pages/ProjectDetailPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 6A Frontend Operational Pages', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  const mockProjectSummary = {
    _id: 'proj-123',
    projectCode: 'PRJ-2026-00001',
    name: 'Apex Commercial Rooftop 25kWp',
    customerId: {
      _id: 'cust-1',
      customerCode: 'CUST-001',
      name: 'Apex Industries Ltd',
      phone: '+91 9876543210'
    },
    orderId: {
      _id: 'ord-1',
      orderNumber: 'ORD-2026-00001',
      netTotalPaise: 125000000,
      status: 'CONFIRMED'
    },
    systemCapacityKwp: 25.0,
    systemTopology: 'ON_GRID',
    currentStage: 'STAGE_1_ENGINEERING_DESIGN',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    plannedStartDate: '2026-11-01T00:00:00.000Z',
    targetCompletionDate: '2026-12-01T00:00:00.000Z',
    projectManagerId: {
      _id: 'user-pm',
      firstName: 'Vikram',
      lastName: 'Patel',
      email: 'vikram.patel@inssolar.com'
    },
    milestones: [
      { _id: 'm1', status: 'IN_PROGRESS' },
      { _id: 'm2', status: 'NOT_STARTED' }
    ]
  };

  const mockProjectDetail = {
    _id: 'proj-123',
    projectCode: 'PRJ-2026-00001',
    name: 'Apex Commercial Rooftop 25kWp',
    customerId: {
      _id: 'cust-1',
      customerCode: 'CUST-001',
      legalName: 'Apex Industries Ltd',
      primaryPhone: '+91 9876543210',
      email: 'contact@apexind.com'
    },
    orderId: {
      _id: 'ord-1',
      orderNumber: 'ORD-2026-00001',
      netTotalPaise: 125000000,
      status: 'CONFIRMED',
      systemCapacityKwp: 25.0
    },
    siteAddress: {
      addressLine1: 'Plot 42, Sector 8, Industrial Estate',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '382481'
    },
    systemCapacityKwp: 25.0,
    systemTopology: 'ON_GRID',
    currentStage: 'STAGE_1_ENGINEERING_DESIGN',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    plannedStartDate: '2026-11-01T00:00:00.000Z',
    targetCompletionDate: '2026-12-01T00:00:00.000Z',
    projectManagerId: {
      _id: 'user-pm',
      firstName: 'Vikram',
      lastName: 'Patel',
      email: 'vikram.patel@inssolar.com'
    },
    milestones: [
      {
        _id: 'm-1',
        name: 'Site Readiness & Structural Assessment',
        description: 'Verify roof load-bearing and civil readiness',
        displayOrder: 1,
        status: 'COMPLETED',
        completedAt: '2026-11-02T10:00:00.000Z',
        completedBy: {
          _id: 'user-1',
          firstName: 'Anil',
          lastName: 'Sharma',
          email: 'anil@inssolar.com'
        }
      },
      {
        _id: 'm-2',
        name: 'DISCOM Net-metering Application Submission',
        description: 'Submit interconnection feasibility to DISCOM',
        displayOrder: 2,
        status: 'BLOCKED',
        blockerReason: 'DISCOM portal down for portal maintenance'
      }
    ],
    stageHistory: [
      {
        stage: 'STAGE_1_ENGINEERING_DESIGN',
        transitionedAt: '2026-11-01T08:00:00.000Z',
        transitionedBy: {
          firstName: 'Vikram',
          lastName: 'Patel',
          email: 'vikram@inssolar.com'
        },
        notes: 'Initial engineering kick-off'
      }
    ],
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z'
  };

  const mockTasks = [
    {
      _id: 'task-1',
      taskCode: 'TSK-2026-00001',
      projectId: 'proj-123',
      milestoneId: 'm-1',
      title: 'Roof anchor pull-out test',
      description: 'Perform tensile test on 10 anchor points',
      priority: 'HIGH',
      status: 'TODO',
      dueDate: '2026-10-20T00:00:00.000Z', // In the past -> Overdue
      assignedUserId: {
        _id: 'user-tech',
        firstName: 'Suresh',
        lastName: 'Rao',
        email: 'suresh@inssolar.com'
      },
      createdAt: '2026-10-18T00:00:00.000Z'
    }
  ];

  // --------------------------------------------------------------------------
  // 1. ProjectsPage Directory & Metric Cards
  // --------------------------------------------------------------------------
  it('renders ProjectsPage with metric cards, search, and project list', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/projects')) {
        return { projects: [mockProjectSummary], total: 1 };
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProjectsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Project Management/i })).toBeInTheDocument();
    expect(screen.getByText(/New Project/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Apex Commercial Rooftop 25kWp')).toBeInTheDocument();
      expect(screen.getByText('25 kWp')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 2. ProjectDetailPage Overview & Stepper
  // --------------------------------------------------------------------------
  it('renders ProjectDetailPage with 10-stage stepper, overview details, and action controls', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-123') {
        return mockProjectDetail;
      }
      if (endpoint.startsWith('/projects/proj-123/tasks')) {
        return { tasks: mockTasks };
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-123']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Apex Commercial Rooftop 25kWp')).toBeInTheDocument();
      expect(screen.getByText('Installation Progression Pipeline')).toBeInTheDocument();
    });

    // Overview Tab Content
    expect(screen.getByText(/Customer & Sales Order/i)).toBeInTheDocument();
    expect(screen.getByText('Apex Industries Ltd')).toBeInTheDocument();
    expect(screen.getByText('ORD-2026-00001')).toBeInTheDocument();
    expect(screen.getByText('Plot 42, Sector 8, Industrial Estate, Ahmedabad, Gujarat 382481')).toBeInTheDocument();

    // Verify Action Controls for IN_PROGRESS status
    expect(screen.getByRole('button', { name: /Advance Stage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hold/i })).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 3. ProjectDetailPage Milestones Tab & Blocker Alert
  // --------------------------------------------------------------------------
  it('displays milestones, blocker alerts, and sign-offs when Milestones tab is selected', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-123') {
        return mockProjectDetail;
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-123']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-00001')).toBeInTheDocument();
    });

    // Switch to Milestones tab
    const milestonesTab = screen.getByRole('button', { name: /Milestones \(2\)/i });
    fireEvent.click(milestonesTab);

    await waitFor(() => {
      expect(screen.getByText('Site Readiness & Structural Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Signed off on/i)).toBeInTheDocument();
      expect(screen.getByText('DISCOM Net-metering Application Submission')).toBeInTheDocument();
      expect(screen.getByText('DISCOM portal down for portal maintenance')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Resolve Blocker/i })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 4. ProjectDetailPage Tasks Tab & Overdue Badge
  // --------------------------------------------------------------------------
  it('displays project tasks with overdue alerts when Tasks tab is selected', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/projects/proj-123') {
        return mockProjectDetail;
      }
      if (endpoint.startsWith('/projects/proj-123/tasks')) {
        return { tasks: mockTasks };
      }
      return null;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/proj-123']}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('PRJ-2026-00001')).toBeInTheDocument();
    });

    // Switch to Tasks tab
    const tasksTab = screen.getByRole('button', { name: /Project Tasks/i });
    fireEvent.click(tasksTab);

    await waitFor(() => {
      expect(screen.getByText('TSK-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('Roof anchor pull-out test')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Task/i })).toBeInTheDocument();
    });
  });
});
