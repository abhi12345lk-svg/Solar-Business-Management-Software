import { describe, it, expect } from 'vitest';
import {
  SolarTopology,
  OnGridSizingInputSchema,
  OffGridSizingInputSchema,
  HybridSizingInputSchema,
  SizingCalculationInputSchema,
  CreateSolarDesignInputSchema,
  DISCLAIMER_TEXT
} from '../index.js';

describe('Solar Design & Sizing Shared Schemas', () => {
  describe('OnGridSizingInputSchema', () => {
    it('accepts valid on-grid sizing inputs', () => {
      const valid = {
        topology: SolarTopology.ON_GRID,
        targetCapacityKwp: 10,
        moduleWattageWp: 550,
        peakSunHoursPerDay: 5.0,
        performanceRatioPercent: 78.0,
        targetDcAcRatio: 1.2
      };

      const parsed = OnGridSizingInputSchema.parse(valid);
      expect(parsed.targetCapacityKwp).toBe(10);
      expect(parsed.moduleWattageWp).toBe(550);
      expect(parsed.assumptionsSource).toBe('MNRE Solar Resource Map / Standard Operator Basis');
    });

    it('rejects zero or negative target capacity', () => {
      expect(() =>
        OnGridSizingInputSchema.parse({
          topology: SolarTopology.ON_GRID,
          targetCapacityKwp: 0,
          moduleWattageWp: 550
        })
      ).toThrow(/Target capacity must be greater than 0/);
    });

    it('rejects unrealistic module wattage and performance ratios', () => {
      expect(() =>
        OnGridSizingInputSchema.parse({
          topology: SolarTopology.ON_GRID,
          targetCapacityKwp: 5,
          moduleWattageWp: 50 // Too low
        })
      ).toThrow(/at least 100 Wp/);

      expect(() =>
        OnGridSizingInputSchema.parse({
          topology: SolarTopology.ON_GRID,
          targetCapacityKwp: 5,
          moduleWattageWp: 550,
          performanceRatioPercent: 95 // Unrealistic
        })
      ).toThrow(/cannot exceed 90%/);
    });
  });

  describe('OffGridSizingInputSchema', () => {
    it('accepts valid off-grid load and battery inputs', () => {
      const valid = {
        topology: SolarTopology.OFF_GRID,
        dailyEnergyDemandKwh: 25,
        autonomyDays: 2,
        depthOfDischargePercent: 80,
        systemVoltageV: 48,
        moduleWattageWp: 550
      };

      const parsed = OffGridSizingInputSchema.parse(valid);
      expect(parsed.dailyEnergyDemandKwh).toBe(25);
      expect(parsed.systemVoltageV).toBe(48);
      expect(parsed.depthOfDischargePercent).toBe(80);
    });

    it('rejects non-standard DC bus voltage', () => {
      expect(() =>
        OffGridSizingInputSchema.parse({
          topology: SolarTopology.OFF_GRID,
          dailyEnergyDemandKwh: 15,
          systemVoltageV: 33, // Non-standard
          moduleWattageWp: 550
        })
      ).toThrow(/standard DC bus voltage/);
    });
  });

  describe('HybridSizingInputSchema', () => {
    it('accepts valid hybrid inputs', () => {
      const valid = {
        topology: SolarTopology.HYBRID,
        gridTieCapacityKwp: 15,
        criticalLoadDemandKwh: 10,
        backupHours: 6,
        systemVoltageV: 48,
        moduleWattageWp: 550
      };

      const parsed = HybridSizingInputSchema.parse(valid);
      expect(parsed.gridTieCapacityKwp).toBe(15);
      expect(parsed.criticalLoadDemandKwh).toBe(10);
    });
  });

  describe('SizingCalculationInputSchema (Discriminated Union)', () => {
    it('properly discriminates between topologies', () => {
      const onGrid = SizingCalculationInputSchema.parse({
        topology: SolarTopology.ON_GRID,
        targetCapacityKwp: 10,
        moduleWattageWp: 550
      });
      expect(onGrid.topology).toBe(SolarTopology.ON_GRID);

      const offGrid = SizingCalculationInputSchema.parse({
        topology: SolarTopology.OFF_GRID,
        dailyEnergyDemandKwh: 20,
        moduleWattageWp: 550
      });
      expect(offGrid.topology).toBe(SolarTopology.OFF_GRID);
    });
  });

  describe('CreateSolarDesignInputSchema', () => {
    it('validates comprehensive solar design input', () => {
      const designInput = {
        customerId: '507f1f77bcf86cd799439011',
        designName: 'Rooftop 10kWp On-Grid Solar Plant',
        systemTopology: SolarTopology.ON_GRID,
        proposedCapacityKwp: 10.45,
        module: {
          productId: '507f1f77bcf86cd799439022',
          wattageWp: 550,
          quantity: 19
        },
        inverter: {
          productId: '507f1f77bcf86cd799439033',
          ratedCapacityKw: 10,
          quantity: 1
        },
        structure: {
          structureType: 'RCC_FLAT',
          tiltDegrees: 22,
          azimuthDegrees: 0
        }
      };

      const parsed = CreateSolarDesignInputSchema.parse(designInput);
      expect(parsed.designName).toBe('Rooftop 10kWp On-Grid Solar Plant');
      expect(parsed.module.quantity).toBe(19);
      expect(DISCLAIMER_TEXT).toContain('Preliminary technical sizing calculation');
    });
  });
});
