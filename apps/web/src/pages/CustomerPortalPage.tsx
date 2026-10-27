/**
 * INS Solar Business Management Software — Comprehensive Customer Portal Hub
 *
 * Provides a secure, responsive, unified self-service portal for solar plant owners:
 * - Real-time Project Execution & 10-Stage Milestone Tracker
 * - Commercial Quotation Revisions with digital Accept/Reject workflows
 * - Verified Payment Receipts & Receivables Statements (with statutory non-tax disclaimer)
 * - Net-Metering & Government Subsidy Claim Tracking
 * - Equipment Warranty Cards & AMC Contract Maintenance Quotas
 * - Break-Fix Complaint Intake & Service Visit Schedules
 * - Persistent In-App Notification Center with Category Filters & Bulk Read Actions
 * - Multi-Channel Notification Delivery Preferences
 *
 * Strict tenant isolation enforced; zero cross-customer data leakage.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sun,
  LayoutDashboard,
  FolderKanban,
  FileSpreadsheet,
  Banknote,
  LifeBuoy,
  Bell,
  Settings,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Printer,
  Plus,
  Zap,
  Landmark,
  ShieldCheck,
  CheckCheck,
  ArrowRight,
  ExternalLink,
  Send,
  Download,
  XCircle,
  X,
  FileText,
  Mail,
  Smartphone,
  MessageSquare
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface ProjectSummary {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  currentStage: string;
  systemCapacityKwp: number;
  systemTopology: string;
  targetCompletionDate?: string;
  totalMilestones: number;
  completedMilestones: number;
  progressPercent: number;
}

interface QuotationItem {
  _id: string;
  quotationNumber: string;
  revisionNumber: number;
  fullQuotationCode: string;
  systemTopology: string;
  systemCapacityKwp: number;
  netTotalPaise: number;
  validUntil: string;
  status: string;
  acceptedAt?: string;
}

interface NotificationItem {
  id: string;
  notificationNumber: string;
  category: string;
  eventType: string;
  title: string;
  message: string;
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
  deliveryStatus: string;
}

interface NotificationPreferences {
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  categories: {
    quotations: boolean;
    projectMilestones: boolean;
    payments: boolean;
    serviceAndWarranty: boolean;
    reminders: boolean;
  };
}

const STAGE_LABELS: Record<string, { label: string; desc: string }> = {
  STAGE_1_ENGINEERING_DESIGN: {
    label: 'Stage 1: Engineering & Design',
    desc: 'System layout, string sizing, and CAD single-line diagrams finalized.'
  },
  STAGE_2_NET_METERING_APPLY: {
    label: 'Stage 2: Net Metering Application',
    desc: 'Bi-directional meter paperwork submitted to DISCOM utility.'
  },
  STAGE_3_MATERIAL_DISPATCH: {
    label: 'Stage 3: Material Dispatch',
    desc: 'Solar modules, inverter, structure, and BOS allocated and dispatched.'
  },
  STAGE_4_CIVIL_STRUCTURE: {
    label: 'Stage 4: Civil & Structure Mounting',
    desc: 'Rooftop mounting rails, ballast, and structure anchored to civil columns.'
  },
  STAGE_5_MODULE_DC_CABLING: {
    label: 'Stage 5: Module & DC Cabling',
    desc: 'PV modules clamped in string series; UV-resistant DC cabling routed.'
  },
  STAGE_6_INVERTER_ACDB: {
    label: 'Stage 6: Inverter & ACDB Integration',
    desc: 'Inverter mounted with AC/DC distribution boxes and surge arrestors.'
  },
  STAGE_7_EARTHING_LIGHTNING: {
    label: 'Stage 7: Earthing & Lightning Protection',
    desc: 'Chemical earthing pits and copper lightning arrestor grounded.'
  },
  STAGE_8_TESTING_PRE_COMMISSION: {
    label: 'Stage 8: Pre-Commissioning Testing',
    desc: 'Insulation resistance, open circuit voltage, and grid sync verified.'
  },
  STAGE_9_DISCOM_METER_INSTALL: {
    label: 'Stage 9: DISCOM Meter Sync',
    desc: 'DISCOM inspector verification and bi-directional meter installed.'
  },
  STAGE_10_COMMISSION_HANDOVER: {
    label: 'Stage 10: Commissioning & Handover',
    desc: 'System energized; warranty cards and generation monitoring handed over.'
  }
};

export interface CustomerPortalPageProps {
  defaultTab?: 'DASHBOARD' | 'PROJECTS' | 'QUOTATIONS' | 'PAYMENTS' | 'SERVICE' | 'NOTIFICATIONS' | 'PREFERENCES' | 'DOCUMENTS';
}

export const CustomerPortalPage: React.FC<CustomerPortalPageProps> = ({ defaultTab = 'DASHBOARD' }) => {
  const [searchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') || '').toUpperCase();
  const validTabs = ['DASHBOARD', 'PROJECTS', 'QUOTATIONS', 'PAYMENTS', 'SERVICE', 'NOTIFICATIONS', 'PREFERENCES', 'DOCUMENTS'];
  const initialTab = validTabs.includes(urlTab) ? urlTab : defaultTab;

  const [activeTab, setActiveTab] = useState<
    'DASHBOARD' | 'PROJECTS' | 'QUOTATIONS' | 'PAYMENTS' | 'SERVICE' | 'NOTIFICATIONS' | 'PREFERENCES' | 'DOCUMENTS'
  >(initialTab as any);

  useEffect(() => {
    if (urlTab && validTabs.includes(urlTab)) {
      setActiveTab(urlTab as any);
    } else if (defaultTab && validTabs.includes(defaultTab)) {
      setActiveTab(defaultTab as any);
    }
  }, [urlTab, defaultTab]);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Dashboard Aggregated Data
  const [dashboardData, setDashboardData] = useState<any | null>(null);

  // Tab Data
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<any | null>(null);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);

  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any | null>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [amcs, setAmcs] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [customerDocs, setCustomerDocs] = useState<any[]>([]);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationCategoryFilter, setNotificationCategoryFilter] = useState<string>('ALL');
  const [notificationReadFilter, setNotificationReadFilter] = useState<string>('ALL');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    channels: { inApp: true, email: true, sms: true, whatsapp: true },
    categories: {
      quotations: true,
      projectMilestones: true,
      payments: true,
      serviceAndWarranty: true,
      reminders: true
    }
  });

  // Modals
  const [showAcceptQuoteModal, setShowAcceptQuoteModal] = useState(false);
  const [showRejectQuoteModal, setShowRejectQuoteModal] = useState(false);
  const [targetQuote, setTargetQuote] = useState<QuotationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [acceptanceNotes, setAcceptanceNotes] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    projectId: '',
    title: '',
    description: '',
    category: 'INVERTER_FAULT',
    preferredVisitTime: 'Morning (9 AM - 12 PM)',
    contactPreference: 'PHONE'
  });
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Fetch Dashboard & Unread Notification Count
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashRes, notifRes, unreadRes, prefsRes] = await Promise.all([
        apiClient<any>('/customer-portal/dashboard').catch(() => null),
        apiClient<any>('/customer-portal/notifications?limit=20').catch(() => ({ items: [] })),
        apiClient<any>('/customer-portal/notifications/unread-count').catch(() => ({ unreadCount: 0 })),
        apiClient<any>('/customer-portal/notifications/preferences').catch(() => null)
      ]);

      if (dashRes) {
        setDashboardData(dashRes);
        setProjects(dashRes.projects || []);
        setQuotations(dashRes.pendingQuotations || []);
        setReceivables(dashRes.receivables || null);
        if (dashRes.projects?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(dashRes.projects[0].id);
        }
      }

      setNotifications(notifRes?.items || []);
      setUnreadCount(unreadRes?.unreadCount || 0);

      if (prefsRes) {
        setPreferences(prefsRes);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load customer portal data.');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Fetch specific tab data when activated
  const fetchTabData = useCallback(async (tab: string) => {
    try {
      setError(null);
      if (tab === 'PROJECTS') {
        const res = await apiClient<any>('/customer-portal/projects');
        setProjects(res?.items || []);
        if (res?.items?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(res.items[0]._id || res.items[0].id);
        }
      } else if (tab === 'QUOTATIONS') {
        const res = await apiClient<any>('/customer-portal/quotations');
        setQuotations(res?.data || res || []);
      } else if (tab === 'PAYMENTS') {
        const [payRes, recRes] = await Promise.all([
          apiClient<any>('/customer-portal/payments'),
          apiClient<any>('/customer-portal/payments/receivables')
        ]);
        setPayments(Array.isArray(payRes) ? payRes : (payRes?.items || payRes?.data?.items || []));
        setReceivables(recRes?.data || recRes || null);
      } else if (tab === 'SERVICE') {
        const [compRes, warRes, amcRes, visRes] = await Promise.all([
          apiClient<any>('/customer-portal/service/complaints'),
          apiClient<any>('/customer-portal/service/warranties'),
          apiClient<any>('/customer-portal/service/amc'),
          apiClient<any>('/customer-portal/service/visits')
        ]);
        setComplaints(compRes?.items || compRes?.complaints || compRes?.data?.items || []);
        setWarranties(warRes?.items || warRes?.equipment || warRes?.warranties || warRes?.data?.items || []);
        setAmcs(amcRes?.items || amcRes?.contracts || amcRes?.amcs || amcRes?.data?.items || []);
        setVisits(visRes?.items || visRes?.visits || visRes?.data?.items || []);
      } else if (tab === 'NOTIFICATIONS') {
        const params = new URLSearchParams();
        if (notificationCategoryFilter !== 'ALL') {
          params.append('category', notificationCategoryFilter);
        }
        if (notificationReadFilter === 'UNREAD') {
          params.append('isRead', 'false');
        } else if (notificationReadFilter === 'READ') {
          params.append('isRead', 'true');
        }
        const res = await apiClient<any>(`/customer-portal/notifications?${params.toString()}`);
        setNotifications(res?.items || []);
        const unreadRes = await apiClient<any>('/customer-portal/notifications/unread-count');
        setUnreadCount(unreadRes?.unreadCount || 0);
      } else if (tab === 'PREFERENCES') {
        const res = await apiClient<any>('/customer-portal/notifications/preferences');
        if (res) setPreferences(res);
      } else if (tab === 'DOCUMENTS') {
        const res = await apiClient<any>('/customer-portal/documents');
        setCustomerDocs(res?.items || []);
      }
    } catch (err: any) {
      setError(err?.message || `Failed to load ${tab.toLowerCase()} data.`);
    }
  }, [selectedProjectId, notificationCategoryFilter, notificationReadFilter]);

  const handleDownloadCustomerDoc = async (docId: string) => {
    try {
      const res = await apiClient<{ downloadUrl: string }>(`/customer-portal/documents/${docId}/access-url`);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate document download link.');
    }
  };

  useEffect(() => {
    if (activeTab !== 'DASHBOARD') {
      fetchTabData(activeTab);
    }
  }, [activeTab, fetchTabData]);

  // Fetch Project Deep Details
  const fetchProjectDetail = useCallback(async (projectId: string) => {
    try {
      setProjectDetailLoading(true);
      const [proj, dispatches, netMet, subsidy] = await Promise.all([
        apiClient<any>(`/customer-portal/projects/${projectId}`),
        apiClient<any>(`/customer-portal/projects/${projectId}/dispatches`).catch(() => ({ items: [] })),
        apiClient<any>(`/customer-portal/projects/${projectId}/net-metering`).catch(() => ({ items: [] })),
        apiClient<any>(`/customer-portal/projects/${projectId}/subsidy`).catch(() => ({ items: [] }))
      ]);

      setSelectedProjectDetail({
        ...proj,
        dispatches: dispatches?.items || [],
        netMetering: netMet?.items || [],
        subsidy: subsidy?.items || []
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch project detail.');
    } finally {
      setProjectDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId && (activeTab === 'PROJECTS' || activeTab === 'DASHBOARD')) {
      fetchProjectDetail(selectedProjectId);
    }
  }, [selectedProjectId, activeTab, fetchProjectDetail]);

  // Quotation Decision Handlers
  const handleAcceptQuote = async () => {
    if (!targetQuote) return;
    try {
      setSubmittingDecision(true);
      setError(null);
      await apiClient(`/customer-portal/quotations/${targetQuote._id}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          notes: acceptanceNotes || 'Digitally approved by customer.'
        })
      });
      setShowAcceptQuoteModal(false);
      setActionSuccess(`Quotation ${targetQuote.fullQuotationCode} accepted successfully!`);
      fetchDashboardData();
      if (activeTab === 'QUOTATIONS') fetchTabData('QUOTATIONS');
    } catch (err: any) {
      setError(err?.message || 'Failed to accept quotation.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleRejectQuote = async () => {
    if (!targetQuote) return;
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for declining the quotation revision.');
      return;
    }
    try {
      setSubmittingDecision(true);
      setError(null);
      await apiClient(`/customer-portal/quotations/${targetQuote._id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim()
        })
      });
      setShowRejectQuoteModal(false);
      setActionSuccess(`Quotation ${targetQuote.fullQuotationCode} was declined.`);
      fetchDashboardData();
      if (activeTab === 'QUOTATIONS') fetchTabData('QUOTATIONS');
    } catch (err: any) {
      setError(err?.message || 'Failed to decline quotation.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Receipt Modal Handler
  const openReceipt = async (paymentId: string) => {
    try {
      setLoading(true);
      const res = await apiClient<any>(`/customer-portal/payments/${paymentId}/receipt`);
      setReceiptData(res?.data || res);
      setShowReceiptModal(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment receipt.');
    } finally {
      setLoading(false);
    }
  };

  // Mark single notification read
  const handleMarkRead = async (notifId: string) => {
    try {
      await apiClient(`/customer-portal/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      setError(err?.message || 'Failed to mark notification as read.');
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await apiClient('/customer-portal/notifications/mark-all-read', {
        method: 'POST',
        body: JSON.stringify({
          category: notificationCategoryFilter !== 'ALL' ? notificationCategoryFilter : undefined
        })
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setActionSuccess('All notifications marked as read.');
    } catch (err: any) {
      setError(err?.message || 'Failed to mark all notifications as read.');
    }
  };

  // Update Preferences Handler
  const handleSavePreferences = async (updatedPrefs: NotificationPreferences) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient('/customer-portal/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(updatedPrefs)
      });
      setPreferences(updatedPrefs);
      setActionSuccess('Notification delivery preferences updated successfully!');
    } catch (err: any) {
      setError(err?.message || 'Failed to update preferences.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Complaint Handler
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintForm.projectId) {
      setError('Please select a solar project.');
      return;
    }
    try {
      setSubmittingComplaint(true);
      setError(null);
      await apiClient('/customer-portal/service/complaints', {
        method: 'POST',
        body: JSON.stringify(complaintForm)
      });
      setShowComplaintModal(false);
      setActionSuccess('Service ticket registered! Our support team will dispatch a technician.');
      fetchTabData('SERVICE');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit service complaint.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-solar-500/10 border border-solar-500/30 flex items-center justify-center text-solar-600">
            <Sun className="w-7 h-7 text-solar-500" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Customer Portal Hub
              </h1>
              {dashboardData?.customer?.name && (
                <span className="text-xs font-medium text-muted-foreground">
                  ({dashboardData.customer.name})
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Verified Client
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live installation progress, commercial proposals, payment receipts, warranties, and notification center.
            </p>
          </div>
        </div>

        {/* Quick Notification Indicator & Refresh */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setActiveTab('NOTIFICATIONS');
            }}
            className="relative px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 text-foreground flex items-center space-x-2 text-xs font-semibold transition-colors"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-solar-500 text-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              if (activeTab === 'DASHBOARD') fetchDashboardData();
              else fetchTabData(activeTab);
            }}
            disabled={loading}
            className="px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start justify-between">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-destructive/80 hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-start justify-between">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700/80 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto border-b pb-1 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'DASHBOARD'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('PROJECTS')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'PROJECTS'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>My Projects</span>
        </button>

        <button
          onClick={() => setActiveTab('QUOTATIONS')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'QUOTATIONS'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Quotations</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'PAYMENTS'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Payments & Receipts</span>
        </button>

        <button
          onClick={() => setActiveTab('SERVICE')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'SERVICE'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Service & AMC</span>
        </button>

        <button
          onClick={() => setActiveTab('NOTIFICATIONS')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'NOTIFICATIONS'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notification Center</span>
          {unreadCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'NOTIFICATIONS' ? 'bg-white text-solar-600' : 'bg-solar-500 text-white'
            }`}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'DOCUMENTS'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Documents</span>
        </button>

        <button
          onClick={() => setActiveTab('PREFERENCES')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'PREFERENCES'
              ? 'bg-solar-500 text-white shadow-sm shadow-solar-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Preferences</span>
        </button>
      </div>

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Active Plants</span>
                <FolderKanban className="w-4 h-4 text-solar-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {projects.length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Turnkey installation projects
              </p>
            </div>

            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Quotes for Review</span>
                <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {quotations.filter(q => q.status === 'SENT' || q.status === 'APPROVED').length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Awaiting digital acceptance
              </p>
            </div>

            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Outstanding Balance</span>
                <Banknote className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                ₹{(((receivables?.totalOutstandingPaise ?? receivables?.outstandingPaise ?? 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Total realized: ₹{(((receivables?.totalAllocatedPaise ?? receivables?.totalReceivedPaise ?? 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Unread Alerts</span>
                <Bell className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {unreadCount}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Milestone & service reminders
              </p>
            </div>
          </div>

          {/* Quick Action Alert: Pending Quotations */}
          {quotations.filter(q => q.status === 'SENT' || q.status === 'APPROVED').length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Commercial Proposal Action Required</div>
                  <div className="text-xs text-muted-foreground">
                    You have active proposals ready for your review and digital acceptance.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('QUOTATIONS')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors flex items-center space-x-1 self-start sm:self-auto"
              >
                <span>Review Proposals</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Primary Project Live Progress Bar */}
          {projects[0] && (
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-solar-600">{projects[0]!.projectCode}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">{projects[0]!.systemTopology}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">{projects[0]!.systemCapacityKwp} kWp</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">{projects[0]!.name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground font-semibold">Overall Installation Progress</div>
                  <div className="text-xl font-bold text-solar-600">{projects[0]!.progressPercent}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-solar-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${projects[0]!.progressPercent}%` }}
                />
              </div>

              <div className="p-3.5 rounded-lg bg-muted/40 border text-xs flex items-start space-x-3">
                <Zap className="w-4 h-4 text-solar-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">
                    {STAGE_LABELS[projects[0]!.currentStage]?.label || projects[0]!.currentStage}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {STAGE_LABELS[projects[0]!.currentStage]?.desc || 'Stage execution in progress.'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedProjectId(projects[0]!.id);
                    setActiveTab('PROJECTS');
                  }}
                  className="text-xs font-semibold text-solar-600 hover:text-solar-700 flex items-center space-x-1"
                >
                  <span>View Project Details & Checklists</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Recent Notifications Widget */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <Bell className="w-4 h-4 text-solar-500" />
                <span>Recent Notifications & Reminders</span>
              </h3>
              <button
                onClick={() => setActiveTab('NOTIFICATIONS')}
                className="text-xs font-semibold text-solar-600 hover:text-solar-700"
              >
                View All
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No recent notifications. You're all caught up!
              </div>
            ) : (
              <div className="divide-y text-xs">
                {notifications.slice(0, 4).map(item => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">{item.title}</span>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-solar-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5">{item.message}</p>
                      <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                        {new Date(item.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {!item.isRead && (
                      <button
                        onClick={() => handleMarkRead(item.id)}
                        className="text-[11px] font-semibold text-solar-600 hover:text-solar-700 shrink-0"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY PROJECTS */}
      {activeTab === 'PROJECTS' && (
        <div className="space-y-6">
          {/* Project selector dropdown if multiple projects */}
          {projects.length > 1 && (
            <div className="flex items-center space-x-3 bg-card border rounded-xl p-3">
              <span className="text-xs font-semibold text-muted-foreground">Select Project:</span>
              <select
                value={selectedProjectId || ''}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="text-xs bg-background border rounded-lg px-3 py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} — {p.name} ({p.systemCapacityKwp} kWp)
                  </option>
                ))}
              </select>
            </div>
          )}

          {projectDetailLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-solar-500" />
              <span>Loading installation pipeline...</span>
            </div>
          ) : !selectedProjectDetail ? (
            <div className="p-12 text-center text-xs text-muted-foreground border rounded-xl bg-card">
              No project details available.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Project Overview Card */}
              <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-solar-600">{selectedProjectDetail.projectCode}</span>
                    <h2 className="text-xl font-bold text-foreground mt-0.5">{selectedProjectDetail.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedProjectDetail.siteAddress?.addressLine1}, {selectedProjectDetail.siteAddress?.city},{' '}
                      {selectedProjectDetail.siteAddress?.state}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-solar-500/10 text-solar-600 border border-solar-500/20">
                      {selectedProjectDetail.systemCapacityKwp} kWp Capacity
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-foreground border">
                      {selectedProjectDetail.systemTopology}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {selectedProjectDetail.status}
                    </span>
                  </div>
                </div>

                {/* 10 Stages Visualizer */}
                <div className="pt-4 border-t space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Execution Pipeline (10 Stages)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {Object.entries(STAGE_LABELS).map(([stageKey, info], idx) => {
                      const isCurrent = selectedProjectDetail.currentStage === stageKey;
                      const stagesArr = Object.keys(STAGE_LABELS);
                      const currentIdx = stagesArr.indexOf(selectedProjectDetail.currentStage);
                      const isDone = stagesArr.indexOf(stageKey) < currentIdx;

                      return (
                        <div
                          key={stageKey}
                          className={`p-3 rounded-lg border text-xs transition-all ${
                            isCurrent
                              ? 'bg-solar-500 text-white font-bold shadow-md shadow-solar-500/20 border-solar-600'
                              : isDone
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                              : 'bg-muted/30 border-muted text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-wider">Step {idx + 1}</span>
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {isCurrent && <Clock className="w-3.5 h-3.5" />}
                          </div>
                          <div className="line-clamp-2 leading-tight">{info.label.split(': ')[1]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Milestones Checklist */}
              <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                  <span>Installation Milestones & Verification</span>
                </h3>

                {selectedProjectDetail.milestones?.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4">No milestones registered yet.</div>
                ) : (
                  <div className="divide-y text-xs">
                    {selectedProjectDetail.milestones.map((m: any) => (
                      <div key={m._id || m.id} className="py-3 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground flex items-center space-x-2">
                            <span>{m.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                m.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : m.status === 'IN_PROGRESS'
                                  ? 'bg-solar-500/10 text-solar-600'
                                  : m.status === 'BLOCKED'
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          {m.description && <p className="text-muted-foreground">{m.description}</p>}
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground shrink-0">
                          {m.completedAt ? (
                            <span className="text-emerald-600 font-semibold">
                              Done on {new Date(m.completedAt).toLocaleDateString('en-IN')}
                            </span>
                          ) : m.targetDueDate ? (
                            <span>Due by {new Date(m.targetDueDate).toLocaleDateString('en-IN')}</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Utility Net Metering & Subsidy Tracker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Net Metering Card */}
                <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-solar-500" />
                      <span>Net-Metering Application</span>
                    </h4>
                  </div>
                  {selectedProjectDetail.netMetering?.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Net-metering application has not been submitted yet.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {selectedProjectDetail.netMetering.map((nm: any) => (
                        <div key={nm._id} className="p-3 rounded-lg bg-muted/40 border space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>App #: {nm.applicationNumber}</span>
                            <span className="px-2 py-0.5 rounded bg-solar-500/10 text-solar-600 text-[10px]">
                              {nm.status}
                            </span>
                          </div>
                          <div className="text-muted-foreground">DISCOM: {nm.discomName}</div>
                          {nm.consumerNumber && <div>Consumer #: {nm.consumerNumber}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subsidy Card */}
                <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-2">
                      <Landmark className="w-4 h-4 text-emerald-500" />
                      <span>Government Subsidy Claim (DBT)</span>
                    </h4>
                  </div>
                  {selectedProjectDetail.subsidy?.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Subsidy claim application not yet initialized.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {selectedProjectDetail.subsidy.map((sub: any) => (
                        <div key={sub._id} className="p-3 rounded-lg bg-muted/40 border space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>Scheme: {sub.schemeName}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px]">
                              {sub.status}
                            </span>
                          </div>
                          <div className="text-muted-foreground">App #: {sub.applicationNumber}</div>
                          <div className="font-medium text-foreground">
                            Claim: ₹{((sub.requestedAmountPaise || 0) / 100).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUOTATIONS */}
      {activeTab === 'QUOTATIONS' && (
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-solar-500" />
              <span>Commercial Proposals & Digital Approvals</span>
            </h3>

            {quotations.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No quotations have been prepared for your profile yet.
              </div>
            ) : (
              <div className="space-y-4">
                {quotations.map(quote => {
                  const canAct = quote.status === 'SENT' || quote.status === 'APPROVED';
                  const isAccepted = quote.status === 'ACCEPTED';
                  const isRejected = quote.status === 'REJECTED';

                  return (
                    <div
                      key={quote._id}
                      className="p-5 rounded-xl border bg-background hover:bg-muted/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-foreground text-sm">
                            {quote.fullQuotationCode || quote.quotationNumber}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">
                            Rev {quote.revisionNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isAccepted
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : isRejected
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-solar-500/10 text-solar-600'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center space-x-4">
                          <span>Capacity: {quote.systemCapacityKwp} kWp</span>
                          <span>Topology: {quote.systemTopology}</span>
                          <span>Valid Until: {new Date(quote.validUntil).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Net Investment</div>
                          <div className="text-lg font-bold text-solar-600">
                            ₹{((quote.netTotalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        {canAct && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setTargetQuote(quote);
                                setShowAcceptQuoteModal(true);
                              }}
                              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accept Proposal</span>
                            </button>
                            <button
                              onClick={() => {
                                setTargetQuote(quote);
                                setShowRejectQuoteModal(true);
                              }}
                              className="px-3.5 py-2 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENTS & OPERATIONAL RECEIPTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-6">
          {/* Receivables Balance Overview */}
          {receivables && (
            <div className="bg-card border rounded-xl p-6 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground font-semibold">Total Contract Value</div>
                <div className="text-xl font-bold text-foreground mt-1">
                  ₹{((receivables.totalOrderValuePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-semibold">Total Realized Collections</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  ₹{((receivables.totalAllocatedPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-semibold">Current Outstanding Balance</div>
                <div className="text-xl font-bold text-solar-600 mt-1">
                  ₹{((receivables.totalOutstandingPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Payments Register */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
              <Banknote className="w-4 h-4 text-emerald-500" />
              <span>Verified Payment Receipts</span>
            </h3>

            {payments.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No payment transactions recorded for your account.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {payments.map(p => (
                  <div key={p._id || p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-foreground">{p.receiptNumber || p.paymentNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600">
                          {p.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-muted">{p.paymentMethod}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Date: {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                        {p.transactionReference && ` • Ref/UTR: ${p.transactionReference}`}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Amount Paid</div>
                        <div className="text-sm font-bold text-emerald-600">
                          ₹{((p.amountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <button
                        onClick={() => openReceipt(p._id || p.id)}
                        className="px-3 py-1.5 rounded-lg border hover:bg-muted/50 text-foreground text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Print Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SERVICE, WARRANTIES & AMC */}
      {activeTab === 'SERVICE' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">After-Sales & Maintenance</h3>
            <button
              onClick={() => {
                if (projects.length > 0 && projects[0] && !complaintForm.projectId) {
                  setComplaintForm(prev => ({ ...prev, projectId: projects[0]!.id }));
                }
                setShowComplaintModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-solar-500 hover:bg-solar-600 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Report Issue</span>
            </button>
          </div>

          {/* Active Complaints */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
              <LifeBuoy className="w-4 h-4 text-solar-500" />
              <span>Support & Defect Complaints</span>
            </h4>

            {complaints.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No complaints registered. Your system is running smoothly!</p>
            ) : (
              <div className="space-y-3">
                {complaints.map(c => (
                  <div key={c._id || c.id} className="p-4 rounded-lg border bg-muted/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-foreground">{c.ticketNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-solar-500/10 text-solar-600">
                          {c.status}
                        </span>
                      </div>
                      <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="font-semibold text-foreground">{c.title}</div>
                    <p className="text-muted-foreground">{c.description}</p>
                    {c.resolutionSummary && (
                      <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                        <span className="font-semibold">Resolution: </span>
                        {c.resolutionSummary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Equipment Warranties */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Serialized Hardware Warranties</span>
            </h4>

            {warranties.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No warranty cards issued yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {warranties.map(w => (
                  <div key={w._id || w.id} className="p-3.5 rounded-lg border bg-muted/20 space-y-1 text-xs">
                    <div className="font-semibold text-foreground">{w.productName || w.componentType}</div>
                    <div className="text-muted-foreground">Serial: {w.serialNumber}</div>
                    <div className="text-[11px] text-emerald-600 font-medium">
                      Valid through: {new Date(w.warrantyEndDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active AMC Contracts */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
              <FileText className="w-4 h-4 text-solar-500" />
              <span>Active AMC Contracts ({amcs.length})</span>
            </h4>

            {amcs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No active annual maintenance contracts.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {amcs.map(a => (
                  <div key={a._id || a.id} className="p-3.5 rounded-lg border bg-muted/20 space-y-1 text-xs">
                    <div className="font-semibold text-foreground">{a.contractNumber || 'AMC Contract'}</div>
                    <div className="text-muted-foreground">Tier: {a.contractType || 'Comprehensive'}</div>
                    <div className="text-[11px] text-solar-600 font-medium">Status: {a.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Visits History */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
              <Clock className="w-4 h-4 text-solar-500" />
              <span>Technician Visits ({visits.length})</span>
            </h4>

            {visits.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No scheduled or completed technician visits.</p>
            ) : (
              <div className="space-y-2">
                {visits.map(v => (
                  <div key={v._id || v.id} className="p-3 rounded-lg border bg-muted/10 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-foreground">{v.visitType || 'Site Inspection'}</div>
                      <div className="text-muted-foreground">{v.technicianName ? `Technician: ${v.technicianName}` : 'Technician assigned'}</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary">{v.status}</span>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {v.scheduledDate ? new Date(v.scheduledDate).toLocaleDateString('en-IN') : 'Scheduled'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: NOTIFICATION CENTER */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-solar-500" />
                  <span>Notification Inbox</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Milestone alerts, dispatch notices, quotation reviews, and operational reminders.
                </p>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="px-3.5 py-1.5 rounded-lg bg-solar-500 hover:bg-solar-600 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark All as Read</span>
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs">
              <div className="flex items-center space-x-1">
                <span className="text-muted-foreground font-semibold">Category:</span>
                <select
                  value={notificationCategoryFilter}
                  onChange={e => {
                    setNotificationCategoryFilter(e.target.value);
                  }}
                  className="bg-background border rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="QUOTATION">Quotations</option>
                  <option value="PROJECT_MILESTONE">Milestones & Progress</option>
                  <option value="PAYMENT">Payments</option>
                  <option value="INSPECTION">Inspections</option>
                  <option value="SERVICE_COMPLAINT">Service</option>
                  <option value="WARRANTY_AMC">Warranties & AMC</option>
                  <option value="SYSTEM">System Alerts</option>
                </select>
              </div>

              <div className="flex items-center space-x-1">
                <span className="text-muted-foreground font-semibold">Status:</span>
                <select
                  value={notificationReadFilter}
                  onChange={e => {
                    setNotificationReadFilter(e.target.value);
                  }}
                  className="bg-background border rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  <option value="ALL">All</option>
                  <option value="UNREAD">Unread Only</option>
                  <option value="READ">Read Only</option>
                </select>
              </div>
            </div>

            {/* Notifications List */}
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No notifications found for this filter.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {notifications.map(item => (
                  <div
                    key={item.id}
                    className={`py-4 px-2 rounded-lg transition-colors flex items-start justify-between gap-4 ${
                      !item.isRead ? 'bg-solar-500/5' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-foreground text-sm">{item.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
                          {item.category}
                        </span>
                        {!item.isRead && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-solar-500 text-white">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">{item.message}</p>
                      <div className="flex items-center space-x-3 text-[10px] text-muted-foreground/80 pt-0.5">
                        <span>{new Date(item.createdAt).toLocaleString('en-IN')}</span>
                        <span>•</span>
                        <span>Ref: {item.notificationNumber}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {item.linkUrl && (
                        <button
                          onClick={() => {
                            if (item.linkUrl?.includes('quotation')) setActiveTab('QUOTATIONS');
                            else if (item.linkUrl?.includes('project')) setActiveTab('PROJECTS');
                            else if (item.linkUrl?.includes('payment')) setActiveTab('PAYMENTS');
                            else if (item.linkUrl?.includes('service')) setActiveTab('SERVICE');
                            if (!item.isRead) handleMarkRead(item.id);
                          }}
                          className="px-2.5 py-1 rounded border hover:bg-muted/50 text-solar-600 font-semibold text-xs flex items-center space-x-1"
                        >
                          <span>Go to</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {!item.isRead && (
                        <button
                          onClick={() => handleMarkRead(item.id)}
                          className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: NOTIFICATION PREFERENCES */}
      {activeTab === 'PREFERENCES' && (
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6 max-w-2xl">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <Settings className="w-4 h-4 text-solar-500" />
                <span>Notification Delivery Preferences</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure your preferred delivery channels and notification categories.
              </p>
            </div>

            {/* Delivery Channels */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Delivery Channels
              </h4>
              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-4 h-4 text-solar-500" />
                    <div>
                      <div className="font-semibold text-foreground">In-App Notifications</div>
                      <div className="text-muted-foreground">Portal inbox notifications and badge counter</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.channels?.inApp)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        channels: { ...prev.channels, inApp: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-indigo-500" />
                    <div>
                      <div className="font-semibold text-foreground">Email Notifications</div>
                      <div className="text-muted-foreground">Detailed commercial and project milestone emails</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.channels?.email)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        channels: { ...prev.channels, email: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="font-semibold text-foreground">SMS Alerts</div>
                      <div className="text-muted-foreground">Urgent technician arrival and OTP messages</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.channels?.sms)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        channels: { ...prev.channels, sms: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-foreground">WhatsApp Messages</div>
                      <div className="text-muted-foreground">Automated installation updates and proposal links</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.channels?.whatsapp)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        channels: { ...prev.channels, whatsapp: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>
              </div>
            </div>

            {/* Category Preferences */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notification Categories
              </h4>
              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div>
                    <div className="font-semibold text-foreground">Commercial Proposals & Quotes</div>
                    <div className="text-muted-foreground">Proposal readiness and revision expiry warnings</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.categories?.quotations)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        categories: { ...prev.categories, quotations: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div>
                    <div className="font-semibold text-foreground">Project Milestones & Field Progress</div>
                    <div className="text-muted-foreground">Dispatch notices, roof mounting, and DISCOM sync</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.categories?.projectMilestones)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        categories: { ...prev.categories, projectMilestones: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div>
                    <div className="font-semibold text-foreground">Payments & Receipts</div>
                    <div className="text-muted-foreground">Bank realization receipts and statements</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.categories?.payments)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        categories: { ...prev.categories, payments: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 cursor-pointer">
                  <div>
                    <div className="font-semibold text-foreground">Service, Warranty & AMC</div>
                    <div className="text-muted-foreground">Technician visit schedules and warranty expiration alerts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.categories?.serviceAndWarranty ?? (preferences.categories as any)?.warranties ?? true)}
                    onChange={e =>
                      setPreferences(prev => ({
                        ...prev,
                        categories: { ...prev.categories, serviceAndWarranty: e.target.checked }
                      }))
                    }
                    className="w-4 h-4 text-solar-500 rounded focus:ring-solar-500"
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => handleSavePreferences(preferences)}
                disabled={loading}
                className="px-5 py-2.5 rounded-lg bg-solar-500 hover:bg-solar-600 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm shadow-solar-500/20"
              >
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CUSTOMER DOCUMENTS VAULT */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-solar-500" />
                  Verified Project & Compliance Documents
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Official engineering drawings, DISCOM net metering approvals, signed contracts, and manufacturer warranty cards.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-solar-500/10 text-solar-600 rounded-full border border-solar-500/20">
                {customerDocs.length} Verified Files
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-muted-foreground">Loading documents...</div>
            ) : customerDocs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">No documents published yet.</p>
                <p className="text-xs mt-1">
                  Once your system design, commissioning tests, or NOC approvals are finalized, documents will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                      <th className="py-3 px-4">Document Details</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Version</th>
                      <th className="py-3 px-4">File Size</th>
                      <th className="py-3 px-4">Published Date</th>
                      <th className="py-3 px-4 text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customerDocs.map((doc: any) => {
                      const sizeMb = ((doc.fileSizeBytes || 0) / (1024 * 1024)).toFixed(2);
                      return (
                        <tr key={doc._id || doc.id} className="hover:bg-muted/30 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs font-bold text-solar-600">
                              {doc.documentNumber}
                            </div>
                            <div className="font-semibold text-foreground">
                              {doc.safeDisplayName || doc.originalFilename}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{doc.originalFilename}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                              {doc.category ? doc.category.replace(/_/g, ' ') : 'General'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                            v{doc.version || 1}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                            {sizeMb} MB
                          </td>

                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDownloadCustomerDoc(doc._id || doc.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-solar-500 hover:bg-solar-600 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ACCEPT QUOTATION */}
      {showAcceptQuoteModal && targetQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Digital Proposal Acceptance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Confirm digital acceptance of proposal revision {targetQuote.fullQuotationCode || targetQuote.quotationNumber}.
                </p>
              </div>
              <button
                onClick={() => setShowAcceptQuoteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plant Capacity:</span>
                <span className="font-semibold">{targetQuote.systemCapacityKwp} kWp ({targetQuote.systemTopology})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Agreed Value:</span>
                <span className="font-bold text-emerald-600">
                  ₹{((targetQuote.netTotalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
              I hereby accept quotation {targetQuote.quotationNumber || targetQuote.fullQuotationCode} (Revision {targetQuote.revisionNumber}) and authorize INS Solar to proceed with system procurement and site execution under the specified commercial terms.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Acceptance Remarks (Optional)</label>
              <textarea
                value={acceptanceNotes}
                onChange={e => setAcceptanceNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Approved as discussed with sales team."
                className="w-full text-xs p-2.5 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-solar-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptQuoteModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptQuote}
                disabled={submittingDecision}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5"
              >
                {submittingDecision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Confirm Acceptance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT QUOTATION */}
      {showRejectQuoteModal && targetQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Decline Proposal Revision</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Provide feedback to our engineering & sales team for revision.
                </p>
              </div>
              <button
                onClick={() => setShowRejectQuoteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Reason for Declining <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="e.g. Budget revised, or need bifacial module option instead of mono PERC."
                className="w-full text-xs p-2.5 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectQuoteModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectQuote}
                disabled={submittingDecision || !rejectionReason.trim()}
                className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-xs font-semibold flex items-center space-x-1.5"
              >
                {submittingDecision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Decline Proposal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: OPERATIONAL RECEIPT MODAL */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="text-xs font-semibold text-solar-600">Official Operational Receipt</span>
                <h3 className="text-xl font-bold text-foreground">{receiptData.receiptNumber}</h3>
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Non-Tax Invoice Disclaimer Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-bold">Operational Document Notice: </span>
                This document is an operational payment receipt confirming realization of customer funds against solar plant installation milestones. It does not constitute a statutory Tax Invoice under GST law.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border">
                <div>
                  <span className="text-muted-foreground">Receipt Number:</span>
                  <div className="font-semibold text-foreground">{receiptData.receiptNumber}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Date:</span>
                  <div className="font-semibold text-foreground">
                    {new Date(receiptData.paymentDate).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Mode:</span>
                  <div className="font-semibold text-foreground">{receiptData.paymentMethod}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Bank Reference / UTR:</span>
                  <div className="font-semibold text-foreground">{receiptData.transactionReference || 'N/A'}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">Total Realized Amount:</span>
                <span className="text-xl font-bold text-emerald-600">
                  ₹{((receiptData.amountPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Print Copy</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 rounded-lg bg-solar-500 hover:bg-solar-600 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: REPORT SERVICE COMPLAINT */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Report Solar Plant Issue</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Register a defect or generation issue for prompt technician dispatch.
                </p>
              </div>
              <button onClick={() => setShowComplaintModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground">Select Solar Plant</label>
                <select
                  value={complaintForm.projectId}
                  onChange={e => setComplaintForm({ ...complaintForm, projectId: e.target.value })}
                  required
                  className="w-full mt-1 p-2.5 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground">Issue Category</label>
                <select
                  value={complaintForm.category}
                  onChange={e => setComplaintForm({ ...complaintForm, category: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-solar-500"
                >
                  <option value="INVERTER_FAULT">Inverter Error / Red Light</option>
                  <option value="GENERATION_DROP">Generation Drop / Low Output</option>
                  <option value="PHYSICAL_DAMAGE">Panel Cracking / Physical Damage</option>
                  <option value="ROOF_LEAKAGE">Water Seepage / Roof Leakage</option>
                  <option value="METER_DISCOM">Net Meter Disconnect</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground">Issue Title</label>
                <input
                  type="text"
                  required
                  value={complaintForm.title}
                  onChange={e => setComplaintForm({ ...complaintForm, title: e.target.value })}
                  placeholder="e.g. Inverter showing Error E031 after heavy rain"
                  className="w-full mt-1 p-2.5 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Description of Problem</label>
                <textarea
                  required
                  rows={3}
                  value={complaintForm.description}
                  onChange={e => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  placeholder="Please describe symptoms, unusual noises, error codes, or physical damage observed."
                  className="w-full mt-1 p-2.5 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-solar-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComplaintModal(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplaint}
                  className="px-4 py-2 rounded-lg bg-solar-500 hover:bg-solar-600 text-white text-xs font-semibold flex items-center space-x-1.5"
                >
                  {submittingComplaint ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Submit Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
