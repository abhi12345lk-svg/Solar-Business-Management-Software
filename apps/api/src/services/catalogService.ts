/**
 * INS Solar Business Management Software — Catalog Service
 *
 * Business logic for Product Categories and Hardware Master Catalog.
 * Handles hierarchy cycle validation, case-insensitive SKU uniqueness,
 * and integer-paise financial validation.
 */

import { Types } from 'mongoose';
import {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  CreateProductInput,
  UpdateProductInput,
  ProductFilterInput,
  SequenceEntityType
} from '@ins-solar/shared';
import { ProductCategory, IProductCategoryDocument } from '../models/ProductCategory.js';
import { Product, IProductDocument } from '../models/Product.js';
import { SequenceService } from './sequenceService.js';
import { AppError } from '../errors/AppError.js';

export class CatalogService {
  // -------------------------------------------------------------------------
  // Category Management
  // -------------------------------------------------------------------------

  public static async createCategory(
    input: CreateProductCategoryInput,
    _actorId?: string
  ): Promise<IProductCategoryDocument> {
    const code = input.code.trim().toUpperCase();

    // 1. Check code uniqueness
    const existing = await ProductCategory.findOne({ code });
    if (existing) {
      throw AppError.conflict(`Product category with code '${code}' already exists.`);
    }

    let ancestors: Types.ObjectId[] = [];

    // 2. Validate parent if provided
    if (input.parentId) {
      const parent = await ProductCategory.findById(input.parentId);
      if (!parent) {
        throw AppError.notFound(`Parent category '${input.parentId}'`);
      }
      if (!parent.isActive) {
        throw AppError.badRequest('Cannot assign an inactive parent category.');
      }
      ancestors = [...parent.ancestors, parent._id];
    }

    const category = new ProductCategory({
      code,
      name: input.name.trim(),
      description: input.description?.trim(),
      parentId: input.parentId ? new Types.ObjectId(input.parentId) : null,
      ancestors,
      isActive: input.isActive ?? true
    });

    await category.save();
    return category;
  }

  public static async updateCategory(
    id: string,
    input: UpdateProductCategoryInput,
    _actorId?: string
  ): Promise<IProductCategoryDocument> {
    const category = await ProductCategory.findById(id);
    if (!category) {
      throw AppError.notFound(`Product category '${id}'`);
    }

    if (input.name !== undefined) {
      category.name = input.name.trim();
    }
    if (input.description !== undefined) {
      category.description = input.description ? input.description.trim() : undefined;
    }
    if (input.isActive !== undefined) {
      category.isActive = input.isActive;
    }

    // Handle parent reassignment with cycle detection
    if (input.parentId !== undefined) {
      if (input.parentId === null) {
        category.parentId = null;
        category.ancestors = [];
      } else {
        if (input.parentId === id) {
          throw AppError.badRequest('A category cannot be its own parent.');
        }

        const newParent = await ProductCategory.findById(input.parentId);
        if (!newParent) {
          throw AppError.notFound(`Parent category '${input.parentId}'`);
        }
        if (!newParent.isActive) {
          throw AppError.badRequest('Cannot assign an inactive parent category.');
        }

        // Bounded cycle detection: walk up hierarchy (max 10 levels)
        let currentParent: IProductCategoryDocument | null = newParent;
        let depth = 0;
        while (currentParent && depth < 10) {
          if (currentParent._id.toString() === id) {
            throw AppError.badRequest(
              'Cyclic category hierarchy detected. A category cannot be an ancestor of its parent.'
            );
          }
          if (currentParent.parentId) {
            currentParent = await ProductCategory.findById(currentParent.parentId);
          } else {
            break;
          }
          depth++;
        }

        category.parentId = newParent._id;
        category.ancestors = [...newParent.ancestors, newParent._id];
      }
    }

    await category.save();
    return category;
  }

