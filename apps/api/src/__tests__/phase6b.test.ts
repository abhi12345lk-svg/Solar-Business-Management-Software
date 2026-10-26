/**
 * INS Solar Business Management Software — Phase 6B Integration Tests
 *
 * Comprehensive test suite for Installation Execution & Inventory-to-Site Integration:
 * - Material dispatch creation & atomic sequence generation (DSP-YYYY-NNNNN)
 * - Concurrency & negative-stock prevention
 * - Serial number tracking & location consistency
 * - Idempotency protection
 * - Dispatch cancellation with compensating stock movements and balance restoration
 * - 5-category checklist generation & duplicate prevention
 * - Mandatory checklist item completion & evidence enforcement
 * - Commissioning stage gate check
 * - Evidence GPS coordinate boundary validation
 * - Customer multi-tenant isolation
 * - 401 Unauthenticated access guards
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  MaterialDispatchStatus,
  ChecklistCategory,
  ChecklistItemStatus,
  ProjectStage,
  ProjectStatus,
  UserRole
} from '@ins-solar/shared';
import { createApp } from '../app.js';
import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { MaterialDispatch } from '../models/MaterialDispatch.js';
import { StockReservation } from '../models/StockReservation.js';
import { InstallationChecklistTemplate } from '../models/InstallationChecklistTemplate.js';
import { ProjectInstallationChecklist } from '../models/ProjectInstallationChecklist.js';
import { MaterialDispatchService } from '../services/materialDispatchService.js';
import { ChecklistService } from '../services/checklistService.js';
import { ProjectService } from '../services/projectService.js';

describe('Phase 6B Integration: Installation Execution & Inventory Integration', () => {
  let app: any;
  const adminUser = { userId: new Types.ObjectId().toString(), role: UserRole.ADMIN };
  const sampleProjectId = new Types.ObjectId().toString();
  const sampleCustomerId = new Types.ObjectId().toString();
  const sampleWarehouseId = new Types.ObjectId().toString();
  const sampleProductId = new Types.ObjectId().toString();
  const sampleOrderId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();
  });

  // --------------------------------------------------------------------------
  // 1. Material Dispatch Creation & Atomic Sequence Generation
  // --------------------------------------------------------------------------
  it('creates a material dispatch, updates StockBalance, and records StockMovement with DSP sequence', async () => {
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001',
      status: ProjectStatus.IN_PROGRESS,
      customerId: new Types.ObjectId(sampleCustomerId),
      orderId: new Types.ObjectId(sampleOrderId),
      siteAddress: {
        addressLine1: '42 Solar Park',
        city: 'Ahmedabad',
        state: 'Gujarat',
        postalCode: '380001'
      }
    };

    const mockWarehouse = {
      _id: new Types.ObjectId(sampleWarehouseId),
      name: 'Main Depot',
      code: 'DEPOT-01',
      isActive: true
    };

    const mockProduct = {
      _id: new Types.ObjectId(sampleProductId),
      name: 'Mono PERC 540W Panel',
      sku: 'SOL-540-MONO',
      isActive: true
    };

    const mockOrder = {
      _id: new Types.ObjectId(sampleOrderId),
      lineItems: [{ productId: mockProduct._id, quantity: 50 }]
    };

    vi.spyOn(Project, 'findById').mockResolvedValue(mockProject as any);
    vi.spyOn(Warehouse, 'findById').mockResolvedValue(mockWarehouse as any);
    vi.spyOn(SalesOrder, 'findById').mockResolvedValue(mockOrder as any);
    vi.spyOn(Product, 'findById').mockResolvedValue(mockProduct as any);
    vi.spyOn(MaterialDispatch, 'find').mockResolvedValue([]);
    vi.spyOn(StockReservation, 'findOneAndUpdate').mockResolvedValue(null);

    // Stock Balance deduction mock (atomic update)
    vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({
      onHandQuantity: 40,
      availableQuantity: 40
    } as any);

    // Stock Movement save mock
    vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    // Material Dispatch save mock
    vi.spyOn(MaterialDispatch.prototype, 'save').mockImplementation(async function (this: any) {
      this._id = new Types.ObjectId();
      return this;
    });

    const dispatch = await MaterialDispatchService.createDispatch(
      {
        projectId: sampleProjectId,
        sourceWarehouseId: sampleWarehouseId,
        lineItems: [
          {
            productId: sampleProductId,
            requestedQuantity: 10
          }
        ],
        vehicleNumber: 'GJ-01-AB-1234',
        driverName: 'Suresh Kumar'
      },
      adminUser
    );

    expect(dispatch.dispatchNumber).toMatch(/^DSP-\d{4}-\d{5}$/);
    expect(dispatch.status).toBe(MaterialDispatchStatus.DISPATCHED);
    expect(dispatch.lineItems[0]!.issuedQuantity).toBe(10);
  });

  // --------------------------------------------------------------------------
  // 2. Insufficient Stock Rejection & Concurrency Protection
  // --------------------------------------------------------------------------
  it('rejects dispatch and prevents negative stock when physical inventory is insufficient', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProjectId),
      status: ProjectStatus.IN_PROGRESS
    } as any);

    vi.spyOn(Warehouse, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleWarehouseId),
      isActive: true
    } as any);

    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProductId),
      name: 'Mono PERC 540W Panel',
      isActive: true
    } as any);

    // Simulate atomic update failure when stock is insufficient (findOneAndUpdate returns null)
    vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue(null);

    await expect(
      MaterialDispatchService.createDispatch(
        {
          projectId: sampleProjectId,
          sourceWarehouseId: sampleWarehouseId,
          lineItems: [{ productId: sampleProductId, requestedQuantity: 100 }]
        },
        adminUser
      )
    ).rejects.toThrow(/Insufficient physical inventory/);
  });

  // --------------------------------------------------------------------------
  // 3. Serial Number Tracking & Incompatible Status Rejection
  // --------------------------------------------------------------------------
  it('validates serial numbers and rejects when serial number is not in stock or available', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProjectId),
      status: ProjectStatus.IN_PROGRESS
    } as any);

    vi.spyOn(Warehouse, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleWarehouseId),
      isActive: true
    } as any);

    vi.spyOn(Product, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProductId),
      name: '5kW Hybrid Inverter',
      isActive: true
    } as any);

    vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({ onHandQuantity: 5 } as any);

    // Serial number lookup fails (already issued or wrong warehouse)
    vi.spyOn(ProductSerialNumber, 'findOneAndUpdate').mockResolvedValue(null);

    await expect(
      MaterialDispatchService.createDispatch(
        {
          projectId: sampleProjectId,
          sourceWarehouseId: sampleWarehouseId,
          lineItems: [
            {
              productId: sampleProductId,
              requestedQuantity: 1,
              serialNumbers: ['INV-ALREADY-ISSUED']
            }
          ]
        },
        adminUser
      )
    ).rejects.toThrow(/is not in stock or available/);
  });

  // --------------------------------------------------------------------------
  // 4. Idempotency Protection for Duplicate Issue Transactions
  // --------------------------------------------------------------------------
  it('returns existing dispatch record when duplicate idempotency key is submitted', async () => {
    const existingDispatch = {
      _id: new Types.ObjectId(),
      dispatchNumber: 'DSP-2026-00001',
      idempotencyKey: 'idem-key-123',
      populate: vi.fn().mockReturnThis()
    };

    vi.spyOn(MaterialDispatch, 'findOne').mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(existingDispatch)
        })
      })
    } as any);

    const result = await MaterialDispatchService.createDispatch(
      {
        projectId: sampleProjectId,
        sourceWarehouseId: sampleWarehouseId,
        idempotencyKey: 'idem-key-123',
        lineItems: [{ productId: sampleProductId, requestedQuantity: 1 }]
      },
      adminUser
    );

    expect(result.dispatchNumber).toBe('DSP-2026-00001');
  });

  // --------------------------------------------------------------------------
  // 5. Dispatch Cancellation & Compensating Stock Return
  // --------------------------------------------------------------------------
  it('cancels dispatch, creates compensating return movement, and restores StockBalance', async () => {
    const mockDispatch = {
      _id: new Types.ObjectId(),
      dispatchNumber: 'DSP-2026-00001',
      projectId: new Types.ObjectId(sampleProjectId),
      sourceWarehouseId: new Types.ObjectId(sampleWarehouseId),
      status: MaterialDispatchStatus.DISPATCHED,
      lineItems: [
        {
          productId: new Types.ObjectId(sampleProductId),
          issuedQuantity: 5,
          serialNumbers: ['PANEL-001']
        }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(MaterialDispatch, 'findById').mockResolvedValue(mockDispatch as any);
    vi.spyOn(Project, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001'
    } as any);
    const balanceUpdateSpy = vi.spyOn(StockBalance, 'findOneAndUpdate').mockResolvedValue({} as any);
    const serialUpdateSpy = vi.spyOn(ProductSerialNumber, 'findOneAndUpdate').mockResolvedValue({} as any);
    const movementSaveSpy = vi.spyOn(StockMovement.prototype, 'save').mockResolvedValue(true as any);

    const cancelled = await MaterialDispatchService.cancelDispatch(
      mockDispatch._id.toString(),
      { cancellationReason: 'Client requested reschedule due to weather' },
      adminUser
    );

    expect(cancelled.status).toBe(MaterialDispatchStatus.CANCELLED);
    expect(cancelled.cancellationReason).toBe('Client requested reschedule due to weather');
    expect(balanceUpdateSpy).toHaveBeenCalled();
    expect(serialUpdateSpy).toHaveBeenCalled();
    expect(movementSaveSpy).toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 6. Checklist Generation & Duplicate Prevention
  // --------------------------------------------------------------------------
  it('generates 5-category checklist and prevents duplicate generation for same template version', async () => {
    vi.spyOn(Project, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001'
    } as any);

    vi.spyOn(InstallationChecklistTemplate, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      templateCode: 'CKT-STANDARD-ROOFTOP',
      version: 1,
      categories: [
        {
          category: ChecklistCategory.SITE_READINESS_SAFETY,
          title: '1. Site Readiness',
          items: [{ itemCode: 'CHK-01-01', description: 'Roof inspection', isRequired: true, requiresEvidence: true }]
        }
      ]
    } as any);

    vi.spyOn(ProjectInstallationChecklist, 'findOne')
      .mockResolvedValueOnce(null) // First call: no checklist exists
      .mockResolvedValueOnce({ _id: new Types.ObjectId() } as any); // Second call: duplicate detected

    vi.spyOn(ProjectInstallationChecklist.prototype, 'save').mockResolvedValue(true as any);

    const checklist = await ChecklistService.generateProjectChecklist(sampleProjectId, 'CKT-STANDARD-ROOFTOP', adminUser);
    expect(checklist.templateVersion).toBe(1);
    expect(checklist.categories.length).toBe(1);

    // Second call should throw duplicate resource
    await expect(
      ChecklistService.generateProjectChecklist(sampleProjectId, 'CKT-STANDARD-ROOFTOP', adminUser)
    ).rejects.toThrow(/already exists/);
  });

  // --------------------------------------------------------------------------
  // 7. Checklist Mandatory Status Transitions (FAILED requires reason, BLOCKED requires reason)
  // --------------------------------------------------------------------------
  it('strictly requires failureReason when FAILED and blockerReason when BLOCKED', async () => {
    const itemId = new Types.ObjectId();
    const mockChecklist = {
      _id: new Types.ObjectId(),
      categories: [
        {
          title: 'Electrical',
          items: [
            {
              _id: itemId,
              itemCode: 'CHK-03-03',
              description: 'Earthing pit resistance',
              status: ChecklistItemStatus.NOT_STARTED,
              evidence: []
            }
          ]
        }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    // Attach Mongoose subdocument id method
    (mockChecklist.categories[0]!.items as any).id = vi.fn().mockReturnValue(mockChecklist.categories[0]!.items[0]);

    vi.spyOn(ChecklistService, 'getProjectChecklist').mockResolvedValue(mockChecklist as any);

    // Fail without reason -> rejects
    await expect(
      ChecklistService.updateItemStatus(
        sampleProjectId,
        itemId.toString(),
        { status: ChecklistItemStatus.FAILED, failureReason: '' },
        adminUser
      )
    ).rejects.toThrow(/Failure reason is strictly required/);

    // Block without reason -> rejects
    await expect(
      ChecklistService.updateItemStatus(
        sampleProjectId,
        itemId.toString(),
        { status: ChecklistItemStatus.BLOCKED, blockerReason: '' },
        adminUser
      )
    ).rejects.toThrow(/Blocker reason is strictly required/);

    // Pass with valid reason
    const updated = await ChecklistService.updateItemStatus(
      sampleProjectId,
      itemId.toString(),
      { status: ChecklistItemStatus.BLOCKED, blockerReason: 'Earth pit soil rocky; chemical compound required' },
      adminUser
    );
    expect(updated).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 8. Mandatory Checklist Evidence Enforcement
  // --------------------------------------------------------------------------
  it('blocks marking mandatory checklist item as PASSED when required evidence is missing', async () => {
    const itemId = new Types.ObjectId();
    const mockChecklist = {
      _id: new Types.ObjectId(),
      categories: [
        {
          title: 'Structural',
          items: [
            {
              _id: itemId,
              itemCode: 'CHK-01-01',
              description: 'Roof structural integrity',
              isRequired: true,
              requiresEvidence: true,
              status: ChecklistItemStatus.NOT_STARTED,
              evidence: [] // No evidence attached!
            }
          ]
        }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    (mockChecklist.categories[0]!.items as any).id = vi.fn().mockReturnValue(mockChecklist.categories[0]!.items[0]);
    vi.spyOn(ChecklistService, 'getProjectChecklist').mockResolvedValue(mockChecklist as any);

    await expect(
      ChecklistService.updateItemStatus(
        sampleProjectId,
        itemId.toString(),
        { status: ChecklistItemStatus.PASSED },
        adminUser
      )
    ).rejects.toThrow(/without required photo evidence/);
  });

  // --------------------------------------------------------------------------
  // 9. Commissioning Stage Gate Enforcement
  // --------------------------------------------------------------------------
  it('blocks advancing project to STAGE_8 or STAGE_10 when mandatory checklist items are not passed', async () => {
    const mockProject = {
      _id: new Types.ObjectId(sampleProjectId),
      projectCode: 'PRJ-2026-00001',
      status: ProjectStatus.IN_PROGRESS,
      currentStage: ProjectStage.STAGE_7_EARTHING_LIGHTNING,
      stageHistory: [],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(ProjectService, 'getProjectById').mockResolvedValue(mockProject as any);

    // Checklist has an item that is still NOT_STARTED
    vi.spyOn(ProjectInstallationChecklist, 'findOne').mockResolvedValue({
      categories: [
        {
          category: ChecklistCategory.DC_WIRING_EARTHING,
          items: [
            {
              itemCode: 'CHK-03-03',
              description: 'Earthing pit resistance',
              isRequired: true,
              status: ChecklistItemStatus.NOT_STARTED
            }
          ]
        }
      ]
    } as any);

    await expect(
      ProjectService.advanceProjectStage(
        sampleProjectId,
        { stage: ProjectStage.STAGE_8_TESTING_PRE_COMMISSION },
        adminUser
      )
    ).rejects.toThrow(/Mandatory installation checklist items must be PASSED before commissioning gate/);
  });

  // --------------------------------------------------------------------------
  // 10. Evidence GPS Coordinate Boundary Validation
  // --------------------------------------------------------------------------
  it('validates GPS coordinate bounds when attaching photo evidence', async () => {
    const itemId = new Types.ObjectId();
    const mockChecklist = {
      _id: new Types.ObjectId(),
      categories: [
        {
          items: [
            {
              _id: itemId,
              itemCode: 'CHK-01-01',
              evidence: []
            }
          ]
        }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    (mockChecklist.categories[0]!.items as any).id = vi.fn().mockReturnValue(mockChecklist.categories[0]!.items[0]);
    vi.spyOn(ChecklistService, 'getProjectChecklist').mockResolvedValue(mockChecklist as any);

    // Invalid latitude > 90
    await expect(
      ChecklistService.attachEvidence(
        sampleProjectId,
        itemId.toString(),
        { fileName: 'roof.jpg', mimeType: 'image/jpeg', fileSizeBytes: 50000 },
        { latitude: 95.0, longitude: 72.5 },
        adminUser
      )
    ).rejects.toThrow(/Latitude must be between -90 and 90/);

    // Invalid longitude > 180
    await expect(
      ChecklistService.attachEvidence(
        sampleProjectId,
        itemId.toString(),
        { fileName: 'roof.jpg', mimeType: 'image/jpeg', fileSizeBytes: 50000 },
        { latitude: 23.0, longitude: 190.0 },
        adminUser
      )
    ).rejects.toThrow(/Longitude must be between -180 and 180/);
  });

  // --------------------------------------------------------------------------
  // 11. Customer Tenant Isolation Protection
  // --------------------------------------------------------------------------
  it('strictly forbids customer from viewing another customer project evidence', async () => {
    const ownerCustomerId = new Types.ObjectId().toString();
    const intruderCustomerId = new Types.ObjectId().toString();

    vi.spyOn(Project, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(sampleProjectId),
      customerId: new Types.ObjectId(ownerCustomerId) // Owned by ownerCustomerId
    } as any);

    await expect(
      ChecklistService.getAuthorizedEvidenceAccess(
        sampleProjectId,
        new Types.ObjectId().toString(),
        { customerId: intruderCustomerId } // Attempted access by intruderCustomerId
      )
    ).rejects.toThrow(/Access denied: You cannot view evidence for another customer project/);
  });

  // --------------------------------------------------------------------------
  // 12. Security & RBAC: 401 Rejection for Unauthenticated Endpoints
  // --------------------------------------------------------------------------
  it('returns 401 Unauthorized when accessing dispatch or checklist routes without authentication', async () => {
    const res1 = await request(app).get('/api/v1/dispatches');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get('/api/v1/checklists/templates');
    expect(res2.status).toBe(401);

    const res3 = await request(app).get(`/api/v1/projects/${sampleProjectId}/checklist`);
    expect(res3.status).toBe(401);
  });
});
