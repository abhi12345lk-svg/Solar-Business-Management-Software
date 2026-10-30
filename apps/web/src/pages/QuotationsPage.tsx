import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api.js';
import { QuotationStatus, SolarTopology, QuotationItemType } from '@ins-solar/shared';

interface QuotationListItem {
  _id: string;
  quotationNumber: string;
  revisionNumber: number;
  fullQuotationCode: string;
  isLatestRevision: boolean;
  status: QuotationStatus;
  systemTopology: SolarTopology;
  systemCapacityKwp: number;
  grossSubtotalPaise: number;
  additionalDiscountPaise: number;
  totalDiscountPaise: number;
  discountPercent: number;
  requiresDiscountApproval: boolean;
  discountApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
  taxableAmountPaise: number;
  totalTaxPaise: number;
  netTotalPaise: number;
  validUntil: string;
  createdAt: string;
  customerId: {
    _id: string;
    legalName?: string;
    customerCode?: string;
  };
  createdBy: {
    firstName?: string;
    lastName?: string;
  };
}

export const QuotationsPage: React.FC = () => {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'ALL' | 'PENDING_APPROVAL' | 'SENT' | 'ACCEPTED' | 'DRAFT'
  >('ALL');
  const [search, setSearch] = useState('');

  // Create Quotation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // CRM context for dropdowns
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [manualCustomerEntry, setManualCustomerEntry] = useState(false);

  // Form Fields for new quotation
  const [customerId, setCustomerId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [topology, setTopology] = useState<SolarTopology>(SolarTopology.ON_GRID);
  const [capacityKwp, setCapacityKwp] = useState('10.0');
  const [panelDesc, setPanelDesc] = useState('550Wp Mono Perc Solar Module');
  const [panelQty, setPanelQty] = useState('19');
  const [panelRateRs, setPanelRateRs] = useState('14500'); // in Rupees
  const [inverterDesc, setInverterDesc] = useState('8kW On-Grid Solar Inverter');
  const [inverterQty, setInverterQty] = useState('1');
  const [inverterRateRs, setInverterRateRs] = useState('65000');
  const [additionalDiscountRs, setAdditionalDiscountRs] = useState('0');
  const [validDays, setValidDays] = useState('30');

  const fetchQuotations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'PENDING_APPROVAL') {
        params.set('requiresDiscountApproval', 'true');
      } else if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');

      const data = await apiClient<QuotationListItem[]>(`/quotations?${params.toString()}`);
      setQuotations(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [activeTab]);

  useEffect(() => {
    if (showCreateModal && availableCustomers.length === 0) {
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
  }, [showCreateModal]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuotations();
  };

  const handleLeadChange = (selectedLeadId: string) => {
    setLeadId(selectedLeadId);
    if (!selectedLeadId) return;

    const matchedLead = availableLeads.find(l => (l.id || l._id) === selectedLeadId);
    if (!matchedLead) return;

    const linkedCustId = matchedLead.convertedCustomerId || matchedLead.customerId;
    if (linkedCustId) {
      const matchedCust = availableCustomers.find(
        c => (c._id || c.id) === linkedCustId || c.customerCode === linkedCustId
      );
      if (matchedCust) {
        setCustomerId(matchedCust._id || matchedCust.id);
        setManualCustomerEntry(false);
        return;
      }
      setCustomerId(linkedCustId);
      return;
    }

    const matchedByPhone = availableCustomers.find(
      c =>
        (c.primaryPhone &&
          matchedLead.prospectPhone &&
          c.primaryPhone === matchedLead.prospectPhone) ||
        (c.legalName &&
          matchedLead.prospectName &&
          c.legalName.toLowerCase() === matchedLead.prospectName.toLowerCase()) ||
        (c.name &&
          matchedLead.prospectName &&
          c.name.toLowerCase() === matchedLead.prospectName.toLowerCase())
    );
    if (matchedByPhone) {
      setCustomerId(matchedByPhone._id || matchedByPhone.id);
      setManualCustomerEntry(false);
    }
  };

  const handleCustomerChange = (selectedCustId: string) => {
    setCustomerId(selectedCustId);
    if (!selectedCustId || leadId) return;

    const matchedCust = availableCustomers.find(c => (c._id || c.id) === selectedCustId);
    if (!matchedCust) return;

    const matchedLead = availableLeads.find(
      l =>
        l.convertedCustomerId === selectedCustId ||
        l.customerId === selectedCustId ||
        (l.prospectPhone &&
          matchedCust.primaryPhone &&
          l.prospectPhone === matchedCust.primaryPhone)
    );
    if (matchedLead) {
      setLeadId(matchedLead.id || matchedLead._id);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId.trim() && !leadId.trim()) {
      setCreateError('Please select either a Customer Account or an Originating Lead.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const lineItems = [
        {
          itemType: QuotationItemType.SOLAR_MODULE,
          description: panelDesc.trim(),
          quantity: Number(panelQty),
          unit: 'Nos',
          unitRatePaise: Math.round(Number(panelRateRs) * 100),
          discountPaise: 0,
          gstRateBasisPoints: 1200 // 12% GST standard on solar hardware
        },
        {
          itemType: QuotationItemType.INVERTER,
          description: inverterDesc.trim(),
          quantity: Number(inverterQty),
          unit: 'Nos',
          unitRatePaise: Math.round(Number(inverterRateRs) * 100),
          discountPaise: 0,
          gstRateBasisPoints: 1800 // 18% GST standard on inverters
        }
      ];

      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + Number(validDays));

      const payload = {
        customerId: customerId.trim() || undefined,
        leadId: leadId.trim() || undefined,
        systemTopology: topology,
        systemCapacityKwp: Number(capacityKwp),
        validUntil: validUntilDate.toISOString(),
        lineItems,
        additionalDiscountPaise: Math.round(Number(additionalDiscountRs) * 100),
        taxProfile: {
          profileName: 'Standard Indian Solar EPC Tax Profile',
          profileCode: 'GST-EPC-STD-2026',
          effectiveDate: '2026-04-01',
          isInterState: false,
          accountingNotice:
            'Pre-commercial quotation; final GST classification must be confirmed by qualified chartered accountant.'
        },
        paymentMilestones: [
          {
            milestoneName: 'Booking Advance',
            percentage: 20,
            dueTrigger: 'Upon confirmation of order'
          },
          {
            milestoneName: 'Pre-Dispatch',
            percentage: 70,
            dueTrigger: 'Prior to material dispatch from warehouse'
          },
          {
            milestoneName: 'Commissioning',
            percentage: 10,
            dueTrigger: 'Post physical installation and net-meter testing'
          }
        ],
        termsAndConditions: [
          'Prices are valid for 30 days from proposal generation.',
          'Statutory net metering approvals and CEIG clearance subject to local DISCOM norms.'
        ]
      };

      await apiClient('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
      fetchQuotations();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create quotation.');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case QuotationStatus.DRAFT:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            Draft
          </span>
        );
      case QuotationStatus.PENDING_APPROVAL:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Pending Discount Approval
          </span>
        );
      case QuotationStatus.APPROVED:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            Discount Approved
          </span>
        );
      case QuotationStatus.SENT:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            Sent to Customer
          </span>
        );
      case QuotationStatus.ACCEPTED:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Customer Accepted
          </span>
        );
      case QuotationStatus.REJECTED:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            Declined
          </span>
        );
      case QuotationStatus.REVISED:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Superseded (Revised)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-solar-500" />
            Quotations & Commercial Proposals
          </h1>
          <p className="text-sm text-muted-foreground">
            Immutable quotation revision tracking (QT-YYYY-NNNNN-Rx), integer-paise financial
            engine, and approval control.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white font-medium text-sm rounded-lg shadow transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Quotation
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Quotations' },
            { id: 'PENDING_APPROVAL', label: 'Discount Approval Queue' },
            { id: 'SENT', label: 'Sent to Customer' },
            { id: 'ACCEPTED', label: 'Accepted' },
            { id: 'DRAFT', label: 'Drafts' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-solar-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search code or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-background border border-input rounded-md w-56"
          />
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
        </form>
      </div>

      {/* Quotations Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Loading commercial quotations...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-destructive">{error}</div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
            <div className="text-sm font-medium text-foreground">No quotations found</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeTab === 'PENDING_APPROVAL'
                ? 'No quotations currently awaiting commercial discount approval.'
                : 'Create a new quotation or generate one directly from a saved solar sizing design.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Quotation Code</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Topology / Size</th>
                  <th className="py-3 px-4 font-medium text-right">Gross Subtotal</th>
                  <th className="py-3 px-4 font-medium text-right">Discount</th>
                  <th className="py-3 px-4 font-medium text-right">Net Payable</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotations.map(q => {
                  const grossRs = (q.grossSubtotalPaise / 100).toLocaleString('en-IN', {
                    maximumFractionDigits: 2
                  });
                  const netRs = (q.netTotalPaise / 100).toLocaleString('en-IN', {
                    maximumFractionDigits: 2
                  });
                  const discountRs = (q.totalDiscountPaise / 100).toLocaleString('en-IN', {
                    maximumFractionDigits: 2
                  });

                  return (
                    <tr key={q._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/quotations/${q._id}`}
                          className="font-mono font-bold text-solar-600 hover:text-solar-700 text-xs flex items-center gap-1.5"
                        >
                          {q.fullQuotationCode}
                          {q.isLatestRevision && (
                            <span className="text-[10px] font-normal px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 rounded">
                              Latest
                            </span>
                          )}
                        </Link>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Issued: {new Date(q.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-foreground">
                          {q.customerId?.legalName || 'Direct Customer'}
                        </div>
                        <div className="text-muted-foreground font-mono text-[11px]">
                          {q.customerId?.customerCode || '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-medium text-foreground">
                          {q.systemCapacityKwp} kWp
                        </span>
                        <div className="text-muted-foreground">{q.systemTopology}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs text-muted-foreground">
                        ₹{grossRs}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs">
                        <div className="font-mono text-amber-600">
                          {q.discountPercent > 0 ? `₹${discountRs}` : '—'}
                        </div>
                        {q.discountPercent > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            {q.discountPercent.toFixed(1)}%
                            {q.requiresDiscountApproval && (
                              <span className="ml-1 text-destructive font-semibold">(&gt;5%)</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground text-xs">
                        ₹{netRs}
                      </td>

                      <td className="py-3.5 px-4 text-center">{getStatusBadge(q.status)}</td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/quotations/${q._id}`}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded"
                        >
                          View Details
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-solar-500" />
              Generate Commercial Quotation (R0)
            </h3>
            <p className="text-xs text-muted-foreground">
              Drafts an initial revision R0 quotation using server-side integer-paise monetary
              engine and GST rules.
            </p>

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Customer {!leadId && <span className="text-destructive">*</span>}
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
                      required={!leadId}
                      value={customerId}
                      onChange={e => handleCustomerChange(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
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
                      required={!leadId}
                      placeholder="Enter Customer Code (e.g. CUST-2026-00001) or ID"
                      value={customerId}
                      onChange={e => handleCustomerChange(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                    />
                  )}
                  {leadId && customerId && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      ✓ Automatically synchronized with Lead account
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Originating Lead {!customerId && <span className="text-destructive">*</span>}
                  </label>
                  <select
                    value={leadId}
                    onChange={e => handleLeadChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                  >
                    <option value="">-- None (Direct Customer) --</option>
                    {availableLeads.map(l => (
                      <option key={l.id || l._id} value={l.id || l._id}>
                        {l.leadCode} — {l.prospectName} ({l.prospectPhone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    System Topology
                  </label>
                  <select
                    value={topology}
                    onChange={e => setTopology(e.target.value as SolarTopology)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                  >
                    <option value={SolarTopology.ON_GRID}>On-Grid</option>
                    <option value={SolarTopology.OFF_GRID}>Off-Grid</option>
                    <option value={SolarTopology.HYBRID}>Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    System Capacity (kWp)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={capacityKwp}
                    onChange={e => setCapacityKwp(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                  />
                </div>
              </div>

              {/* Module Line Item */}
              <div className="bg-secondary/30 p-3 rounded-lg space-y-2 border border-border">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Line Item 1: Solar Modules (12% GST)</span>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground">Description</label>
                  <input
                    type="text"
                    required
                    value={panelDesc}
                    onChange={e => setPanelDesc(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-background border border-input rounded"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[11px] text-muted-foreground">Qty (Nos)</label>
                    <input
                      type="number"
                      required
                      value={panelQty}
                      onChange={e => setPanelQty(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-input rounded"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-muted-foreground">Unit Rate (₹)</label>
                    <input
                      type="number"
                      required
                      value={panelRateRs}
                      onChange={e => setPanelRateRs(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-input rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Inverter Line Item */}
              <div className="bg-secondary/30 p-3 rounded-lg space-y-2 border border-border">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Line Item 2: Solar Inverter (18% GST)</span>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground">Description</label>
                  <input
                    type="text"
                    required
                    value={inverterDesc}
                    onChange={e => setInverterDesc(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-background border border-input rounded"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[11px] text-muted-foreground">Qty (Nos)</label>
                    <input
                      type="number"
                      required
                      value={inverterQty}
                      onChange={e => setInverterQty(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-input rounded"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-muted-foreground">Unit Rate (₹)</label>
                    <input
                      type="number"
                      required
                      value={inverterRateRs}
                      onChange={e => setInverterRateRs(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-input rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Discounts & Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Additional Commercial Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={additionalDiscountRs}
                    onChange={e => setAdditionalDiscountRs(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Discounts exceeding 5% trigger mandatory managerial approval.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="90"
                    value={validDays}
                    onChange={e => setValidDays(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-md"
                  />
                </div>
              </div>

              {createError && (
                <div className="p-2.5 bg-destructive/10 text-destructive text-xs rounded">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-medium rounded-md shadow"
                >
                  {creating ? 'Creating Quotation...' : 'Create & Calculate (R0)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