  public static async deactivateCategory(
    id: string,
    _actorId?: string
  ): Promise<IProductCategoryDocument> {
    const category = await ProductCategory.findById(id);
    if (!category) {
      throw AppError.notFound(`Product category '${id}'`);
    }

    // Constraint 1: Check active child categories
    const activeChildrenCount = await ProductCategory.countDocuments({
      parentId: category._id,
      isActive: true
    });
    if (activeChildrenCount > 0) {
      throw AppError.badRequest(
        `Cannot deactivate category '${category.name}' because it has ${activeChildrenCount} active subcategories.`
      );
    }

    // Constraint 2: Check active products referencing this category
    const activeProductsCount = await Product.countDocuments({
      categoryId: category._id,
      isActive: true
    });
    if (activeProductsCount > 0) {
      throw AppError.badRequest(
        `Cannot deactivate category '${category.name}' because it is assigned to ${activeProductsCount} active products.`
      );
    }

    category.isActive = false;
    await category.save();
    return category;
  }

  public static async listCategories(options?: {
    isActive?: boolean;
    parentId?: string | null;
  }): Promise<IProductCategoryDocument[]> {
    const filter: Record<string, any> = {};
    if (options?.isActive !== undefined) {
      filter.isActive = options.isActive;
    }
    if (options?.parentId !== undefined) {
      filter.parentId = options.parentId ? new Types.ObjectId(options.parentId) : null;
    }

    return await ProductCategory.find(filter).sort({ name: 1 });
  }

  // -------------------------------------------------------------------------
  // Product Management
  // -------------------------------------------------------------------------

