import { dbManager } from '../db/connection.js';
import {
  Customer,
  CustomerIdentity,
  Lead,
  LeadActivity,
  SiteSurvey,
  SolarDesign,
  Quotation,
  SalesOrder,
  Project,
  ProjectTask,
  MaterialDispatch,
  ProjectInstallationChecklist,
  NetMeteringApplication,
  SubsidyApplication,
  CustomerPayment,
  PaymentAllocation,
  Expense,
  ProjectBudget,
  VendorInvoice,
  PurchaseOrder,
  GoodsReceipt,
  StockMovement,
  StockReservation,
  ProductSerialNumber,
  DocumentModel,
  ServiceComplaint,
  WarrantyClaim,
  AnnualMaintenanceContract,
  ServiceVisit,
  Notification,
  SequenceCounter,
  User,
  StockBalance
} from '../models/index.js';
import { hashPassword } from '../utils/crypto.js';
import { Department, UserRole } from '@ins-solar/shared';

export async function cleanAllDatabaseData() {
  await dbManager.connect();
  console.log('Connected to MongoDB Atlas.');

  console.log('--- Wiping all business transaction records ---');

  await Promise.all([
    Customer.deleteMany({}),
    CustomerIdentity.deleteMany({}),
    Lead.deleteMany({}),
    LeadActivity.deleteMany({}),
    SiteSurvey.deleteMany({}),
    SolarDesign.deleteMany({}),
    Quotation.deleteMany({}),
    SalesOrder.deleteMany({}),
    Project.deleteMany({}),
    ProjectTask.deleteMany({}),
    MaterialDispatch.deleteMany({}),
    ProjectInstallationChecklist.deleteMany({}),
    NetMeteringApplication.deleteMany({}),
    SubsidyApplication.deleteMany({}),
    CustomerPayment.deleteMany({}),
    PaymentAllocation.deleteMany({}),
    Expense.deleteMany({}),
    ProjectBudget.deleteMany({}),
    VendorInvoice.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    GoodsReceipt.deleteMany({}),
    StockMovement.deleteMany({}),
    StockReservation.deleteMany({}),
    ProductSerialNumber.deleteMany({}),
    DocumentModel.deleteMany({}),
    ServiceComplaint.deleteMany({}),
    WarrantyClaim.deleteMany({}),
    AnnualMaintenanceContract.deleteMany({}),
    ServiceVisit.deleteMany({}),
    Notification.deleteMany({}),
    SequenceCounter.deleteMany({}) // Reset all numbering back to 00001
  ]);

  console.log('All transaction data wiped and sequence counters reset.');

  // Reset reserved stock in stock balances back to 0
  await StockBalance.updateMany({}, { $set: { reservedQuantity: 0 } });
  console.log('Stock reservations cleared.');

  // Verify core login users exist
  console.log('--- Verifying panel login accounts ---');
  const adminPassHash = await hashPassword('SolarAdmin2026!');
  const salesPassHash = await hashPassword('SolarSales2026!');
  const accountsPassHash = await hashPassword('SolarAccounts2026!');
  const installerPassHash = await hashPassword('SolarInstaller2026!');

  // Super Admin
  await User.findOneAndUpdate(
    { email: 'admin@inssolar.com' },
    {
      $set: {
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
      }
    },
    { upsert: true, new: true }
  );

  // Sales Executive
  await User.findOneAndUpdate(
    { email: 'sales@inssolar.com' },
    {
      $set: {
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
      }
    },
    { upsert: true, new: true }
  );

  // Accounts Officer
  await User.findOneAndUpdate(
    { email: 'accounts@inssolar.com' },
    {
      $set: {
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
      }
    },
    { upsert: true, new: true }
  );

  // Field Installer
  await User.findOneAndUpdate(
    { email: 'installer@inssolar.com' },
    {
      $set: {
        employeeCode: 'EMP-0004',
        firstName: 'Vikram',
        lastName: 'Sahu',
        email: 'installer@inssolar.com',
        phone: '+919876500003',
        passwordHash: installerPassHash,
        department: Department.OPERATIONS,
        role: UserRole.INSTALLATION_CREW,
        permissions: [],
        isActive: true,
        mfaEnabled: false,
        sessionVersion: 1
      }
    },
    { upsert: true, new: true }
  );

  console.log('All 4 panel accounts verified and ready.');
  console.log('Database cleanup completed successfully.');
  await dbManager.disconnect();
}

cleanAllDatabaseData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Cleanup error:', err);
    process.exit(1);
  });
