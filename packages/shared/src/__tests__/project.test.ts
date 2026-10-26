import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  updateProjectStatusSchema,
  createMilestoneSchema,
  updateMilestoneStatusSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  ProjectStatus,
  MilestoneStatus,
  ProjectPriority,
  ProjectTaskStatus,
  SolarTopology
} from '../index.js';

describe('Phase 6A — Shared Project, Milestone & Task Schemas', () => {
  const validCustomerId = '507f1f77bcf86cd799439011';
  const validOrderId = '507f1f77bcf86cd799439022';
  const validUserId = '507f1f77bcf86cd799439033';
  const validMilestoneId = '507f1f77bcf86cd799439044';

  it('validates a valid project creation payload', () => {
    const validProject = {
      name: 'Rooftop Solar 10kW - Mehta Residency',
      customerId: validCustomerId,
      orderId: validOrderId,
      projectManagerId: validUserId,
      systemCapacityKwp: 10.5,
      systemTopology: SolarTopology.ON_GRID,
      plannedStartDate: '2026-11-01T00:00:00.000Z',
      targetCompletionDate: '2026-11-20T00:00:00.000Z',
      priority: ProjectPriority.HIGH,
      notes: 'Customer requested completion before festive season.'
    };

    const result = createProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Rooftop Solar 10kW - Mehta Residency');
      expect(result.data.priority).toBe(ProjectPriority.HIGH);
      expect(result.data.applyDefaultMilestones).toBe(true);
      expect(result.data.plannedStartDate instanceof Date).toBe(true);
    }
  });

  it('rejects a project if target completion date is before planned start date', () => {
    const invalidProject = {
      name: 'Invalid Dates Solar Project',
      customerId: validCustomerId,
      plannedStartDate: '2026-11-20T00:00:00.000Z',
      targetCompletionDate: '2026-11-05T00:00:00.000Z' // Invalid: earlier than start date
    };

    const result = createProjectSchema.safeParse(invalidProject);
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.errors.find(e => e.path.includes('targetCompletionDate'));
      expect(err).toBeDefined();
      expect(err?.message).toContain('Target completion date must be on or after planned start date');
    }
  });

  it('validates project status change and requires reason for ON_HOLD and CANCELLED', () => {
    // Valid ON_HOLD with reason
    const validHold = updateProjectStatusSchema.safeParse({
      status: ProjectStatus.ON_HOLD,
      reason: 'Awaiting DISCOM net-meter sanction letter'
    });
    expect(validHold.success).toBe(true);

    // Invalid ON_HOLD without reason
    const invalidHold = updateProjectStatusSchema.safeParse({
      status: ProjectStatus.ON_HOLD,
      reason: '   '
    });
    expect(invalidHold.success).toBe(false);

    // Valid IN_PROGRESS without reason
    const validProgress = updateProjectStatusSchema.safeParse({
      status: ProjectStatus.IN_PROGRESS
    });
    expect(validProgress.success).toBe(true);
  });

  it('validates milestone creation and status updates', () => {
    const validMilestone = {
      name: 'Civil Structure & Rail Mounting',
      description: 'Mount HDG strut channels and rails on RCC roof',
      displayOrder: 5,
      plannedStartDate: '2026-11-05T00:00:00.000Z',
      dueDate: '2026-11-08T00:00:00.000Z',
      assignedUserId: validUserId
    };

    const parseResult = createMilestoneSchema.safeParse(validMilestone);
    expect(parseResult.success).toBe(true);

    // Status BLOCKED requires blockerReason
    const invalidBlocked = updateMilestoneStatusSchema.safeParse({
      status: MilestoneStatus.BLOCKED
    });
    expect(invalidBlocked.success).toBe(false);

    const validBlocked = updateMilestoneStatusSchema.safeParse({
      status: MilestoneStatus.BLOCKED,
      blockerReason: 'Roof access key unavailable from building society'
    });
    expect(validBlocked.success).toBe(true);

    const validCompleted = updateMilestoneStatusSchema.safeParse({
      status: MilestoneStatus.COMPLETED,
      completionNotes: 'Torque inspected and signed off'
    });
    expect(validCompleted.success).toBe(true);
  });

  it('validates project task creation and updates', () => {
    const validTask = {
      title: 'Procure 25mm earthing copper tape',
      description: 'Need 30m coil for grounding termination',
      milestoneId: validMilestoneId,
      assignedUserId: validUserId,
      priority: ProjectPriority.URGENT,
      dueDate: '2026-11-06T00:00:00.000Z'
    };

    const taskResult = createProjectTaskSchema.safeParse(validTask);
    expect(taskResult.success).toBe(true);

    const updateTaskResult = updateProjectTaskSchema.safeParse({
      status: ProjectTaskStatus.COMPLETED,
      priority: ProjectPriority.HIGH
    });
    expect(updateTaskResult.success).toBe(true);
  });
});
