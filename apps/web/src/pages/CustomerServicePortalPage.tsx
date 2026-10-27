/**
 * INS Solar Business Management Software — Customer Service Portal Page
 *
 * Self-service portal view for solar plant owners:
 * - Register break-fix complaints and track resolution progress in real time
 * - View public progress updates (strictly stripped of internal confidential notes)
 * - View serialized equipment warranty cards with expiry status
 * - View active AMC maintenance contracts and remaining visit quota
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  ShieldCheck,
  FileCheck2,
  Plus,
  CheckCircle2,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

export const CustomerServicePortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COMPLAINTS' | 'WARRANTIES' | 'AMC'>('COMPLAINTS');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [amcs, setAmcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New complaint form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    projectId: '',
    title: '',
    description: '',
    category: 'INVERTER_FAULT',
    preferredVisitTime: 'Morning (9 AM - 12 PM)',
    contactPreference: 'PHONE'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (activeTab === 'COMPLAINTS') {
        const res = await apiClient<any>('/customer-portal/service/complaints');
        setComplaints(res?.items || res?.complaints || res?.data?.items || []);
      } else if (activeTab === 'WARRANTIES') {
        const res = await apiClient<any>('/customer-portal/service/warranties');
        setWarranties(res?.items || res?.equipment || res?.warranties || res?.data?.items || []);
      } else if (activeTab === 'AMC') {
        const res = await apiClient<any>('/customer-portal/service/amc');
        setAmcs(res?.items || res?.contracts || res?.amcs || res?.data?.items || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer service records.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegisterComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient('/customer-portal/service/complaints', {
        method: 'POST',
        body: JSON.stringify(complaintForm)
      });
      setShowCreateModal(false);
      setComplaintForm({
        projectId: '',
        title: '',
        description: '',
        category: 'INVERTER_FAULT',
        preferredVisitTime: 'Morning (9 AM - 12 PM)',
        contactPreference: 'PHONE'
      });
      fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to submit service request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'TRIAGED':
      case 'ASSIGNED':
      case 'VISIT_SCHEDULED':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'IN_PROGRESS':
        return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default:
        return 'bg-secondary text-secondary-foreground border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-solar-500/10 border border-solar-500/30 rounded-lg text-solar-600">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Customer Service & Support Portal</h1>
              <p className="text-sm text-muted-foreground">
                Track ticket resolution progress, plant maintenance visits, and equipment warranties
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 transition shadow-sm text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Request Service / Report Issue
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('COMPLAINTS')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'COMPLAINTS'
              ? 'border-b-2 border-solar-600 text-solar-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          My Service Complaints
        </button>

        <button
          onClick={() => setActiveTab('WARRANTIES')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'WARRANTIES'
              ? 'border-b-2 border-solar-600 text-solar-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Installed Equipment Warranties
        </button>

        <button
          onClick={() => setActiveTab('AMC')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'AMC'
              ? 'border-b-2 border-solar-600 text-solar-600'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Annual Maintenance (AMC)
        </button>
      </div>

      {/* Content based on Tab */}
      {activeTab === 'COMPLAINTS' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
              Loading service tickets...
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              <div className="text-base font-semibold text-foreground">No Active Service Tickets</div>
              <div className="text-xs text-muted-foreground mt-1">
                Your solar installation is operating normally. If you notice lower generation or an inverter fault, request service above.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {complaints.map(item => (
                <div key={item._id} className="p-5 border rounded-xl bg-card shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-solar-600 text-sm">{item.complaintNumber}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border font-medium ${getStatusBadge(item.status)}`}>
                      {item.status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  </div>

                  {item.customerUpdates && item.customerUpdates.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-solar-500" />
                        Technician Updates
                      </div>
                      <div className="space-y-1">
                        {item.customerUpdates.map((upd: any, idx: number) => (
                          <div key={idx} className="text-xs bg-muted/40 p-2 rounded text-foreground">
                            {upd.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.resolutionSummary && (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-600">
                      <span className="font-semibold">Resolution: </span>
                      {item.resolutionSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'WARRANTIES' && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-3">Component / Serial</th>
                <th className="px-4 py-3">Equipment Model</th>
                <th className="px-4 py-3">Warranty Expiry</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
                    Loading warranties...
                  </td>
                </tr>
              ) : warranties.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-muted-foreground">
                    No serialized solar hardware linked to your profile.
                  </td>
                </tr>
              ) : (
                warranties.map(item => (
                  <tr key={item._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{item.serialNumber}</td>
                    <td className="px-4 py-3 text-foreground">{item.productId?.name || 'Solar Hardware'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.warrantyEndDate ? new Date(item.warrantyEndDate).toISOString().split('T')[0] : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          item.isExpired ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                      >
                        {item.isExpired ? 'EXPIRED' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'AMC' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-solar-500" />
              Loading maintenance contracts...
            </div>
          ) : amcs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
              No active maintenance contracts on your account.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {amcs.map(contract => (
                <div key={contract._id} className="p-5 border rounded-xl bg-card shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-solar-600">{contract.amcNumber}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs border font-medium bg-emerald-500/10 text-emerald-500">
                      {contract.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-base font-bold text-foreground">{contract.planType} Plan</div>
                    <div className="text-xs text-muted-foreground">
                      Valid: {new Date(contract.startDate).toISOString().split('T')[0]} to{' '}
                      {new Date(contract.endDate).toISOString().split('T')[0]}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Included Visits Quota</span>
                      <span className="font-bold text-foreground">
                        {contract.consumedVisits} / {contract.includedVisits} Used
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-solar-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((contract.consumedVisits / Math.max(1, contract.includedVisits)) * 100)
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Request Service / Register Complaint */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-solar-500" />
                Submit Service Request
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterComplaint} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Solar Project Code / ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your solar project ID"
                  value={complaintForm.projectId}
                  onChange={e => setComplaintForm({ ...complaintForm, projectId: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Issue Summary *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Red fault LED on inverter, zero generation"
                  value={complaintForm.title}
                  onChange={e => setComplaintForm({ ...complaintForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Detailed Observations *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe when the issue began, any audible beeps, inverter display codes, or solar app readings..."
                  value={complaintForm.description}
                  onChange={e => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                  <select
                    value={complaintForm.category}
                    onChange={e => setComplaintForm({ ...complaintForm, category: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="INVERTER_FAULT">Inverter Fault</option>
                    <option value="PANEL_ISSUE">Panel / Soiling</option>
                    <option value="GRID_TRIP">Grid Trip</option>
                    <option value="MONITORING_OFFLINE">Monitoring Offline</option>
                    <option value="OTHER">Other Issue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Method</label>
                  <select
                    value={complaintForm.contactPreference}
                    onChange={e => setComplaintForm({ ...complaintForm, contactPreference: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border bg-background focus:outline-none"
                  >
                    <option value="PHONE">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-md border text-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-solar-600 text-white font-medium hover:bg-solar-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
