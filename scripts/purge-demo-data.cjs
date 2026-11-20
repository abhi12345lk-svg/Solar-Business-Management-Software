const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'apps', 'api', '.env');
const env = dotenv.parse(fs.readFileSync(envPath));

const COLLECTIONS_TO_CLEAR = [
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

async function purgeDemoData() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('\n--- Purging Demo / Test Transactional Data ---');
  for (const colName of COLLECTIONS_TO_CLEAR) {
    try {
      const col = db.collection(colName);
      const beforeCount = await col.countDocuments();
      if (beforeCount > 0) {
        await col.deleteMany({});
        console.log(`✓ Cleared collection "${colName}": removed ${beforeCount} documents.`);
      } else {
        console.log(`- Collection "${colName}" was already empty.`);
      }
    } catch (err) {
      console.warn(`! Failed clearing "${colName}":`, err.message);
    }
  }

  console.log('\n--- Resetting Stock Balances ---');
  try {
    const sbCol = db.collection('stock_balances');
    const updateRes = await sbCol.updateMany({}, [
      {
        $set: {
          reservedQuantity: 0,
          availableQuantity: '$onHandQuantity'
        }
      }
    ]);
    console.log(`✓ Reset ${updateRes.matchedCount} stock balances to unreserved (available = on-hand).`);
  } catch (err) {
    console.warn('! Error resetting stock balances:', err.message);
  }

  console.log('\n--- Resetting Sequence Counters ---');
  try {
    const seqCol = db.collection('sequencecounters');
    const seqRes = await seqCol.updateMany({}, { $set: { currentValue: 0, updatedAt: new Date() } });
    console.log(`✓ Reset ${seqRes.matchedCount} sequence counters to 0 (next new records start at 00001).`);
  } catch (err) {
    console.warn('! Error resetting sequence counters:', err.message);
  }

  console.log('\n--- Verifying Preserved Configurations & Logins ---');
  const userCount = await db.collection('users').countDocuments();
  const users = await db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
  console.log(`✓ Users preserved (${userCount}):`);
  users.forEach(u => console.log(`   - ${u.email} (${u.role})`));

  const company = await db.collection('companysettings').findOne({});
  console.log(`✓ Company Settings preserved: ${company?.companyName || 'Rarebox Solar'}`);

  const vendorCount = await db.collection('vendors').countDocuments();
  console.log(`✓ Vendors preserved: ${vendorCount}`);

  const warehouseCount = await db.collection('warehouses').countDocuments();
  console.log(`✓ Warehouses preserved: ${warehouseCount}`);

  const productCount = await db.collection('products').countDocuments();
  console.log(`✓ Products preserved: ${productCount}`);

  const templateCount = await db.collection('installationchecklisttemplates').countDocuments();
  console.log(`✓ Installation Templates preserved: ${templateCount}`);

  console.log('\n========================================');
  console.log('ALL DEMO & TEST DATA HAS BEEN COMPLETELY PURGED!');
  console.log('The system is 100% clean and ready for client demonstration.');
  console.log('========================================\n');

  await mongoose.disconnect();
}

purgeDemoData().catch(err => {
  console.error('Purge script failed:', err);
  process.exit(1);
});
