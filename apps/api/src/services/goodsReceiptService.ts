import { Types } from 'mongoose';
import {
  CreateGoodsReceiptInput,
  GoodsReceiptFilter,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  StockMovementType,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  UserRole
} from '@ins-solar/shared';
import { GoodsReceipt, IGoodsReceiptDocument, IGoodsReceiptLineItem } from '../models/GoodsReceipt.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { StockBalance } from '../models/StockBalance.js';
import { StockMovement } from '../models/StockMovement.js';
import { ProductSerialNumber } from '../models/ProductSerialNumber.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { SequenceService } from './sequenceService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';

export class GoodsReceiptService {
  /**
   * Process a new Goods Receipt Note against an approved Purchase Order.
   */
  public static async createGoodsReceipt(
    input: CreateGoodsReceiptInput,
    user: { userId: string; role: UserRole },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<IGoodsReceiptDocument> {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await GoodsReceipt.findOne({ idempotencyKey: input.idempotencyKey })
        .populate('purchaseOrderId', 'poNumber status')
        .populate('vendorId', 'name vendorCode')
        .populate('destinationWarehouseId', 'name code');
      if (existing) {
        return existing;
      }
    }

    // 2. Fetch and Validate Purchase Order
    const po = await PurchaseOrder.findById(input.purchaseOrderId);
    if (!po) {
      throw AppError.notFound('Purchase Order not found.');
    }

    if (
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw AppError.invalidStateTransition(
        `Cannot receive goods against purchase order in status '${po.status}'. Must be APPROVED or PARTIALLY_RECEIVED.`
      );
    }

    // 3. Determine and Validate Warehouse
    const warehouseId = input.destinationWarehouseId
      ? new Types.ObjectId(input.destinationWarehouseId)
      : po.destinationWarehouseId;

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse || !warehouse.isActive) {
      throw AppError.businessRule('Receiving warehouse is inactive or not found.');
    }

    // 4. Validate and Process Each Line Item
    const grnLineItems: IGoodsReceiptLineItem[] = [];
    const stockMovementIds: Types.ObjectId[] = [];
    const grnSeq = await SequenceService.generateNumber(SequenceEntityType.GOODS_RECEIPT);
    const grnNumber = grnSeq.formattedNumber;

    for (const receiptItem of input.lineItems) {
      const poLine = po.lineItems.find(
        line => line.productId.toString() === receiptItem.productId
      );

      if (!poLine) {
        throw AppError.validation(
          `Product ${receiptItem.productId} is not part of Purchase Order ${po.poNumber}.`
        );
      }

      const rejectedQty = receiptItem.rejectedQuantity ?? 0;
      const totalDelivered = receiptItem.acceptedQuantity + rejectedQty;
      if (receiptItem.deliveredQuantity !== totalDelivered) {
        throw AppError.validation(
          `Delivered quantity (${receiptItem.deliveredQuantity}) must equal accepted (${receiptItem.acceptedQuantity}) + rejected (${rejectedQty}).`
        );
      }

      // Check cumulative over-delivery guard
      const newTotalDelivered = poLine.receivedQuantity + poLine.rejectedQuantity + totalDelivered;
      if (newTotalDelivered > poLine.orderedQuantity) {
        throw AppError.businessRule(
          `Over-delivery rejected for SKU '${poLine.sku}': cumulative delivered (${newTotalDelivered}) exceeds ordered quantity (${poLine.orderedQuantity}).`
        );
      }

      const product = await Product.findById(receiptItem.productId);
      if (!product || !product.isActive) {
        throw AppError.businessRule(`Product SKU '${poLine.sku}' is inactive or not found.`);
      }

      // 5. Atomic Stock Update ONLY for Accepted Quantity (Never create stock for rejected quantities!)
      let movementId: Types.ObjectId | undefined;

      if (receiptItem.acceptedQuantity > 0) {
        // Atomic balance increment in target warehouse
        await StockBalance.findOneAndUpdate(
          { productId: product._id, warehouseId: warehouse._id },
          {
            $inc: {
              onHandQuantity: receiptItem.acceptedQuantity,
              availableQuantity: receiptItem.acceptedQuantity
            },
            $set: { updatedAt: new Date() }
          },
          { upsert: true, new: true }
        );

        // Record immutable append-only stock movement ledger
        const movSeq = await SequenceService.generateNumber(SequenceEntityType.STOCK_MOVEMENT);
        const movement = new StockMovement({
          movementNumber: movSeq.formattedNumber,
          productId: product._id,
          quantity: receiptItem.acceptedQuantity,
          movementType: StockMovementType.RECEIPT,
          destinationWarehouseId: warehouse._id,
          performedBy: new Types.ObjectId(user.userId),
          reason: `GRN ${grnNumber} receipt against PO ${po.poNumber}`,
          reference: po.poNumber,
          serialNumbers: receiptItem.serialNumbers?.map(s => s.toUpperCase())
        });

        await movement.save();
        movementId = movement._id;
        stockMovementIds.push(movement._id);

        // 6. Register Hardware Serial Numbers if provided
        if (receiptItem.serialNumbers && receiptItem.serialNumbers.length > 0) {
          for (const rawSerial of receiptItem.serialNumbers) {
            const normalizedSerial = rawSerial.trim().toUpperCase();

            // Check duplicate serial
            const existingSerial = await ProductSerialNumber.findOne({ serialNumber: normalizedSerial });
            if (existingSerial) {
              throw AppError.duplicateResource(
                `Serial number '${normalizedSerial}' is already registered in the system.`
              );
            }

            const serialDoc = new ProductSerialNumber({
              serialNumber: normalizedSerial,
              productId: product._id,
              warehouseId: warehouse._id,
              status: 'IN_STOCK',
              movementHistory: [movement._id]
            });
            await serialDoc.save();
          }
        }
      }

      // 7. Update PO Line Item Balances
      poLine.receivedQuantity += receiptItem.acceptedQuantity;
      poLine.rejectedQuantity += rejectedQty;
      poLine.outstandingQuantity = Math.max(0, poLine.orderedQuantity - poLine.receivedQuantity);

      grnLineItems.push({
        productId: product._id,
        sku: poLine.sku,
        productName: poLine.productName,
        orderedQuantity: poLine.orderedQuantity,
        deliveredQuantity: receiptItem.deliveredQuantity,
        acceptedQuantity: receiptItem.acceptedQuantity,
        rejectedQuantity: rejectedQty,
        outstandingQuantityAfter: poLine.outstandingQuantity,
        rejectionReason: receiptItem.rejectionReason?.trim(),
        serialNumbers: receiptItem.serialNumbers?.map(s => s.trim().toUpperCase()),
        stockMovementId: movementId
      });
    }

