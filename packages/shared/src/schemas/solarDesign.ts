/**
 * INS Solar Business Management Software — Solar Design & Sizing Schemas
 *
 * Provides typed, validated Zod schemas for mathematical solar sizing calculations
 * across On-Grid, Off-Grid, and Hybrid topologies, with explicit physical units and bounds.
 */

import { z } from 'zod';
import { SolarTopology, RoofType } from '../types/enums.js';

export const DISCLAIMER_TEXT =
  'Preliminary technical sizing calculation based on standardized mathematical formulas and operator assumptions. This is not a certified structural engineering design or guaranteed solar generation yield. Site-specific shading, local grid voltage fluctuations, and temperature coefficients require qualified engineering audit before commercial commissioning.';

// ----------------------------------------------------------------------------
// Sizing Inputs
// ----------------------------------------------------------------------------

export const OnGridSizingInputSchema = z.object({
  topology: z.literal(SolarTopology.ON_GRID),
  targetCapacityKwp: z
    .number({ invalid_type_error: 'Target capacity must be a numeric value in kWp.' })
    .positive('Target capacity must be greater than 0 kWp.')
    .max(10000, 'Single rooftop design cannot exceed 10,000 kWp.'),
  moduleWattageWp: z
    .number({ invalid_type_error: 'Module wattage must be a number in Wp.' })
    .int('Module wattage must be an integer.')
    .min(100, 'Solar panel wattage must be at least 100 Wp.')
    .max(1000, 'Solar panel wattage cannot exceed 1,000 Wp.'),
  peakSunHoursPerDay: z
    .number({ invalid_type_error: 'Peak sun hours must be a number.' })
    .positive('Peak sun hours per day must be strictly positive.')
    .max(12, 'Peak sun hours cannot exceed 12 hours/day.')
    .default(4.8),
  performanceRatioPercent: z
    .number({ invalid_type_error: 'Performance ratio must be a percentage.' })
    .min(50, 'Performance ratio cannot be less than 50%.')
    .max(90, 'Performance ratio cannot exceed 90%.')
    .default(75.0),
  targetDcAcRatio: z
    .number({ invalid_type_error: 'Target DC:AC ratio must be a number.' })
    .min(1.0, 'Target DC:AC ratio must be at least 1.0.')
    .max(1.5, 'Target DC:AC ratio cannot exceed 1.5.')
    .default(1.2),
  selectedInverterRatedKw: z
    .number({ invalid_type_error: 'Inverter capacity must be a number in kW.' })
    .positive('Selected inverter rated capacity must be greater than 0 kW.')
    .optional(),
  assumptionsSource: z
    .string()
    .trim()
    .min(1, 'Assumptions source basis must be documented.')
    .default('MNRE Solar Resource Map / Standard Operator Basis')
});

export type OnGridSizingInput = z.input<typeof OnGridSizingInputSchema>;

export const OffGridSizingInputSchema = z.object({
  topology: z.literal(SolarTopology.OFF_GRID),
  dailyEnergyDemandKwh: z
    .number({ invalid_type_error: 'Daily energy demand must be a number in kWh.' })
    .positive('Daily energy demand must be strictly greater than 0 kWh.')
    .max(5000, 'Off-grid daily energy demand cannot exceed 5,000 kWh.'),
  autonomyDays: z
    .number({ invalid_type_error: 'Autonomy days must be a number.' })
    .int('Autonomy days must be an integer.')
    .min(1, 'Autonomy days must be at least 1 day.')
    .max(7, 'Autonomy days cannot exceed 7 days.')
    .default(1),
  depthOfDischargePercent: z
    .number({ invalid_type_error: 'Depth of discharge must be a percentage.' })
    .min(20, 'Depth of discharge cannot be less than 20%.')
    .max(95, 'Depth of discharge cannot exceed 95%.')
    .default(80.0), // Standard for Lithium LiFePO4
  systemVoltageV: z
    .number({ invalid_type_error: 'System DC bus voltage must be a number in Volts.' })
    .refine(v => [12, 24, 48, 96, 120, 240, 360, 480].includes(v), {
      message:
        'System voltage must be a standard DC bus voltage (12, 24, 48, 96, 120, 240, 360, 480 V).'
    })
    .default(48),
  moduleWattageWp: z.number().int().min(100).max(1000),
  batteryUnitVoltageV: z.number().positive().default(48),
  batteryUnitAh: z.number().positive().default(100),
  peakSunHoursPerDay: z.number().positive().max(12).default(4.8),
  performanceRatioPercent: z.number().min(50).max(90).default(75.0),
  selectedInverterRatedKw: z.number().positive().optional(),
  assumptionsSource: z
    .string()
    .trim()
    .min(1)
    .default('Off-Grid Load Audit / Battery DoD 80% Standard')
});

export type OffGridSizingInput = z.input<typeof OffGridSizingInputSchema>;

