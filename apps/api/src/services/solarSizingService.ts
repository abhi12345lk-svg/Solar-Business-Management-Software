/**
 * INS Solar Business Management Software — Solar Sizing Calculation Engine
 *
 * Pure, deterministic mathematical calculation service supporting:
 * - On-Grid: PV array sizing, inverter DC:AC matching, estimated generation yield.
 * - Off-Grid: Load demand, autonomy, battery bank sizing (Ah/kWh), array coverage.
 * - Hybrid: Dual grid-tie capacity + critical backup storage sizing.
 *
 * Implements explicit physical units, documented assumptions, boundary validation,
 * and standard disclaimer requirements.
 */

import {
  SolarTopology,
  OnGridSizingInput,
  OffGridSizingInput,
  HybridSizingInput,
  SizingCalculationInput,
  SizingResult,
  DISCLAIMER_TEXT
} from '@ins-solar/shared';
import { AppError } from '../errors/AppError.js';

export class SolarSizingService {
  /**
   * Main entry point evaluating any validated sizing input.
   */
  public static calculate(input: SizingCalculationInput): SizingResult {
    switch (input.topology) {
      case SolarTopology.ON_GRID:
        return this.calculateOnGrid(input);
      case SolarTopology.OFF_GRID:
        return this.calculateOffGrid(input);
      case SolarTopology.HYBRID:
        return this.calculateHybrid(input);
      default:
        throw AppError.validationFailed(
          `Unsupported solar system topology: '${(input as any).topology}'.`
        );
    }
  }

  /**
   * 1. On-Grid Solar Sizing
   */
  public static calculateOnGrid(input: OnGridSizingInput): SizingResult {
    if (input.targetCapacityKwp <= 0) {
      throw AppError.validationFailed('Target capacity must be strictly greater than 0 kWp.');
    }
    if (input.moduleWattageWp <= 0) {
      throw AppError.validationFailed('Module wattage must be strictly greater than 0 Wp.');
    }

    const peakSunHours = input.peakSunHoursPerDay ?? 4.8;
    if (peakSunHours <= 0) {
      throw AppError.validationFailed('Peak sun hours per day must be strictly positive.');
    }

    const prPercent = input.performanceRatioPercent ?? 75.0;
    if (prPercent <= 0 || prPercent > 100) {
      throw AppError.validationFailed('Performance ratio must be between 1% and 100%.');
    }

    const assumptionsSource =
      input.assumptionsSource || 'MNRE Solar Resource Map / Standard Operator Basis';
    const warnings: string[] = [];

    // Calculate panel count: integer ceiling to achieve or exceed target capacity
    const panelQuantity = Math.ceil((input.targetCapacityKwp * 1000) / input.moduleWattageWp);
    const actualDcCapacityKwp = Number(((panelQuantity * input.moduleWattageWp) / 1000).toFixed(3));

    // Recommended inverter sizing based on target DC:AC ratio (default 1.20)
    const targetRatio = input.targetDcAcRatio || 1.2;
    const recommendedInverterKw = Number((actualDcCapacityKwp / targetRatio).toFixed(2));
    const inverterQuantity = 1;

    // Actual DC:AC ratio evaluation
    let actualDcAcRatio = targetRatio;
    if (input.selectedInverterRatedKw && input.selectedInverterRatedKw > 0) {
      actualDcAcRatio = Number(
        (actualDcCapacityKwp / (input.selectedInverterRatedKw * inverterQuantity)).toFixed(2)
      );

      if (actualDcAcRatio < 1.05) {
        warnings.push(
          `Inverter capacity (${input.selectedInverterRatedKw} kW) is high relative to DC capacity (${actualDcCapacityKwp} kWp, DC:AC = ${actualDcAcRatio}). Inverter may operate at suboptimal efficiency during low irradiance.`
        );
      } else if (actualDcAcRatio > 1.35) {
        warnings.push(
          `DC:AC loading ratio (${actualDcAcRatio}) exceeds 1.35. Peak solar generation clipping is expected during high-irradiance midday periods.`
        );
      }
    }

    // Energy Generation Modeling
    const dailyGenerationKwh = Number(
      (actualDcCapacityKwp * peakSunHours * (prPercent / 100)).toFixed(2)
    );
    const monthlyGenerationKwh = Number((dailyGenerationKwh * 30).toFixed(2));
    const annualGenerationKwh = Number((dailyGenerationKwh * 365).toFixed(2));
    const specificYieldKwhPerKwp = Number((annualGenerationKwh / actualDcCapacityKwp).toFixed(1));

    return {
      topology: SolarTopology.ON_GRID,
      proposedCapacityKwp: actualDcCapacityKwp,
      panelQuantity,
      moduleWattageWp: input.moduleWattageWp,
      actualDcCapacityKwp,
      recommendedInverterKw,
      inverterQuantity,
      actualDcAcRatio,
      estimatedGeneration: {
        dailyGenerationKwh,
        monthlyGenerationKwh,
        annualGenerationKwh,
        specificYieldKwhPerKwp
      },
      assumptions: {
        peakSunHoursPerDay: peakSunHours,
        performanceRatioPercent: prPercent,
        assumptionsSource
      },
      warnings,
      disclaimer: DISCLAIMER_TEXT
    };
  }

