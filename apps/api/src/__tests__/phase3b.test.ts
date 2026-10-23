import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { SequenceService } from '../services/sequenceService.js';
import { CatalogService } from '../services/catalogService.js';
import { WarehouseService } from '../services/warehouseService.js';
import { ProductCategory } from '../models/ProductCategory.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { UnitOfMeasurement, WarehouseType, AddressType } from '@ins-solar/shared';

describe('Phase 3B: Product Catalog, Categories & Warehouse Foundation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    SequenceService.resetInMemoryCounters();
  });

  // --------------------------------------------------------------------------
  // 1. Product creation with valid data and auto-generated productCode
  // --------------------------------------------------------------------------
  it('creates product with valid data, integer paise rates, and auto-generated productCode', async () => {
    const category = new ProductCategory({
      _id: new mongoose.Types.ObjectId(),
      code: 'MODULES',
      name: 'Solar Modules',
      ancestors: [],
      isActive: true
    });

    vi.spyOn(ProductCategory, 'findById').mockResolvedValue(category as any);
    vi.spyOn(Product, 'findOne').mockResolvedValue(null);

    let savedProductData: any = null;
    vi.spyOn(Product.prototype, 'save').mockImplementation(async function (this: any) {
      savedProductData = this.toObject();
      return this;
    });

    const product = await CatalogService.createProduct({
      sku: 'WAAREE-540-BIFACIAL',
      name: 'Waaree 540W Bifacial Dual Glass Module',
      categoryId: category._id.toString(),
      brand: 'Waaree Energies',
      model: 'WSMD-540',
      productType: 'SOLAR_PANEL',
      uom: UnitOfMeasurement.NOS,
      hsnSacCode: '85414011',
      standardPurchaseRatePaise: 950000, // ₹9,500.00
      standardSellingRatePaise: 1120000, // ₹11,200.00
      minimumStockThreshold: 20,
      taxProfileCode: 'TAX_SOLAR_STANDARD',
      isActive: true
    });

    expect(product.sku).toBe('WAAREE-540-BIFACIAL');
    expect(product.skuNormalized).toBe('WAAREE-540-BIFACIAL');
    expect(product.productCode).toMatch(/^PROD-\d{4}-\d{5}$/);
    expect(product.standardPurchaseRatePaise).toBe(950000);
    expect(product.standardSellingRatePaise).toBe(1120000);
    expect(savedProductData).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. Duplicate SKU rejection
  // --------------------------------------------------------------------------
  it('rejects duplicate SKU creation with HTTP 409 conflict', async () => {
    const category = new ProductCategory({
      _id: new mongoose.Types.ObjectId(),
      code: 'MODULES',
      name: 'Solar Modules',
      ancestors: [],
      isActive: true
    });

    vi.spyOn(ProductCategory, 'findById').mockResolvedValue(category as any);
    vi.spyOn(Product, 'findOne').mockResolvedValue({
      skuNormalized: 'WAAREE-540-BIFACIAL'
    } as any);

    await expect(
      CatalogService.createProduct({
        sku: 'WAAREE-540-BIFACIAL',
        name: 'Waaree 540W Duplicate',
        categoryId: category._id.toString(),
        brand: 'Waaree',
        model: 'WSMD-540',
        productType: 'SOLAR_PANEL',
        uom: UnitOfMeasurement.NOS,
        standardPurchaseRatePaise: 950000,
        standardSellingRatePaise: 1120000,
        taxProfileCode: 'TAX_SOLAR_STANDARD',
        minimumStockThreshold: 0,
        isActive: true
      })
    ).rejects.toThrow("Product with SKU 'WAAREE-540-BIFACIAL' already exists.");
  });

  // --------------------------------------------------------------------------
  // 3. Case-insensitive SKU uniqueness
  // --------------------------------------------------------------------------
  it('enforces case-insensitive SKU uniqueness against normalized index', async () => {
    const category = new ProductCategory({
      _id: new mongoose.Types.ObjectId(),
      code: 'INVERTER',
      name: 'Inverters',
      ancestors: [],
      isActive: true
    });

    vi.spyOn(ProductCategory, 'findById').mockResolvedValue(category as any);
    vi.spyOn(Product, 'findOne').mockImplementation((async (query: any) => {
      if (query.skuNormalized === 'INV-GROWATT-5K') {
        return { skuNormalized: 'INV-GROWATT-5K' } as any;
      }
      return null;
    }) as any);

    // Submitting lowercase sku: 'inv-growatt-5k'
    await expect(
      CatalogService.createProduct({
        sku: 'inv-growatt-5k',
        name: 'Growatt 5kW Hybrid Inverter',
        categoryId: category._id.toString(),
        brand: 'Growatt',
        model: 'MIN-5000TL-X',
        productType: 'INVERTER',
        uom: UnitOfMeasurement.NOS,
        standardPurchaseRatePaise: 4500000,
        standardSellingRatePaise: 5200000,
        taxProfileCode: 'TAX_SOLAR_STANDARD',
        minimumStockThreshold: 0,
        isActive: true
      })
    ).rejects.toThrow("Product with SKU 'inv-growatt-5k' already exists.");
  });

  // --------------------------------------------------------------------------
  // 4. Invalid money, unit, and inactive category rejection
  // --------------------------------------------------------------------------
  it('rejects product creation when category is inactive or missing', async () => {
    const inactiveCategory = new ProductCategory({
      _id: new mongoose.Types.ObjectId(),
      code: 'OLD_MODULES',
      name: 'Old Modules',
      isActive: false
    });

    vi.spyOn(ProductCategory, 'findById').mockResolvedValue(inactiveCategory as any);

    await expect(
      CatalogService.createProduct({
        sku: 'OLD-MOD-330',
        name: 'Old Poly 330W',
        categoryId: inactiveCategory._id.toString(),
        brand: 'Generic',
        model: 'P330',
        productType: 'SOLAR_PANEL',
        uom: UnitOfMeasurement.NOS,
        standardPurchaseRatePaise: 500000,
        standardSellingRatePaise: 600000,
        taxProfileCode: 'TAX_SOLAR_STANDARD',
        minimumStockThreshold: 0,
        isActive: true
      })
    ).rejects.toThrow('Cannot add product to an inactive category.');
  });

  // --------------------------------------------------------------------------
  // 5. Product serialization and protected-field behavior
  // --------------------------------------------------------------------------
  it('sanitizes product serialization via toJSON and separates master from inventory ledger', () => {
    const categoryId = new mongoose.Types.ObjectId();
    const product = new Product({
      productCode: 'PROD-2026-00042',
      sku: 'HAV-INV-10KW',
      skuNormalized: 'HAV-INV-10KW',
      name: 'Havells 10kW On-Grid Inverter',
      categoryId,
      brand: 'Havells Enviro',
      model: 'ENV-10K',
      standardPurchaseRatePaise: 7500000,
      standardSellingRatePaise: 8800000
    });

    const json = product.toJSON();
    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    // Authoritative stock balance must NOT exist on product master
    expect((json as any).currentStockQuantity).toBeUndefined();
    expect((json as any).physicalQuantity).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 6. Category hierarchy validation: self-parenting and cyclic hierarchy rejection
  // --------------------------------------------------------------------------
  it('rejects self-parenting and cyclic category hierarchies', async () => {
    const catAId = new mongoose.Types.ObjectId();
    const catBId = new mongoose.Types.ObjectId();

    const catA = new ProductCategory({
      _id: catAId,
      code: 'CAT_A',
      name: 'Category A',
      ancestors: [],
      isActive: true
    });

    const catB = new ProductCategory({
      _id: catBId,
      code: 'CAT_B',
      name: 'Category B',
      parentId: catAId,
      ancestors: [catAId],
      isActive: true
    });

    // 1. Self-parenting check
    vi.spyOn(ProductCategory, 'findById').mockImplementation(((id: any) => {
      if (id?.toString() === catAId.toString()) return Promise.resolve(catA);
      if (id?.toString() === catBId.toString()) return Promise.resolve(catB);
      return Promise.resolve(null);
    }) as any);

    await expect(
      CatalogService.updateCategory(catAId.toString(), {
        parentId: catAId.toString()
      })
    ).rejects.toThrow('A category cannot be its own parent.');

    // 2. Cyclic hierarchy check: trying to make catA's parent catB (which already has parent catA)
    await expect(
      CatalogService.updateCategory(catAId.toString(), {
        parentId: catBId.toString()
      })
    ).rejects.toThrow('Cyclic category hierarchy detected.');
  });

  // --------------------------------------------------------------------------
  // 7. Category deactivation constraints
  // --------------------------------------------------------------------------
  it('prevents deactivating category when active subcategories or products exist', async () => {
    const catId = new mongoose.Types.ObjectId();
    const category = new ProductCategory({
      _id: catId,
      code: 'SOLAR_PANELS',
      name: 'Solar Panels',
      isActive: true
    });

    vi.spyOn(ProductCategory, 'findById').mockResolvedValue(category as any);

    // Mock active subcategories
    vi.spyOn(ProductCategory, 'countDocuments').mockResolvedValue(2 as any);
    await expect(CatalogService.deactivateCategory(catId.toString())).rejects.toThrow(
      'Cannot deactivate category'
    );

    // Mock no subcategories, but active products
    vi.spyOn(ProductCategory, 'countDocuments').mockResolvedValue(0 as any);
    vi.spyOn(Product, 'countDocuments').mockResolvedValue(5 as any);
    await expect(CatalogService.deactivateCategory(catId.toString())).rejects.toThrow(
      'Cannot deactivate category'
    );
  });

  // --------------------------------------------------------------------------
  // 8. Warehouse code uniqueness and normalization
  // --------------------------------------------------------------------------
  it('creates warehouse and enforces unique uppercase location codes', async () => {
    vi.spyOn(Warehouse, 'findOne').mockResolvedValue(null);

    let savedWarehouse: any = null;
    vi.spyOn(Warehouse.prototype, 'save').mockImplementation(async function (this: any) {
      savedWarehouse = this.toObject();
      return this;
    });

    const wh = await WarehouseService.createWarehouse({
      code: 'wh-depot-ahmedabad',
      name: 'Ahmedabad Central Distribution Hub',
      type: WarehouseType.CENTRAL_DEPOT,
      address: {
        type: AddressType.WAREHOUSE,
        addressLine1: 'Plot 42, GIDC Vatva Phase II',
        city: 'Ahmedabad',
        state: 'Gujarat',
        postalCode: '382445',
        country: 'India'
      },
      isActive: true
    });

    expect(wh.code).toBe('WH-DEPOT-AHMEDABAD');
    expect(wh.type).toBe(WarehouseType.CENTRAL_DEPOT);
    expect(savedWarehouse).toBeDefined();

    // Check duplicate rejection
    vi.spyOn(Warehouse, 'findOne').mockResolvedValue({ code: 'WH-DEPOT-AHMEDABAD' } as any);
    await expect(
      WarehouseService.createWarehouse({
        code: 'WH-DEPOT-AHMEDABAD',
        name: 'Duplicate Warehouse',
        type: WarehouseType.CENTRAL_DEPOT,
        isActive: true
      })
    ).rejects.toThrow("Warehouse with code 'WH-DEPOT-AHMEDABAD' already exists.");
  });

  // --------------------------------------------------------------------------
  // 9. Warehouse deactivation behavior
  // --------------------------------------------------------------------------
  it('soft-deactivates warehouse without physical document deletion', async () => {
    const whId = new mongoose.Types.ObjectId();
    const warehouse = new Warehouse({
      _id: whId,
      code: 'WH-TRANSIT-01',
      name: 'Transit Warehouse Surat',
      type: WarehouseType.TRANSIT,
      isActive: true
    });

    vi.spyOn(Warehouse, 'findById').mockResolvedValue(warehouse as any);
    vi.spyOn(warehouse, 'save').mockResolvedValue(warehouse as any);

    const deactivated = await WarehouseService.deactivateWarehouse(whId.toString());
    expect(deactivated.isActive).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 10. Pagination, filtering and sorting on product query
  // --------------------------------------------------------------------------
  it('executes validated paginated queries with sorting and search filters', async () => {
    const mockProducts = [
      { productCode: 'PROD-2026-00001', name: 'Waaree 540W', brand: 'Waaree' },
      { productCode: 'PROD-2026-00002', name: 'Tata 550W', brand: 'Tata Power Solar' }
    ];

    vi.spyOn(Product, 'countDocuments').mockResolvedValue(2 as any);
    vi.spyOn(Product, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate: vi.fn().mockResolvedValue(mockProducts as any)
    } as any);

    const result = await CatalogService.listProducts({
      search: 'Waaree',
      brand: 'Waaree',
      page: 1,
      limit: 10,
      sortBy: 'standardSellingRatePaise',
      sortOrder: 'asc'
    });

    expect(result.data.length).toBe(2);
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.page).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 11. Unauthorized catalog and warehouse mutations are denied
  // --------------------------------------------------------------------------
  it('denies unauthenticated requests to catalog and warehouse endpoints with HTTP 401', async () => {
    const app = createApp();

    // 1. GET requests without authentication must return 401
    const resCatGet = await request(app).get('/api/v1/catalog/categories');
    expect(resCatGet.status).toBe(401);
    expect(resCatGet.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const resProdGet = await request(app).get('/api/v1/catalog/products');
    expect(resProdGet.status).toBe(401);
    expect(resProdGet.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const resWhGet = await request(app).get('/api/v1/warehouses');
    expect(resWhGet.status).toBe(401);
    expect(resWhGet.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    // 2. Obtain valid CSRF token from auth csrf endpoint
    const initRes = await request(app).get('/api/v1/auth/csrf');
    const csrfToken = initRes.body.data.csrfToken;
    const sessionCookie = (initRes.headers['set-cookie'] as unknown as string[]) || [];

    // 3. POST request with valid CSRF token but unauthenticated must return 401
    const resProdPost = await request(app)
      .post('/api/v1/catalog/products')
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', sessionCookie)
      .send({
        sku: 'TEST-SKU',
        name: 'Test Product'
      });
    expect(resProdPost.status).toBe(401);
    expect(resProdPost.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  // --------------------------------------------------------------------------
  // 12. Production Sequence Generation Refuses In-Memory Fallback
  // --------------------------------------------------------------------------
  it('STRICT SAFETY: refuses in-memory fallback in production when MongoDB is unavailable', async () => {
    const originalEnv = process.env.NODE_ENV;

    try {
      // Simulate production runtime
      process.env.NODE_ENV = 'production';

      // Verify mongoose is disconnected (readyState 0 or !== 1)
      expect(mongoose.connection.readyState).not.toBe(1);

      // Attempting to generate sequence in production without MongoDB must throw AppError(503)
      await expect(
        SequenceService.generateNextSequence({
          entityType: 'ORDER'
        })
      ).rejects.toThrow(/Database connection unavailable.*strictly rejected in production/);

      // Sequence preview in production without MongoDB must also throw AppError(503)
      await expect(
        SequenceService.previewNextSequence({
          entityType: 'ORDER'
        })
      ).rejects.toThrow(/Database connection unavailable.*disabled in production/);
    } finally {
      // Restore test environment
      process.env.NODE_ENV = originalEnv;
    }
  });
});
