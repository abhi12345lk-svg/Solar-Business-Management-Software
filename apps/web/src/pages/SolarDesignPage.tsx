import React, { useState, useEffect } from 'react';
import {
  Sun,
  Zap,
  Battery,
  Plus,
  Search,
  Calculator,
  Layers,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { SolarTopology, RoofType, SizingResult, DISCLAIMER_TEXT } from '@ins-solar/shared';

interface SolarDesignItem {
  _id: string;
  designNumber: string;
  designName: string;
  systemTopology: SolarTopology;
  proposedCapacityKwp: number;
  customerId: {
    _id: string;
    legalName?: string;
    customerCode?: string;
  };
  module: {
    wattageWp: number;
    quantity: number;
    totalDcCapacityKwp: number;
  };
  inverter: {
    ratedCapacityKw: number;
    quantity: number;
    actualDcAcRatio: number;
  };
  estimatedGeneration: {
    dailyGenerationKwh: number;
    monthlyGenerationKwh: number;
    annualGenerationKwh: number;
  };
  createdAt: string;
}

export const SolarDesignPage: React.FC = () => {
  const [designs, setDesigns] = useState<SolarDesignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [topologyFilter, setTopologyFilter] = useState<string>('ALL');

  // Calculator Form State
  const [calcTopology, setCalcTopology] = useState<SolarTopology>(SolarTopology.ON_GRID);
  const [targetCapacityKwp, setTargetCapacityKwp] = useState('10.0');
  const [moduleWattageWp, setModuleWattageWp] = useState('550');
  const [peakSunHours, setPeakSunHours] = useState('4.8');
  const [performanceRatio, setPerformanceRatio] = useState('75.0');
  const [targetDcAcRatio, setTargetDcAcRatio] = useState('1.2');
  const [selectedInverterKw, setSelectedInverterKw] = useState('');

  // Off-grid/Hybrid Battery inputs
  const [dailyDemandKwh, setDailyDemandKwh] = useState('20.0');
  const [autonomyDays, setAutonomyDays] = useState('1');
  const [backupHours, setBackupHours] = useState('4');
  const [dodPercent, setDodPercent] = useState('80.0');
  const [systemVoltageV, setSystemVoltageV] = useState('48');
  const [batteryUnitVoltageV, setBatteryUnitVoltageV] = useState('48');
  const [batteryUnitAh, setBatteryUnitAh] = useState('100');

  // Sizing Output State
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<SizingResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Save Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveCustomerId, setSaveCustomerId] = useState('');
  const [saveLeadId, setSaveLeadId] = useState('');
  const [saveDesignName, setSaveDesignName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

  // CRM context for dropdowns
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [manualCustomerEntry, setManualCustomerEntry] = useState(false);

  useEffect(() => {
    apiClient<any>('/catalog/products?limit=100')
      .then(res => {
        if (res && Array.isArray(res.items)) setCatalogProducts(res.items);
        else if (Array.isArray(res)) setCatalogProducts(res);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showSaveModal && availableCustomers.length === 0) {
      setLoadingContext(true);
      Promise.all([
        apiClient<any>('/customers?limit=100').catch(() => []),
        apiClient<any>('/leads?limit=100').catch(() => [])
      ])
        .then(([custRes, leadRes]) => {
          const custs = Array.isArray(custRes) ? custRes : custRes?.data || custRes?.items || [];
          const lds = Array.isArray(leadRes) ? leadRes : leadRes?.data || leadRes?.items || [];
          setAvailableCustomers(custs);
          setAvailableLeads(lds);
        })
        .finally(() => setLoadingContext(false));
    }
  }, [showSaveModal]);

  const fetchDesigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (topologyFilter !== 'ALL') params.set('systemTopology', topologyFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');

      const data = await apiClient<SolarDesignItem[]>(`/solar-designs?${params.toString()}`);
      setDesigns(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch solar designs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, [topologyFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDesigns();
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setCalcError(null);
    try {
      let payload: any = {
        topology: calcTopology,
        moduleWattageWp: Number(moduleWattageWp),
        peakSunHoursPerDay: Number(peakSunHours),
        performanceRatioPercent: Number(performanceRatio)
      };

      if (calcTopology === SolarTopology.ON_GRID) {
        payload.targetCapacityKwp = Number(targetCapacityKwp);
        payload.targetDcAcRatio = Number(targetDcAcRatio);
        if (selectedInverterKw.trim()) {
          payload.selectedInverterRatedKw = Number(selectedInverterKw);
        }
      } else if (calcTopology === SolarTopology.OFF_GRID) {
        payload.dailyEnergyDemandKwh = Number(dailyDemandKwh);
        payload.autonomyDays = Number(autonomyDays);
        payload.depthOfDischargePercent = Number(dodPercent);
        payload.systemVoltageV = Number(systemVoltageV);
        payload.batteryUnitVoltageV = Number(batteryUnitVoltageV);
        payload.batteryUnitAh = Number(batteryUnitAh);
        if (selectedInverterKw.trim()) {
          payload.selectedInverterRatedKw = Number(selectedInverterKw);
        }
      } else if (calcTopology === SolarTopology.HYBRID) {
        payload.gridTieCapacityKwp = Number(targetCapacityKwp);
        payload.criticalLoadDemandKwh = Number(dailyDemandKwh);
        payload.backupHours = Number(backupHours);
        payload.depthOfDischargePercent = Number(dodPercent);
        payload.systemVoltageV = Number(systemVoltageV);
        payload.batteryUnitVoltageV = Number(batteryUnitVoltageV);
        payload.batteryUnitAh = Number(batteryUnitAh);
        payload.targetDcAcRatio = Number(targetDcAcRatio);
        if (selectedInverterKw.trim()) {
          payload.selectedInverterRatedKw = Number(selectedInverterKw);
        }
      }

      const res = await apiClient<SizingResult>('/solar-designs/calculate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setCalcResult(res);
      setSaveDesignName(
        `${calcTopology.replace('_', '-')} ${res.actualDcCapacityKwp} kWp Sizing Proposal`
      );
    } catch (err: any) {
      setCalcError(err.message || 'Sizing calculation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const handleLeadChange = (selectedLeadId: string) => {
    setSaveLeadId(selectedLeadId);
    if (!selectedLeadId) return;
    const lead = availableLeads.find(l => (l.id || l._id) === selectedLeadId);
    if (lead) {
      if (lead.convertedCustomerId) {
        const matchingCust = availableCustomers.find(
          c =>
            (c._id || c.id) === lead.convertedCustomerId ||
            c.customerCode === lead.convertedCustomerId
        );
        if (matchingCust) {
          setSaveCustomerId(matchingCust._id || matchingCust.id);
          setManualCustomerEntry(false);
          return;
        }
        setSaveCustomerId(lead.convertedCustomerId);
      } else {
        const matchingCust = availableCustomers.find(
          c =>
            (c.phone && lead.prospectPhone && c.phone === lead.prospectPhone) ||
            (c.primaryPhone && lead.prospectPhone && c.primaryPhone === lead.prospectPhone) ||
            (c.customerCode && lead.leadCode && c.customerCode.endsWith(lead.leadCode.slice(-5)))
        );
        if (matchingCust) {
          setSaveCustomerId(matchingCust._id || matchingCust.id);
          setManualCustomerEntry(false);
        }
      }
    }
  };

  const handleCustomerChange = (selectedCustId: string) => {
    setSaveCustomerId(selectedCustId);
    if (!selectedCustId) return;
    const matchingLead = availableLeads.find(
      l =>
        l.convertedCustomerId === selectedCustId ||
        (l.id && l.id === selectedCustId) ||
        (l._id && l._id === selectedCustId)
    );
    if (matchingLead) {
      setSaveLeadId(matchingLead.id || matchingLead._id);
    }
  };

  const handleSaveDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcResult) return;

    if (!saveCustomerId.trim() && !saveLeadId.trim()) {
      setSaveError('Please select either a Customer Account or an Originating Lead.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const panelProd = catalogProducts.find(
        p =>
          p.category?.code === 'SOLAR_PANEL' ||
          p.category?.name?.toLowerCase().includes('panel') ||
          p.name?.toLowerCase().includes('panel')
      );
      const inverterProd = catalogProducts.find(
        p =>
          p.category?.code === 'INVERTER' ||
          p.category?.name?.toLowerCase().includes('inverter') ||
          p.name?.toLowerCase().includes('inverter')
      );
      const batteryProd = catalogProducts.find(
        p =>
          p.category?.code === 'BATTERY' ||
          p.category?.name?.toLowerCase().includes('battery') ||
          p.name?.toLowerCase().includes('battery')
      );

      const payload: any = {
        customerId: saveCustomerId.trim() || undefined,
        leadId: saveLeadId.trim() || undefined,
        designName: saveDesignName.trim(),
        systemTopology: calcTopology,
        module: {
          productId: panelProd?._id || '507f1f77bcf86cd799439011',
          wattageWp: calcResult.moduleWattageWp,
          quantity: calcResult.panelQuantity
        },
        inverter: {
          productId: inverterProd?._id || '507f1f77bcf86cd799439022',
          ratedCapacityKw: calcResult.recommendedInverterKw,
          quantity: 1
        },
        structure: {
          roofType: RoofType.RCC_FLAT,
          structureType: 'Elevated Aluminum HDGI MMS',
          tiltAngleDegrees: 25,
          azimuthOrientation: 'South Facing (180°)'
        },
        engineeringNotes: saveNotes.trim() || undefined
      };

      if (calcResult.batteryStorage) {
        payload.battery = {
          productId: batteryProd?._id || '507f1f77bcf86cd799439033',
          batteryType: 'LiFePO4 Lithium Ion',
          unitVoltageV: Number(batteryUnitVoltageV),
          unitCapacityAh: Number(batteryUnitAh),
          quantity: calcResult.batteryStorage.batteryQuantity,
          totalStorageKwh: calcResult.batteryStorage.requiredStorageKwh,
          autonomyDays: calcTopology === SolarTopology.OFF_GRID ? Number(autonomyDays) : 1
        };
      }

      const created = await apiClient('/solar-designs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSaveSuccess(`Design ${created.designNumber} created and saved successfully!`);
      setTimeout(() => {
        setShowSaveModal(false);
        fetchDesigns();
      }, 1500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save solar design.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sun className="w-6 h-6 text-solar-500" />
            Solar Sizing Engine & Design Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Deterministic technical PV array sizing, DC:AC inverter matching, battery storage, and
            yield modeling.
          </p>
        </div>
      </div>

      {/* Top Section: Interactive Sizing Calculator */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-solar-600" />
            <h2 className="text-lg font-semibold text-foreground">Interactive Sizing Calculator</h2>
          </div>
          <span className="text-xs bg-solar-50 text-solar-700 dark:bg-solar-950/60 dark:text-solar-300 font-medium px-2.5 py-1 rounded-full border border-solar-200 dark:border-solar-800">
            PV Sizing Engine
          </span>
        </div>

        {/* Topology Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => {
              setCalcTopology(SolarTopology.ON_GRID);
              setCalcResult(null);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              calcTopology === SolarTopology.ON_GRID
                ? 'border-solar-500 bg-solar-50/50 dark:bg-solar-950/30 ring-2 ring-solar-500/20'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Zap className="w-4 h-4 text-solar-500" />
              On-Grid (Grid-Tied)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Direct grid export, net-metered PV array with DC:AC inverter sizing and annual
              generation yield.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setCalcTopology(SolarTopology.OFF_GRID);
              setCalcResult(null);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              calcTopology === SolarTopology.OFF_GRID
                ? 'border-solar-500 bg-solar-50/50 dark:bg-solar-950/30 ring-2 ring-solar-500/20'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Battery className="w-4 h-4 text-emerald-500" />
              Off-Grid (Autonomous)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Load demand coverage, autonomy buffer, DoD-compensated battery bank Ah/kWh sizing.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setCalcTopology(SolarTopology.HYBRID);
              setCalcResult(null);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              calcTopology === SolarTopology.HYBRID
                ? 'border-solar-500 bg-solar-50/50 dark:bg-solar-950/30 ring-2 ring-solar-500/20'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Layers className="w-4 h-4 text-indigo-500" />
              Hybrid (Grid + Storage)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dual-function grid-export array paired with essential critical load backup battery
              reserve.
            </p>
          </button>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-secondary/30 p-4 rounded-lg">
          {(calcTopology === SolarTopology.ON_GRID || calcTopology === SolarTopology.HYBRID) && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Target Capacity (kWp)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                value={targetCapacityKwp}
                onChange={e => setTargetCapacityKwp(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Module Wattage (Wp)
            </label>
            <input
              type="number"
              step="5"
              min="100"
              value={moduleWattageWp}
              onChange={e => setModuleWattageWp(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Peak Sun Hours (PSH/day)
            </label>
            <input
              type="number"
              step="0.1"
              min="2.0"
              max="8.0"
              value={peakSunHours}
              onChange={e => setPeakSunHours(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Performance Ratio (%)
            </label>
            <input
              type="number"
              step="1"
              min="50"
              max="90"
              value={performanceRatio}
              onChange={e => setPerformanceRatio(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
            />
          </div>

          {(calcTopology === SolarTopology.OFF_GRID || calcTopology === SolarTopology.HYBRID) && (
            <>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Daily Demand / Critical Load (kWh)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={dailyDemandKwh}
                  onChange={e => setDailyDemandKwh(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                />
              </div>

              {calcTopology === SolarTopology.OFF_GRID ? (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Autonomy (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={autonomyDays}
                    onChange={e => setAutonomyDays(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Backup Duration (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={backupHours}
                    onChange={e => setBackupHours(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Battery DoD (%)
                </label>
                <input
                  type="number"
                  min="20"
                  max="95"
                  value={dodPercent}
                  onChange={e => setDodPercent(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Battery Bus Voltage (V)
                </label>
                <select
                  value={systemVoltageV}
                  onChange={e => {
                    setSystemVoltageV(e.target.value);
                    setBatteryUnitVoltageV(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                >
                  <option value="12">12V DC</option>
                  <option value="24">24V DC</option>
                  <option value="48">48V DC (Standard)</option>
                  <option value="96">96V DC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Battery Unit Ah
                </label>
                <input
                  type="number"
                  min="20"
                  max="1000"
                  value={batteryUnitAh}
                  onChange={e => setBatteryUnitAh(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Target DC:AC Ratio
            </label>
            <input
              type="number"
              step="0.05"
              min="1.0"
              max="1.5"
              value={targetDcAcRatio}
              onChange={e => setTargetDcAcRatio(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Specific Inverter (Optional kW)
            </label>
            <input
              type="number"
              step="0.5"
              placeholder="e.g. 8.0"
              value={selectedInverterKw}
              onChange={e => setSelectedInverterKw(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
            />
          </div>
        </div>

        {/* Action Button & Error */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleCalculate}
            disabled={calculating}
            className="inline-flex items-center px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white font-medium text-sm rounded-lg shadow transition-colors disabled:opacity-50"
          >
            <Calculator className="w-4 h-4 mr-2" />
            {calculating ? 'Computing Solar Sizing...' : 'Calculate Sizing Preview'}
          </button>
        </div>

        {calcError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{calcError}</span>
          </div>
        )}

        {/* Calculated Results Banner */}
        {calcResult && (
          <div className="bg-solar-500/5 border border-solar-500/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-semibold text-foreground">
                  Calculated Technical Specifications
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="inline-flex items-center px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded-md hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Save as Official Design
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background p-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground">PV Array DC Capacity</div>
                <div className="text-xl font-bold text-foreground">
                  {calcResult.actualDcCapacityKwp} <span className="text-xs font-normal">kWp</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {calcResult.panelQuantity} modules × {calcResult.moduleWattageWp} Wp
                </div>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground">Inverter Sizing & DC:AC</div>
                <div className="text-xl font-bold text-foreground">
                  {calcResult.recommendedInverterKw} <span className="text-xs font-normal">kW</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Loading Ratio: {calcResult.actualDcAcRatio ?? targetDcAcRatio}
                </div>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground">Daily Generation Yield</div>
                <div className="text-xl font-bold text-solar-600 dark:text-solar-400">
                  {calcResult.estimatedGeneration.dailyGenerationKwh}{' '}
                  <span className="text-xs font-normal">kWh/day</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Annual: {calcResult.estimatedGeneration.annualGenerationKwh.toLocaleString()} kWh
                </div>
              </div>

              {calcResult.batteryStorage ? (
                <div className="bg-background p-3 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Battery Bank Storage</div>
                  <div className="text-xl font-bold text-emerald-600">
                    {calcResult.batteryStorage.requiredStorageKwh}{' '}
                    <span className="text-xs font-normal">kWh</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {calcResult.batteryStorage.batteryQuantity} units (
                    {calcResult.batteryStorage.requiredCapacityAh} Ah)
                  </div>
                </div>
              ) : (
                <div className="bg-background p-3 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Specific Yield</div>
                  <div className="text-xl font-bold text-foreground">
                    {calcResult.estimatedGeneration.specificYieldKwhPerKwp}{' '}
                    <span className="text-xs font-normal">kWh/kWp</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Annualized yield factor
                  </div>
                </div>
              )}
            </div>

            {/* Warnings */}
            {calcResult.warnings && calcResult.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Engineering Sizing Alerts:
                </div>
                {calcResult.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded border border-border flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{calcResult.disclaimer || DISCLAIMER_TEXT}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Existing Saved Designs Directory */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-solar-500" />
            <h2 className="text-lg font-semibold text-foreground">Saved Solar Designs</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={topologyFilter}
              onChange={e => setTopologyFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-input rounded-md"
            >
              <option value="ALL">All Topologies</option>
              <option value={SolarTopology.ON_GRID}>On-Grid</option>
              <option value={SolarTopology.OFF_GRID}>Off-Grid</option>
              <option value={SolarTopology.HYBRID}>Hybrid</option>
            </select>

            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Search design number or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-background border border-input rounded-md w-56"
              />
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            </form>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Loading solar designs...
          </div>
        ) : error ? (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
        ) : designs.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No solar designs recorded yet. Use the sizing calculator above to generate and save
            technical designs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2.5 font-medium">Design #</th>
                  <th className="py-2.5 font-medium">Design Name</th>
                  <th className="py-2.5 font-medium">Topology</th>
                  <th className="py-2.5 font-medium">Capacity</th>
                  <th className="py-2.5 font-medium">Module / Inverter</th>
                  <th className="py-2.5 font-medium">Annual Yield</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {designs.map(d => (
                  <tr key={d._id} className="hover:bg-muted/30">
                    <td className="py-3 font-mono font-medium text-solar-600 dark:text-solar-400">
                      {d.designNumber}
                    </td>
                    <td className="py-3 font-medium text-foreground">{d.designName}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground font-medium">
                        {d.systemTopology}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-foreground">
                      {d.proposedCapacityKwp} kWp
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {d.module.quantity}× {d.module.wattageWp}Wp | {d.inverter.ratedCapacityKw}kW
                      (DC:AC {d.inverter.actualDcAcRatio})
                    </td>
                    <td className="py-3 text-xs text-foreground">
                      {d.estimatedGeneration?.annualGenerationKwh?.toLocaleString() || '—'} kWh
                    </td>
                    <td className="py-3 text-right">
                      <a
                        href={`/quotations?designId=${d._id}`}
                        className="inline-flex items-center text-xs font-medium text-solar-600 hover:text-solar-700"
                      >
                        Create Quotation
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Design Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sun className="w-5 h-5 text-solar-500" />
              Save Solar System Design
            </h3>
            <p className="text-xs text-muted-foreground">
              Persist this validated sizing calculation into the repository with sequence code and
              audit trail.
            </p>

            <form onSubmit={handleSaveDesign} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Customer Account {!saveLeadId && <span className="text-destructive">*</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setManualCustomerEntry(!manualCustomerEntry)}
                    className="text-[10px] text-solar-600 dark:text-solar-400 hover:underline"
                  >
                    {manualCustomerEntry ? '← Select Customer' : 'Custom Code'}
                  </button>
                </div>
                {!manualCustomerEntry ? (
                  <select
                    value={saveCustomerId}
                    onChange={e => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                  >
                    <option value="">
                      {loadingContext
                        ? 'Loading registered customers...'
                        : '-- Select Registered Customer --'}
                    </option>
                    {availableCustomers.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.customerCode || 'CUST'} — {c.legalName || c.name} (
                        {c.primaryPhone || c.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter Customer Code (e.g. CUST-2026-00001) or ID"
                    value={saveCustomerId}
                    onChange={e => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                  />
                )}
                {saveLeadId && saveCustomerId && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ✓ Automatically synchronized with Lead account
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Originating Lead {!saveCustomerId && <span className="text-destructive">*</span>}
                </label>
                <select
                  value={saveLeadId}
                  onChange={e => handleLeadChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                >
                  <option value="">-- None (Direct Design) --</option>
                  {availableLeads.map(l => (
                    <option key={l.id || l._id} value={l.id || l._id}>
                      {l.leadCode} — {l.prospectName} ({l.prospectPhone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Design Name *
                </label>
                <input
                  type="text"
                  required
                  value={saveDesignName}
                  onChange={e => setSaveDesignName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Engineering Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Mounting specifics, shadow orientation details, cable run distance..."
                  value={saveNotes}
                  onChange={e => setSaveNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md"
                />
              </div>

              {saveError && (
                <div className="p-2.5 bg-destructive/10 text-destructive text-xs rounded">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 text-xs rounded">
                  {saveSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-medium rounded-md shadow"
                >
                  {saving ? 'Saving...' : 'Confirm & Save Design'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
