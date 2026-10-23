/**
 * INS Solar Business Management Software — Warehouse Service
 *
 * Manages inventory storage locations including Central Hubs, Transit Depots,
 * Customer Installation Sites, and Employee Custody points.
 * Enforces non-destructive lifecycle rules (physical deletions forbidden).
 */

import { Types } from 'mongoose';
import {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseFilterInput
} from '@ins-solar/shared';
import { Warehouse, IWarehouseDocument } from '../models/Warehouse.js';
import { AppError } from '../errors/AppError.js';

export class WarehouseService {
  public static async createWarehouse(
    input: CreateWarehouseInput,
    actorId?: string
  ): Promise<IWarehouseDocument> {
    const code = input.code.trim().toUpperCase();

    const existing = await Warehouse.findOne({ code });
    if (existing) {
      throw AppError.conflict(`Warehouse with code '${code}' already exists.`);
    }

    const warehouse = new Warehouse({
      code,
      name: input.name.trim(),
      description: input.description?.trim(),
      type: input.type,
      address: input.address,
      managerId: input.managerId ? new Types.ObjectId(input.managerId) : undefined,
      custodianEmployeeId: input.custodianEmployeeId
        ? new Types.ObjectId(input.custodianEmployeeId)
        : undefined,
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      isActive: input.isActive ?? true,
      createdBy: actorId ? new Types.ObjectId(actorId) : undefined
    });

    await warehouse.save();
    return warehouse;
  }

  public static async updateWarehouse(
    id: string,
    input: UpdateWarehouseInput,
    actorId?: string
  ): Promise<IWarehouseDocument> {
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      throw AppError.notFound(`Warehouse '${id}'`);
    }

    if (input.name !== undefined) warehouse.name = input.name.trim();
    if (input.description !== undefined) warehouse.description = input.description?.trim();
    if (input.type !== undefined) warehouse.type = input.type;
    if (input.address !== undefined) warehouse.address = input.address as any;
    if (input.managerId !== undefined) {
      warehouse.managerId = input.managerId ? new Types.ObjectId(input.managerId) : undefined;
    }
    if (input.custodianEmployeeId !== undefined) {
      warehouse.custodianEmployeeId = input.custodianEmployeeId
        ? new Types.ObjectId(input.custodianEmployeeId)
        : undefined;
    }
    if (input.projectId !== undefined) {
      warehouse.projectId = input.projectId ? new Types.ObjectId(input.projectId) : undefined;
    }
    if (input.isActive !== undefined) warehouse.isActive = input.isActive;
    if (actorId) warehouse.updatedBy = new Types.ObjectId(actorId);

    await warehouse.save();
    return warehouse;
  }

  public static async deactivateWarehouse(
    id: string,
    actorId?: string
  ): Promise<IWarehouseDocument> {
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      throw AppError.notFound(`Warehouse '${id}'`);
    }

    // Physical deletion is strictly prohibited to maintain traceability of stock ledgers
    warehouse.isActive = false;
    if (actorId) warehouse.updatedBy = new Types.ObjectId(actorId);
    await warehouse.save();
    return warehouse;
  }

  public static async getWarehouseById(id: string): Promise<IWarehouseDocument> {
    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      throw AppError.notFound(`Warehouse '${id}'`);
    }
    return warehouse;
  }

  public static async listWarehouses(filter: WarehouseFilterInput): Promise<{
    data: IWarehouseDocument[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const query: Record<string, any> = {};

    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    if (filter.search) {
      query.$or = [
        { name: new RegExp(filter.search, 'i') },
        { code: new RegExp(filter.search, 'i') }
      ];
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      Warehouse.countDocuments(query),
      Warehouse.find(query).sort({ code: 1 }).skip(skip).limit(limit)
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }
}
