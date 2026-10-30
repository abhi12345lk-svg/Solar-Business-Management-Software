/**
 * INS Solar Business Management Software — SolarDesign Service
 *
 * Coordinates catalog product validation, atomic design numbering,
 * mathematical solar sizing, and solar design persistence.
 */

import {
  CreateSolarDesignInput,
  SolarDesignFilter,
  SizingCalculationInput,
  SizingResult,
  SequenceEntityType,
  AuditAction,
  AuditOutcome,
  ActorType,
  SolarProductType,
  CustomerType
} from '@ins-solar/shared';
import { Types } from 'mongoose';
import { SolarDesign, ISolarDesignDocument } from '../models/SolarDesign.js';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Lead } from '../models/Lead.js';
import { SequenceService } from './sequenceService.js';
import { SolarSizingService } from './solarSizingService.js';
import { AuditService } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class SolarDesignService {
  /**
   * Preview sizing calculation without writing to database.
   */
  public static calculatePreview(input: SizingCalculationInput): SizingResult {
    return SolarSizingService.calculate(input);
  }

  /**
   * Create a new persisted SolarDesign linked to Customer and active catalog hardware.
   */
  public static async createDesign(
    input: CreateSolarDesignInput,
    user: { userId: string; role?: string },
    context: { ipAddress?: string; userAgent?: string; correlationId?: string } = {}
  ): Promise<ISolarDesignDocument> {
    // 1. Resolve lead if provided
    let resolvedLeadId: Types.ObjectId | undefined;
    let lead: any = null;
    if (input.leadId && input.leadId.trim()) {
      const cleanLeadId = input.leadId.trim();
      if (Types.ObjectId.isValid(cleanLeadId)) {
        lead = await Lead.findById(cleanLeadId);
      }
      if (!lead) {
        lead = await Lead.findOne({
          $or: [{ leadCode: cleanLeadId.toUpperCase() }, { prospectPhone: cleanLeadId }]
        });
      }
      if (lead) {
        resolvedLeadId = lead._id;
      }
    }

    // 2. Resolve customer
    let customer: any = null;
    const cleanCustId = (input.customerId || '').trim();
    if (cleanCustId) {
      if (Types.ObjectId.isValid(cleanCustId)) {
        customer = await Customer.findById(cleanCustId);
      }
      if (!customer) {
        customer = await Customer.findOne({ customerCode: cleanCustId.toUpperCase() });
      }
    }

    // Auto-resolve or create customer from lead if not explicitly provided
    if (!customer && lead) {
      if (lead.convertedCustomerId) {
        customer = await Customer.findById(lead.convertedCustomerId);
      }
      if (!customer) {
        customer = await Customer.findOne({
          $or: [
            { primaryPhone: lead.prospectPhone },
            { email: lead.prospectEmail },
            { name: lead.prospectName }
          ]
        });
      }
      // If customer record doesn't exist yet, auto-create customer profile for this lead
      if (!customer) {
        const seqResult = await SequenceService.generateNumber(SequenceEntityType.CUSTOMER);
        customer = await Customer.create({
          customerCode: seqResult.formattedNumber,
          name: lead.prospectName,
          legalName: lead.companyName || lead.prospectName,
          primaryPhone: lead.prospectPhone,
          email: lead.prospectEmail,
          customerType: CustomerType.INDIVIDUAL,
          billingAddress: {
            street: lead.location?.street || lead.prospectName,
            city: lead.location?.city || 'Jaipur',
            state: lead.location?.state || 'Rajasthan',
            pincode: lead.location?.pinCode || '302001',
            country: 'India'
          },
          installationAddresses: [
            {
              street: lead.location?.street || lead.prospectName,
              city: lead.location?.city || 'Jaipur',
              state: lead.location?.state || 'Rajasthan',
              pincode: lead.location?.pinCode || '302001',
              country: 'India'
            }
          ],
          createdBy: Types.ObjectId.isValid(user.userId)
            ? new Types.ObjectId(user.userId)
            : undefined
        });
        lead.convertedCustomerId = customer._id;
        await lead.save();
      }
    }

    if (!customer) {
      throw AppError.notFound(
        'Please select a valid Customer Account or Lead for this solar design.'
      );
    }

    // 2. Validate Module Product in catalog
    const moduleProduct = await Product.findById(input.module.productId);
    if (!moduleProduct || !moduleProduct.isActive) {
      throw AppError.businessRule(
        'Selected solar module is inactive or does not exist in catalog.'
      );
    }
    if (moduleProduct.productType !== SolarProductType.SOLAR_PANEL) {
      throw AppError.validationFailed(
        `Product '${moduleProduct.name}' is categorized as '${moduleProduct.productType}', not '${SolarProductType.SOLAR_PANEL}'.`
      );
    }

    // 3. Validate Inverter Product in catalog
    const inverterProduct = await Product.findById(input.inverter.productId);
    if (!inverterProduct || !inverterProduct.isActive) {
      throw AppError.businessRule('Selected inverter is inactive or does not exist in catalog.');
    }
    if (inverterProduct.productType !== SolarProductType.INVERTER) {
      throw AppError.validationFailed(
        `Product '${inverterProduct.name}' is categorized as '${inverterProduct.productType}', not '${SolarProductType.INVERTER}'.`
      );
    }

    // 4. Validate Battery if provided
    let batteryData: any = undefined;
    if (input.battery) {
      const batteryProduct = await Product.findById(input.battery.productId);
      if (!batteryProduct || !batteryProduct.isActive) {
        throw AppError.businessRule('Selected battery is inactive or does not exist in catalog.');
      }
      batteryData = {
        productId: batteryProduct._id,
        name: batteryProduct.name,
        sku: batteryProduct.sku,
        nominalVoltageV: input.battery.nominalVoltageV,
        capacityAh: input.battery.capacityAh,
        quantity: input.battery.quantity,
        totalStorageKwh: input.battery.totalStorageKwh,
        autonomyDays: input.battery.autonomyDays
      };
    }

    // 5. Generate Atomic Design Number (e.g. DES-2026-00001)
    const seqResult = await SequenceService.generateNumber(SequenceEntityType.SOLAR_DESIGN);

    // 6. Compute Sizing & Generation
    const totalDcCapacityKwp = Number(
      ((input.module.quantity * input.module.wattageWp) / 1000).toFixed(3)
    );
    const inverterQty = input.inverter.quantity ?? 1;
    const actualDcAcRatio = Number(
      (totalDcCapacityKwp / (input.inverter.ratedCapacityKw * inverterQty)).toFixed(2)
    );

    const peakSunHours = 4.8;
    const prPercent = 75.0;
    const dailyGen = Number((totalDcCapacityKwp * peakSunHours * (prPercent / 100)).toFixed(2));
    const monthlyGen = Number((dailyGen * 30).toFixed(2));
    const annualGen = Number((dailyGen * 365).toFixed(2));
    const specificYield = Number((annualGen / totalDcCapacityKwp).toFixed(1));

    const warnings: string[] = [];
    if (actualDcAcRatio < 1.05) {
      warnings.push('Low DC:AC loading ratio (< 1.05); inverter capacity is oversized.');
    } else if (actualDcAcRatio > 1.35) {
      warnings.push('High DC:AC ratio (> 1.35); generation clipping expected in peak sun.');
    }

    const design = new SolarDesign({
      designNumber: seqResult.formattedNumber,
      customerId: customer._id,
      leadId:
        resolvedLeadId ||
        (input.leadId && Types.ObjectId.isValid(input.leadId)
          ? new Types.ObjectId(input.leadId)
          : undefined),
      surveyId: input.surveyId,
      designName: input.designName,
      systemTopology: input.systemTopology,
      proposedCapacityKwp: totalDcCapacityKwp,
      module: {
        productId: moduleProduct._id,
        name: moduleProduct.name,
        sku: moduleProduct.sku,
        wattageWp: input.module.wattageWp,
        quantity: input.module.quantity,
        totalDcCapacityKwp
      },
      inverter: {
        productId: inverterProduct._id,
        name: inverterProduct.name,
        sku: inverterProduct.sku,
        ratedCapacityKw: input.inverter.ratedCapacityKw,
        quantity: inverterQty,
        actualDcAcRatio
      },
      battery: batteryData,
      structure: input.structure,
      estimatedGeneration: {
        dailyGenerationKwh: dailyGen,
        monthlyGenerationKwh: monthlyGen,
        annualGenerationKwh: annualGen,
        specificYieldKwhPerKwp: specificYield
      },
      assumptions: {
        peakSunHoursPerDay: peakSunHours,
        performanceRatioPercent: prPercent,
        assumptionsSource: 'Standard Indian Solar Resource Metric (4.8 PSH, 75% PR)'
      },
      warnings,
      disclaimer:
        'Preliminary technical sizing calculation based on standardized mathematical formulas and operator assumptions. This is not a certified structural engineering design or guaranteed solar generation yield.',
      engineeringNotes: input.engineeringNotes,
      createdBy: user.userId
    });

    await design.save();

    await AuditService.recordEvent({
      actorId: user.userId,
      actorType: ActorType.EMPLOYEE,
      action: AuditAction.DESIGN_CREATED,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId || 'solar-design-create',
      details: {
        designNumber: design.designNumber,
        customerId: customer._id.toString(),
        topology: design.systemTopology,
        capacityKwp: totalDcCapacityKwp
      }
    });

    logger.info(
      { designNumber: design.designNumber, customerId: customer._id },
      'SolarDesign created successfully.'
    );

    return design;
  }

  /**
   * Retrieve single SolarDesign by ID.
   */
  public static async getDesignById(id: string): Promise<ISolarDesignDocument> {
    const design = await SolarDesign.findById(id)
      .populate('customerId', 'legalName customerCode primaryPhone email')
      .populate('leadId', 'leadCode prospectName prospectPhone')
      .populate('surveyId', 'surveyNumber usableRoofAreaSqFt roofType')
      .populate('module.productId', 'name sku brand')
      .populate('inverter.productId', 'name sku brand')
      .populate('createdBy', 'firstName lastName email');

    if (!design) {
      throw AppError.notFound('SolarDesign not found.');
    }
    return design;
  }

  /**
   * List solar designs with pagination and filters.
   */
  public static async listDesigns(filter: SolarDesignFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.customerId) query.customerId = filter.customerId;
    if (filter.leadId) query.leadId = filter.leadId;
    if (filter.systemTopology) query.systemTopology = filter.systemTopology;
    if (filter.search) {
      query.$or = [
        { designNumber: { $regex: filter.search, $options: 'i' } },
        { designName: { $regex: filter.search, $options: 'i' } }
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {
      [filter.sortBy || 'createdAt']: filter.sortOrder === 'asc' ? 1 : -1
    };

    const [designs, total] = await Promise.all([
      SolarDesign.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'legalName customerCode')
        .lean(),
      SolarDesign.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items: designs,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }
}
