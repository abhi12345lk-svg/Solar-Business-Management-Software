/**
 * INS Solar ERP — Field Installer Workstation & Dashboard
 * Dedicated operational dashboard for field installers and technical crews.
 * 100% aligned with actual software modules: Customer Directory, Barcode Register, Site Photos, Handover Docs, and Vault.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Camera,
  FolderLock,
  UserCheck,
  ArrowRight,
  MapPin,
  Phone,
  Barcode,
  ClipboardCheck,
  Zap
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';
import { DateFilterRange } from './dashboardUtils.js';

interface InstallerDashboardProps {
  dateRange: DateFilterRange;
}

export const InstallerDashboard: React.FC<InstallerDashboardProps> = () => {
  // Fetch real customers from database
  const { data: customers = [], isLoading: loadingCustomers } = useQuery<any[]>({
    queryKey: ['installerCustomers'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/customers?limit=50');
        return Array.isArray(res) ? res : res?.data || res?.items || [];
      } catch {
        return [];
      }
    }
  });

  // Fetch recent documents count
  const { data: documentsCount = 0 } = useQuery<number>({
    queryKey: ['installerDocumentsCount'],
    queryFn: async () => {
      try {
        const res = await apiClient<any>('/documents?limit=1');
        return res?.meta?.totalRecords || res?.total || 0;
      } catch {
        return 0;
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* 1. Key Operational Metric KPI Cards (4 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Registered Clients */}
        <Link
          to="/customers"
          className="p-5 bg-card rounded-2xl border border-border hover:border-blue-500/50 hover:shadow-md transition shadow-xs group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              Directory
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-foreground group-hover:text-blue-600 transition">
              {customers.length}
            </div>
            <div className="text-xs font-bold text-foreground mt-0.5">Registered Clients</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Consumer KYC &amp; site addresses</div>
          </div>
        </Link>

        {/* KPI 2: Equipment & Barcodes */}
        <Link
          to="/equipment-barcodes"
          className="p-5 bg-card rounded-2xl border border-border hover:border-solar-500/50 hover:shadow-md transition shadow-xs group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <Barcode className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-solar-700 dark:text-solar-400 bg-solar-500/10 px-2 py-0.5 rounded-full border border-solar-500/20">
              Hardware
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-foreground group-hover:text-solar-600 transition">
              Barcode Register
            </div>
            <div className="text-xs font-bold text-foreground mt-0.5">Inverters &amp; PV Modules</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Live camera scanner &amp; serials</div>
          </div>
        </Link>

        {/* KPI 3: Site Inspection Photos */}
        <Link
          to="/site-photos"
          className="p-5 bg-card rounded-2xl border border-border hover:border-orange-500/50 hover:shadow-md transition shadow-xs group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
              Field Photos
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-foreground group-hover:text-orange-600 transition">
              5-Point Report
            </div>
            <div className="text-xs font-bold text-foreground mt-0.5">Site Inspection Photos</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">PM Surya Ghar GPS geotags &amp; A4 doc</div>
          </div>
        </Link>

        {/* KPI 4: Document Vault & JCR */}
        <Link
          to="/documents"
          className="p-5 bg-card rounded-2xl border border-border hover:border-emerald-500/50 hover:shadow-md transition shadow-xs group flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <FolderLock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Compliance
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-foreground group-hover:text-emerald-600 transition">
              {documentsCount} Filed
            </div>
            <div className="text-xs font-bold text-foreground mt-0.5">Document Vault</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">JCR, Handover &amp; DISCOM dossiers</div>
          </div>
        </Link>
      </div>

      {/* 2. On-Site Installation Workflow Stages (Chronological Step-by-Step Flow) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center space-x-2">
              <Zap className="w-4 h-4 text-solar-600" />
              <span>Official Solar EPC Installation Workflow</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Sequential 4-stage process: Equipment Barcodes ➔ Geotagged Photos ➔ Handover Dossiers ➔ DISCOM Net Meter (BM) Sync
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stage 1: Equipment & Panel Barcodes */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs hover:border-solar-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                  <Barcode className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-solar-500/15 text-solar-700 dark:text-solar-400 border border-solar-500/30">
                  Step 1 • Hardware
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Equipment &amp; Barcodes</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Record on-grid inverter model and scan individual barcodes for every solar PV module using camera scanner.
                </p>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                <li>Solar PV Module serial numbers register</li>
                <li>Inverter brand, model &amp; rated kWp</li>
                <li>Live camera barcode scanner &amp; CSV export</li>
              </ul>
            </div>
            <Link
              to="/equipment-barcodes"
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Barcode className="w-4 h-4" />
              <span>Open Barcode Register</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {/* Stage 2: Site Inspection Photos */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs hover:border-orange-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30">
                  Step 2 • Geotags
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Site Inspection Photos</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Capture 5 mandatory geo-tagged photos with live GPS stamp, company seal, and generate official A4 report.
                </p>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                <li>Array, Inverter, Net Meter, Earthing &amp; LA</li>
                <li>Live device GPS coordinates &amp; timestamp</li>
                <li>Printable official A4 compliance PDF report</li>
              </ul>
            </div>
            <Link
              to="/site-photos"
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Open Inspection Photos</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {/* Stage 3: After-Installation Documents */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs hover:border-emerald-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  Step 3 • Handover
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Handover Documents</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Complete technical handover dossiers, DISCOM joint inspection reports, and net meter test verification.
                </p>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                <li>Customer Handover &amp; Work Completion Certificate</li>
                <li>Joint Commissioning Report (JCR for DISCOM)</li>
                <li>Net Meter Testing Slip &amp; As-Built SLD</li>
              </ul>
            </div>
            <Link
              to="/installation-docs"
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Open Handover Docs</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          {/* Stage 4: Net Metering & BM Installation */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs hover:border-cyan-500/40 transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30">
                  Step 4 • BM Sync
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Net Metering &amp; BM Sync</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Record official Bi-directional Net Meter (BM Number), initial 0000 import/export readings &amp; DISCOM JE inspection.
                </p>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                <li>Bi-directional Meter (BM) Serial Number</li>
                <li>Initial 0000 kWh import &amp; export readings</li>
                <li>DISCOM JE test slip &amp; meter handover</li>
              </ul>
            </div>
            <Link
              to="/net-metering"
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Open Net Meter Register</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Assigned Solar Clients Quick Workstation Launcher */}
      <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Assigned Solar Consumer Sites
              </h3>
              <p className="text-xs text-muted-foreground">
                Select any consumer to immediately launch their barcodes, photos, or handover docs
              </p>
            </div>
          </div>
          <Link
            to="/customers"
            className="text-xs font-bold text-solar-600 hover:text-solar-700 flex items-center space-x-1"
          >
            <span>View Full Customer Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingCustomers ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading assigned clients...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No assigned clients found.</div>
        ) : (
          <div className="divide-y divide-border">
            {customers.slice(0, 6).map(cust => {
              const custId = cust._id || cust.id;
              const addr = cust.installationAddress || cust.billingAddress || cust.address;
              const city = addr?.city || addr?.district || 'Raipur';
              const state = addr?.state || 'Chhattisgarh';
              const street = addr?.addressLine1 || addr?.street || '';
              const capacity = cust.sanctionedLoadKw || cust.systemCapacityKw || '3';

              return (
                <div
                  key={custId}
                  className="p-4 hover:bg-muted/40 transition flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {cust.name || cust.companyName}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-solar-700 bg-solar-500/15 px-2 py-0.5 rounded border border-solar-500/30 shrink-0">
                        {cust.customerCode || 'CUST'}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        ⚡ {capacity} kWp
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center space-x-3 mt-1 flex-wrap">
                      {cust.primaryPhone && (
                        <span className="flex items-center text-muted-foreground font-mono">
                          <Phone className="w-3 h-3 mr-1 text-muted-foreground/70" />
                          {cust.primaryPhone}
                        </span>
                      )}
                      <span className="flex items-center text-muted-foreground">
                        <MapPin className="w-3 h-3 mr-1 text-muted-foreground/70" />
                        {street ? `${street}, ` : ''}{city}, {state}
                      </span>
                    </div>
                  </div>

                  {/* 1-Click Launchers for each step */}
                  <div className="flex items-center space-x-1.5 shrink-0 flex-wrap gap-y-1.5">
                    <Link
                      to={`/equipment-barcodes?customerId=${custId}`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-solar-500/10 hover:bg-solar-500/20 text-solar-700 dark:text-solar-400 border border-solar-500/30 text-[11px] font-bold transition cursor-pointer"
                      title="Open Equipment & Barcodes Register"
                    >
                      <Barcode className="w-3 h-3" />
                      <span>Barcodes</span>
                    </Link>

                    <Link
                      to={`/site-photos?customerId=${custId}`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30 text-[11px] font-bold transition cursor-pointer"
                      title="Open Site Inspection Photos"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Photos</span>
                    </Link>

                    <Link
                      to={`/installation-docs?customerId=${custId}`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
                      title="Open After-Installation Documents"
                    >
                      <ClipboardCheck className="w-3 h-3" />
                      <span>Handover</span>
                    </Link>

                    <Link
                      to={`/documents`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-[11px] font-semibold transition cursor-pointer"
                      title="Open Document Vault"
                    >
                      <FolderLock className="w-3 h-3 text-muted-foreground" />
                      <span>Vault</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