    // 8. Update Purchase Order Overall Status
    const totalOutstanding = po.lineItems.reduce((acc, line) => acc + line.outstandingQuantity, 0);
    if (totalOutstanding === 0) {
      po.status = PurchaseOrderStatus.FULLY_RECEIVED;
    } else {
      po.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }
    po.updatedBy = new Types.ObjectId(user.userId);
    await po.save();

    // 9. Save Goods Receipt Record
    const grn = new GoodsReceipt({
      grnNumber,
      purchaseOrderId: po._id,
      vendorId: po.vendorId,
      destinationWarehouseId: warehouse._id,
      receiptDate: input.receiptDate ? new Date(input.receiptDate) : new Date(),
      lineItems: grnLineItems,
      deliveryChallanNumber: input.deliveryChallanNumber?.trim(),
      vehicleNumber: input.vehicleNumber?.trim(),
      inspectionRemarks: input.inspectionRemarks?.trim(),
      status: GoodsReceiptStatus.COMPLETED,
      stockMovementIds,
      idempotencyKey: input.idempotencyKey?.trim(),
      receivedBy: new Types.ObjectId(user.userId)
    });

    await grn.save();

    // 10. Audit Event
    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.GRN_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'grn-create',
      details: {
        grnNumber: grn.grnNumber,
        poNumber: po.poNumber,
        warehouseCode: warehouse.code,
        poStatus: po.status
      }
    });

    return grn;
  }

  /**
   * Query goods receipts with pagination and filters.
   */
  public static async getGoodsReceipts(filter: GoodsReceiptFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filter.purchaseOrderId) {
      query.purchaseOrderId = new Types.ObjectId(filter.purchaseOrderId);
    }
    if (filter.vendorId) {
      query.vendorId = new Types.ObjectId(filter.vendorId);
    }
    if (filter.destinationWarehouseId) {
      query.destinationWarehouseId = new Types.ObjectId(filter.destinationWarehouseId);
    }

    const sortField = filter.sortBy || 'createdAt';
    const sortDirection = filter.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      GoodsReceipt.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .populate('purchaseOrderId', 'poNumber status totalAmountPaise')
        .populate('vendorId', 'name vendorCode gstin')
        .populate('destinationWarehouseId', 'name code city')
        .populate('receivedBy', 'firstName lastName email'),
      GoodsReceipt.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get Goods Receipt by ID.
   */
  public static async getGoodsReceiptById(id: string): Promise<IGoodsReceiptDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Invalid Goods Receipt ID.');
    }
    const grn = await GoodsReceipt.findById(id)
      .populate('purchaseOrderId')
      .populate('vendorId')
      .populate('destinationWarehouseId')
      .populate('receivedBy', 'firstName lastName email')
      .populate('stockMovementIds');
    if (!grn) {
      throw AppError.notFound('Goods Receipt Note not found.');
    }
    return grn;
  }
}