export const HybridSizingInputSchema = z.object({
  topology: z.literal(SolarTopology.HYBRID),
  gridTieCapacityKwp: z
    .number()
    .positive('Grid-tie capacity must be greater than 0 kWp.')
    .max(10000),
  criticalLoadDemandKwh: z
    .number()
    .nonnegative('Critical load demand must be 0 or positive kWh.')
    .max(2000),
  backupHours: z
    .number()
    .positive('Backup duration must be greater than 0 hours.')
    .max(72)
    .default(4),
  depthOfDischargePercent: z.number().min(20).max(95).default(80.0),
  systemVoltageV: z
    .number()
    .refine(v => [12, 24, 48, 96, 120, 240, 360, 480].includes(v), {
      message: 'System voltage must be a standard DC bus voltage.'
    })
    .default(48),
  moduleWattageWp: z.number().int().min(100).max(1000),
  batteryUnitVoltageV: z.number().positive().default(48),
  batteryUnitAh: z.number().positive().default(100),
  peakSunHoursPerDay: z.number().positive().max(12).default(4.8),
  performanceRatioPercent: z.number().min(50).max(90).default(75.0),
  targetDcAcRatio: z.number().min(1.0).max(1.5).default(1.2),
  selectedInverterRatedKw: z.number().positive().optional(),
  assumptionsSource: z
    .string()
    .trim()
    .min(1)
    .default('Hybrid ESS Standard Model / Critical Load Backup')
});

export type HybridSizingInput = z.input<typeof HybridSizingInputSchema>;

export const SizingCalculationInputSchema = z.discriminatedUnion('topology', [
  OnGridSizingInputSchema,
  OffGridSizingInputSchema,
  HybridSizingInputSchema
]);

export type SizingCalculationInput = z.input<typeof SizingCalculationInputSchema>;

// ----------------------------------------------------------------------------
// Sizing Calculation Result Schemas
// ----------------------------------------------------------------------------

export const SizingResultSchema = z.object({
  topology: z.nativeEnum(SolarTopology),
  proposedCapacityKwp: z.number().positive(),
  panelQuantity: z.number().int().positive(),
  moduleWattageWp: z.number().int().positive(),
  actualDcCapacityKwp: z.number().positive(),
  recommendedInverterKw: z.number().positive(),
  inverterQuantity: z.number().int().positive(),
  actualDcAcRatio: z.number().positive(),
  batteryStorage: z
    .object({
      requiredStorageKwh: z.number().nonnegative(),
      requiredCapacityAh: z.number().nonnegative(),
      systemVoltageV: z.number().positive(),
      depthOfDischargePercent: z.number().positive(),
      autonomyDuration: z.string(),
      batteryQuantity: z.number().int().nonnegative()
    })
    .optional(),
  estimatedGeneration: z.object({
    dailyGenerationKwh: z.number().positive(),
    monthlyGenerationKwh: z.number().positive(),
    annualGenerationKwh: z.number().positive(),
    specificYieldKwhPerKwp: z.number().positive()
  }),
  assumptions: z.object({
    peakSunHoursPerDay: z.number().positive(),
    performanceRatioPercent: z.number().positive(),
    assumptionsSource: z.string()
  }),
  warnings: z.array(z.string()),
  disclaimer: z.string()
});

export type SizingResult = z.infer<typeof SizingResultSchema>;

// ----------------------------------------------------------------------------
// Solar Design Model DTOs
// ----------------------------------------------------------------------------

export const CreateSolarDesignInputSchema = z.object({
  customerId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  surveyId: z.string().trim().optional(),
  designName: z
    .string({ required_error: 'Design name is required.' })
    .trim()
    .min(3, 'Design name must be at least 3 characters.')
    .max(120, 'Design name cannot exceed 120 characters.'),
  systemTopology: z.nativeEnum(SolarTopology),
  proposedCapacityKwp: z
    .number()
    .positive('Proposed capacity must be greater than 0 kWp.')
    .max(10000),
  module: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid module product ID.'),
    wattageWp: z.number().int().min(100).max(1000),
    quantity: z.number().int().positive()
  }),
  inverter: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid inverter product ID.'),
    ratedCapacityKw: z.number().positive(),
    quantity: z.number().int().positive().default(1)
  }),
  battery: z
    .object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid battery product ID.'),
      nominalVoltageV: z.number().positive(),
      capacityAh: z.number().positive(),
      quantity: z.number().int().positive(),
      totalStorageKwh: z.number().positive(),
      autonomyDays: z.number().positive().optional()
    })
    .optional(),
  structure: z.object({
    structureType: z.nativeEnum(RoofType),
    tiltDegrees: z.number().min(0).max(90).default(15),
    azimuthDegrees: z.number().min(-180).max(180).default(0),
    notes: z.string().trim().max(500).optional()
  }),
  sizingInputs: SizingCalculationInputSchema.optional(),
  engineeringNotes: z.string().trim().max(2000).optional()
});

export type CreateSolarDesignInput = z.input<typeof CreateSolarDesignInputSchema>;

export const UpdateSolarDesignInputSchema = CreateSolarDesignInputSchema.partial();
export type UpdateSolarDesignInput = z.infer<typeof UpdateSolarDesignInputSchema>;

export const SolarDesignFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  customerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  leadId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  systemTopology: z.nativeEnum(SolarTopology).optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type SolarDesignFilter = z.infer<typeof SolarDesignFilterSchema>;
