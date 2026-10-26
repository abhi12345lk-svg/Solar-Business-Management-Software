/**
 * INS Solar Business Management Software — Material Dispatch Service
 *
 * Implements authoritative material issue/dispatch workflows from warehouse stock
 * to installation project sites:
 * - Atomic conditional stock balance reduction (preventing negative stock under concurrency)
 * - Reservation deduction alignment
 * - Serialized hardware tracking (panels, inverters)
 * - Immutable stock movements
 * - Auditable cancellation & reversal with compensating stock movements
 * - Cumulative quantity enforcement against originating sales order
 */

import { Types } from 'mongoose';
import {
  CreateMaterialDispatchInput,
  CancelMaterialDispatchInput,
  DispatchFilterInput,
  MaterialDispatchStatus,
  StockMovementType,
  StockReservationStatus,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { MaterialDispatch, IMaterialDispatchDocument } from '../models/MaterialDispatch.js';
import { Project } from '../models/Project.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockReservation } from '../models/StockReservation.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class MaterialDispatchService {
  /**
   * 1. Create and execute a Material Dispatch to an installation site.
   */
  public static async createDispatch(
    input: CreateMaterialDispatchInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IMaterialDispatchDocument> {
    // Idempotency check
    if (input.idempotencyKey && input.idempotencyKey.trim()) {
      const existing = await MaterialDispatch.findOne({
        projectId: new Types.ObjectId(input.projectId),
        idempotencyKey: input.idempotencyKey.trim()
      })
        .populate('lineItems.productId', 'name sku uom')
        .populate('sourceWarehouseId', 'name code')
        .populate('dispatchedBy', 'firstName lastName email');

      if (existing) {
        return existing;
      }
    }

    if (!Types.ObjectId.isValid(input.projectId)) {
      throw AppError.validation(`Invalid project ID '${input.projectId}'.`);
    }

    const project = await Project.findById(input.projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID '${input.projectId}' not found.`);
    }

    if (['COMPLETED', 'CANCELLED'].includes(project.status)) {
      throw AppError.businessRule(`Cannot dispatch materials to a project in '${project.status}' status.`);
    }

    if (!Types.ObjectId.isValid(input.sourceWarehouseId)) {
      throw AppError.validation(`Invalid warehouse ID '${input.sourceWarehouseId}'.`);
    }

    const warehouse = await Warehouse.findById(input.sourceWarehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Source fulfillment warehouse is inactive or not found.');
    }

    // Load originating order if linked to project
    let order: any = null;
    if (project.orderId) {
      order = await SalesOrder.findById(project.orderId);
    }

    // Cumulative dispatch limits validation if order is present
    if (order && order.lineItems) {
      const existingDispatches = await MaterialDispatch.find({
        projectId: project._id,
        status: { $ne: MaterialDispatchStatus.CANCELLED }
      });

      const alreadyDispatchedMap = new Map<string, number>();
      for (const d of existingDispatches) {
        for (const item of d.lineItems) {
          const pId = item.productId.toString();
          alreadyDispatchedMap.set(pId, (alreadyDispatchedMap.get(pId) || 0) + item.issuedQuantity);
        }
      }

      for (const reqItem of input.lineItems) {
        const orderLine = order.lineItems.find(
          (ol: any) => ol.productId && ol.productId.toString() === reqItem.productId
        );
        if (orderLine) {
          const priorIssued = alreadyDispatchedMap.get(reqItem.productId) || 0;
          if (priorIssued + reqItem.requestedQuantity > orderLine.quantity) {
            throw AppError.businessRule(
              `Cumulative dispatch for product '${reqItem.productId}' (${priorIssued + reqItem.requestedQuantity}) exceeds ordered quantity (${orderLine.quantity}).`
            );
          }
        }
      }
    }

    const processedLineItems: any[] = [];
    const rollbackStockBalances: Array<{ productId: Types.ObjectId; quantity: number; wasReserved: boolean }> = [];
    const rollbackSerials: string[] = [];

    try {
      for (const item of input.lineItems) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          throw AppError.businessRule(`Product '${item.productId}' is inactive or not found.`);
        }

        // Check if an active reservation exists for this order/product/warehouse
        let reservation: any = null;
        if (order) {
          reservation = await StockReservation.findOneAndUpdate(
            {
              orderId: order._id,
              productId: product._id,
              warehouseId: warehouse._id,
              status: StockReservationStatus.ACTIVE
            },
            {
              $set: {
                status: StockReservationStatus.ISSUED,
                issuedAt: new Date(),
                issuedBy: new Types.ObjectId(user.userId)
              }
            },
            { new: true }
          );
        }

        // Atomic conditional update on StockBalance
        const updateFilter: any = {
          productId: product._id,
          warehouseId: warehouse._id,
          onHandQuantity: { $gte: item.requestedQuantity }
        };

        const updateOps: any = {
          $inc: { onHandQuantity: -item.requestedQuantity },
          $set: { updatedAt: new Date() }
        };

        if (reservation) {
          updateFilter.reservedQuantity = { $gte: item.requestedQuantity };
          updateOps.$inc.reservedQuantity = -item.requestedQuantity;
        } else {
          updateFilter.availableQuantity = { $gte: item.requestedQuantity };
          updateOps.$inc.availableQuantity = -item.requestedQuantity;
        }

        const balance = await StockBalance.findOneAndUpdate(updateFilter, updateOps, { new: true });
        if (!balance) {
          throw AppError.insufficientStock(
            `Insufficient physical inventory in '${warehouse.name}' to dispatch ${item.requestedQuantity} units of '${product.name}'.`
          );
        }

        rollbackStockBalances.push({
          productId: product._id,
          quantity: item.requestedQuantity,
          wasReserved: !!reservation
        });

        // Validate serial numbers if provided
        const normalizedSerials = item.serialNumbers ? item.serialNumbers.map(s => s.toUpperCase().trim()) : [];
        if (normalizedSerials.length > 0) {
          if (normalizedSerials.length !== item.requestedQuantity) {
            throw AppError.validation(
              `Number of serial numbers provided (${normalizedSerials.length}) must match requested quantity (${item.requestedQuantity}) for '${product.name}'.`
            );
          }

          for (const sn of normalizedSerials) {
            const serialDoc = await ProductSerialNumber.findOneAndUpdate(
              {
                serialNumber: sn,
                productId: product._id,
                warehouseId: warehouse._id,
                status: { $in: ['IN_STOCK', 'RESERVED'] }
              },
              {
                $set: {
                  status: 'ISSUED',
                  orderId: project.orderId
                }
              },
              { new: true }
            );

            if (!serialDoc) {
              throw AppError.businessRule(
                `Serial number '${sn}' is not in stock or available in warehouse '${warehouse.name}' for '${product.name}'.`
              );
            }

            rollbackSerials.push(sn);
          }
        }

        // Record immutable StockMovement
        const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
        const movement = new StockMovement({
          movementNumber: movSeq.formattedNumber,
          productId: product._id,
          quantity: item.requestedQuantity,
          movementType: StockMovementType.ISSUE,
          sourceWarehouseId: warehouse._id,
          orderId: project.orderId,
          reservationId: reservation?._id,
          serialNumbers: normalizedSerials.length > 0 ? normalizedSerials : undefined,
          performedBy: new Types.ObjectId(user.userId),
          reason: `Installation dispatch to project ${project.projectCode}`,
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-${product._id}` : undefined
        });

        await movement.save();

        processedLineItems.push({
          productId: product._id,
          requestedQuantity: item.requestedQuantity,
          issuedQuantity: item.requestedQuantity,
          serialNumbers: normalizedSerials,
          stockMovementId: movement._id
        });
      }
    } catch (err) {
      // Compensate / Rollback any already modified stock balances
      for (const rb of rollbackStockBalances) {
        const incOps: any = { onHandQuantity: rb.quantity };
        if (rb.wasReserved) {
          incOps.reservedQuantity = rb.quantity;
        } else {
          incOps.availableQuantity = rb.quantity;
        }
        await StockBalance.findOneAndUpdate(
          { productId: rb.productId, warehouseId: warehouse._id },
          { $inc: incOps }
        );
      }

      // Rollback serial statuses
      for (const sn of rollbackSerials) {
        await ProductSerialNumber.findOneAndUpdate(
          { serialNumber: sn },
          { $set: { status: 'IN_STOCK', orderId: null } }
        );
      }

      throw err;
    }

    // Allocate atomic sequence code (DSP-YYYY-NNNNN)
    const seq = await SequenceService.generateNumber(SequenceEntityType.MATERIAL_DISPATCH);
    const dispatchNumber = seq.formattedNumber;

    const dispatch = new MaterialDispatch({
      dispatchNumber,
      projectId: project._id,
      orderId: project.orderId,
      sourceWarehouseId: warehouse._id,
      destinationSiteAddress: project.siteAddress
        ? {
            addressLine1: project.siteAddress.addressLine1,
            city: project.siteAddress.city,
            state: project.siteAddress.state,
            postalCode: project.siteAddress.postalCode
          }
        : undefined,
      lineItems: processedLineItems,
      status: MaterialDispatchStatus.DISPATCHED,
      dispatchedBy: new Types.ObjectId(user.userId),
      dispatchedAt: new Date(),
      vehicleNumber: input.vehicleNumber?.trim(),
      driverName: input.driverName?.trim(),
      driverPhone: input.driverPhone?.trim(),
      notes: input.notes?.trim(),
      idempotencyKey: input.idempotencyKey?.trim()
    });

    await dispatch.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.MATERIAL_DISPATCH_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'dispatch-create',
      targetEntity: 'MaterialDispatch',
      targetId: dispatch._id.toString(),
      details: {
        dispatchNumber: dispatch.dispatchNumber,
        projectCode: project.projectCode,
        warehouseCode: warehouse.code,
        itemCount: processedLineItems.length
      }
    });

    return dispatch;
  }

  /**
   * 2. Cancel and reverse an issued dispatch slip with compensating stock movements.
   */
  public static async cancelDispatch(
    dispatchId: string,
    input: CancelMaterialDispatchInput,
    user: { userId: string; role: UserRole },
    context?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IMaterialDispatchDocument> {
    if (!Types.ObjectId.isValid(dispatchId)) {
      throw AppError.validation(`Invalid dispatch ID '${dispatchId}'.`);
    }

    const dispatch = await MaterialDispatch.findById(dispatchId);
    if (!dispatch) {
      throw AppError.notFound(`Dispatch slip '${dispatchId}' not found.`);
    }

    if (dispatch.status === MaterialDispatchStatus.CANCELLED) {
      throw AppError.businessRule(`Dispatch slip '${dispatch.dispatchNumber}' is already cancelled.`);
    }

    const project = await Project.findById(dispatch.projectId);

    // Perform reversal on inventory balances and generate compensating movements
    for (const item of dispatch.lineItems) {
      // Atomically restore on-hand and available quantities in warehouse
      await StockBalance.findOneAndUpdate(
        { productId: item.productId, warehouseId: dispatch.sourceWarehouseId },
        {
          $inc: {
            onHandQuantity: item.issuedQuantity,
            availableQuantity: item.issuedQuantity
          },
          $set: { updatedAt: new Date() }
        }
      );

      // Revert serial numbers back to IN_STOCK
      if (item.serialNumbers && item.serialNumbers.length > 0) {
        for (const sn of item.serialNumbers) {
          await ProductSerialNumber.findOneAndUpdate(
            { serialNumber: sn },
            { $set: { status: 'IN_STOCK', orderId: null } }
          );
        }
      }

      // Create compensating return StockMovement
      const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
      const returnMovement = new StockMovement({
        movementNumber: movSeq.formattedNumber,
        productId: item.productId,
        quantity: item.issuedQuantity,
        movementType: StockMovementType.RETURN,
        destWarehouseId: dispatch.sourceWarehouseId,
        orderId: dispatch.orderId,
        serialNumbers: item.serialNumbers,
        performedBy: new Types.ObjectId(user.userId),
        reason: `Reversal of dispatch ${dispatch.dispatchNumber}: ${input.cancellationReason.trim()}`
      });

      await returnMovement.save();
    }

    dispatch.status = MaterialDispatchStatus.CANCELLED;
    dispatch.cancellationReason = input.cancellationReason.trim();
    dispatch.cancelledAt = new Date();
    dispatch.cancelledBy = new Types.ObjectId(user.userId);

    await dispatch.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.MATERIAL_DISPATCH_CANCELLED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      correlationId: context?.correlationId || 'dispatch-cancel',
      targetEntity: 'MaterialDispatch',
      targetId: dispatch._id.toString(),
      details: {
        dispatchNumber: dispatch.dispatchNumber,
        projectCode: project?.projectCode,
        cancellationReason: dispatch.cancellationReason
      }
    });

    return dispatch;
  }

  /**
   * 3. List material dispatches with pagination and filters.
   */
  public static async getDispatches(filter: DispatchFilterInput): Promise<{
    dispatches: IMaterialDispatchDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query: Record<string, any> = {};

    if (filter.projectId && Types.ObjectId.isValid(filter.projectId)) {
      query.projectId = new Types.ObjectId(filter.projectId);
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.sourceWarehouseId && Types.ObjectId.isValid(filter.sourceWarehouseId)) {
      query.sourceWarehouseId = new Types.ObjectId(filter.sourceWarehouseId);
    }
    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ dispatchNumber: searchRegex }, { vehicleNumber: searchRegex }, { driverName: searchRegex }];
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, any> = { [sortField]: sortOrder };

    const [dispatches, total] = await Promise.all([
      MaterialDispatch.find(query)
        .populate('projectId', 'projectCode name status')
        .populate('sourceWarehouseId', 'name code')
        .populate('lineItems.productId', 'name sku uom')
        .populate('dispatchedBy', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      MaterialDispatch.countDocuments(query)
    ]);

    return {
      dispatches,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 4. Get single dispatch slip by ID.
   */
  public static async getDispatchById(id: string): Promise<IMaterialDispatchDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation(`Invalid dispatch ID '${id}'.`);
    }

    const dispatch = await MaterialDispatch.findById(id)
      .populate('projectId', 'projectCode name status siteAddress')
      .populate('orderId', 'orderNumber status')
      .populate('sourceWarehouseId', 'name code location')
      .populate('lineItems.productId', 'name sku uom brand')
      .populate('dispatchedBy', 'firstName lastName email')
      .populate('cancelledBy', 'firstName lastName email');

    if (!dispatch) {
      throw AppError.notFound(`Dispatch slip with ID '${id}' not found.`);
    }

    return dispatch;
  }

  /**
   * 5. Get project material availability and issued summaries.
   */
  public static async getProjectMaterialSummary(projectId: string): Promise<{
    projectCode: string;
    items: Array<{
      productId: string;
      name: string;
      sku: string;
      uom: string;
      orderedQuantity: number;
      dispatchedQuantity: number;
      remainingQuantity: number;
    }>;
  }> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw AppError.validation(`Invalid project ID '${projectId}'.`);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw AppError.notFound(`Project with ID '${projectId}' not found.`);
    }

    const itemsSummaryMap = new Map<string, any>();

    // If originating order exists, populate contracted BOM quantities
    if (project.orderId) {
      const order = await SalesOrder.findById(project.orderId).populate('lineItems.productId', 'name sku uom');
      if (order && order.lineItems) {
        for (const ol of order.lineItems) {
          if (ol.productId) {
            const p: any = ol.productId;
            itemsSummaryMap.set(p._id.toString(), {
              productId: p._id.toString(),
              name: p.name,
              sku: p.sku,
              uom: p.uom || 'units',
              orderedQuantity: ol.quantity,
              dispatchedQuantity: 0,
              remainingQuantity: ol.quantity
            });
          }
        }
      }
    }

    // Tally physical dispatches for this project
    const dispatches = await MaterialDispatch.find({
      projectId: project._id,
      status: { $ne: MaterialDispatchStatus.CANCELLED }
    }).populate('lineItems.productId', 'name sku uom');

    for (const d of dispatches) {
      for (const li of d.lineItems) {
        const p: any = li.productId;
        const pId = p._id.toString();
        let record = itemsSummaryMap.get(pId);
        if (!record) {
          record = {
            productId: pId,
            name: p.name,
            sku: p.sku,
            uom: p.uom || 'units',
            orderedQuantity: 0,
            dispatchedQuantity: 0,
            remainingQuantity: 0
          };
          itemsSummaryMap.set(pId, record);
        }
        record.dispatchedQuantity += li.issuedQuantity;
        record.remainingQuantity = Math.max(0, record.orderedQuantity - record.dispatchedQuantity);
      }
    }

    return {
      projectCode: project.projectCode,
      items: Array.from(itemsSummaryMap.values())
    };
  }
}
