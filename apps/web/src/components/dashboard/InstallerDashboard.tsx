/**
 * INS Solar ERP — Field Installer Workstation & Dashboard
 * Dedicated operational dashboard for field installers and technical teams.
 * Highlights: Site Photos Compliance Document, Customer Directory, Document Vault, Site Surveys.
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
  FilePlus2
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
      {/* 1. Field Operations Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600 via-solar-600 to-amber-700 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider">
              <Camera className="w-3.5 h-3.5 text-amber-200" />
              <span>Field Operations &amp; Site Compliance Workstation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Field Execution &amp; Site Documentation Hub
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed">
              Generate PM Surya Ghar &amp; DISCOM rooftop site photo reports with live GPS coordinates, verified company seal, and direct customer vault integration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/site-photos"
              className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white text-solar-800 font-bold text-sm shadow-md hover:bg-amber-50 transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-solar-600" />
              <span>Generate Site Photos Doc</span>
              <ArrowRight className="w-4 h-4 text-solar-600" />
            </Link>
            <Link
              to="/documents"
              className="inline-flex items-center space-x-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-sm border border-white/20 transition cursor-pointer"
            >
              <FolderLock className="w-4 h-4 text-amber-200" />
              <span>Document Vault</span>
            </Link>
          </div>
        </div>

        {/* Decorative backdrop elements */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-48 h-48 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />
      </div>

      {/* 2. Key Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Site Photos Compliance */}
        <Link
          to="/site-photos"
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-solar-400 transition shadow-xs group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-solar-50 text-solar-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Active Module
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 group-hover:text-solar-600 transition">
            Site Photos Doc
          </div>
          <div className="text-xs text-slate-500 mt-1">
            4-photo PM Surya Ghar compliance format
          </div>
        </Link>

        {/* Metric 2: Registered Clients */}
        <Link
          to="/customers"
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 transition shadow-xs group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400">Database</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{customers.length}</div>
          <div className="text-xs text-slate-500 mt-1">Registered solar consumers</div>
        </Link>

        {/* Metric 3: Vault Documents */}
        <Link
          to="/documents"
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-xs group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold group-hover:scale-105 transition">
              <FolderLock className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400">Vault</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{documentsCount}</div>
          <div className="text-xs text-slate-500 mt-1">Approved &amp; filed documents</div>
        </Link>
      </div>

      {/* 3. Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card A: Client Site Photos Document Generator */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Client Site Photos Compliance Generator
                </h3>
                <p className="text-xs text-slate-500">Document format: SITE PHOTOS AT &lt;CLIENT&gt;</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Standard 4-photo field documentation format strictly tailored for DISCOM subsidy inspection and technical handover:
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
              <li>1. Solar PV Rooftop Array &amp; Beneficiary View</li>
              <li>2. Chemical Earthing Pits &amp; Grounding Chambers</li>
              <li>3. On-Grid Inverter, ACDB &amp; DCDB Distribution Junction</li>
              <li>4. Lightning Arrester (LA) &amp; Terrace Grounding Earthing</li>
            </ul>
          </div>

          <Link
            to="/site-photos"
            className="w-full inline-flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Open Site Photos Document Generator</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {/* Card B: Create Document Generator */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                <FilePlus2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  PM Surya Ghar Compliance Documents
                </h3>
                <p className="text-xs text-slate-500">Agreements, WCR &amp; Bank Undertakings</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instantly draft and generate official PM Surya Ghar scheme documentation with certified company seal:
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
              <li>Annexure 2 — Consumer &amp; Vendor RTS Agreement</li>
              <li>Annexure A — DCR Undertaking / Self-Declaration</li>
              <li>Work Completion Report (WCR) &amp; Handover Certificate</li>
              <li>CSPDCL Grid Connectivity Application (LV Connection)</li>
            </ul>
          </div>

          <Link
            to="/create-document"
            className="w-full inline-flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4 text-solar-600" />
            <span>Open Document Template Generator</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      {/* 4. Registered Solar Consumers Quick Directory */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-solar-50 text-solar-700 flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Registered Solar Clients Directory
              </h3>
              <p className="text-xs text-slate-500">
                Select a client to autofill and generate their site photo report
              </p>
            </div>
          </div>
          <Link
            to="/customers"
            className="text-xs font-bold text-solar-600 hover:text-solar-700 flex items-center space-x-1"
          >
            <span>View All Clients</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingCustomers ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading registered clients...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No registered clients found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {customers.slice(0, 6).map(cust => {
              const custId = cust._id || cust.id;
              const addr = cust.installationAddress || cust.billingAddress || cust.address;
              const city = addr?.city || addr?.district || 'Raipur';
              const state = addr?.state || 'Chhattisgarh';
              const street = addr?.addressLine1 || addr?.street || '';

              return (
                <div
                  key={custId}
                  className="p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {cust.name || cust.companyName}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-solar-700 bg-solar-50 px-1.5 py-0.5 rounded border border-solar-200 shrink-0">
                        {cust.customerCode || 'CUST'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center space-x-3 mt-0.5">
                      {cust.primaryPhone && (
                        <span className="flex items-center text-slate-500">
                          <Phone className="w-3 h-3 mr-1 text-slate-400" />
                          {cust.primaryPhone}
                        </span>
                      )}
                      <span className="flex items-center text-slate-400">
                        <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                        {street ? `${street}, ` : ''}{city}, {state}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/site-photos?customerId=${custId}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition self-start sm:self-auto cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-600" />
                    <span>Create Site Photos</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
