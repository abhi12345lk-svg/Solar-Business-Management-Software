/**
 * INS Solar Business Management Software — Product Serial Number Service
 *
 * Manages tracking, unique normalization, registration, location custody, and movement history
 * for high-value serialized hardware assets (solar panels, inverters, batteries).
 */

import { Types } from 'mongoose';
import {
  RegisterSerialNumberInput,
  RegisterSerialNumberInputSchema,
  SerialNumberStatus,
  AuditAction,
  AuditOutcome,
  ActorType
} from '@ins-solar/shared';
import {
  ProductSerialNumber,
  IProductSerialNumberDocument
} from '../models/ProductSerialNumber.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export interface SerialNumberActorContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface SerialNumberListFilter {
  productId?: string;
  warehouseId?: string;
  status?: SerialNumberStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export class SerialNumberService {
  /**
   * Register a batch of serial numbers into a warehouse for a product.
   * Ensures case-insensitive/normalized uppercase uniqueness.
   */
  public static async registerSerialNumbers(
    input: RegisterSerialNumberInput,
    actor: SerialNumberActorContext
  ): Promise<IProductSerialNumberDocument[]> {
    const validated = RegisterSerialNumberInputSchema.parse(input);

    const product = await Product.findById(validated.productId);
    if (!product) {
      throw AppError.notFound('Product');
    }

    const warehouse = await Warehouse.findById(validated.warehouseId);
    if (!warehouse) {
      throw AppError.notFound('Warehouse');
    }
    if (!warehouse.isActive) {
      throw AppError.businessRule('Cannot register serial numbers into an inactive warehouse.');
    }

    // Normalize serial numbers to uppercase and deduplicate in request
    const rawSerials = validated.serialNumbers.map(s => s.trim().toUpperCase());
    const uniqueSerials = Array.from(new Set(rawSerials));
    if (uniqueSerials.length !== rawSerials.length) {
      throw AppError.badRequest('Duplicate serial numbers detected within the submission batch.');
    }

    // Check existing serial numbers in database
    const existing = await ProductSerialNumber.find({
      serialNumber: { $in: uniqueSerials }
    }).select('serialNumber');

    if (existing.length > 0) {
      const conflicting = existing.map(e => e.serialNumber).join(', ');
      throw AppError.conflict(`Serial numbers already registered: ${conflicting}`);
    }

    const docsToInsert = uniqueSerials.map(sn => ({
      serialNumber: sn,
      productId: new Types.ObjectId(validated.productId),
      warehouseId: new Types.ObjectId(validated.warehouseId),
      status: SerialNumberStatus.IN_STOCK,
      movementHistory: [],
      registeredBy: new Types.ObjectId(actor.userId)
    }));

    const inserted = await ProductSerialNumber.insertMany(docsToInsert);

    await AuditService.recordEvent({
      actorId: actor.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.STOCK_RECEIVED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      correlationId: actor.correlationId || 'register-serials',
      targetEntity: 'ProductSerialNumber',
      targetId: validated.productId,
      details: {
        warehouseId: validated.warehouseId,
        productId: validated.productId,
        count: inserted.length,
        serialNumbers: uniqueSerials
      }
    });

    return inserted;
  }

  /**
   * Query details and full lifecycle history for a single serial number.
   */
  public static async getSerialHistory(
    serialNumber: string
  ): Promise<IProductSerialNumberDocument> {
    const normalized = serialNumber.trim().toUpperCase();
    const doc = await ProductSerialNumber.findOne({ serialNumber: normalized })
      .populate('productId', 'name productCode sku brand model uom')
      .populate('warehouseId', 'name code address')
      .populate('orderId', 'orderNumber status customerId')
      .populate('movementHistory');

    if (!doc) {
      throw AppError.notFound(`Serial number '${normalized}'`);
    }

    return doc;
  }

  /**
   * Filter and list serial numbers.
   */
  public static async listSerialNumbers(filter: SerialNumberListFilter) {
    const query: Record<string, any> = {};

    if (filter.productId) {
      query.productId = new Types.ObjectId(filter.productId);
    }
    if (filter.warehouseId) {
      query.warehouseId = new Types.ObjectId(filter.warehouseId);
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.search) {
      query.serialNumber = { $regex: filter.search.trim().toUpperCase(), $options: 'i' };
    }

    const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
    const offset = Math.max(filter.offset || 0, 0);

    const [items, total] = await Promise.all([
      ProductSerialNumber.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('productId', 'name productCode sku brand')
        .populate('warehouseId', 'name code')
        .populate('orderId', 'orderNumber status'),
      ProductSerialNumber.countDocuments(query)
    ]);

    return {
      items,
      total,
      limit,
      offset
    };
  }

  /**
   * Update serial numbers when stock is transferred or issued.
   */
  public static async updateLocationAndStatus(
    serialNumbers: string[],
    newWarehouseId: Types.ObjectId,
    newStatus: SerialNumberStatus,
    movementId?: Types.ObjectId,
    orderId?: Types.ObjectId
  ): Promise<number> {
    const normalized = serialNumbers.map(s => s.trim().toUpperCase());

    const updateDoc: Record<string, any> = {
      warehouseId: newWarehouseId,
      status: newStatus
    };
    if (orderId) {
      updateDoc.orderId = orderId;
    }

    const updateOp: Record<string, any> = {
      $set: updateDoc
    };

    if (movementId) {
      updateOp.$push = { movementHistory: movementId };
    }

    const result = await ProductSerialNumber.updateMany(
      { serialNumber: { $in: normalized } },
      updateOp
    );

    return result.modifiedCount;
  }
}
