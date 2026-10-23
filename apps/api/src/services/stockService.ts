/**
 * INS Solar Business Management Software — Stock Service
 *
 * Implements atomic, location-scoped inventory projections, append-oriented
 * stock movement ledgers, race-condition-free reservations, and physical
 * material issue/receipt/transfer/return lifecycles.
 */

import { Types } from 'mongoose';
import {
  StockBalanceFilter,
  StockMovementFilter,
  StockReceiptInput,
  StockIssueInput,
  StockTransferInput,
  StockReturnInput,
  OpeningBalanceInput,
  ReserveStockForOrderInput,
  StockMovementType,
  StockReservationStatus,
  OrderReservationStatus,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole,
  SequenceEntityType
} from '@ins-solar/shared';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement, IStockMovementDocument } from '../models/StockMovement.js';
import { StockReservation, IStockReservationDocument } from '../models/StockReservation.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class StockService {
  /**
   * 1. Reserve Stock for a Sales Order.
   * Atomically increments reservedQuantity and decrements availableQuantity without altering onHandQuantity.
   */
  public static async reserveStockForOrder(
    orderId: string,
    input: ReserveStockForOrderInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ) {
    const order = await SalesOrder.findById(orderId);
    if (!order) {
      throw AppError.notFound('Sales Order not found.');
    }

    if (order.status === 'CANCELLED') {
      throw AppError.businessRule('Cannot reserve stock for a cancelled sales order.');
    }

    const warehouse = await Warehouse.findById(input.warehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Target fulfillment warehouse is inactive or not found.');
    }

    // Determine items to reserve: either explicit items or all hardware line items from order
    let itemsToReserve: Array<{ productId: string; quantity: number }> = [];

    if (input.items && input.items.length > 0) {
      itemsToReserve = input.items;
    } else {
      // Default: reserve all items with a valid productId
      itemsToReserve = order.lineItems
        .filter(item => item.productId)
        .map(item => ({
          productId: item.productId!.toString(),
          quantity: item.quantity
        }));
    }

    if (itemsToReserve.length === 0) {
      throw AppError.businessRule('No physical hardware items found to reserve.');
    }

    const reservedResults: IStockReservationDocument[] = [];
    const rollbacks: Array<{ productId: string; quantity: number }> = [];

    for (const item of itemsToReserve) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        // Rollback prior reservations in this batch
        await this.rollbackAtomicReservations(rollbacks, input.warehouseId);
        throw AppError.businessRule(`Product ${item.productId} is inactive or not found.`);
      }

      // Atomic conditional update on StockBalance: guarantees concurrency safety
      const balance = await StockBalance.findOneAndUpdate(
        {
          productId: product._id,
          warehouseId: warehouse._id,
          availableQuantity: { $gte: item.quantity }
        },
        {
          $inc: {
            reservedQuantity: item.quantity,
            availableQuantity: -item.quantity
          },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      if (!balance) {
        // Fetch current projection to report honest availability
        const currentProjection = await StockBalance.findOne({
          productId: product._id,
          warehouseId: warehouse._id
        });
        const available = currentProjection ? currentProjection.availableQuantity : 0;

        // Rollback previous reservations in this batch
        await this.rollbackAtomicReservations(rollbacks, input.warehouseId);

        throw AppError.insufficientStock(
          `Insufficient available stock for '${product.name}'. Available at ${warehouse.name}: ${available}, Requested: ${item.quantity}.`
        );
      }

      rollbacks.push({ productId: product._id.toString(), quantity: item.quantity });

      // Generate sequence code for reservation
      const resSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_RESERVATION);

      const reservation = new StockReservation({
        reservationNumber: resSeq.formattedNumber,
        orderId: order._id,
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: item.quantity,
        status: StockReservationStatus.ACTIVE,
        reservedAt: new Date(),
        reservedBy: new Types.ObjectId(user.userId),
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-${product._id}` : undefined
      });

      await reservation.save();
      reservedResults.push(reservation);

      // Append immutable stock movement
      const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
      const movement = new StockMovement({
        movementNumber: movSeq.formattedNumber,
        productId: product._id,
        quantity: item.quantity,
        movementType: StockMovementType.RESERVATION,
        sourceWarehouseId: warehouse._id,
        orderId: order._id,
        reservationId: reservation._id,
        performedBy: new Types.ObjectId(user.userId),
        reason: `Stock reserved for Sales Order ${order.orderNumber}`
      });

      await movement.save();
    }

    // Update order reservation status
    order.reservationStatus = OrderReservationStatus.FULLY_RESERVED;
    await order.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_RESERVED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-reserve',
      details: {
        orderNumber: order.orderNumber,
        warehouseCode: warehouse.code,
        reservedItemsCount: reservedResults.length
      }
    });

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      reservationStatus: order.reservationStatus,
      reservations: reservedResults
    };
  }

  /**
   * Helper: Rollback atomic reservations if a batch item fails.
   */
  private static async rollbackAtomicReservations(
    items: Array<{ productId: string; quantity: number }>,
    warehouseId: string
  ) {
    for (const item of items) {
      await StockBalance.findOneAndUpdate(
        {
          productId: new Types.ObjectId(item.productId),
          warehouseId: new Types.ObjectId(warehouseId)
        },
        {
          $inc: {
            reservedQuantity: -item.quantity,
            availableQuantity: item.quantity
          },
          $set: { updatedAt: new Date() }
        }
      );
    }
  }

  /**
   * 2. Release a single Stock Reservation (Idempotent).
   */
  public static async releaseReservation(
    reservationId: string,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ) {
    // Atomically find and transition reservation from ACTIVE to RELEASED
    const reservation = await StockReservation.findOneAndUpdate(
      {
        _id: new Types.ObjectId(reservationId),
        status: StockReservationStatus.ACTIVE
      },
      {
        $set: {
          status: StockReservationStatus.RELEASED,
          releasedAt: new Date(),
          releasedBy: new Types.ObjectId(user.userId)
        }
      },
      { new: true }
    );

    if (!reservation) {
      // Idempotent return if already released or nonexistent
      const existing = await StockReservation.findById(reservationId);
      if (existing) return existing;
      throw AppError.notFound('Stock Reservation not found.');
    }

    // Atomically restore available stock on StockBalance
    await StockBalance.findOneAndUpdate(
      {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId
      },
      {
        $inc: {
          reservedQuantity: -reservation.quantity,
          availableQuantity: reservation.quantity
        },
        $set: { updatedAt: new Date() }
      }
    );

    // Append movement ledger
    const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
    const movement = new StockMovement({
      movementNumber: movSeq.formattedNumber,
      productId: reservation.productId,
      quantity: reservation.quantity,
      movementType: StockMovementType.RESERVATION_RELEASE,
      sourceWarehouseId: reservation.warehouseId,
      orderId: reservation.orderId,
      reservationId: reservation._id,
      performedBy: new Types.ObjectId(user.userId),
      reason: `Reservation ${reservation.reservationNumber} released`
    });

    await movement.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_RESERVATION_RELEASED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-release',
      details: {
        reservationNumber: reservation.reservationNumber,
        releasedQuantity: reservation.quantity
      }
    });

    return reservation;
  }

  /**
   * 3. Release all active reservations for a given order (used during order cancellation).
   */
  public static async releaseOrderReservations(
    orderId: string,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ) {
    const activeReservations = await StockReservation.find({
      orderId: new Types.ObjectId(orderId),
      status: StockReservationStatus.ACTIVE
    });

    for (const res of activeReservations) {
      await this.releaseReservation(res._id.toString(), user, context);
    }

    return activeReservations.length;
  }

  /**
   * 4. Physically issue material (dispatches reserved stock).
   * Reduces both onHandQuantity and reservedQuantity.
   */
  public static async issueStock(
    input: StockIssueInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IStockMovementDocument> {
    const warehouse = await Warehouse.findById(input.warehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Issuing warehouse is inactive or not found.');
    }

    const product = await Product.findById(input.productId);
    if (!product || !product.isActive) {
      throw AppError.businessRule('Product is inactive or not found.');
    }

    let reservation: IStockReservationDocument | null = null;

    if (input.reservationId) {
      reservation = await StockReservation.findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.reservationId),
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

      if (!reservation) {
        throw AppError.businessRule('Active stock reservation not found for this issue.');
      }
    }

    // Atomic reduction of on-hand quantity and reserved quantity (if reserved)
    const updateFilter: any = {
      productId: product._id,
      warehouseId: warehouse._id,
      onHandQuantity: { $gte: input.quantity }
    };

    const updateOps: any = {
      $inc: { onHandQuantity: -input.quantity },
      $set: { updatedAt: new Date() }
    };

    if (reservation) {
      updateFilter.reservedQuantity = { $gte: input.quantity };
      updateOps.$inc.reservedQuantity = -input.quantity;
    } else {
      updateFilter.availableQuantity = { $gte: input.quantity };
      updateOps.$inc.availableQuantity = -input.quantity;
    }

    const balance = await StockBalance.findOneAndUpdate(updateFilter, updateOps, { new: true });

    if (!balance) {
      // Revert reservation status if update failed
      if (reservation) {
        await StockReservation.findByIdAndUpdate(reservation._id, {
          $set: { status: StockReservationStatus.ACTIVE, issuedAt: null, issuedBy: null }
        });
      }
      throw AppError.insufficientStock(
        `Insufficient physical stock to issue ${input.quantity} units of '${product.name}'.`
      );
    }

    // Serial Number tracking updates if serials provided
    if (input.serialNumbers && input.serialNumbers.length > 0) {
      for (const sn of input.serialNumbers) {
        await ProductSerialNumber.findOneAndUpdate(
          {
            serialNumber: sn.toUpperCase(),
            productId: product._id,
            warehouseId: warehouse._id,
            status: { $in: ['IN_STOCK', 'RESERVED'] }
          },
          {
            $set: {
              status: 'ISSUED',
              orderId: input.orderId ? new Types.ObjectId(input.orderId) : undefined
            }
          }
        );
      }
    }

    // Record movement ledger
    const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
    const movement = new StockMovement({
      movementNumber: movSeq.formattedNumber,
      productId: product._id,
      quantity: input.quantity,
      movementType: StockMovementType.ISSUE,
      sourceWarehouseId: warehouse._id,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : undefined,
      reservationId: reservation?._id,
      serialNumbers: input.serialNumbers?.map(s => s.toUpperCase()),
      performedBy: new Types.ObjectId(user.userId),
      reason: input.reason || 'Physical material issue',
      idempotencyKey: input.idempotencyKey
    });

    await movement.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_ISSUED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-issue',
      details: {
        movementNumber: movement.movementNumber,
        productSku: product.sku,
        quantity: input.quantity,
        warehouseCode: warehouse.code
      }
    });

    return movement;
  }

  /**
   * 5. Record incoming material receipt (GRN or return receipt).
   */
  public static async receiveStock(
    input: StockReceiptInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IStockMovementDocument> {
    if (input.idempotencyKey) {
      const existing = await StockMovement.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) return existing;
    }

    const warehouse = await Warehouse.findById(input.warehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Receiving warehouse is inactive or not found.');
    }

    const product = await Product.findById(input.productId);
    if (!product || !product.isActive) {
      throw AppError.businessRule('Product is inactive or not found.');
    }

    // Atomic projection update
    await StockBalance.findOneAndUpdate(
      { productId: product._id, warehouseId: warehouse._id },
      {
        $inc: { onHandQuantity: input.quantity, availableQuantity: input.quantity },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
    const movement = new StockMovement({
      movementNumber: movSeq.formattedNumber,
      productId: product._id,
      quantity: input.quantity,
      movementType: StockMovementType.RECEIPT,
      destinationWarehouseId: warehouse._id,
      performedBy: new Types.ObjectId(user.userId),
      reason: input.reason || 'Material stock receipt',
      reference: input.reference,
      idempotencyKey: input.idempotencyKey
    });

    await movement.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_RECEIVED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-receive',
      details: {
        movementNumber: movement.movementNumber,
        quantity: input.quantity,
        warehouseCode: warehouse.code
      }
    });

    return movement;
  }

  /**
   * 6. Inter-warehouse material transfer.
   */
  public static async transferStock(
    input: StockTransferInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IStockMovementDocument> {
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw AppError.businessRule('Source and destination warehouses must be different.');
    }

    const srcWarehouse = await Warehouse.findById(input.sourceWarehouseId);
    const destWarehouse = await Warehouse.findById(input.destinationWarehouseId);
    if (!srcWarehouse || !srcWarehouse.isActive || !destWarehouse || !destWarehouse.isActive) {
      throw AppError.businessRule('Source or destination warehouse is inactive or not found.');
    }

    const product = await Product.findById(input.productId);
    if (!product || !product.isActive) {
      throw AppError.businessRule('Product is inactive or not found.');
    }

    // Atomic deduction from source
    const srcBalance = await StockBalance.findOneAndUpdate(
      {
        productId: product._id,
        warehouseId: srcWarehouse._id,
        onHandQuantity: { $gte: input.quantity },
        availableQuantity: { $gte: input.quantity }
      },
      {
        $inc: { onHandQuantity: -input.quantity, availableQuantity: -input.quantity },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    if (!srcBalance) {
      throw AppError.insufficientStock(
        `Insufficient stock at '${srcWarehouse.name}' for transferring ${input.quantity} units of '${product.name}'.`
      );
    }

    // Atomic addition to destination
    await StockBalance.findOneAndUpdate(
      { productId: product._id, warehouseId: destWarehouse._id },
      {
        $inc: { onHandQuantity: input.quantity, availableQuantity: input.quantity },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
    const movement = new StockMovement({
      movementNumber: movSeq.formattedNumber,
      productId: product._id,
      quantity: input.quantity,
      movementType: StockMovementType.TRANSFER,
      sourceWarehouseId: srcWarehouse._id,
      destinationWarehouseId: destWarehouse._id,
      performedBy: new Types.ObjectId(user.userId),
      reason: input.reason || 'Inter-warehouse transfer',
      idempotencyKey: input.idempotencyKey
    });

    await movement.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_TRANSFERRED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-transfer',
      details: {
        movementNumber: movement.movementNumber,
        quantity: input.quantity,
        from: srcWarehouse.code,
        to: destWarehouse.code
      }
    });

    return movement;
  }

  /**
   * 7. Record material return.
   */
  public static async returnStock(
    input: StockReturnInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IStockMovementDocument> {
    const srcWarehouse = await Warehouse.findById(input.sourceWarehouseId);
    const destWarehouse = await Warehouse.findById(input.destinationWarehouseId);
    if (!srcWarehouse || !destWarehouse) {
      throw AppError.businessRule('Return warehouses must be valid locations.');
    }

    const product = await Product.findById(input.productId);
    if (!product) {
      throw AppError.notFound('Product not found.');
    }

    // Atomic addition at return destination warehouse
    await StockBalance.findOneAndUpdate(
      { productId: product._id, warehouseId: destWarehouse._id },
      {
        $inc: { onHandQuantity: input.quantity, availableQuantity: input.quantity },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
    const movement = new StockMovement({
      movementNumber: movSeq.formattedNumber,
      productId: product._id,
      quantity: input.quantity,
      movementType: StockMovementType.RETURN,
      sourceWarehouseId: srcWarehouse._id,
      destinationWarehouseId: destWarehouse._id,
      performedBy: new Types.ObjectId(user.userId),
      reason: input.reason,
      reversalOfMovementId: input.originalMovementId
        ? new Types.ObjectId(input.originalMovementId)
        : undefined,
      idempotencyKey: input.idempotencyKey
    });

    await movement.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_RETURNED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-return',
      details: {
        movementNumber: movement.movementNumber,
        returnedQuantity: input.quantity,
        reason: input.reason
      }
    });

    return movement;
  }

  /**
   * 8. Authorized opening stock balance creation.
   */
  public static async recordOpeningBalance(
    input: OpeningBalanceInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IStockMovementDocument> {
    const warehouse = await Warehouse.findById(input.warehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Warehouse is inactive or not found.');
    }

    const product = await Product.findById(input.productId);
    if (!product || !product.isActive) {
      throw AppError.businessRule('Product is inactive or not found.');
    }

    // Atomic increment of stock balance
    await StockBalance.findOneAndUpdate(
      { productId: product._id, warehouseId: warehouse._id },
      {
        $inc: { onHandQuantity: input.quantity, availableQuantity: input.quantity },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
    const movement = new StockMovement({
      movementNumber: movSeq.formattedNumber,
      productId: product._id,
      quantity: input.quantity,
      movementType: StockMovementType.OPENING_BALANCE,
      destinationWarehouseId: warehouse._id,
      performedBy: new Types.ObjectId(user.userId),
      reason: input.reason
    });

    await movement.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_OPENING_BALANCE,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'stock-opening-balance',
      details: {
        movementNumber: movement.movementNumber,
        quantity: input.quantity,
        reason: input.reason
      }
    });

    return movement;
  }

  /**
   * 9. Query location-scoped stock projections.
   */
  public static async listStockBalances(filter: StockBalanceFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.warehouseId) query.warehouseId = filter.warehouseId;
    if (filter.productId) query.productId = filter.productId;

    const [balances, total] = await Promise.all([
      StockBalance.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('productId', 'name sku brand productType defaultGstRate')
        .populate('warehouseId', 'name code type')
        .lean(),
      StockBalance.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: balances,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * 10. Query append-only stock movement ledger.
   */
  public static async listStockMovements(filter: StockMovementFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.productId) query.productId = filter.productId;
    if (filter.orderId) query.orderId = filter.orderId;
    if (filter.movementType) query.movementType = filter.movementType;
    if (filter.warehouseId) {
      query.$or = [
        { sourceWarehouseId: filter.warehouseId },
        { destinationWarehouseId: filter.warehouseId }
      ];
    }

    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('productId', 'name sku brand')
        .populate('sourceWarehouseId', 'name code')
        .populate('destinationWarehouseId', 'name code')
        .populate('performedBy', 'firstName lastName')
        .lean(),
      StockMovement.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: movements,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }
}
