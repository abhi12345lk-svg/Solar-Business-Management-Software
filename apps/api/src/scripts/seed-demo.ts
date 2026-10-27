import { dbManager } from '../db/connection.js';
import {
  User,
  CompanySettings,
  Customer,
  ProductCategory,
  Product,
  Warehouse,
  StockBalance,
  Project,
  ProjectInstallationChecklist,
  NetMeteringApplication,
  SubsidyApplication,
  Lead,
  LeadActivity,
  SiteSurvey,
  Vendor,
  PurchaseOrder
} from '../models/index.js';
import {
  UserRole,
  ProjectPriority,
  SolarTopology,
  NetMeteringStatus,
  NetMeteringInspectionOutcome,
  SubsidyScheme,
  DisbursementMode,
  ApplicationDocumentStatus,
  UnitOfMeasurement,
  LeadStatus,
  LeadSource,
  LeadPriority,
  SolarRequirement,
  PurchaseOrderStatus,
  RoofType,
  ConnectionPhase,
  SurveyStatus
} from '@ins-solar/shared';
import { ProjectService } from '../services/projectService.js';
import { NetMeteringService } from '../services/netMeteringService.js';
import { SubsidyService } from '../services/subsidyService.js';
import { ChecklistService } from '../services/checklistService.js';

