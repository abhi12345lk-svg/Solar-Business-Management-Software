import { dbManager } from '../db/connection.js';
import {
  User,
  Vendor,
  PurchaseOrder,
  VendorInvoice,
  Expense,
  SubsidyApplication,
  Project,
  Customer,
  Warehouse,
  Product
} from '../models/index.js';
import {
  UserRole,
  PurchaseOrderStatus,
  VendorInvoiceStatus,
  ExpenseCategory,
  ExpenseStatus,
  ExpensePaymentStatus,
  PaymentMethod,
  UnitOfMeasurement,
  SubsidyScheme,
  SubsidyStatus
} from '@ins-solar/shared';

export async function seedAccountsFlowData(): Promise<void> {
  await dbManager.connect();

  try {
    const admin = await User.findOne({ role: UserRole.SUPERADMIN });
    const accounts = await User.findOne({ email: 'accounts@inssolar.com' });
    const creatorId = admin?._id || accounts?._id;

    if (!creatorId) {
      console.error('No admin or accounts user found in DB.');
      return;
    }

    const warehouse = await Warehouse.findOne();
    const productPanel = await Product.findOne({ sku: 'PANEL-MONO-550W' });
    const productInv = await Product.findOne({ sku: 'INV-GRID-5KW' });
    const project1 = await Project.findOne({ projectCode: 'PRJ-2026-00001' });
    const project3 = await Project.findOne({ projectCode: 'PRJ-2026-00003' }) || project1;
    const customerRaki = await Customer.findOne({ customerCode: 'CUST-2026-00003' });

    // 1. Seed Real Solar EPC Vendors
    const vendorsToSeed = [
      {
        vendorCode: 'VEN-2026-00001',
        name: 'Waaree Energies Limited',
        contactPerson: 'Vikas Singhal',
        email: 'orders@waaree.com',
        phone: '+912266440000',
        address: {
          addressLine1: '602, Western Edge I, Borivali East',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400066',
          country: 'India'
        },
        gstin: '27AAACW8891P1ZX',
        pan: 'AAACW8891P',
        suppliedCategoryIds: productPanel ? [productPanel.categoryId] : [],
        suppliedProductIds: productPanel ? [productPanel._id] : [],
        paymentTermsDays: 30,
        bankDetails: {
          accountName: 'Waaree Energies Ltd',
          accountNumber: '002905001290',
          ifscCode: 'HDFC0000029',
          bankName: 'HDFC Bank'
        },
        isActive: true,
        hasPurchaseHistory: true,
        createdBy: creatorId
      },
      {
        vendorCode: 'VEN-2026-00002',
        name: 'Growatt New Energy India Pvt Ltd',
        contactPerson: 'Arunav Mathur',
        email: 'sales.india@growatt.com',
        phone: '+911145678900',
        address: {
          addressLine1: 'Connaught Place, Barakhamba Road',
          city: 'New Delhi',
          state: 'Delhi',
          postalCode: '110001',
          country: 'India'
        },
        gstin: '07AABCG9912K1Z8',
        pan: 'AABCG9912K',
        suppliedCategoryIds: productInv ? [productInv.categoryId] : [],
        suppliedProductIds: productInv ? [productInv._id] : [],
        paymentTermsDays: 30,
        bankDetails: {
          accountName: 'Growatt New Energy India Pvt Ltd',
          accountNumber: '91802004561234',
          ifscCode: 'UTIB0000123',
          bankName: 'Axis Bank'
        },
        isActive: true,
        hasPurchaseHistory: true,
        createdBy: creatorId
      },
      {
        vendorCode: 'VEN-2026-00003',
        name: 'Polycab India Limited',
        contactPerson: 'Suresh Patel',
        email: 'solar.cables@polycab.com',
        phone: '+917926589000',
        address: {
          addressLine1: 'Polycab House, Mogra Village, Andheri East',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400093',
          country: 'India'
        },
        gstin: '24AAACP4412R1ZU',
        pan: 'AAACP4412R',
        suppliedCategoryIds: [],
        suppliedProductIds: [],
        paymentTermsDays: 45,
        isActive: true,
        hasPurchaseHistory: true,
        createdBy: creatorId
      },
      {
        vendorCode: 'VEN-2026-00004',
        name: 'Galvano Solar Mounting Structures',
        contactPerson: 'Ramesh Agrawal',
        email: 'orders@galvanosolar.com',
        phone: '+917714098765',
        address: {
          addressLine1: 'Industrial Area, Urla Sector C',
          city: 'Raipur',
          state: 'Chhattisgarh',
          postalCode: '492003',
          country: 'India'
        },
        gstin: '22AABCG5512M1Z2',
        pan: 'AABCG5512M',
        suppliedCategoryIds: [],
        suppliedProductIds: [],
        paymentTermsDays: 15,
        isActive: true,
        hasPurchaseHistory: true,
        createdBy: creatorId
      }
    ];

    const seededVendors: any[] = [];
    for (const vData of vendorsToSeed) {
      let v = await Vendor.findOne({ vendorCode: vData.vendorCode });
      if (!v) {
        v = await Vendor.create(vData);
        console.log(`✓ Created Vendor: ${v.name} (${v.vendorCode})`);
      } else {
        v.isActive = true;
        await v.save();
      }
      seededVendors.push(v);
    }

    const [vWaaree, vGrowatt, vPolycab] = seededVendors;

    // 2. Seed Realistic Purchase Orders
    let po1 = await PurchaseOrder.findOne({ poNumber: 'PO-2026-00001' });
    if (!po1 && vWaaree && warehouse && productPanel) {
      po1 = await PurchaseOrder.create({
        poNumber: 'PO-2026-00001',
        vendorId: vWaaree._id,
        destinationWarehouseId: warehouse._id,
        orderDate: new Date('2026-10-15'),
        expectedDeliveryDate: new Date('2026-10-22'),
        lineItems: [
          {
            productId: productPanel._id,
            sku: productPanel.sku,
            productName: productPanel.name,
            orderedQuantity: 100,
            uom: UnitOfMeasurement.NOS,
            unitPurchaseRatePaise: 1100000, // ₹11,000
            discountPaise: 0,
            taxableAmountPaise: 110000000, // ₹11,00,000
            gstRate: 12,
            cgstAmountPaise: 0,
            sgstAmountPaise: 0,
            igstAmountPaise: 13200000,
            totalTaxPaise: 13200000,
            totalAmountPaise: 123200000, // ₹12,32,000
            receivedQuantity: 100,
            rejectedQuantity: 0,
            outstandingQuantity: 0
          }
        ],
        isInterState: true,
        subtotalPaise: 110000000,
        totalDiscountPaise: 0,
        totalTaxPaise: 13200000,
        totalAmountPaise: 123200000,
        status: PurchaseOrderStatus.FULLY_RECEIVED,
        approval: {
          requiresApproval: true,
          approvalThresholdPaise: 2500000,
          approvedBy: creatorId,
          approvedAt: new Date('2026-10-15')
        },
        revision: 1,
        createdBy: creatorId
      });
      console.log('✓ Created Purchase Order PO-2026-00001 (Waaree Modules)');
    }

    let po2 = await PurchaseOrder.findOne({ poNumber: 'PO-2026-00002' });
    if (!po2 && vGrowatt && warehouse && productInv) {
      po2 = await PurchaseOrder.create({
        poNumber: 'PO-2026-00002',
        vendorId: vGrowatt._id,
        destinationWarehouseId: warehouse._id,
        orderDate: new Date('2026-10-20'),
        expectedDeliveryDate: new Date('2026-10-28'),
        lineItems: [
          {
            productId: productInv._id,
            sku: productInv.sku,
            productName: productInv.name,
            orderedQuantity: 5,
            uom: UnitOfMeasurement.NOS,
            unitPurchaseRatePaise: 6500000, // ₹65,000
            discountPaise: 0,
            taxableAmountPaise: 32500000, // ₹3,25,000
            gstRate: 18,
            cgstAmountPaise: 2925000,
            sgstAmountPaise: 2925000,
            igstAmountPaise: 0,
            totalTaxPaise: 5850000,
            totalAmountPaise: 38350000, // ₹3,83,500
            receivedQuantity: 5,
            rejectedQuantity: 0,
            outstandingQuantity: 0
          }
        ],
        isInterState: false,
        subtotalPaise: 32500000,
        totalDiscountPaise: 0,
        totalTaxPaise: 5850000,
        totalAmountPaise: 38350000,
        status: PurchaseOrderStatus.FULLY_RECEIVED,
        approval: {
          requiresApproval: true,
          approvalThresholdPaise: 2500000,
          approvedBy: creatorId,
          approvedAt: new Date('2026-10-20')
        },
        revision: 1,
        createdBy: creatorId
      });
      console.log('✓ Created Purchase Order PO-2026-00002 (Growatt Inverters)');
    }

    let po3 = await PurchaseOrder.findOne({ poNumber: 'PO-2026-00003' });
    if (!po3 && vPolycab && warehouse) {
      po3 = await PurchaseOrder.create({
        poNumber: 'PO-2026-00003',
        vendorId: vPolycab._id,
        destinationWarehouseId: warehouse._id,
        orderDate: new Date('2026-11-01'),
        expectedDeliveryDate: new Date('2026-11-08'),
        lineItems: [
          {
            productId: productPanel?._id || creatorId,
            sku: 'CABLE-DC-4SQMM',
            productName: 'Polycab 4sqmm Solar DC Cable (500m Coil)',
            orderedQuantity: 2,
            uom: UnitOfMeasurement.NOS,
            unitPurchaseRatePaise: 3750000, // ₹37,500
            discountPaise: 0,
            taxableAmountPaise: 7500000,
            gstRate: 18,
            cgstAmountPaise: 675000,
            sgstAmountPaise: 675000,
            igstAmountPaise: 0,
            totalTaxPaise: 1350000,
            totalAmountPaise: 8850000, // ₹88,500
            receivedQuantity: 2,
            rejectedQuantity: 0,
            outstandingQuantity: 0
          }
        ],
        isInterState: false,
        subtotalPaise: 7500000,
        totalDiscountPaise: 0,
        totalTaxPaise: 1350000,
        totalAmountPaise: 8850000,
        status: PurchaseOrderStatus.APPROVED,
        approval: {
          requiresApproval: true,
          approvalThresholdPaise: 500000,
          approvedBy: creatorId,
          approvedAt: new Date('2026-11-01')
        },
        revision: 1,
        createdBy: creatorId
      });
      console.log('✓ Created Purchase Order PO-2026-00003 (Polycab DC Cables)');
    }

    // 3. Seed Realistic Vendor Invoices
    if (vWaaree && po1) {
      const inv1 = await VendorInvoice.findOne({ vendorInvoiceNumber: 'INV-WAAREE-99120' });
      if (!inv1) {
        await VendorInvoice.create({
          vendorInvoiceNumber: 'INV-WAAREE-99120',
          vendorId: vWaaree._id,
          purchaseOrderId: po1._id,
          goodsReceiptIds: [],
          invoiceDate: new Date('2026-10-23'),
          dueDate: new Date('2026-11-22'),
          subtotalPaise: 110000000,
          taxAmountPaise: 13200000,
          totalAmountPaise: 123200000,
          paidAmountPaise: 123200000,
          balancePayablePaise: 0,
          status: VendorInvoiceStatus.RECONCILED,
          reconciliationNotes: '3-Way Match Verified against PO-2026-00001 and Delivery GRN. Full payment released.',
          discrepancyAmountPaise: 0,
          createdBy: creatorId
        });
        console.log('✓ Created Vendor Invoice INV-WAAREE-99120 (PAID)');
      }
    }

    if (vGrowatt && po2) {
      const inv2 = await VendorInvoice.findOne({ vendorInvoiceNumber: 'INV-GROWATT-44180' });
      if (!inv2) {
        await VendorInvoice.create({
          vendorInvoiceNumber: 'INV-GROWATT-44180',
          vendorId: vGrowatt._id,
          purchaseOrderId: po2._id,
          goodsReceiptIds: [],
          invoiceDate: new Date('2026-10-29'),
          dueDate: new Date('2026-11-28'),
          subtotalPaise: 32500000,
          taxAmountPaise: 5850000,
          totalAmountPaise: 38350000,
          paidAmountPaise: 20000000, // ₹2,00,000 paid
          balancePayablePaise: 18350000, // ₹1,83,500 due
          status: VendorInvoiceStatus.PARTIALLY_RECONCILED,
          reconciliationNotes: 'Advance payment ₹2,00,000 released via RTGS. Balance on testing.',
          discrepancyAmountPaise: 0,
          createdBy: creatorId
        });
        console.log('✓ Created Vendor Invoice INV-GROWATT-44180 (PARTIALLY_PAID)');
      }
    }

    if (vPolycab && po3) {
      const inv3 = await VendorInvoice.findOne({ vendorInvoiceNumber: 'INV-POLYCAB-1104' });
      if (!inv3) {
        await VendorInvoice.create({
          vendorInvoiceNumber: 'INV-POLYCAB-1104',
          vendorId: vPolycab._id,
          purchaseOrderId: po3._id,
          goodsReceiptIds: [],
          invoiceDate: new Date('2026-11-09'),
          dueDate: new Date('2026-12-09'),
          subtotalPaise: 7500000,
          taxAmountPaise: 1350000,
          totalAmountPaise: 8850000,
          paidAmountPaise: 0,
          balancePayablePaise: 8850000,
          status: VendorInvoiceStatus.RECONCILED,
          reconciliationNotes: 'Bill verified against PO-2026-00003. Scheduled for next payout cycle.',
          discrepancyAmountPaise: 0,
          createdBy: creatorId
        });
        console.log('✓ Created Vendor Invoice INV-POLYCAB-1104 (RECONCILED / UNPAID)');
      }
    }

    // 4. Seed Realistic Project & Overhead Expenses
    const realExpenses = [
      {
        expenseNumber: 'EXP-2026-00002',
        expenseDate: new Date('2026-11-10'),
        category: ExpenseCategory.LIAISON_DISCOM_APPROVALS,
        payeeName: 'CSPDCL Discom Sub-division Office',
        projectId: project1?._id,
        description: 'Statutory Net Metering processing fee & CEIG site clearance inspection',
        amountPaise: 750000,
        taxAmountPaise: 100000,
        totalAmountPaise: 850000, // ₹8,500
        paymentStatus: ExpensePaymentStatus.PAID,
        paymentMode: PaymentMethod.BANK_TRANSFER,
        paymentReference: 'UTR-DISCOM-991204',
        paymentDate: new Date('2026-11-10'),
        paidAmountPaise: 850000,
        evidenceKey: 'cspdcl-receipt-8500.pdf',
        notes: 'Official demand note paid online through CSPDCL portal.',
        status: ExpenseStatus.APPROVED,
        requiresApproval: false,
        submittedBy: creatorId,
        approvedBy: creatorId,
        approvedAt: new Date('2026-11-10'),
        approvalNotes: 'Statutory government liaison clearance',
        statusHistory: [
          {
            fromStatus: 'NONE',
            toStatus: 'APPROVED',
            changedAt: new Date('2026-11-10'),
            changedBy: creatorId,
            notes: 'Approved statutory expense'
          }
        ]
      },
      {
        expenseNumber: 'EXP-2026-00003',
        expenseDate: new Date('2026-11-11'),
        category: ExpenseCategory.CRANE_EQUIPMENT_HIRE,
        payeeName: 'Shree Ram Crane & Lifting Services',
        projectId: project1?._id,
        description: 'Hydraulic boom crane rental for 19x 550Wp modules lifting to 3rd floor terrace',
        amountPaise: 600000,
        taxAmountPaise: 0,
        totalAmountPaise: 600000, // ₹6,000
        paymentStatus: ExpensePaymentStatus.PAID,
        paymentMode: PaymentMethod.CASH,
        paymentReference: 'CASH-VOUCHER-108',
        paymentDate: new Date('2026-11-11'),
        paidAmountPaise: 600000,
        notes: 'Operator certified and safety harness verified on site.',
        status: ExpenseStatus.APPROVED,
        requiresApproval: true,
        submittedBy: creatorId,
        approvedBy: creatorId,
        approvedAt: new Date('2026-11-11'),
        approvalNotes: 'Approved lifting requirement for high terrace.',
        statusHistory: [
          {
            fromStatus: 'PENDING_APPROVAL',
            toStatus: 'APPROVED',
            changedAt: new Date('2026-11-11'),
            changedBy: creatorId,
            notes: 'Approved by project manager'
          }
        ]
      },
      {
        expenseNumber: 'EXP-2026-00004',
        expenseDate: new Date('2026-11-12'),
        category: ExpenseCategory.CIVIL_FOUNDATION_WORKS,
        payeeName: 'Apex Civil Engineering Contractors',
        projectId: project1?._id,
        description: 'RCC roof core drilling, anchor chemical grouting & civil pedestal curing',
        amountPaise: 1250000,
        taxAmountPaise: 200000,
        totalAmountPaise: 1450000, // ₹14,500
        paymentStatus: ExpensePaymentStatus.UNPAID,
        paidAmountPaise: 0,
        notes: 'Waterproof chemical coating verified post drill.',
        status: ExpenseStatus.APPROVED,
        requiresApproval: true,
        submittedBy: creatorId,
        approvedBy: creatorId,
        approvedAt: new Date('2026-11-12'),
        approvalNotes: 'Civil work inspected and approved.',
        statusHistory: [
          {
            fromStatus: 'PENDING_APPROVAL',
            toStatus: 'APPROVED',
            changedAt: new Date('2026-11-12'),
            changedBy: creatorId,
            notes: 'Approved for payout'
          }
        ]
      },
      {
        expenseNumber: 'EXP-2026-00005',
        expenseDate: new Date('2026-11-13'),
        category: ExpenseCategory.INSTALLATION_LABOR,
        payeeName: 'Vikram Sahu (Installation Crew Lead)',
        projectId: project3?._id,
        description: 'Electrical DC stringing, ACDB/DCDB terminations, and copper earthing pits (3 pits)',
        amountPaise: 1800000,
        taxAmountPaise: 0,
        totalAmountPaise: 1800000, // ₹18,000
        paymentStatus: ExpensePaymentStatus.PAID,
        paymentMode: PaymentMethod.BANK_TRANSFER,
        paymentReference: 'UTR-HDFC-8821045',
        paymentDate: new Date('2026-11-13'),
        paidAmountPaise: 1800000,
        notes: 'Testing earth resistance < 2 ohms completed.',
        status: ExpenseStatus.APPROVED,
        requiresApproval: true,
        submittedBy: creatorId,
        approvedBy: creatorId,
        approvedAt: new Date('2026-11-13'),
        approvalNotes: 'Milestone 2 physical installation complete.',
        statusHistory: [
          {
            fromStatus: 'NONE',
            toStatus: 'APPROVED',
            changedAt: new Date('2026-11-13'),
            changedBy: creatorId,
            notes: 'Approved labor payout'
          }
        ]
      },
      {
        expenseNumber: 'EXP-2026-00006',
        expenseDate: new Date('2026-11-14'),
        category: ExpenseCategory.FREIGHT_LOGISTICS,
        payeeName: 'Gati Solar Logistics Carrier',
        projectId: project3?._id,
        description: 'Material transportation from Central Warehouse Raipur to Dhamtari site',
        amountPaise: 950000,
        taxAmountPaise: 171000,
        totalAmountPaise: 1121000, // ₹11,210
        paymentStatus: ExpensePaymentStatus.UNPAID,
        paidAmountPaise: 0,
        notes: 'LR / Bilty attached. Delivery confirmed by installer.',
        status: ExpenseStatus.PENDING_APPROVAL,
        requiresApproval: true,
        submittedBy: creatorId,
        statusHistory: [
          {
            fromStatus: 'NONE',
            toStatus: 'PENDING_APPROVAL',
            changedAt: new Date('2026-11-14'),
            changedBy: creatorId,
            notes: 'Submitted for manager approval'
          }
        ]
      }
    ];

    for (const exp of realExpenses) {
      const exists = await Expense.findOne({ expenseNumber: exp.expenseNumber });
      if (!exists) {
        await Expense.create(exp);
        console.log(`✓ Created Expense: ${exp.expenseNumber} — ${exp.payeeName} (₹${exp.totalAmountPaise / 100})`);
      }
    }

    // 5. Seed Additional Subsidy Application for raki ji (PRJ-2026-00003)
    if (project3 && customerRaki) {
      const subExists = await SubsidyApplication.findOne({ applicationNumber: 'SUB-2026-00002' });
      if (!subExists) {
        await SubsidyApplication.create({
          applicationNumber: 'SUB-2026-00002',
          projectId: project3._id,
          customerId: customerRaki._id,
          schemeName: SubsidyScheme.PM_SURYA_GHAR_MUFT_BIJLI_YOJANA,
          schemeVersion: '2026-V1',
          portalApplicationNumber: 'PMSG-CG-2026-882190',
          systemCapacityKw: 10,
          estimatedAmountPaise: 7800000,
          requestedAmountPaise: 7800000,
          approvedAmountPaise: 7800000,
          disbursedAmountPaise: 7800000,
          status: SubsidyStatus.FULLY_DISBURSED,
          sanctionReference: 'MNRE-SANCT-77120-CG',
          disbursements: [
            {
              disbursementId: 'DISB-2026-00001',
              disbursementReference: 'DBT-2026-991204',
              amountPaise: 7800000,
              disbursedAt: new Date('2026-11-12'),
              paymentMode: 'DIRECT_BENEFIT_TRANSFER',
              recipientAccount: 'SBI A/c • raki ji (Beneficiary DBT)',
              idempotencyKey: 'dbt-sub2-seed-001',
              recordedBy: creatorId,
              notes: 'Full subsidy credit under PM Surya Ghar Muft Bijli Yojana credited to beneficiary.'
            }
          ],
          createdBy: creatorId
        });
        console.log('✓ Created Subsidy Application SUB-2026-00002 (FULLY_DISBURSED)');
      }
    }

    console.log('\n======================================================');
    console.log('  ACCOUNTS & FINANCE DATA SEED COMPLETED SUCCESSFULLY  ');
    console.log('======================================================\n');
  } finally {
    await dbManager.disconnect();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.includes('seed-accounts-flow')) {
  seedAccountsFlowData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seed accounts failed:', err);
      process.exit(1);
    });
}