  /**
   * 2. Off-Grid Solar Sizing
   */
  public static calculateOffGrid(input: OffGridSizingInput): SizingResult {
    if (input.dailyEnergyDemandKwh <= 0) {
      throw AppError.validationFailed('Daily energy demand must be strictly greater than 0 kWh.');
    }
    const autonomyDays = input.autonomyDays ?? 1;
    if (autonomyDays < 1) {
      throw AppError.validationFailed('Autonomy days must be at least 1 day.');
    }
    const dodPercent = input.depthOfDischargePercent ?? 80.0;
    if (dodPercent <= 0 || dodPercent > 100) {
      throw AppError.validationFailed('Depth of discharge must be between 1% and 100%.');
    }

    const systemVoltage = input.systemVoltageV ?? 48;
    const peakSunHours = input.peakSunHoursPerDay ?? 4.8;
    const prPercent = input.performanceRatioPercent ?? 75.0;
    const assumptionsSource =
      input.assumptionsSource || 'Off-Grid Load Audit / Battery DoD 80% Standard';

    const warnings: string[] = [];

    // Battery Bank Sizing
    // Total Nominal Storage (kWh) = (Daily Demand * Autonomy Days) / (DoD / 100)
    const requiredStorageKwh = Number(
      ((input.dailyEnergyDemandKwh * autonomyDays) / (dodPercent / 100)).toFixed(2)
    );

    // Required Ah = (kWh * 1000) / System Voltage (V)
    const requiredCapacityAh = Number(((requiredStorageKwh * 1000) / systemVoltage).toFixed(1));

    const unitVoltage = input.batteryUnitVoltageV || systemVoltage;
    const unitAh = input.batteryUnitAh || 100;
    const singleBatteryKwh = (unitVoltage * unitAh) / 1000;
    const batteryQuantity = Math.max(1, Math.ceil(requiredStorageKwh / singleBatteryKwh));

    if (dodPercent > 85) {
      warnings.push(
        `High depth of discharge (${dodPercent}%) will accelerate battery capacity fade if non-LiFePO4 chemistry is utilized.`
      );
    }
    if (autonomyDays === 1) {
      warnings.push(
        'Single-day autonomy provides minimal buffer against persistent monsoon cloud cover.'
      );
    }

    // Solar PV Array Coverage for Off-Grid
    const batteryRoundTripEfficiency = 0.85;
    const totalDailyDcEnergyNeeded = input.dailyEnergyDemandKwh / batteryRoundTripEfficiency;
    const requiredArrayKwp = totalDailyDcEnergyNeeded / (peakSunHours * (prPercent / 100));

    const panelQuantity = Math.ceil((requiredArrayKwp * 1000) / input.moduleWattageWp);
    const actualDcCapacityKwp = Number(((panelQuantity * input.moduleWattageWp) / 1000).toFixed(3));

    // Inverter Sizing for Off-Grid
    const recommendedInverterKw = Number(
      Math.max(3.0, (input.dailyEnergyDemandKwh / 6) * 1.3).toFixed(2)
    );
    const inverterQuantity = 1;

    let actualDcAcRatio = Number((actualDcCapacityKwp / recommendedInverterKw).toFixed(2));
    if (input.selectedInverterRatedKw && input.selectedInverterRatedKw > 0) {
      actualDcAcRatio = Number((actualDcCapacityKwp / input.selectedInverterRatedKw).toFixed(2));
    }

    // Generation estimates
    const dailyGenerationKwh = Number(
      (actualDcCapacityKwp * peakSunHours * (prPercent / 100)).toFixed(2)
    );
    const monthlyGenerationKwh = Number((dailyGenerationKwh * 30).toFixed(2));
    const annualGenerationKwh = Number((dailyGenerationKwh * 365).toFixed(2));
    const specificYieldKwhPerKwp = Number((annualGenerationKwh / actualDcCapacityKwp).toFixed(1));

    return {
      topology: SolarTopology.OFF_GRID,
      proposedCapacityKwp: actualDcCapacityKwp,
      panelQuantity,
      moduleWattageWp: input.moduleWattageWp,
      actualDcCapacityKwp,
      recommendedInverterKw: input.selectedInverterRatedKw || recommendedInverterKw,
      inverterQuantity,
      actualDcAcRatio,
      batteryStorage: {
        requiredStorageKwh,
        requiredCapacityAh,
        systemVoltageV: systemVoltage,
        depthOfDischargePercent: dodPercent,
        autonomyDuration: `${autonomyDays} day(s)`,
        batteryQuantity
      },
      estimatedGeneration: {
        dailyGenerationKwh,
        monthlyGenerationKwh,
        annualGenerationKwh,
        specificYieldKwhPerKwp
      },
      assumptions: {
        peakSunHoursPerDay: peakSunHours,
        performanceRatioPercent: prPercent,
        assumptionsSource
      },
      warnings,
      disclaimer: DISCLAIMER_TEXT
    };
  }

