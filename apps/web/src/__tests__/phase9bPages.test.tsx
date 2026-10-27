/**
 * INS Solar Business Management Software — Phase 9B Frontend Tests
 *
 * Tests for Employee/Team, Unified Tasks & Document Management interfaces:
 * - Employee Directory & Workload dashboard with department filters
 * - Crews & Team Management with eligibility badges and status toggles
 * - Unified Tasks view with overdue filters, status badges, and action triggers
 * - Private Document Vault with categories, version chips, and signed download triggers
 * - Customer Portal "My Documents" tab with client-visible file downloads
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeesPage } from '../pages/EmployeesPage.js';
import { TeamsPage } from '../pages/TeamsPage.js';
import { TasksPage } from '../pages/TasksPage.js';
import { DocumentsPage } from '../pages/DocumentsPage.js';
import { CustomerPortalPage } from '../pages/CustomerPortalPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 9B Frontend: Operations, Teams, Tasks & Document Vault', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockEmployeesData = {
    items: [
      {
        _id: 'emp-001',
        employeeCode: 'EMP-2026-00001',
        designation: 'Senior Project Engineer',
        department: 'OPERATIONS',
        isTeamLead: true,
        employmentStatus: 'ACTIVE',
        availability: 'AVAILABLE',
        joiningDate: '2026-01-15T00:00:00.000Z',
        skills: ['Rooftop-Structure', 'String-Inverters'],
        isActive: true,
        userId: {
          _id: 'user-001',
          firstName: 'Rahul',
          lastName: 'Sharma',
          email: 'rahul.sharma@inssolar.com',
          phone: '+919876543210',
          role: 'INSTALLATION_CREW',
          department: 'OPERATIONS',
          isActive: true
        },
        teamId: {
          _id: 'tem-001',
          teamCode: 'TEM-2026-00001',
          name: 'Delhi Rooftop Crew Alpha',
          purpose: 'High-rise residential installations'
        },
        workload: {
          activeTasks: 4,
          activeVisits: 1,
          activeProjects: 2
        }
      }
    ],
    total: 1
  };

  const mockTeamsData = {
    items: [
      {
        _id: 'tem-001',
        teamCode: 'TEM-2026-00001',
        name: 'Delhi Rooftop Crew Alpha',
        department: 'OPERATIONS',
        purpose: 'High-rise residential installations',
        skills: ['Rooftop-Structure', 'Safety-Harness'],
        eligibility: {
          projectTasks: true,
          serviceVisits: false
        },
        isActive: true,
        teamLeadId: {
          _id: 'user-001',
          firstName: 'Rahul',
          lastName: 'Sharma',
          phone: '+919876543210'
        },
        memberUserIds: [{ _id: 'user-002', firstName: 'Amit', lastName: 'Kumar' }],
        activeTasks: 4
      }
    ],
    total: 1
  };

  const mockTasksData = {
    items: [
      {
        _id: 'tsk-001',
        taskNumber: 'TSK-2026-00001',
        title: 'Conduct Earth Pit Resistance Megger Testing',
        description: 'Verify impedance < 5 ohms for inverter earthing',
        category: 'INSTALLATION_CHECKLIST',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-10-30T00:00:00.000Z',
        isOverdue: false,
        projectId: {
          _id: 'prj-001',
          projectNumber: 'PRJ-2026-00001',
          title: 'Sharma 10kWp Rooftop System'
        },
        assignedUserId: {
          _id: 'user-001',
          firstName: 'Rahul',
          lastName: 'Sharma'
        }
      }
    ],
    total: 1
  };

  const mockDocumentsData = {
    items: [
      {
        _id: 'doc-001',
        documentNumber: 'DOC-2026-00001',
        originalFilename: 'single_line_diagram_rev2.pdf',
        safeDisplayName: 'Engineering SLD 10kWp Bifacial',
        category: 'ENGINEERING_DRAWING',
        accessClassification: 'CUSTOMER_VISIBLE',
        reviewStatus: 'ACCEPTED',
        storageKey: 'documents/engineering_drawing/2026/DOC-2026-00001_sld.pdf',
        storageStatus: 'SIMULATED_STORAGE_ONLY',
        mimeType: 'application/pdf',
        fileSizeBytes: 1048576,
        version: 1,
        isLatestVersion: true,
        isArchived: false,
        createdAt: '2026-10-27T00:00:00.000Z'
      }
    ],
    total: 1
  };

  it('renders Employee Directory with real-time workload counters and status pills', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url: string) => {
      if (url.includes('/employees')) {
        return mockEmployeesData as any;
      }
      return null as any;
    });

    render(
      <MemoryRouter>
        <EmployeesPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Employee Directory & Workload')).toBeDefined();
    expect(screen.getByText('Link New Employee')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Rahul Sharma')).toBeDefined();
      expect(screen.getByText('EMP-2026-00001')).toBeDefined();
      expect(screen.getByText('Senior Project Engineer')).toBeDefined();
      expect(screen.getByText('4 tasks')).toBeDefined();
      expect(screen.getByText('1 visits')).toBeDefined();
    });
  });

  it('renders Crews & Team Management with crew code and assignment eligibility', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url: string) => {
      if (url.includes('/teams')) {
        return mockTeamsData as any;
      }
      return null as any;
    });

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Crews & Team Management')).toBeDefined();
    expect(screen.getByText('Create New Crew/Team')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Delhi Rooftop Crew Alpha')).toBeDefined();
      expect(screen.getByText('TEM-2026-00001')).toBeDefined();
      expect(screen.getByText('Projects')).toBeDefined(); // Eligibility tag
      expect(screen.getByText('Rahul Sharma')).toBeDefined();
    });
  });

  it('renders Unified Tasks view with task code, priority, and status update actions', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url: string) => {
      if (url.includes('/tasks')) {
        return mockTasksData as any;
      }
      return null as any;
    });

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Unified Task Management')).toBeDefined();
    expect(screen.getByText('Create Task')).toBeDefined();
    expect(screen.getByText('Show Overdue Only')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('TSK-2026-00001')).toBeDefined();
      expect(screen.getByText('Conduct Earth Pit Resistance Megger Testing')).toBeDefined();
      expect(screen.getByText('HIGH')).toBeDefined();
      expect(screen.getByText(/IN[ _]PROGRESS/)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Status' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Reassign' })).toBeDefined();
    });
  });

  it('renders Private Document Vault with access classifications and signed download actions', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url: string) => {
      if (url.includes('/documents')) {
        return mockDocumentsData as any;
      }
      return null as any;
    });

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Private Document Vault & Library')).toBeDefined();
    expect(screen.getByText('Upload to Vault')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('DOC-2026-00001')).toBeDefined();
      expect(screen.getByText('Engineering SLD 10kWp Bifacial')).toBeDefined();
      expect(screen.getByText('CUSTOMER VISIBLE')).toBeDefined();
      expect(screen.getByText('ACCEPTED')).toBeDefined();
      expect(screen.getByText('v1')).toBeDefined();
    });
  });

  it('renders Customer Portal Documents tab with customer-accessible verified files', async () => {
    vi.spyOn(apiModule, 'apiClient').mockImplementation(async (url: string) => {
      if (url.includes('/customer-portal/documents')) {
        return {
          items: [
            {
              _id: 'doc-001',
              documentNumber: 'DOC-2026-00001',
              safeDisplayName: 'Approved Net Metering SLD',
              originalFilename: 'approved_sld.pdf',
              category: 'ENGINEERING_DRAWING',
              version: 1,
              fileSizeBytes: 1048576,
              createdAt: '2026-10-27T00:00:00.000Z'
            }
          ]
        } as any;
      }
      if (url.includes('/customer-portal/dashboard')) {
        return { customer: { name: 'Asha Sharma' }, projects: [] } as any;
      }
      if (url.includes('/customer-portal/notifications')) {
        return { items: [], unreadCount: 0 } as any;
      }
      return null as any;
    });

    render(
      <MemoryRouter initialEntries={['/customer-portal?tab=DOCUMENTS']}>
        <CustomerPortalPage defaultTab="DOCUMENTS" />
      </MemoryRouter>
    );

    const myDocsBtn = screen.getByText('My Documents');
    expect(myDocsBtn).toBeDefined();
    fireEvent.click(myDocsBtn);

    await waitFor(() => {
      expect(screen.getByText('Verified Project & Compliance Documents')).toBeDefined();
      expect(screen.getByText('DOC-2026-00001')).toBeDefined();
      expect(screen.getByText('Approved Net Metering SLD')).toBeDefined();
      expect(screen.getByRole('button', { name: /Download/i })).toBeDefined();
    });
  });
});
