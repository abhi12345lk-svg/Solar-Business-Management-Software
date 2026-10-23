import { describe, it, expect } from 'vitest';
import {
  ProductCategoryCodeSchema,
  CreateProductCategoryInputSchema,
  SkuSchema,
  CreateProductInputSchema,
  WarehouseCodeSchema,
  CreateWarehouseInputSchema,
  ProductFilterSchema
} from '../schemas/catalog.js';
import { UnitOfMeasurement, WarehouseType } from '../types/enums.js';

describe('Catalog & Warehouse Shared Validation Schemas', () => {
  describe('ProductCategoryCodeSchema', () => {
    it('accepts valid uppercase alphanumeric category codes', () => {
      expect(ProductCategoryCodeSchema.parse('PANEL')).toBe('PANEL');
      expect(ProductCategoryCodeSchema.parse('INV_3PHASE')).toBe('INV_3PHASE');
      expect(ProductCategoryCodeSchema.parse('SOLAR-BATTERY')).toBe('SOLAR-BATTERY');
    });

    it('normalizes lowercase inputs to uppercase', () => {
      expect(ProductCategoryCodeSchema.parse('panel')).toBe('PANEL');
      expect(ProductCategoryCodeSchema.parse('  inverter-hybrid  ')).toBe('INVERTER-HYBRID');
    });

    it('rejects category codes that are too short, too long, or contain invalid characters', () => {
      expect(() => ProductCategoryCodeSchema.parse('A')).toThrow();
      expect(() => ProductCategoryCodeSchema.parse('PANEL@123')).toThrow();
      expect(() =>
        ProductCategoryCodeSchema.parse('VERY_LONG_CODE_THAT_EXCEEDS_THIRTY_CHARACTERS_LONG')
      ).toThrow();
    });
  });

  describe('CreateProductCategoryInputSchema', () => {
    it('validates a correct category input', () => {
      const valid = {
        code: 'SOLAR_PANELS',
        name: 'Monocrystalline Solar Panels',
        description: 'Tier-1 Mono PERC and TOPCon modules',
        parentId: '507f1f77bcf86cd799439011',
        isActive: true
      };
      const result = CreateProductCategoryInputSchema.parse(valid);
      expect(result.code).toBe('SOLAR_PANELS');
      expect(result.name).toBe('Monocrystalline Solar Panels');
    });

    it('rejects invalid parentId format', () => {
      const invalid = {
        code: 'SOLAR_PANELS',
        name: 'Monocrystalline Solar Panels',
        parentId: 'invalid-id'
      };
      expect(() => CreateProductCategoryInputSchema.parse(invalid)).toThrow(
        'Invalid parent category ObjectId'
      );
    });
  });

  describe('SkuSchema', () => {
    it('accepts valid SKU strings', () => {
      expect(SkuSchema.parse('MOD-550-MONO')).toBe('MOD-550-MONO');
      expect(SkuSchema.parse('INV.5KW.HYBRID')).toBe('INV.5KW.HYBRID');
      expect(SkuSchema.parse('CBL_4SQMM_RED')).toBe('CBL_4SQMM_RED');
    });

    it('rejects SKUs with invalid characters', () => {
      expect(() => SkuSchema.parse('MOD 550')).toThrow();
      expect(() => SkuSchema.parse('MOD#550$')).toThrow();
      expect(() => SkuSchema.parse('A')).toThrow();
    });
  });

  describe('CreateProductInputSchema', () => {
    it('validates a complete product with rates in integer paise', () => {
      const input = {
        sku: 'WAAREE-540-BIFACIAL',
        name: 'Waaree 540W Bifacial Dual Glass Solar Module',
        categoryId: '507f1f77bcf86cd799439011',
        brand: 'Waaree Energies',
        model: 'WSMD-540',
        productType: 'SOLAR_PANEL',
        uom: UnitOfMeasurement.NOS,
        hsnSacCode: '85414011',
        standardPurchaseRatePaise: 950000, // ₹9,500.00
        standardSellingRatePaise: 1120000, // ₹11,200.00
        minimumStockThreshold: 50,
        warranty: {
          warrantyYears: 25,
          warrantyType: 'PERFORMANCE',
          terms: '25 years 80% linear performance guarantee'
        }
      };

      const parsed = CreateProductInputSchema.parse(input);
      expect(parsed.sku).toBe('WAAREE-540-BIFACIAL');
      expect(parsed.standardPurchaseRatePaise).toBe(950000);
      expect(parsed.standardSellingRatePaise).toBe(1120000);
      expect(parsed.minimumStockThreshold).toBe(50);
    });

    it('rejects products with floating-point or negative money rates', () => {
      const input = {
        sku: 'WAAREE-540-BIFACIAL',
        name: 'Waaree 540W Bifacial',
        categoryId: '507f1f77bcf86cd799439011',
        brand: 'Waaree',
        model: 'WSMD-540',
        standardPurchaseRatePaise: 9500.5, // Invalid: floating point
        standardSellingRatePaise: 1120000
      };
      expect(() => CreateProductInputSchema.parse(input)).toThrow();

      const negativeInput = {
        ...input,
        standardPurchaseRatePaise: -100
      };
      expect(() => CreateProductInputSchema.parse(negativeInput)).toThrow();
    });

    it('rejects invalid HSN/SAC codes', () => {
      const input = {
        sku: 'WAAREE-540-BIFACIAL',
        name: 'Waaree 540W Bifacial',
        categoryId: '507f1f77bcf86cd799439011',
        brand: 'Waaree',
        model: 'WSMD-540',
        hsnSacCode: 'ABC123', // Invalid non-digit
        standardPurchaseRatePaise: 950000,
        standardSellingRatePaise: 1120000
      };
      expect(() => CreateProductInputSchema.parse(input)).toThrow('HSN/SAC code');
    });
  });

  describe('Warehouse Schemas', () => {
    it('accepts valid warehouse codes and normalizes them', () => {
      expect(WarehouseCodeSchema.parse('wh-central-01')).toBe('WH-CENTRAL-01');
      expect(WarehouseCodeSchema.parse('SITE-PROJECT-101')).toBe('SITE-PROJECT-101');
    });

    it('validates a complete warehouse creation input', () => {
      const input = {
        code: 'WH-CENTRAL-DEPOT',
        name: 'Ahmedabad Central Distribution Hub',
        type: WarehouseType.CENTRAL_DEPOT,
        address: {
          addressLine1: 'Plot 42, GIDC Phase II, Vatva',
          city: 'Ahmedabad',
          district: 'Ahmedabad',
          state: 'Gujarat',
          stateCode: '24',
          postalCode: '382445',
          country: 'India'
        },
        isActive: true
      };
      const parsed = CreateWarehouseInputSchema.parse(input);
      expect(parsed.code).toBe('WH-CENTRAL-DEPOT');
      expect(parsed.type).toBe(WarehouseType.CENTRAL_DEPOT);
      expect(parsed.address?.stateCode).toBe('24');
    });

    it('rejects invalid warehouse types', () => {
      const input = {
        code: 'WH-INVALID',
        name: 'Invalid Warehouse',
        type: 'UNDERGROUND_BUNKER'
      };
      expect(() => CreateWarehouseInputSchema.parse(input)).toThrow();
    });
  });

  describe('ProductFilterSchema', () => {
    it('parses string booleans and applies defaults', () => {
      const filter = ProductFilterSchema.parse({
        isActive: 'true',
        page: '2',
        limit: '50',
        sortBy: 'standardSellingRatePaise',
        sortOrder: 'asc'
      });
      expect(filter.isActive).toBe(true);
      expect(filter.page).toBe(2);
      expect(filter.limit).toBe(50);
      expect(filter.sortBy).toBe('standardSellingRatePaise');
      expect(filter.sortOrder).toBe('asc');
    });
  });
});
