import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

async function updateWarehouse() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set in apps/api/.env');
  }

  await mongoose.connect(uri);
  const coll = mongoose.connection.collection('warehouses');
  const res = await coll.updateMany(
    {},
    {
      $set: {
        code: 'WH-RAIPUR-01',
        name: 'Central Depot Raipur',
        type: 'CENTRAL_DEPOT',
        'address.addressLine1': 'Warehouse C-12, Transport Nagar, Tatibandh',
        'address.city': 'Raipur',
        'address.state': 'Chhattisgarh',
        'address.postalCode': '492099',
        'address.country': 'India',
        isActive: true,
        updatedAt: new Date()
      }
    }
  );

  console.log(`Successfully updated ${res.matchedCount} warehouse(s) to Central Depot Raipur.`);
  await mongoose.disconnect();
}

updateWarehouse().catch(err => {
  console.error(err);
  process.exit(1);
});
