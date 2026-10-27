/**
 * INS Solar Business Management Software — Project Service & AMC Tab
 *
 * Integrated project view for post-installation service, warranty, and AMC operations:
 * - Active AMC contract summary with included-visit quota meter
 * - Project service complaints history & status pipeline
 * - Field technician visits scheduled and executed
 * - Installed serialized hardware warranties & expiry status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy,
  ShieldCheck,
  FileCheck2,
  Wrench,
  ArrowRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';

interface ServiceAmcTabProps {
  projectId: string;
  isTerminal?: boolean;
}

export const ServiceAmcTab: React.FC<ServiceAmcTabProps> = ({ projectId }) => {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [amcs, setAmcs] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [compRes, warRes, amcRes, visRes] = await Promise.all([
        apiClient<any>(`/complaints?projectId=${projectId}&limit=5`).catch(() => ({ data: { items: [] } })),
        apiClient<any>(`/warranties?projectId=${projectId}&limit=5`).catch(() => ({ data: { items: [] } })),
        apiClient<any>(`/amc?projectId=${projectId}&limit=5`).catch(() => ({ data: { items: [] } })),
        apiClient<any>(`/service-visits?projectId=${projectId}&limit=5`).catch(() => ({ data: { items: [] } }))
      ]);

      setComplaints(compRes?.items || compRes?.complaints || compRes?.data?.items || []);
      setWarranties(warRes?.items || warRes?.warranties || warRes?.data?.items || []);
      setAmcs(amcRes?.items || amcRes?.contracts || amcRes?.amcs || amcRes?.data?.items || []);
      setVisits(visRes?.items || visRes?.visits || visRes?.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeAmc = amcs.find(a => a.status === 'ACTIVE') || amcs[0];

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground border rounded-xl bg-card">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
        Loading service, warranty & AMC records for this project...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AMC Overview Card */}
        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">AMC Agreement</span>
            <FileCheck2 className="w-4 h-4 text-solar-500" />
          </div>

          {activeAmc ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-solar-600">{activeAmc.amcNumber}</span>
                <span className="px-2 py-0.5 rounded text-xs font-medium border bg-emerald-500/10 text-emerald-500">
                  {activeAmc.status}
                </span>
              </div>
              <div className="text-sm font-bold text-foreground">{activeAmc.planType} Plan</div>

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Visit Quota Utilization</span>
                  <span className="font-semibold text-foreground">
                    {activeAmc.consumedVisits} / {activeAmc.includedVisits} Visits
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-solar-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((activeAmc.consumedVisits / Math.max(1, activeAmc.includedVisits)) * 100)
                      )}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground py-2">
              No active Annual Maintenance Contract attached to this project.
            </div>
          )}

          <div className="border-t pt-2">
            <Link to="/amc" className="text-xs font-medium text-solar-600 hover:underline flex items-center gap-1">
              Manage AMC Contracts <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Complaints Summary Card */}
        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Service Complaints</span>
            <LifeBuoy className="w-4 h-4 text-solar-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <div className="text-2xl font-bold text-foreground">{complaints.length}</div>
            <span className="text-xs text-muted-foreground">tickets logged</span>
          </div>

          <div className="space-y-1">
            {complaints.slice(0, 2).map((c: any) => (
              <div key={c._id} className="text-xs flex items-center justify-between py-1 border-b border-border/50">
                <span className="font-medium truncate max-w-[150px]">{c.title}</span>
                <span className="text-[11px] font-semibold text-solar-600">{c.status}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-2">
            <Link to="/complaints" className="text-xs font-medium text-solar-600 hover:underline flex items-center gap-1">
              View Complaints Register <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Warranties Summary Card */}
        <div className="p-5 border rounded-xl bg-card shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Hardware Warranties</span>
            <ShieldCheck className="w-4 h-4 text-solar-500" />
          </div>

          <div className="flex items-baseline space-x-2">
            <div className="text-2xl font-bold text-foreground">{warranties.length}</div>
            <span className="text-xs text-muted-foreground">serialized components</span>
          </div>

          <div className="space-y-1">
            {warranties.slice(0, 2).map((w: any) => (
              <div key={w._id} className="text-xs flex items-center justify-between py-1 border-b border-border/50">
                <span className="font-mono truncate max-w-[150px]">{w.serialNumber}</span>
                <span
                  className={`text-[11px] font-semibold ${
                    w.isExpired ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  {w.isExpired ? 'EXPIRED' : 'ACTIVE'}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-2">
            <Link to="/warranties" className="text-xs font-medium text-solar-600 hover:underline flex items-center gap-1">
              View Warranty Cards <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Field Service Visits Schedule */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-solar-500" />
            <h3 className="text-sm font-bold text-foreground">Field Service & Maintenance Visits</h3>
          </div>
          <Link
            to="/service-visits"
            className="text-xs font-medium text-solar-600 hover:underline flex items-center gap-1"
          >
            All Visits Calendar <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-2.5">Visit #</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Technician</th>
                <th className="px-4 py-2.5">Scheduled Slot</th>
                <th className="px-4 py-2.5">Purpose</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                    No field technician visits scheduled for this project.
                  </td>
                </tr>
              ) : (
                visits.map(v => (
                  <tr key={v._id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-semibold text-solar-600 text-xs">{v.visitNumber}</td>
                    <td className="px-4 py-2.5 text-xs">{v.visitType?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      {v.assignedTechnicianId
                        ? `${v.assignedTechnicianId.firstName} ${v.assignedTechnicianId.lastName}`
                        : 'Unassigned'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {v.scheduledDate ? new Date(v.scheduledDate).toISOString().split('T')[0] : 'N/A'}{' '}
                      ({v.scheduledTimeSlot})
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-xs truncate">{v.purpose}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium border bg-secondary">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
