import mongoose from 'mongoose';

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ins_solar_dev');
    const db = mongoose.connection.db;
    if (!db) throw new Error('No DB connection');

    // 1. Warehouse
    let wh = await db.collection('warehouses').findOne({ code: 'WH-JAIPUR-01' });
    if (!wh) {
      const res = await db.collection('warehouses').insertOne({
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      wh = { _id: res.insertedId, code: 'WH-JAIPUR-01', name: 'Central Depot Jaipur' };
      console.log('Seeded Central Warehouse.');
    } else {
      console.log('Central Warehouse exists:', wh.name);
    }

    // 2. Vendors
    const vendors = [
      {
        vendorCode: 'VEN-2026-00001',
        name: 'Waaree Energies Limited',
        contactPerson: 'Karan Sharma',
        phone: '+919820011223',
        email: 'sales@waaree.com',
        gstin: '24AAACW1234A1Z5',
        pan: 'AAACW1234A',
        paymentTermsDays: 30,
        address: { addressLine1: 'B-Wing, Times Square, Andheri East', city: 'Mumbai', state: 'Maharashtra', postalCode: '400059', country: 'India' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorCode: 'VEN-2026-00002',
        name: 'Solis Power India Pvt Ltd',
        contactPerson: 'Amit Patel',
        phone: '+919811223344',
        email: 'orders@solisinverters.in',
        gstin: '07AAACS5678B1Z2',
        pan: 'AAACS5678B',
        paymentTermsDays: 30,
        address: { addressLine1: 'Tower B, Cyber City, DLF Phase 2', city: 'Gurugram', state: 'Haryana', postalCode: '122002', country: 'India' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        vendorCode: 'VEN-2026-00003',
        name: 'Polycab India Limited',
        contactPerson: 'Rohan Gupta',
        phone: '+919822334455',
        email: 'cables@polycab.com',
        gstin: '27AAACP9999C1Z8',
        pan: 'AAACP9999C',
        paymentTermsDays: 45,
        address: { addressLine1: 'Polycab House, Mogul Lane, Mahim', city: 'Mumbai', state: 'Maharashtra', postalCode: '400016', country: 'India' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const v of vendors) {
      const exists = await db.collection('vendors').findOne({ vendorCode: v.vendorCode });
      if (!exists) {
        await db.collection('vendors').insertOne(v);
        console.log('Seeded vendor:', v.name);
      }
    }

    // 3. Categories
    let catModules = await db.collection('productcategories').findOne({ code: 'CAT-MOD' });
    if (!catModules) {
      const r = await db.collection('productcategories').insertOne({
        code: 'CAT-MOD',
        name: 'Solar PV Modules',
        description: 'Bifacial & Monocrystalline PV panels',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      catModules = { _id: r.insertedId };
    }
    let catInv = await db.collection('productcategories').findOne({ code: 'CAT-INV' });
    if (!catInv) {
      const r = await db.collection('productcategories').insertOne({
        code: 'CAT-INV',
        name: 'Solar Inverters',
        description: 'Single-phase & 3-phase on-grid string inverters',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      catInv = { _id: r.insertedId };
    }
    let catBOS = await db.collection('productcategories').findOne({ code: 'CAT-BOS' });
    if (!catBOS) {
      const r = await db.collection('productcategories').insertOne({
        code: 'CAT-BOS',
        name: 'Balance of System & Cables',
        description: 'DC solar cables, ACDB/DCDB, structures and earthing',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      catBOS = { _id: r.insertedId };
    }

    // 4. Products
    const products = [
      {
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const p of products) {
      const exists = await db.collection('products').findOne({ skuNormalized: p.skuNormalized });
      if (!exists) {
        await db.collection('products').insertOne(p);
        console.log('Seeded product:', p.name);
      }
    }

    // 5. Stock Balances (ensure in both stockbalances and stock_balances for safety)
    const panel = await db.collection('products').findOne({ skuNormalized: 'PANEL-MONO-550W' });
    const inverter = await db.collection('products').findOne({ skuNormalized: 'INV-GRID-5KW' });
    const cable = await db.collection('products').findOne({ skuNormalized: 'CABLE-DC-4SQMM' });

    for (const colName of ['stockbalances', 'stock_balances']) {
      if (panel && wh) {
        await db.collection(colName).updateOne(
          { productId: panel._id, warehouseId: wh._id },
          {
            $set: {
              productId: panel._id,
              warehouseId: wh._id,
              onHandQuantity: 180,
              reservedQuantity: 20,
              availableQuantity: 160,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
      if (inverter && wh) {
        await db.collection(colName).updateOne(
          { productId: inverter._id, warehouseId: wh._id },
          {
            $set: {
              productId: inverter._id,
              warehouseId: wh._id,
              onHandQuantity: 24,
              reservedQuantity: 2,
              availableQuantity: 22,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
      if (cable && wh) {
        await db.collection(colName).updateOne(
          { productId: cable._id, warehouseId: wh._id },
          {
            $set: {
              productId: cable._id,
              warehouseId: wh._id,
              onHandQuantity: 1500,
              reservedQuantity: 200,
              availableQuantity: 1300,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }

    await mongoose.disconnect();
    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