  public static async createProduct(
    input: CreateProductInput,
    actorId?: string
  ): Promise<IProductDocument> {
    // 1. Verify Category exists and is active
    const category = await ProductCategory.findById(input.categoryId);
    if (!category) {
      throw AppError.notFound(`Category '${input.categoryId}'`);
    }
    if (!category.isActive) {
      throw AppError.badRequest('Cannot add product to an inactive category.');
    }

    // 2. Normalized case-insensitive SKU uniqueness check
    const cleanSku = input.sku.trim();
    const skuNormalized = cleanSku.toUpperCase();
    const existingSku = await Product.findOne({ skuNormalized });
    if (existingSku) {
      throw AppError.conflict(`Product with SKU '${cleanSku}' already exists.`);
    }

    // 3. Allocate unique business product code via atomic SequenceService
    let productCode = input.productCode?.trim().toUpperCase();
    if (!productCode) {
      const seq = await SequenceService.generateNextSequence({
        entityType: SequenceEntityType.PRODUCT
      });
      productCode = seq.formattedNumber;
    } else {
      const existingCode = await Product.findOne({ productCode });
      if (existingCode) {
        throw AppError.conflict(`Product with code '${productCode}' already exists.`);
      }
    }

    try {
      const product = new Product({
        productCode,
        sku: cleanSku,
        skuNormalized,
        name: input.name.trim(),
        description: input.description?.trim(),
        categoryId: category._id,
        brand: input.brand.trim(),
        model: input.model.trim(),
        productType: input.productType || 'OTHER',
        technicalSpecifications: input.technicalSpecifications || {},
        uom: input.uom,
        hsnSacCode: input.hsnSacCode?.trim(),
        standardPurchaseRatePaise: input.standardPurchaseRatePaise,
        standardSellingRatePaise: input.standardSellingRatePaise,
        taxProfileCode: input.taxProfileCode || 'TAX_SOLAR_STANDARD',
        minimumStockThreshold: input.minimumStockThreshold ?? 0,
        isActive: input.isActive ?? true,
        warranty: input.warranty,
        createdBy: actorId ? new Types.ObjectId(actorId) : undefined
      });

      await product.save();
      return product;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw AppError.conflict('Product with this SKU or product code already exists.');
      }
      throw err;
    }
  }

  public static async updateProduct(
    id: string,
    input: UpdateProductInput,
    actorId?: string
  ): Promise<IProductDocument> {
    const product = await Product.findById(id);
    if (!product) {
      throw AppError.notFound(`Product '${id}'`);
    }

    if (input.sku !== undefined) {
      const cleanSku = input.sku.trim();
      const skuNormalized = cleanSku.toUpperCase();
      if (skuNormalized !== product.skuNormalized) {
        const existing = await Product.findOne({ skuNormalized });
        if (existing && existing._id.toString() !== id) {
          throw AppError.conflict(`Product with SKU '${cleanSku}' already exists.`);
        }
        product.sku = cleanSku;
        product.skuNormalized = skuNormalized;
      }
    }

    if (input.categoryId !== undefined) {
      const category = await ProductCategory.findById(input.categoryId);
      if (!category) {
        throw AppError.notFound(`Category '${input.categoryId}'`);
      }
      if (!category.isActive) {
        throw AppError.badRequest('Cannot move product to an inactive category.');
      }
      product.categoryId = category._id;
    }

    if (input.name !== undefined) product.name = input.name.trim();
    if (input.description !== undefined) product.description = input.description?.trim();
    if (input.brand !== undefined) product.brand = input.brand.trim();
    if (input.model !== undefined) product.model = input.model.trim();
    if (input.productType !== undefined) product.productType = input.productType.trim();
    if (input.technicalSpecifications !== undefined) {
      product.technicalSpecifications = input.technicalSpecifications;
    }
    if (input.uom !== undefined) product.uom = input.uom;
    if (input.hsnSacCode !== undefined) product.hsnSacCode = input.hsnSacCode?.trim();
    if (input.standardPurchaseRatePaise !== undefined) {
      product.standardPurchaseRatePaise = input.standardPurchaseRatePaise;
    }
    if (input.standardSellingRatePaise !== undefined) {
      product.standardSellingRatePaise = input.standardSellingRatePaise;
    }
    if (input.taxProfileCode !== undefined) product.taxProfileCode = input.taxProfileCode.trim();
    if (input.minimumStockThreshold !== undefined) {
      product.minimumStockThreshold = input.minimumStockThreshold;
    }
    if (input.isActive !== undefined) product.isActive = input.isActive;
    if (input.warranty !== undefined) product.warranty = input.warranty;
    if (actorId) product.updatedBy = new Types.ObjectId(actorId);

    await product.save();
    return product;
  }

  public static async deactivateProduct(id: string, actorId?: string): Promise<IProductDocument> {
    const product = await Product.findById(id);
    if (!product) {
      throw AppError.notFound(`Product '${id}'`);
    }

    // Soft deactivation preserves historical quotations, orders, and ledger movements
    product.isActive = false;
    if (actorId) product.updatedBy = new Types.ObjectId(actorId);
    await product.save();
    return product;
  }

  public static async getProductById(id: string): Promise<IProductDocument> {
    const product = await Product.findById(id).populate('categoryId', 'name code');
    if (!product) {
      throw AppError.notFound(`Product '${id}'`);
    }
    return product;
  }

  public static async listProducts(filter: ProductFilterInput): Promise<{
    data: IProductDocument[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const query: Record<string, any> = {};

    if (filter.categoryId) {
      query.categoryId = new Types.ObjectId(filter.categoryId);
    }
    if (filter.brand) {
      query.brand = new RegExp(filter.brand, 'i');
    }
    if (filter.productType) {
      query.productType = filter.productType;
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    if (filter.minPricePaise !== undefined || filter.maxPricePaise !== undefined) {
      query.standardSellingRatePaise = {};
      if (filter.minPricePaise !== undefined) {
        query.standardSellingRatePaise.$gte = filter.minPricePaise;
      }
      if (filter.maxPricePaise !== undefined) {
        query.standardSellingRatePaise.$lte = filter.maxPricePaise;
      }
    }
    if (filter.search) {
      query.$or = [
        { name: new RegExp(filter.search, 'i') },
        { brand: new RegExp(filter.search, 'i') },
        { model: new RegExp(filter.search, 'i') },
        { sku: new RegExp(filter.search, 'i') }
      ];
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = filter.sortBy || 'createdAt';
    const sortDir = filter.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir };

    const [total, data] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query).sort(sort).skip(skip).limit(limit).populate('categoryId', 'name code')
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