export async function seedDemoData(): Promise<void> {
  await dbManager.connect();

  try {
    // 1. Get Superadmin
    let admin = await User.findOne({ email: 'admin@inssolar.com' });
    if (!admin) {
      admin = await User.findOne({ role: UserRole.SUPERADMIN });
    }
    if (!admin) {
      console.error('Please run bootstrap:admin first before seeding demo data.');
      return;
    }
    const adminUser = {
      userId: admin._id.toString(),
      role: admin.role,
      department: admin.department
    };

    // 2. Company Settings
    const existingSettings = await CompanySettings.findOne();
    if (!existingSettings) {
      await CompanySettings.create({
        companyName: 'INS Solar Solutions Pvt Ltd',
        registrationNumber: 'U40106RJ2026PTC099881',
        gstin: '08AAAAA0000A1Z5',
        pan: 'AAAAA0000A',
        registeredAddress: {
          addressLine1: 'Plot 42, Solar Tech Park, Sitapura',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302022',
          country: 'India'
        },
        contactEmail: 'contact@inssolar.com',
        contactPhone: '+911412555555',
        fiscalYearStartMonth: 4,
        prefixes: {
          customer: 'CUST',
          quotation: 'QT',
          order: 'ORD',
          project: 'PRJ',
          invoice: 'INV',
          receipt: 'REC'
        },
        poApprovalThresholdPaise: 2500000,
        maxDiscountPercentageWithoutApproval: 5.0,
        createdBy: admin._id
      });
      console.log('✓ Company settings seeded.');
    }

    // 3. Central Warehouse
    let warehouse = await Warehouse.findOne({ code: 'WH-JAIPUR-01' });
    if (!warehouse) {
      warehouse = await Warehouse.create({
        code: 'WH-JAIPUR-01',
        name: 'Central Depot Jaipur',
        type: 'CENTRAL_DEPOT',
        address: {
          addressLine1: 'Warehouse C-12, Sitapura Industrial Area',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302022',
          country: 'India'
        },
        isActive: true,
        createdBy: admin._id
      });
      console.log('✓ Central warehouse seeded.');
    }

    // 4. Product Categories & Products
    let panelCat = await ProductCategory.findOne({ code: 'CAT-PANELS' });
    if (!panelCat) {
      panelCat = await ProductCategory.create({
        code: 'CAT-PANELS',
        name: 'Solar PV Modules',
        description: 'Tier-1 High Efficiency Monocrystalline PV Modules',
        isActive: true,
        createdBy: admin._id
      });
    }

    let inverterCat = await ProductCategory.findOne({ code: 'CAT-INVERTERS' });
    if (!inverterCat) {
      inverterCat = await ProductCategory.create({
        code: 'CAT-INVERTERS',
        name: 'Solar Inverters',
        description: 'Grid-Tied String & Hybrid Inverters',
        isActive: true,
        createdBy: admin._id
      });
    }

    let panel = await Product.findOne({ skuNormalized: 'PANEL-MONO-550W' });
    if (!panel) {
      panel = await Product.create({
        productCode: 'PROD-2026-00001',
        sku: 'PANEL-MONO-550W',
        skuNormalized: 'PANEL-MONO-550W',
        name: '550Wp Mono Perc Solar Panel',
        description: 'High efficiency Half-Cut Bifacial Monocrystalline Module with 25-yr warranty',
        categoryId: panelCat._id,
        brand: 'Waaree',
        model: 'WXS-550',
        productType: 'PANEL',
        uom: UnitOfMeasurement.NOS,
        standardPurchaseRatePaise: 1100000,
        standardSellingRatePaise: 1350000,
        taxProfileCode: 'GST_12',
        minimumStockThreshold: 10,
        isActive: true,
        createdBy: admin._id
      });
    }

    let inverter = await Product.findOne({ skuNormalized: 'INV-GRID-5KW' });
    if (!inverter) {
      inverter = await Product.create({
        productCode: 'PROD-2026-00002',
        sku: 'INV-GRID-5KW',
        skuNormalized: 'INV-GRID-5KW',
        name: '5kW Single Phase On-Grid Inverter',
        description: 'Dual MPPT, IP65 waterproof on-grid solar string inverter with Wi-Fi',
        categoryId: inverterCat._id,
        brand: 'Solis',
        model: 'S5-GR1P5K',
        productType: 'INVERTER',
        uom: UnitOfMeasurement.SETS,
        standardPurchaseRatePaise: 3500000,
        standardSellingRatePaise: 4200000,
        taxProfileCode: 'GST_12',
        minimumStockThreshold: 5,
        isActive: true,
        createdBy: admin._id
      });
    }

    // Stock Balances
    const existingBalance = await StockBalance.findOne({ productId: panel._id });
    if (!existingBalance) {
      await StockBalance.create({
        productId: panel._id,
        warehouseId: warehouse._id,
        onHandQuantity: 120,
        reservedQuantity: 0,
        availableQuantity: 120
      });
      await StockBalance.create({
        productId: inverter._id,
        warehouseId: warehouse._id,
        onHandQuantity: 30,
        reservedQuantity: 0,
        availableQuantity: 30
      });
      console.log('✓ Hardware inventory catalog seeded.');
    }

    // 5. Customer Ramesh Sharma
    let customer = await Customer.findOne({ primaryPhone: '+919829012345' });
    if (!customer) {
      customer = await Customer.create({
        customerCode: 'CUST-2026-00001',
        name: 'Ramesh Sharma',
        type: 'INDIVIDUAL',
        primaryPhone: '+919829012345',
        email: 'ramesh.sharma@example.com',
        status: 'ACTIVE',
        isActive: true,
        billingAddress: {
          addressLine1: 'B-14, Vaishali Nagar',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302021',
          country: 'India'
        },
        installationAddress: {
          addressLine1: 'B-14, Vaishali Nagar',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302021',
          country: 'India'
        }
      });
      console.log('✓ Customer Ramesh Sharma created.');
    }

    // 6. Project
    let project: any = await Project.findOne({ customerId: customer._id });
    if (!project) {
      project = await ProjectService.createProject(
        {
          customerId: customer._id.toString(),
          name: '5.5 kWp Residential Rooftop Solar Plant',
          systemCapacityKwp: 5.5,
          systemTopology: SolarTopology.ON_GRID,
          priority: ProjectPriority.HIGH,
          plannedStartDate: new Date().toISOString(),
          targetCompletionDate: new Date(Date.now() + 86400000 * 30).toISOString(),
          siteAddress: {
            addressLine1: 'B-14, Vaishali Nagar',
            city: 'Jaipur',
            state: 'Rajasthan',
            postalCode: '302021',
            country: 'India'
          },
          notes: 'Customer approved 10x 550W panels with 5kW string inverter.'
        },
        adminUser,
        { correlationId: 'seed-demo' }
      );
      console.log(`✓ Project ${project.projectCode} created.`);
    }

    if (!project) {
      throw new Error('Project creation failed');
    }

    // 7. Installation Checklist
    let checklist: any = await ProjectInstallationChecklist.findOne({ projectId: project._id });
    if (!checklist) {
      checklist = await ChecklistService.generateProjectChecklist(project._id.toString(), undefined, adminUser);
      console.log('✓ 5-Category Installation Checklist generated.');
    }

    // 8. Net Metering Application (Phase 7A)
    let netMetering: any = await NetMeteringApplication.findOne({ projectId: project._id });
    if (!netMetering) {
      netMetering = await NetMeteringService.createApplication(
        {
          projectId: project._id.toString(),
          discomName: 'JVVNL (Jaipur Vidyut Vitran Nigam Ltd)',
          division: 'Jaipur City Circle',
          subdivision: 'Vaishali Nagar AEN-1',
          consumerNumber: '1102/4482/91',
          sanctionedLoadKw: 5.0,
          proposedCapacityKw: 5.5,
          notes: 'Rooftop net metering application filed with JVVNL'
        },
        adminUser
      );

      // Upload and approve mandatory documents so it can advance
      for (const doc of netMetering.documents) {
        if (doc.isRequired) {
          doc.status = ApplicationDocumentStatus.ACCEPTED;
          doc.fileName = `${doc.documentType.toLowerCase()}.pdf`;
          doc.storageKey = `evidence/documents/${netMetering.applicationNumber}/${doc.fileName}`;
          doc.reviewedBy = admin._id;
          doc.reviewedAt = new Date();
        }
      }
      netMetering.status = NetMeteringStatus.INSPECTION_SCHEDULED;
      netMetering.submissionDate = new Date('2026-10-21');
      netMetering.applicationReferenceNumber = 'JVVNL/RTS/2026/09941';
      netMetering.technicalFeasibility = {
        isFeasible: true,
        approvalDate: new Date('2026-10-23'),
        demandNoteAmountPaise: 250000, // ₹2,500
        demandNotePaidDate: new Date('2026-10-24'),
        demandNotePaymentRef: 'UPI/629910041289'
      };
      netMetering.inspection = {
        scheduledDate: new Date(Date.now() + 86400000 * 2), // 2 days ahead
        inspectorName: 'Er. Rajesh Meena (AEN)',
        inspectorPhone: '+919414002345',
        outcome: NetMeteringInspectionOutcome.PENDING,
        remarks: 'Joint site inspection scheduled for solar plant verification.'
      };
      await netMetering.save();
      console.log(`✓ Net Metering Application ${netMetering.applicationNumber} created & scheduled.`);
    }

    // 9. Subsidy Application (Phase 7A)
    let subsidy: any = await SubsidyApplication.findOne({ projectId: project._id });
    if (!subsidy) {
      subsidy = await SubsidyService.createApplication(
        {
          projectId: project._id.toString(),
          schemeName: SubsidyScheme.PM_SURYA_GHAR_MUFT_BIJLI_YOJANA,
          schemeVersion: '2024-2027 Guidelines v2',
          portalApplicationNumber: 'PMSG-RJ-2026-449102',
          systemCapacityKw: 5.5,
          estimatedAmountPaise: 7800000,
          requestedAmountPaise: 7800000, // ₹78,000
          notes: 'Rooftop solar subsidy claim for 5.5 kWp system'
        },
        adminUser
      );

      // Mark required documents accepted
      for (const doc of subsidy.documents) {
        if (doc.isRequired) {
          doc.status = ApplicationDocumentStatus.ACCEPTED;
          doc.fileName = `${doc.documentType.toLowerCase()}.pdf`;
          doc.storageKey = `evidence/documents/${subsidy.applicationNumber}/${doc.fileName}`;
          doc.reviewedBy = admin._id;
          doc.reviewedAt = new Date();
        }
      }
      await subsidy.save();

      // Record Sanction
      subsidy = await SubsidyService.recordSanction(
        subsidy._id.toString(),
        {
          approvedAmountPaise: 7800000,
          sanctionReference: 'MNRE/DBT/2026/SNC-0982',
          sanctionDate: new Date('2026-10-24')
        },
        adminUser
      );

      // Record First Partial Disbursement (₹50,000)
      subsidy = await SubsidyService.recordDisbursement(
        subsidy._id.toString(),
        {
          amountPaise: 5000000, // ₹50,000
          disbursementReference: 'SBIN20261025881923',
          paymentMode: DisbursementMode.DIRECT_BENEFIT_TRANSFER,
          recipientAccount: 'SBI A/C XXXX4489 (Ramesh Sharma)',
          disbursedAt: new Date('2026-10-25'),
          notes: 'Tranche 1 DBT credited to consumer SBI account.',
          idempotencyKey: 'IDEMP-SUB-2026-00001-INST1'
        },
        adminUser
      );
      console.log(`✓ Subsidy Application ${subsidy.applicationNumber} sanctioned and 1st DBT tranche recorded.`);
    }

    // 10. CRM Leads & Follow-ups
    let lead1 = await Lead.findOne({ prospectPhone: '+919829111222' });
    if (!lead1) {
      lead1 = await Lead.create({
        leadCode: 'LEAD-2026-00001',
        prospectName: 'Amit Verma',
        prospectPhone: '+919829111222',
        prospectEmail: 'amit.verma@example.com',
        location: {
          city: 'Jaipur',
          state: 'Rajasthan',
          pinCode: '302020',
          street: '12, Malviya Nagar'
        },
        source: LeadSource.WEBSITE,
        solarRequirement: SolarRequirement.RESIDENTIAL,
        estimatedCapacityKw: 5,
        status: LeadStatus.SURVEY_SCHEDULED,
        priority: LeadPriority.HIGH,
        notes: 'Interested in 5kW rooftop solar under PM Surya Ghar Yojana.',
        nextFollowUpDate: new Date(Date.now() + 86400000 * 2),
        isActive: true,
        createdBy: admin._id
      });

      await LeadActivity.create({
        leadId: lead1._id,
        activityType: 'CALL',
        summary: 'Introductory requirement consultation call',
        sentiment: 'HOT',
        nextFollowUpDate: new Date(Date.now() + 86400000 * 2),
        performedBy: admin._id,
        createdAt: new Date()
      });
      console.log('✓ CRM Lead Amit Verma & follow-up created.');
    }

    let lead2 = await Lead.findOne({ prospectPhone: '+919829333444' });
    if (!lead2) {
      lead2 = await Lead.create({
        leadCode: 'LEAD-2026-00002',
        prospectName: 'SunTech Garments Pvt Ltd',
        companyName: 'SunTech Garments Pvt Ltd',
        prospectPhone: '+919829333444',
        prospectEmail: 'procurement@suntechgarments.com',
        location: {
          city: 'Jaipur',
          state: 'Rajasthan',
          pinCode: '302022',
          street: 'Plot G-18, Sitapura Industrial Area'
        },
        source: LeadSource.REFERRAL,
        solarRequirement: SolarRequirement.COMMERCIAL,
        estimatedCapacityKw: 25,
        status: LeadStatus.CONTACTED,
        priority: LeadPriority.HIGH,
        notes: 'High daytime energy consumption. Looking for 25kW On-Grid solar plant.',
        isActive: true,
        createdBy: admin._id
      });
      console.log('✓ Commercial Lead SunTech Garments created.');
    }

    let lead3 = await Lead.findOne({ prospectPhone: '+919829555666' });
    if (!lead3) {
      lead3 = await Lead.create({
        leadCode: 'LEAD-2026-00003',
        prospectName: 'Dr. Sunita Rao',
        prospectPhone: '+919829555666',
        prospectEmail: 'dr.sunita@example.com',
        location: {
          city: 'Jaipur',
          state: 'Rajasthan',
          pinCode: '302019',
          street: 'C-45, Mansarovar'
        },
        source: LeadSource.COLD_CALL,
        solarRequirement: SolarRequirement.RESIDENTIAL,
        estimatedCapacityKw: 3,
        status: LeadStatus.NEW,
        priority: LeadPriority.MEDIUM,
        notes: '3kW residential system enquiry for 2-floor bungalow.',
        isActive: true,
        createdBy: admin._id
      });
      console.log('✓ Residential Lead Dr. Sunita Rao created.');
    }

    // 11. Site Survey for Amit Verma
    if (lead1) {
      const existingSurvey = await SiteSurvey.findOne({ leadId: lead1._id });
      if (!existingSurvey) {
        await SiteSurvey.create({
          surveyNumber: 'SRV-2026-00001',
          leadId: lead1._id,
          siteAddress: {
            addressLine1: '12, Malviya Nagar',
            city: 'Jaipur',
            state: 'Rajasthan',
            postalCode: '302020',
            country: 'India'
          },
          roofType: RoofType.RCC_FLAT,
          usableRoofAreaSqFt: 620,
          grossRoofAreaSqFt: 850,
          sanctionedLoadKw: 5.0,
          connectionPhase: ConnectionPhase.SINGLE,
          shadowAnalysisNotes: 'Small parapet wall on east, zero southern shadow.',
          proposedCapacityKw: 5.0,
          averageMonthlyBillPaise: 450000, // ₹4,500
          status: SurveyStatus.COMPLETED,
          completedDate: new Date(),
          photos: [],
          createdBy: admin._id
        });
        console.log('✓ Site Survey SRV-2026-00001 created.');
      }
    }

    // 12. Vendors & Purchase Order
    let vendor1 = await Vendor.findOne({ vendorCode: 'VEN-2026-00001' });
    if (!vendor1) {
      vendor1 = await Vendor.create({
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
        suppliedCategoryIds: [panelCat._id],
        suppliedProductIds: [panel._id],
        paymentTermsDays: 30,
        isActive: true,
        hasPurchaseHistory: true,
        createdBy: admin._id
      });
      console.log('✓ Vendor Waaree Energies Limited created.');
    }

    let vendor2 = await Vendor.findOne({ vendorCode: 'VEN-2026-00002' });
    if (!vendor2) {
      vendor2 = await Vendor.create({
        vendorCode: 'VEN-2026-00002',
        name: 'Solis Power India Pvt Ltd',
        contactPerson: 'Anand Kulkarni',
        email: 'sales.india@solisinverters.com',
        phone: '+912067120000',
        address: {
          addressLine1: 'Magarpatta Cybercity, Tower 4',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411028',
          country: 'India'
        },
        gstin: '27AAACS1234D1Z5',
        pan: 'AAACS1234D',
        suppliedCategoryIds: [inverterCat._id],
        suppliedProductIds: [inverter._id],
        paymentTermsDays: 45,
        isActive: true,
        hasPurchaseHistory: false,
        createdBy: admin._id
      });
      console.log('✓ Vendor Solis Power India created.');
    }

    // 13. Purchase Order
    if (vendor1 && warehouse && panel) {
      const existingPo = await PurchaseOrder.findOne({ poNumber: 'PO-2026-00001' });
      if (!existingPo) {
        const poLineItems = [
          {
            productId: panel._id,
            sku: panel.sku,
            productName: panel.name,
            orderedQuantity: 100,
            uom: UnitOfMeasurement.NOS,
            unitPurchaseRatePaise: 1100000, // ₹11,000
            discountPaise: 0,
            taxableAmountPaise: 110000000, // ₹11,00,000
            gstRate: 12,
            cgstAmountPaise: 0,
            sgstAmountPaise: 0,
            igstAmountPaise: 13200000, // ₹1,32,000
            totalTaxPaise: 13200000,
            totalAmountPaise: 123200000, // ₹12,32,000
            receivedQuantity: 100,
            rejectedQuantity: 0,
            outstandingQuantity: 0
          }
        ];

        await PurchaseOrder.create({
          poNumber: 'PO-2026-00001',
          vendorId: vendor1._id,
          destinationWarehouseId: warehouse._id,
          orderDate: new Date('2026-10-15'),
          expectedDeliveryDate: new Date('2026-10-22'),
          lineItems: poLineItems,
          isInterState: true,
          subtotalPaise: 110000000,
          totalDiscountPaise: 0,
          totalTaxPaise: 13200000,
          totalAmountPaise: 123200000,
          status: PurchaseOrderStatus.FULLY_RECEIVED,
          approval: {
            requiresApproval: true,
            approvalThresholdPaise: 2500000,
            approvedBy: admin._id,
            approvedAt: new Date('2026-10-15')
          },
          revision: 1,
          createdBy: admin._id
        });
        console.log('✓ Purchase Order PO-2026-00001 created.');
      }
    }

    console.log('\n======================================================');
    console.log('  INS SOLAR BUSINESS MANAGEMENT SYSTEM — DEMO READY!  ');
    console.log('======================================================');
    console.log('  Web Portal:    http://localhost:5173');
    console.log('  API Server:    http://localhost:4000/api/v1');
    console.log('  Login Email:   admin@inssolar.com');
    console.log('  Password:      Admin@Solar2026!');
    console.log('------------------------------------------------------');
    console.log('  Available Modules:');
    console.log('  • Projects:        http://localhost:5173/projects');
    console.log('  • Net Metering:    http://localhost:5173/net-metering');
    console.log('  • Subsidies:       http://localhost:5173/subsidies');
    console.log('  • Inventory:       http://localhost:5173/inventory');
    console.log('  • Quotations:      http://localhost:5173/quotations');
    console.log('  • CRM Leads:       http://localhost:5173/leads');
    console.log('======================================================\n');
  } finally {
    await dbManager.disconnect();
  }
}

seedDemoData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Seed demo failed:', err);
    process.exit(1);
  });
