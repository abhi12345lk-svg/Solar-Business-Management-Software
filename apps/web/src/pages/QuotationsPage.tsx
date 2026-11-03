import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  FileSpreadsheet,
  ArrowRight,
  AlertTriangle,
  Zap,
  X
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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

  // Form Fields for new quotation
  const [customerMode, setCustomerMode] = useState<'REGISTERED' | 'LEAD' | 'NEW'>('REGISTERED');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
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

  const [searchParams] = useSearchParams();
  const paramDesignId = searchParams.get('designId');
  const paramCustomerId = searchParams.get('customerId');
  const paramLeadId = searchParams.get('leadId');
  const paramCapacity = searchParams.get('capacity');

  const [linkedDesignId, setLinkedDesignId] = useState<string>(paramDesignId || '');
  const [designPreloadNotice, setDesignPreloadNotice] = useState<string | null>(null);

  useEffect(() => {
    if (paramDesignId || paramCustomerId || paramLeadId || paramCapacity) {
      setShowCreateModal(true);
      if (paramCapacity) setCapacityKwp(paramCapacity);
      if (paramCustomerId) {
        setCustomerId(paramCustomerId);
        setCustomerMode('REGISTERED');
      }
      if (paramLeadId) {
        setLeadId(paramLeadId);
        if (!paramCustomerId) setCustomerMode('LEAD');
      }
      if (paramDesignId) {
        setLinkedDesignId(paramDesignId);
        apiClient<any>(`/solar-designs/${paramDesignId}`)
          .then(design => {
            if (design) {
              if (design.proposedCapacityKwp) {
                setCapacityKwp(String(design.proposedCapacityKwp));
              }
              if (design.systemTopology) {
                setTopology(design.systemTopology);
              }
              if (design.module) {
                setPanelDesc(`${design.module.wattageWp || 550}Wp Mono Perc Solar Module`);
                setPanelQty(String(design.module.quantity || 1));
              }
              if (design.inverter) {
                setInverterDesc(`${design.inverter.ratedCapacityKw || 5}kW Solar Inverter`);
                setInverterQty(String(design.inverter.quantity || 1));
              }
              if (design.customerId?._id) {
                setCustomerId(design.customerId._id);
                setCustomerMode('REGISTERED');
              } else if (typeof design.customerId === 'string' && design.customerId) {
                setCustomerId(design.customerId);
                setCustomerMode('REGISTERED');
              }
              if (design.leadId?._id || (typeof design.leadId === 'string' && design.leadId)) {
                setLeadId(design.leadId?._id || design.leadId);
                if (!design.customerId) setCustomerMode('LEAD');
              }
              setDesignPreloadNotice(
                `Technical Array Sizing #${design.designNumber} pre-loaded: ${design.proposedCapacityKwp} kWp (${design.systemTopology})`
              );
            }
          })
          .catch(err => {
            console.warn('Could not pre-load solar design:', err);
          });
      }
    }
  }, [paramDesignId, paramCustomerId, paramLeadId, paramCapacity]);

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

    if (customerMode === 'REGISTERED' && !customerId.trim()) {
      setCreateError('Please select a registered customer from the dropdown list.');
      return;
    }
    if (customerMode === 'LEAD' && !leadId.trim()) {
      setCreateError('Please select an originating CRM lead.');
      return;
    }
    if (customerMode === 'NEW') {
      if (!newCustName.trim() || !newCustPhone.trim()) {
        setCreateError('Please enter the customer full name and mobile phone number.');
        return;
      }
      if (newCustPhone.trim().length < 8) {
        setCreateError('Please enter a valid phone number (at least 8 digits).');
        return;
      }
    }

    setCreating(true);
    setCreateError(null);

    try {
      const lineItems = [
        {
          itemType: QuotationItemType.SOLAR_MODULE,
          description: panelDesc.trim(),
          quantity: Number(panelQty) || 1,
          unit: 'Nos',
          unitRatePaise: Math.round(Number(panelRateRs || 0) * 100),
          discountPaise: 0,
          gstRateBasisPoints: 1200 // 12% GST standard on solar hardware
        },
        {
          itemType: QuotationItemType.INVERTER,
          description: inverterDesc.trim(),
          quantity: Number(inverterQty) || 1,
          unit: 'Nos',
          unitRatePaise: Math.round(Number(inverterRateRs || 0) * 100),
          discountPaise: 0,
          gstRateBasisPoints: 1800 // 18% GST standard on inverters
        }
      ];

      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + (Number(validDays) || 30));

      const payload: any = {
        systemTopology: topology,
        systemCapacityKwp: Number(capacityKwp) || 5,
        validUntil: validUntilDate.toISOString(),
        lineItems,
        solarDesignId: linkedDesignId.trim() || undefined,
        additionalDiscountPaise: Math.round(Number(additionalDiscountRs || 0) * 100),
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

      if (customerMode === 'REGISTERED') {
        payload.customerId = customerId.trim();
        if (leadId.trim()) payload.leadId = leadId.trim();
      } else if (customerMode === 'LEAD') {
        payload.leadId = leadId.trim();
        if (customerId.trim()) payload.customerId = customerId.trim();
      } else if (customerMode === 'NEW') {
        payload.newCustomer = {
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
          email: newCustEmail.trim() || undefined,
          city: newCustCity.trim() || undefined
        };
      }

      await apiClient('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
      setCustomerId('');
      setLeadId('');
      setLinkedDesignId('');
      setDesignPreloadNotice(null);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustCity('');
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
            Immutable quotation revision tracking, GST breakdown (INR ₹), and commercial discount
            approval workflows.
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
          <>
            {/* Mobile Cards (< md) */}
            <div className="block md:hidden divide-y divide-border">
              {quotations.map(q => {
                const netRs = (q.netTotalPaise / 100).toLocaleString('en-IN', {
                  maximumFractionDigits: 2
                });
                const discountRs = (q.totalDiscountPaise / 100).toLocaleString('en-IN', {
                  maximumFractionDigits: 2
                });

                return (
                  <div key={q._id} className="p-4 hover:bg-muted/30 transition-colors space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/quotations/${q._id}`}
                          className="font-mono font-bold text-solar-600 hover:text-solar-700 text-xs flex items-center gap-1.5"
                        >
                          <span>{q.fullQuotationCode}</span>
                          {q.isLatestRevision && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 rounded">
                              Latest
                            </span>
                          )}
                        </Link>
                        <h4 className="font-bold text-sm text-foreground truncate mt-0.5">
                          {q.customerId?.legalName || 'Direct Customer'}
                        </h4>
                      </div>
                      <div className="shrink-0">{getStatusBadge(q.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          System Capacity
                        </span>
                        <span className="font-semibold text-foreground">
                          {q.systemCapacityKwp} kWp • {q.systemTopology}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          Net Payable Total
                        </span>
                        <span className="font-bold text-foreground text-sm">₹{netRs}</span>
                      </div>
                    </div>

                    {q.discountPercent > 0 && (
                      <div className="text-xs text-amber-600 flex items-center justify-between">
                        <span>Discount Applied:</span>
                        <span className="font-semibold">
                          ₹{discountRs} ({q.discountPercent.toFixed(1)}%)
                        </span>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-xs">
                      <span className="text-[11px] text-muted-foreground">
                        Issued: {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                      <Link
                        to={`/quotations/${q._id}`}
                        className="inline-flex items-center text-xs font-bold text-solar-600 hover:text-solar-700 bg-solar-50 dark:bg-solar-950/40 px-3 py-1.5 rounded-md border border-solar-200 dark:border-solar-800"
                      >
                        <span>Open Workstation</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
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
                                <span className="ml-1 text-destructive font-semibold">
                                  (&gt;5%)
                                </span>
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
          </>
        )}
      </div>

      {/* Create Quotation Modal */}
      {showCreateModal && (() => {
        const moduleSubtotal = (Number(panelQty) || 0) * (Number(panelRateRs) || 0);
        const inverterSubtotal = (Number(inverterQty) || 0) * (Number(inverterRateRs) || 0);
        const grossSubtotal = moduleSubtotal + inverterSubtotal;
        const moduleGst = Math.round(moduleSubtotal * 0.12);
        const inverterGst = Math.round(inverterSubtotal * 0.18);
        const totalTax = moduleGst + inverterGst;
        const discountVal = Number(additionalDiscountRs) || 0;
        const netEstimatedTotal = Math.max(0, grossSubtotal + totalTax - discountVal);
        const discountPercent = grossSubtotal > 0 ? (discountVal / grossSubtotal) * 100 : 0;
        const requiresApproval = discountPercent > 5;

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      New Solar Quotation
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Draft price proposal with instant GST calculation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateQuotation} className="p-5 space-y-4">
                {designPreloadNotice && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{designPreloadNotice}</span>
                    </div>
                    {linkedDesignId && (
                      <span className="font-mono text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded font-semibold shrink-0">
                        CAD Linked
                      </span>
                    )}
                  </div>
                )}

                {/* 1. Customer Selection Strip */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Customer / Client:
                    </label>
                    <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setCustomerMode('REGISTERED')}
                        className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                          customerMode === 'REGISTERED'
                            ? 'bg-solar-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Registered Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerMode('LEAD')}
                        className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                          customerMode === 'LEAD'
                            ? 'bg-solar-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        From Lead
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerMode('NEW')}
                        className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                          customerMode === 'NEW'
                            ? 'bg-solar-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        + Walk-in Client
                      </button>
                    </div>
                  </div>

                  {customerMode === 'REGISTERED' && (
                    <select
                      value={customerId}
                      onChange={e => handleCustomerChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg font-medium"
                    >
                      <option value="">
                        {loadingContext
                          ? 'Loading customers...'
                          : '-- Select Registered Customer --'}
                      </option>
                      {availableCustomers.map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.customerCode || 'CUST'} — {c.legalName || c.name} (
                          {c.primaryPhone || 'No phone'})
                        </option>
                      ))}
                    </select>
                  )}

                  {customerMode === 'LEAD' && (
                    <select
                      value={leadId}
                      onChange={e => handleLeadChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg font-medium"
                    >
                      <option value="">-- Select Active CRM Lead --</option>
                      {availableLeads.map(l => (
                        <option key={l.id || l._id} value={l.id || l._id}>
                          {l.leadCode} — {l.prospectName} ({l.prospectPhone})
                        </option>
                      ))}
                    </select>
                  )}

                  {customerMode === 'NEW' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                      <input
                        type="text"
                        placeholder="Client Name *"
                        value={newCustName}
                        onChange={e => setNewCustName(e.target.value)}
                        className="px-2 py-1 text-xs bg-background border border-input rounded-lg"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile Number *"
                        value={newCustPhone}
                        onChange={e => setNewCustPhone(e.target.value)}
                        className="px-2 py-1 text-xs bg-background border border-input rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={newCustCity}
                        onChange={e => setNewCustCity(e.target.value)}
                        className="px-2 py-1 text-xs bg-background border border-input rounded-lg"
                      />
                      <input
                        type="email"
                        placeholder="Email (Optional)"
                        value={newCustEmail}
                        onChange={e => setNewCustEmail(e.target.value)}
                        className="px-2 py-1 text-xs bg-background border border-input rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* 2. System Specifications Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Solar System Type
                    </label>
                    <select
                      value={topology}
                      onChange={e => setTopology(e.target.value as SolarTopology)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg"
                    >
                      <option value={SolarTopology.ON_GRID}>On-Grid (Net-Metered)</option>
                      <option value={SolarTopology.OFF_GRID}>Off-Grid (Battery)</option>
                      <option value={SolarTopology.HYBRID}>Hybrid (Grid + Battery)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Capacity (kWp) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      required
                      value={capacityKwp}
                      onChange={e => setCapacityKwp(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg font-bold text-solar-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Quotation Validity
                    </label>
                    <select
                      value={validDays}
                      onChange={e => setValidDays(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg"
                    >
                      <option value="15">15 Days</option>
                      <option value="30">30 Days</option>
                      <option value="45">45 Days</option>
                      <option value="60">60 Days</option>
                    </select>
                  </div>
                </div>

                {/* 3. Items Pricing Table */}
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 w-24 text-center">Qty</th>
                        <th className="py-2 px-3 w-32 text-right">Unit Rate (₹)</th>
                        <th className="py-2 px-3 w-24 text-center">GST</th>
                        <th className="py-2 px-3 w-32 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* Solar Modules */}
                      <tr className="hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            value={panelDesc}
                            onChange={e => setPanelDesc(e.target.value)}
                            placeholder="Solar Module description"
                            className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md font-medium"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            required
                            value={panelQty}
                            onChange={e => setPanelQty(e.target.value)}
                            className="w-full px-2 py-1 text-xs text-center bg-background border border-input rounded-md font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            required
                            value={panelRateRs}
                            onChange={e => setPanelRateRs(e.target.value)}
                            className="w-full px-2 py-1 text-xs text-right bg-background border border-input rounded-md font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-[11px] font-semibold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">12%</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          ₹{moduleSubtotal.toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* Solar Inverter */}
                      <tr className="hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            value={inverterDesc}
                            onChange={e => setInverterDesc(e.target.value)}
                            placeholder="Solar Inverter description"
                            className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md font-medium"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            required
                            value={inverterQty}
                            onChange={e => setInverterQty(e.target.value)}
                            className="w-full px-2 py-1 text-xs text-center bg-background border border-input rounded-md font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            required
                            value={inverterRateRs}
                            onChange={e => setInverterRateRs(e.target.value)}
                            className="w-full px-2 py-1 text-xs text-right bg-background border border-input rounded-md font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-[11px] font-semibold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded">18%</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          ₹{inverterSubtotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Single-Row Financial Summary */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-semibold text-foreground whitespace-nowrap">
                      Discount (₹):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={additionalDiscountRs}
                      onChange={e => setAdditionalDiscountRs(e.target.value)}
                      placeholder="0"
                      className="w-28 px-2 py-1 text-xs bg-background border border-input rounded-md font-bold font-mono"
                    />
                    {requiresApproval && (
                      <span className="text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-semibold">
                        Approval Required (&gt;5%)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-medium">
                    <span className="text-muted-foreground">
                      Subtotal: <strong className="font-mono text-foreground">₹{grossSubtotal.toLocaleString('en-IN')}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      GST: <strong className="font-mono text-foreground">+₹{totalTax.toLocaleString('en-IN')}</strong>
                    </span>
                    {discountVal > 0 && (
                      <span className="text-emerald-600">
                        Discount: <strong className="font-mono">-₹{discountVal.toLocaleString('en-IN')}</strong>
                      </span>
                    )}
                    <div className="pl-3 border-l border-border flex items-baseline space-x-1">
                      <span className="text-xs text-muted-foreground">Final Total:</span>
                      <span className="text-base font-black text-solar-600 font-mono">
                        ₹{netEstimatedTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {createError && (
                  <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-1.5 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{creating ? 'Creating Quotation...' : 'Create Quotation →'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
