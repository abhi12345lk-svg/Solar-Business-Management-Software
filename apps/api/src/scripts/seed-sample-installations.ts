import { dbManager } from '../db/connection.js';
import { Customer, User } from '../models/index.js';
import { InstallationModel } from '../models/Installation.js';
import { InstallationStatus, SequenceEntityType } from '@ins-solar/shared';
import { SequenceService } from '../services/sequenceService.js';

export async function seedSampleInstallations(): Promise<void> {
  await dbManager.connect();

  try {
    const existingCount = await InstallationModel.countDocuments();
    console.log(`Current installations in DB: ${existingCount}`);

    // Find Vikram Sahu (Installer) or any installer user
    const installer =
      (await User.findOne({ email: 'installer@inssolar.com' })) ||
      (await User.findOne({ role: 'INSTALLATION_CREW' }));

    const admin =
      (await User.findOne({ email: 'admin@inssolar.com' })) ||
      (await User.findOne({ role: 'SUPERADMIN' }));

    const customers = await Customer.find().limit(5);
    if (customers.length === 0) {
      console.log('No customers found to attach installations.');
      return;
    }

    if (existingCount === 0) {
      console.log('Creating sample solar installations...');

      // 1. Installation 1 - ASSIGNED for Vikram Sahu
      const cust1 = customers[0]!;
      const seq1 = await SequenceService.generateNumber(SequenceEntityType.INSTALLATION, 'INST');
      await InstallationModel.create({
        installationNumber: seq1.formattedNumber,
        customerId: cust1._id,
        customerCode: cust1.customerCode,
        customerName: cust1.name,
        customerPhone: cust1.primaryPhone,
        siteAddress: {
          addressLine1: cust1.installationAddress?.addressLine1 || 'Plot 45, Dangania',
          city: cust1.installationAddress?.city || 'Dhamtari',
          state: 'Chhattisgarh',
          postalCode: '493773'
        },
        systemCapacityKw: 5.5,
        assignedInstallerId: installer?._id,
        assignedInstallerName: installer ? `${installer.firstName} ${installer.lastName}` : 'Vikram Sahu',
        assignedBy: admin?._id,
        installationDate: new Date(),
        status: InstallationStatus.ASSIGNED,
        isDraft: false,
        currentStep: 2,
        earthingSystem: {
          name: 'Chemical Earthing Rod 3m',
          equipmentType: 'EARTHING',
          brand: 'Ashlok',
          model: 'Copper Bonded 17.2mm',
          serialNumber: 'EAR-2026-8819',
          barcode: 'BAR-EAR-8819',
          ratingCapacity: '< 3 Ohms'
        },
        solarPanels: {
          name: 'Solar PV Modules (550W DCR)',
          equipmentType: 'PANELS',
          brand: 'Waaree',
          model: 'Bi-55-550W Mono PERC',
          ratingCapacity: '5.5 kWp'
        },
        panelDetails: {
          totalPanels: 10,
          manufacturer: 'Waaree Energies',
          model: 'Bi-55-550W Mono PERC',
          wattagePerPanel: 550,
          calculatedTotalCapacityKw: 5.5,
          panelSerialNumbers: ['WAR-550-001', 'WAR-550-002', 'WAR-550-003'],
          panelBarcodes: ['BAR-WAR-001', 'BAR-WAR-002']
        }
      });
      console.log(`✓ Created Installation 1: ${seq1.formattedNumber} (ASSIGNED)`);

      // 2. Installation 2 - IN_PROGRESS (Step 6)
      if (customers.length > 1) {
        const cust2 = customers[1]!;
        const seq2 = await SequenceService.generateNumber(SequenceEntityType.INSTALLATION, 'INST');
        await InstallationModel.create({
          installationNumber: seq2.formattedNumber,
          customerId: cust2._id,
          customerCode: cust2.customerCode,
          customerName: cust2.name,
          customerPhone: cust2.primaryPhone,
          siteAddress: {
            addressLine1: cust2.installationAddress?.addressLine1 || 'Shanti Vihar Colony',
            city: cust2.installationAddress?.city || 'Raipur',
            state: 'Chhattisgarh',
            postalCode: '492013'
          },
          systemCapacityKw: 3.3,
          assignedInstallerId: installer?._id,
          assignedInstallerName: installer ? `${installer.firstName} ${installer.lastName}` : 'Vikram Sahu',
          assignedBy: admin?._id,
          installationDate: new Date(Date.now() - 86400000 * 2),
          status: InstallationStatus.IN_PROGRESS,
          isDraft: false,
          currentStep: 6,
          earthingSystem: {
            name: 'Chemical Earthing Pit & Grounding',
            equipmentType: 'EARTHING',
            brand: 'TruePower',
            model: 'Chemical Pipe-in-Pipe 3m',
            serialNumber: 'TP-EAR-9912',
            barcode: 'BAR-TP-9912',
            ratingCapacity: '< 2 Ohms'
          },
          inverter: {
            name: 'On-Grid String Inverter 3.3kW',
            equipmentType: 'INVERTER',
            brand: 'Growatt',
            model: 'MIC 3300TL-X',
            serialNumber: 'GW-3300-88412',
            barcode: 'BAR-GW-88412',
            ratingCapacity: '3.3 kW'
          },
          solarPanels: {
            name: 'High Efficiency ALMM PV Modules',
            equipmentType: 'PANELS',
            brand: 'Tata Power Solar',
            model: 'TP-540-Mono',
            ratingCapacity: '3.3 kWp'
          },
          panelDetails: {
            totalPanels: 6,
            manufacturer: 'Tata Power Solar',
            model: 'TP-540-Mono',
            wattagePerPanel: 550,
            calculatedTotalCapacityKw: 3.3,
            panelSerialNumbers: ['TPS-540-101', 'TPS-540-102', 'TPS-540-103'],
            panelBarcodes: ['BAR-TPS-101', 'BAR-TPS-102']
          }
        });
        console.log(`✓ Created Installation 2: ${seq2.formattedNumber} (IN_PROGRESS)`);
      }

      // 3. Installation 3 - SUBMITTED / UNDER_REVIEW
      if (customers.length > 2) {
        const cust3 = customers[2]!;
        const seq3 = await SequenceService.generateNumber(SequenceEntityType.INSTALLATION, 'INST');
        await InstallationModel.create({
          installationNumber: seq3.formattedNumber,
          customerId: cust3._id,
          customerCode: cust3.customerCode,
          customerName: cust3.name,
          customerPhone: cust3.primaryPhone,
          siteAddress: {
            addressLine1: cust3.installationAddress?.addressLine1 || 'Rooftop Plant, Civil Lines',
            city: cust3.installationAddress?.city || 'Raipur',
            state: 'Chhattisgarh',
            postalCode: '492001'
          },
          systemCapacityKw: 10.0,
          assignedInstallerId: installer?._id,
          assignedInstallerName: installer ? `${installer.firstName} ${installer.lastName}` : 'Vikram Sahu',
          assignedBy: admin?._id,
          installationDate: new Date(Date.now() - 86400000 * 5),
          status: InstallationStatus.SUBMITTED,
          isDraft: false,
          currentStep: 11,
          gpsLocation: {
            latitude: 21.237414,
            longitude: 81.603882,
            accuracyMeters: 4,
            capturedAt: new Date(Date.now() - 86400000 * 1),
            isVerified: true
          },
          panelDetails: {
            totalPanels: 18,
            manufacturer: 'Adani Solar',
            model: 'Elan Shine 550W Bifacial',
            wattagePerPanel: 550,
            calculatedTotalCapacityKw: 9.9,
            panelSerialNumbers: ['ADN-550-01', 'ADN-550-02', 'ADN-550-03'],
            panelBarcodes: ['BAR-ADN-01', 'BAR-ADN-02']
          }
        });
        console.log(`✓ Created Installation 3: ${seq3.formattedNumber} (SUBMITTED / UNDER_REVIEW)`);
      }
    } else {
      console.log(`Installations already exist (${existingCount}). Skipping creation.`);
    }

    console.log('Sample installation seed completed successfully.');
  } finally {
    await dbManager.disconnect();
  }
}

if (process.argv[1]?.endsWith('seed-sample-installations.ts')) {
  seedSampleInstallations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
