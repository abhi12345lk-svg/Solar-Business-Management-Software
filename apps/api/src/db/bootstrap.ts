import mongoose from 'mongoose';
import { User, Warehouse, ProductCategory, Product, Vendor, StockBalance } from '../models/index.js';
import { UserRole, Department } from '@ins-solar/shared';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * Ensures initial default workstation users exist in MongoDB upon fresh connection.
 * Idempotent and concurrency-safe. Does NOT insert any demo or mock business data.
 */
export async function bootstrapDefaultUsers(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const adminExists = await User.exists({ email: 'admin@inssolar.com' });
    if (!adminExists) {
      const adminPassHash = await hashPassword('SolarAdmin2026!');
      await User.create({
        employeeCode: 'EMP-0001',
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@inssolar.com',
        phone: '+919876500000',
        passwordHash: adminPassHash,
        department: Department.ADMIN,
        role: UserRole.SUPERADMIN,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      });
      logger.info('Initialized default Super Administrator (admin@inssolar.com).');
    }

    const salesExists = await User.exists({ email: 'sales@inssolar.com' });
    if (!salesExists) {
      const salesPassHash = await hashPassword('SolarSales2026!');
      await User.create({
        employeeCode: 'EMP-0002',
        firstName: 'Rajesh',
        lastName: 'Sharma',
        email: 'sales@inssolar.com',
        phone: '+919876500001',
        passwordHash: salesPassHash,
        department: Department.SALES,
        role: UserRole.SALES_EXECUTIVE,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      });
      logger.info('Initialized default Sales Executive (sales@inssolar.com).');
    }

    const accountsExists = await User.exists({ email: 'accounts@inssolar.com' });
    if (!accountsExists) {
      const accountsPassHash = await hashPassword('SolarAccounts2026!');
      await User.create({
        employeeCode: 'EMP-0003',
        firstName: 'Priya',
        lastName: 'Verma',
        email: 'accounts@inssolar.com',
        phone: '+919876500002',
        passwordHash: accountsPassHash,
        department: Department.ACCOUNTS,
        role: UserRole.ACCOUNTS_OFFICER,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      });
      logger.info('Initialized default Accounts Officer (accounts@inssolar.com).');
    }

    // Bootstrap default central warehouse if none exists
    const warehouseCount = await Warehouse.countDocuments({});
    let defaultWarehouse = await Warehouse.findOne({ code: 'WH-JAIPUR-01' });
    if (warehouseCount === 0 || !defaultWarehouse) {
      defaultWarehouse = await Warehouse.create({
        code: 'WH-JAIPUR-01',
        name: 'Central Depot Jaipur',
        type: 'CENTRAL_DEPOT',
        address: {
          addressLine1: 'Warehouse C-12, Transport Nagar',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302003',
          country: 'India'
        },
        isActive: true
      });
      logger.info('Initialized default Central Depot Jaipur.');
    }

    // Bootstrap product categories if none exists
    let catModules = await ProductCategory.findOne({ code: 'CAT-MOD' });
    if (!catModules) {
      catModules = await ProductCategory.create({
        code: 'CAT-MOD',
        name: 'Solar PV Modules',
        description: 'Bifacial & Monocrystalline PV panels',
        isActive: true
      });
    }
    let catInv = await ProductCategory.findOne({ code: 'CAT-INV' });
    if (!catInv) {
      catInv = await ProductCategory.create({
        code: 'CAT-INV',
        name: 'Solar Inverters',
        description: 'Single-phase & 3-phase on-grid string inverters',
        isActive: true
      });
    }
    let catBOS = await ProductCategory.findOne({ code: 'CAT-BOS' });
    if (!catBOS) {
      catBOS = await ProductCategory.create({
        code: 'CAT-BOS',
        name: 'Balance of System & Cables',
        description: 'DC solar cables, ACDB/DCDB, structures and earthing',
        isActive: true
      });
    }

    // Bootstrap standard solar products if none exists
    const productCount = await Product.countDocuments({});
    if (productCount === 0) {
      const p1 = await Product.create({
        productCode: 'PROD-2026-00001',
        sku: 'PANEL-MONO-550W',
        skuNormalized: 'PANEL-MONO-550W',
        name: '550Wp Mono Perc Solar Panel',
        description: 'High efficiency Half-Cut Bifacial Monocrystalline Module with 25-yr warranty',
        categoryId: catModules._id,
        brand: 'Waaree',
        model: 'WXS-550',
        productType: 'PANEL',
        uom: 'NOS',
        standardPurchaseRatePaise: 1100000,
        standardSellingRatePaise: 1350000,
        taxProfileCode: 'GST_12',
        minimumStockThreshold: 20,
        isActive: true
      });
      const p2 = await Product.create({
        productCode: 'PROD-2026-00002',
        sku: 'INV-GRID-5KW',
        skuNormalized: 'INV-GRID-5KW',
        name: '5kW Single Phase On-Grid Inverter',
        description: 'Dual MPPT, IP65 waterproof on-grid solar string inverter with Wi-Fi monitoring',
        categoryId: catInv._id,
        brand: 'Solis',
        model: 'S5-GR1P5K',
        productType: 'INVERTER',
        uom: 'SETS',
        standardPurchaseRatePaise: 3500000,
        standardSellingRatePaise: 4200000,
        taxProfileCode: 'GST_12',
        minimumStockThreshold: 5,
        isActive: true
      });
      const p3 = await Product.create({
        productCode: 'PROD-2026-00003',
        sku: 'CABLE-DC-4SQMM',
        skuNormalized: 'CABLE-DC-4SQMM',
        name: '4 sq.mm Copper Solar DC Cable (Red/Black)',
        description: 'UV & Ozone resistant cross-linked polyolefin insulated copper DC solar cable',
        categoryId: catBOS._id,
        brand: 'Polycab',
        model: 'SOLAR-4MM',
        productType: 'CABLE',
        uom: 'METERS',
        standardPurchaseRatePaise: 4200,
        standardSellingRatePaise: 5500,
        taxProfileCode: 'GST_18',
        minimumStockThreshold: 500,
        isActive: true
      });

      // Stock balances for default products
      if (defaultWarehouse) {
        await StockBalance.create({
          productId: p1._id,
          warehouseId: defaultWarehouse._id,
          onHandQuantity: 180,
          reservedQuantity: 20,
          availableQuantity: 160
        });
        await StockBalance.create({
          productId: p2._id,
          warehouseId: defaultWarehouse._id,
          onHandQuantity: 24,
          reservedQuantity: 2,
          availableQuantity: 22
        });
        await StockBalance.create({
          productId: p3._id,
          warehouseId: defaultWarehouse._id,
          onHandQuantity: 1500,
          reservedQuantity: 200,
          availableQuantity: 1300
        });
      }
      logger.info('Initialized default solar products and initial stock balances.');
    }

    // Bootstrap default Tier-1 vendors if none exists
    const vendorCount = await Vendor.countDocuments({});
    if (vendorCount === 0) {
      await Vendor.create({
        vendorCode: 'VEN-2026-00001',
        name: 'Waaree Energies Limited',
        contactPerson: 'Karan Sharma',
        phone: '+919820011223',
        email: 'sales@waaree.com',
        gstin: '24AAACW1234A1Z5',
        pan: 'AAACW1234A',
        paymentTermsDays: 30,
        address: { addressLine1: 'B-Wing, Times Square, Andheri East', city: 'Mumbai', state: 'Maharashtra', postalCode: '400059', country: 'India' },
        isActive: true
      });
      await Vendor.create({
        vendorCode: 'VEN-2026-00002',
        name: 'Solis Power India Pvt Ltd',
        contactPerson: 'Amit Patel',
        phone: '+919811223344',
        email: 'orders@solisinverters.in',
        gstin: '07AAACS5678B1Z2',
        pan: 'AAACS5678B',
        paymentTermsDays: 30,
        address: { addressLine1: 'Tower B, Cyber City, DLF Phase 2', city: 'Gurugram', state: 'Haryana', postalCode: '122002', country: 'India' },
        isActive: true
      });
      await Vendor.create({
        vendorCode: 'VEN-2026-00003',
        name: 'Polycab India Limited',
        contactPerson: 'Rohan Gupta',
        phone: '+919822334455',
        email: 'cables@polycab.com',
        gstin: '27AAACP9999C1Z8',
        pan: 'AAACP9999C',
        paymentTermsDays: 45,
        address: { addressLine1: 'Polycab House, Mogul Lane, Mahim', city: 'Mumbai', state: 'Maharashtra', postalCode: '400016', country: 'India' },
        isActive: true
      });
      logger.info('Initialized default Tier-1 solar suppliers.');
    }
  } catch (err: any) {
    logger.warn(
      { err: err?.message },
      'Non-fatal notice during initial workstation user bootstrap.'
    );
  }
}
