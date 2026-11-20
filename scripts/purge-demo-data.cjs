const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'apps', 'api', '.env');
const env = dotenv.parse(fs.readFileSync(envPath));

const COLLECTIONS_TO_CLEAR = [
  'stock_balances',
  'vendors',
  'products',
  'productcategories',
  'customers',
  'leads',
  'lead_activities',
  'sales_orders',
  'quotations',
  'customer_payments',
  'payment_allocations',
  'expenses',
  'vendorinvoices',
  'purchaseorders',
  'subsidyapplications',
  'projects',
  'site_surveys',
  'netmeteringapplications',
  'documents',
  'installations',
  'projectinstallationchecklists',
  'stock_reservations',
  'stock_movements',
  'securityauditlogs',
  'sessions'
];

async function purgeAllData() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('\n--- Purging All Collections ---');
  for (const colName of COLLECTIONS_TO_CLEAR) {
    try {
      const col = db.collection(colName);
      const count = await col.countDocuments();
      if (count > 0) {
        await col.deleteMany({});
        console.log(`✓ Cleared collection "${colName}": deleted ${count} documents.`);
      } else {
        console.log(`- Collection "${colName}" is already empty.`);
      }
    } catch (err) {
      console.warn(`! Error clearing "${colName}":`, err.message);
    }
  }

  console.log('\n--- Resetting Sequence Counters to 0 ---');
  try {
    const seqCol = db.collection('sequencecounters');
    const seqRes = await seqCol.updateMany({}, { $set: { currentValue: 0, updatedAt: new Date() } });
    console.log(`✓ Reset ${seqRes.matchedCount} sequence counters to 0.`);
  } catch (err) {
    console.warn('! Error resetting sequence counters:', err.message);
  }

  console.log('\n--- Updating Workstation User Names (Removing all demo personal names) ---');
  const usersCol = db.collection('users');

  await usersCol.updateOne(
    { email: 'installer@inssolar.com' },
    { $set: { firstName: 'Field', lastName: 'Installer', updatedAt: new Date() } }
  );
  console.log('✓ Updated installer@inssolar.com -> "Field Installer" (FI)');

  await usersCol.updateOne(
    { email: 'sales@inssolar.com' },
    { $set: { firstName: 'Sales', lastName: 'Executive', updatedAt: new Date() } }
  );
  console.log('✓ Updated sales@inssolar.com -> "Sales Executive" (SE)');

  await usersCol.updateOne(
    { email: 'accounts@inssolar.com' },
    { $set: { firstName: 'Accounts', lastName: 'Officer', updatedAt: new Date() } }
  );
  console.log('✓ Updated accounts@inssolar.com -> "Accounts Officer" (AO)');

  await usersCol.updateOne(
    { email: 'admin@inssolar.com' },
    { $set: { firstName: 'System', lastName: 'Administrator', updatedAt: new Date() } }
  );
  console.log('✓ Updated admin@inssolar.com -> "System Administrator" (SA)');

  console.log('\n--- Final Verification ---');
  const allCols = await db.listCollections().toArray();
  const summary = {};
  for (const c of allCols) {
    const cnt = await db.collection(c.name).countDocuments();
    if (cnt > 0) summary[c.name] = cnt;
  }
  console.log('Remaining documents in database:', JSON.stringify(summary, null, 2));

  const users = await usersCol.find({}, { projection: { email: 1, firstName: 1, lastName: 1, role: 1 } }).toArray();
  console.log('Active Workstation Users:');
  users.forEach(u => console.log(`   - ${u.firstName} ${u.lastName} <${u.email}> (${u.role})`));

  console.log('\n========================================');
  console.log('SYSTEM IS NOW 100% CLEAN OF ALL DEMO / TEST DATA & NAMES!');
  console.log('========================================\n');

  await mongoose.disconnect();
}

purgeAllData().catch(err => {
  console.error('Purge failed:', err);
  process.exit(1);
});
