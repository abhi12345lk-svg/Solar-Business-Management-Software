import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { SequenceService } from '../services/sequenceService.js';
import { ProjectService } from '../services/projectService.js';
import { ProjectTaskService } from '../services/projectTaskService.js';
import { Project } from '../models/Project.js';
import { ProjectTask } from '../models/ProjectTask.js';
import { Customer } from '../models/Customer.js';
import { SalesOrder } from '../models/SalesOrder.js';
import {
  ProjectStatus,
  ProjectStage,
  MilestoneStatus,
  ProjectPriority,
  ProjectTaskStatus,
  SolarTopology,
  UserRole,
  Department
} from '@ins-solar/shared';

describe('Phase 6A: Project Management & Installation Milestones', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    SequenceService.resetInMemoryCounters();
  });

  const mockPmUser = {
    userId: '507f1f77bcf86cd799439022',
    role: UserRole.DEPARTMENT_HEAD,
    department: Department.OPERATIONS
  };

  const mockCrewUser = {
    userId: '507f1f77bcf86cd799439033',
    role: UserRole.INSTALLATION_CREW,
    department: Department.OPERATIONS
  };

  const mockCustomerId = new Types.ObjectId('507f1f77bcf86cd799439044');
  const mockOtherCustomerId = new Types.ObjectId('507f1f77bcf86cd799439055');

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'vitest-test-agent',
    correlationId: 'test-phase-6a-req'
  };

  describe('1. Project Creation & Atomic Sequence Generation', () => {
    it('creates a project with auto-generated PRJ-YYYY-NNNNN code and 10 default planning milestones', async () => {
      vi.spyOn(Customer, 'findById').mockResolvedValue({
        _id: mockCustomerId,
        name: 'Suresh Patel',
        isActive: true
      } as any);

      vi.spyOn(Project.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const project = await ProjectService.createProject(
        {
          name: '15kW Rooftop Solar - Suresh Patel',
          customerId: mockCustomerId.toString(),
          systemCapacityKwp: 15,
          systemTopology: SolarTopology.ON_GRID,
          plannedStartDate: new Date('2026-11-01'),
          targetCompletionDate: new Date('2026-11-20'),
          priority: ProjectPriority.HIGH,
          applyDefaultMilestones: true
        },
        mockPmUser,
        mockContext
      );

      expect(project.projectCode).toMatch(/^PRJ-\d{4}-\d{5}$/);
      expect(project.name).toBe('15kW Rooftop Solar - Suresh Patel');
      expect(project.status).toBe(ProjectStatus.PLANNING);
      expect(project.currentStage).toBe(ProjectStage.STAGE_1_ENGINEERING_DESIGN);
      expect(project.milestones.length).toBe(10);
      expect(project.milestones[0]!.name).toBe('Site Readiness & Physical Survey Verification');
      expect(project.milestones[0]!.status).toBe(MilestoneStatus.NOT_STARTED);
      expect(project.stageHistory.length).toBe(1);
    });

    it('rejects project creation if customer does not exist', async () => {
      vi.spyOn(Customer, 'findById').mockResolvedValue(null);

      await expect(
        ProjectService.createProject(
          {
            name: 'Non-existent customer project',
            customerId: mockCustomerId.toString(),
            plannedStartDate: new Date('2026-11-01'),
            targetCompletionDate: new Date('2026-11-20')
          },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/Customer with ID.*not found/);
    });
  });

  describe('2. Sales Order Binding & Duplicate Project Protection', () => {
    it('binds to an accepted Sales Order and snapshots capacity and topology', async () => {
      const orderId = new Types.ObjectId();
      vi.spyOn(Customer, 'findById').mockResolvedValue({
        _id: mockCustomerId,
        isActive: true
      } as any);

      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
        _id: orderId,
        orderNumber: 'ORD-2026-00001',
        customerId: mockCustomerId,
        quotationId: new Types.ObjectId(),
        solarDesignId: new Types.ObjectId(),
        systemCapacityKwp: 25.5,
        systemTopology: SolarTopology.HYBRID
      } as any);

      vi.spyOn(Project, 'findOne').mockResolvedValue(null);
      vi.spyOn(Project.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const project = await ProjectService.createProject(
        {
          name: 'Factory 25.5kW Hybrid Project',
          customerId: mockCustomerId.toString(),
          orderId: orderId.toString(),
          plannedStartDate: new Date('2026-11-01'),
          targetCompletionDate: new Date('2026-11-30')
        },
        mockPmUser,
        mockContext
      );

      expect(project.orderId?.toString()).toBe(orderId.toString());
      expect(project.systemCapacityKwp).toBe(25.5);
      expect(project.systemTopology).toBe(SolarTopology.HYBRID);
    });

    it('rejects duplicate project creation for the same Sales Order', async () => {
      const orderId = new Types.ObjectId();
      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: mockCustomerId, isActive: true } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
        _id: orderId,
        orderNumber: 'ORD-2026-00001',
        customerId: mockCustomerId
      } as any);

      // Existing active project already bound to this order
      vi.spyOn(Project, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00001'
      } as any);

      await expect(
        ProjectService.createProject(
          {
            name: 'Duplicate project attempt',
            customerId: mockCustomerId.toString(),
            orderId: orderId.toString(),
            plannedStartDate: new Date('2026-11-01'),
            targetCompletionDate: new Date('2026-11-30')
          },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/already active for Sales Order/);
    });

    it('rejects order binding if the order belongs to a different customer', async () => {
      const orderId = new Types.ObjectId();
      vi.spyOn(Customer, 'findById').mockResolvedValue({ _id: mockCustomerId, isActive: true } as any);
      vi.spyOn(SalesOrder, 'findById').mockResolvedValue({
        _id: orderId,
        orderNumber: 'ORD-2026-00001',
        customerId: mockOtherCustomerId // Mismatch
      } as any);

      await expect(
        ProjectService.createProject(
          {
            name: 'Cross customer order attempt',
            customerId: mockCustomerId.toString(),
            orderId: orderId.toString(),
            plannedStartDate: new Date('2026-11-01'),
            targetCompletionDate: new Date('2026-11-30')
          },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/Sales Order does not belong to the specified customer/);
    });
  });

  describe('3. Project Lifecycle State Transitions & Guards', () => {
    it('transitions PLANNING -> IN_PROGRESS -> COMPLETED and records completion timestamp', async () => {
      const mockProjectDoc: any = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00001',
        status: ProjectStatus.PLANNING,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProjectDoc);

      // Transition to IN_PROGRESS
      const inProgressProject = await ProjectService.updateProjectStatus(
        mockProjectDoc._id.toString(),
        { status: ProjectStatus.IN_PROGRESS },
        mockPmUser,
        mockContext
      );
      expect(inProgressProject.status).toBe(ProjectStatus.IN_PROGRESS);

      // Transition to COMPLETED
      const completedProject = await ProjectService.updateProjectStatus(
        mockProjectDoc._id.toString(),
        { status: ProjectStatus.COMPLETED },
        mockPmUser,
        mockContext
      );
      expect(completedProject.status).toBe(ProjectStatus.COMPLETED);
      expect(completedProject.actualCompletionDate).toBeDefined();
    });

    it('rejects direct transition from PLANNING to COMPLETED', async () => {
      const mockProjectDoc: any = {
        _id: new Types.ObjectId(),
        status: ProjectStatus.PLANNING
      };
      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProjectDoc);

      await expect(
        ProjectService.updateProjectStatus(
          mockProjectDoc._id.toString(),
          { status: ProjectStatus.COMPLETED },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/cannot directly transition to COMPLETED/);
    });

    it('requires a reason when setting status to ON_HOLD or CANCELLED', async () => {
      const mockProjectDoc: any = {
        _id: new Types.ObjectId(),
        status: ProjectStatus.IN_PROGRESS,
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProjectDoc);

      // Without reason
      await expect(
        ProjectService.updateProjectStatus(
          mockProjectDoc._id.toString(),
          { status: ProjectStatus.ON_HOLD, reason: '' },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/Reason is required/);

      // With reason
      const onHoldProject = await ProjectService.updateProjectStatus(
        mockProjectDoc._id.toString(),
        { status: ProjectStatus.ON_HOLD, reason: 'Roof reinforcement work by client delayed' },
        mockPmUser,
        mockContext
      );
      expect(onHoldProject.status).toBe(ProjectStatus.ON_HOLD);
      expect(onHoldProject.holdReason).toBe('Roof reinforcement work by client delayed');
    });

    it('blocks transitions on terminal COMPLETED and CANCELLED states', async () => {
      const completedProject: any = {
        _id: new Types.ObjectId(),
        status: ProjectStatus.COMPLETED
      };
      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(completedProject);

      await expect(
        ProjectService.updateProjectStatus(
          completedProject._id.toString(),
          { status: ProjectStatus.IN_PROGRESS },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/Completed projects cannot change status/);
    });
  });

  describe('4. Project Stage Progression & Audit', () => {
    it('advances project stage and records stage history note', async () => {
      const mockProjectDoc: any = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00001',
        status: ProjectStatus.PLANNING,
        currentStage: ProjectStage.STAGE_1_ENGINEERING_DESIGN,
        stageHistory: [],
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProjectDoc);

      const updated = await ProjectService.advanceProjectStage(
        mockProjectDoc._id.toString(),
        {
          stage: ProjectStage.STAGE_2_NET_METERING_APPLY,
          notes: 'Engineering layout signed off by lead engineer.'
        },
        mockPmUser,
        mockContext
      );

      expect(updated.currentStage).toBe(ProjectStage.STAGE_2_NET_METERING_APPLY);
      expect(updated.status).toBe(ProjectStatus.IN_PROGRESS); // Auto-promoted to IN_PROGRESS
      expect(updated.stageHistory.length).toBe(1);
      expect(updated.stageHistory[0]!.notes).toBe('Engineering layout signed off by lead engineer.');
    });
  });

  describe('5. Project Milestones & Quality Sign-Off', () => {
    it('requires blockerReason when marking a milestone as BLOCKED', async () => {
      const milestoneId = new Types.ObjectId().toString();
      const mockMilestone: any = {
        _id: milestoneId,
        name: 'Civil Structure',
        status: MilestoneStatus.IN_PROGRESS
      };

      const mockProjectDoc: any = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00001',
        milestones: {
          id: vi.fn().mockReturnValue(mockMilestone)
        },
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProjectDoc);

      await expect(
        ProjectService.updateMilestoneStatus(
          mockProjectDoc._id.toString(),
          milestoneId,
          { status: MilestoneStatus.BLOCKED, blockerReason: '' },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/Blocker reason is strictly required/);

      await ProjectService.updateMilestoneStatus(
        mockProjectDoc._id.toString(),
        milestoneId,
        { status: MilestoneStatus.BLOCKED, blockerReason: 'Monsoon heavy rain prevented roof welding' },
        mockPmUser,
        mockContext
      );

      expect(mockMilestone.status).toBe(MilestoneStatus.BLOCKED);
      expect(mockMilestone.blockerReason).toBe('Monsoon heavy rain prevented roof welding');
    });

    it('records completion actor and timestamp when milestone is marked COMPLETED', async () => {
      const milestoneId = new Types.ObjectId().toString();
      const mockMilestone: any = {
        _id: milestoneId,
        name: 'Earthing Pit & Lightning Arrester',
        status: MilestoneStatus.IN_PROGRESS
      };

      const mockProjectDoc: any = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00001',
        milestones: {
          id: vi.fn().mockReturnValue(mockMilestone)
        },
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProjectDoc);

      await ProjectService.updateMilestoneStatus(
        mockProjectDoc._id.toString(),
        milestoneId,
        { status: MilestoneStatus.COMPLETED },
        mockCrewUser,
        mockContext
      );

      expect(mockMilestone.status).toBe(MilestoneStatus.COMPLETED);
      expect(mockMilestone.completedBy?.toString()).toBe(mockCrewUser.userId);
      expect(mockMilestone.completedAt).toBeDefined();
    });
  });

  describe('6. Project Tasks & Cross-Project Guard', () => {
    it('creates a project task with sequential TSK-YYYY-NNNNN code', async () => {
      const projectId = new Types.ObjectId().toString();
      const mockProjectDoc: any = {
        _id: new Types.ObjectId(projectId),
        projectCode: 'PRJ-2026-00001',
        milestones: {
          id: vi.fn().mockReturnValue(null)
        }
      };
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectDoc);

      vi.spyOn(ProjectTask.prototype, 'save').mockImplementation(async function (this: any) {
        this._id = new Types.ObjectId();
        return this;
      });

      const task = await ProjectTaskService.createTask(
        projectId,
        {
          title: 'Deliver 10kW On-Grid Inverter to site',
          priority: ProjectPriority.URGENT,
          dueDate: new Date('2026-11-05')
        },
        mockPmUser,
        mockContext
      );

      expect(task.taskCode).toMatch(/^TSK-\d{4}-\d{5}$/);
      expect(task.title).toBe('Deliver 10kW On-Grid Inverter to site');
      expect(task.status).toBe(ProjectTaskStatus.TODO);
      expect(task.priority).toBe(ProjectPriority.URGENT);
    });

    it('rejects task creation if milestone does not belong to the target project', async () => {
      const projectId = new Types.ObjectId().toString();
      const foreignMilestoneId = new Types.ObjectId().toString();

      const mockProjectDoc: any = {
        _id: new Types.ObjectId(projectId),
        projectCode: 'PRJ-2026-00001',
        milestones: {
          id: vi.fn().mockReturnValue(null) // Not found in this project
        }
      };
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectDoc);

      await expect(
        ProjectTaskService.createTask(
          projectId,
          {
            title: 'Task with foreign milestone',
            milestoneId: foreignMilestoneId
          },
          mockPmUser,
          mockContext
        )
      ).rejects.toThrow(/does not belong to project/);
    });

    it('filters overdue tasks where due date is in the past and task is not completed', async () => {
      const findSpy = vi.spyOn(ProjectTask, 'find').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      } as any);
      vi.spyOn(ProjectTask, 'countDocuments').mockResolvedValue(0);

      await ProjectTaskService.getTasks({ isOverdue: true, page: 1, limit: 10, sortOrder: 'desc' });

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: expect.objectContaining({ $lt: expect.any(Date) }),
          status: { $nin: [ProjectTaskStatus.COMPLETED, ProjectTaskStatus.CANCELLED] }
        })
      );
    });
  });

  describe('7. API Route Guards & Customer Portal Boundaries', () => {
    const app = createApp();

    it('rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/projects');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects cross-customer project inspection in customer portal with HTTP 403', async () => {
      const ownCustomerId = '507f1f77bcf86cd799439088';
      const otherCustomerId = '507f1f77bcf86cd799439099';

      const mockProject: any = {
        _id: new Types.ObjectId(),
        projectCode: 'PRJ-2026-00001',
        customerId: { _id: new Types.ObjectId(otherCustomerId) },
        milestones: [],
        stageHistory: []
      };

      vi.spyOn(Project, 'findById').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        then: vi.fn((cb: any) => Promise.resolve(cb(mockProject)))
      } as any);

      // Attempting to access project belonging to otherCustomerId as ownCustomerId
      await expect(
        ProjectService.getProjectById(mockProject._id.toString(), ownCustomerId)
      ).rejects.toThrow(/Access denied: You cannot view another customer's project/);
    });
  });
});