  /**
   * 3. Hybrid Solar Sizing
   */
  public static calculateHybrid(input: HybridSizingInput): SizingResult {
    if (input.gridTieCapacityKwp <= 0) {
      throw AppError.validationFailed('Grid-tie capacity must be strictly greater than 0 kWp.');
    }
    const criticalLoadKwh = input.criticalLoadDemandKwh ?? 0;
    if (criticalLoadKwh < 0) {
      throw AppError.validationFailed('Critical load demand cannot be negative.');
    }

    const peakSunHours = input.peakSunHoursPerDay ?? 4.8;
    const prPercent = input.performanceRatioPercent ?? 75.0;
    const targetRatio = input.targetDcAcRatio || 1.2;
    const backupHours = input.backupHours ?? 4;
    const dodPercent = input.depthOfDischargePercent ?? 80.0;
    const systemVoltage = input.systemVoltageV ?? 48;
    const assumptionsSource =
      input.assumptionsSource || 'Hybrid ESS Standard Model / Critical Load Backup';

    const warnings: string[] = [];

    // PV Array sizing for grid-tie component
    const panelQuantity = Math.ceil((input.gridTieCapacityKwp * 1000) / input.moduleWattageWp);
    const actualDcCapacityKwp = Number(((panelQuantity * input.moduleWattageWp) / 1000).toFixed(3));

    const recommendedInverterKw = Number((actualDcCapacityKwp / targetRatio).toFixed(2));
    const inverterQuantity = 1;

    let actualDcAcRatio = targetRatio;
    if (input.selectedInverterRatedKw && input.selectedInverterRatedKw > 0) {
      actualDcAcRatio = Number((actualDcCapacityKwp / input.selectedInverterRatedKw).toFixed(2));
      if (actualDcAcRatio < 1.05 || actualDcAcRatio > 1.35) {
        warnings.push(`Hybrid inverter DC:AC loading ratio is ${actualDcAcRatio}.`);
      }
    }

    // Critical Backup Battery Sizing
    const backupEnergyKwh = (criticalLoadKwh / 24) * backupHours;
    const requiredStorageKwh = Number((backupEnergyKwh / (dodPercent / 100)).toFixed(2));
    const requiredCapacityAh = Number(((requiredStorageKwh * 1000) / systemVoltage).toFixed(1));

    const unitVoltage = input.batteryUnitVoltageV || systemVoltage;
    const unitAh = input.batteryUnitAh || 100;
    const singleBatteryKwh = (unitVoltage * unitAh) / 1000;
    const batteryQuantity = Math.max(1, Math.ceil(requiredStorageKwh / singleBatteryKwh));

    // Generation estimates
    const dailyGenerationKwh = Number(
      (actualDcCapacityKwp * peakSunHours * (prPercent / 100)).toFixed(2)
    );
    const monthlyGenerationKwh = Number((dailyGenerationKwh * 30).toFixed(2));
    const annualGenerationKwh = Number((dailyGenerationKwh * 365).toFixed(2));
    const specificYieldKwhPerKwp = Number((annualGenerationKwh / actualDcCapacityKwp).toFixed(1));

    return {
      topology: SolarTopology.HYBRID,
      proposedCapacityKwp: actualDcCapacityKwp,
      panelQuantity,
      moduleWattageWp: input.moduleWattageWp,
      actualDcCapacityKwp,
      recommendedInverterKw: input.selectedInverterRatedKw || recommendedInverterKw,
      inverterQuantity,
      actualDcAcRatio,
      batteryStorage: {
        requiredStorageKwh,
        requiredCapacityAh,
        systemVoltageV: systemVoltage,
        depthOfDischargePercent: dodPercent,
        autonomyDuration: `${backupHours} backup hour(s)`,
        batteryQuantity
      },
      estimatedGeneration: {
        dailyGenerationKwh,
        monthlyGenerationKwh,
        annualGenerationKwh,
        specificYieldKwhPerKwp
      },
      assumptions: {
        peakSunHoursPerDay: peakSunHours,
        performanceRatioPercent: prPercent,
        assumptionsSource
      },
      warnings,
      disclaimer: DISCLAIMER_TEXT
    };
  }
}
