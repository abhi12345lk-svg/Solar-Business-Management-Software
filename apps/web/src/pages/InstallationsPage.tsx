import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HardHat,
  Search,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Edit,
  UserCheck,
  ShieldCheck,
  RotateCw,
  Sun,
  MapPin,
  Layers,
  UserPlus,
  X,
  FilePlus2,
  Camera
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { InstallationStatus } from '@ins-solar/shared';

interface InstallationSummaryItem {
  _id: string;
  installationNumber: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  customerPhone?: string;
  siteAddress: {
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  capacityKw: number;
  panelDetails: {
    totalPanels: number;
    panelWattage: number;
    totalCalculatedKw: number;
  };
  assignedInstallerId?: string;
  assignedInstallerName?: string;
  installationDate?: string;
  status: InstallationStatus;
  currentStep: number;
  isDraft: boolean;
  rejectionReason?: string;
  adminReviewRemarks?: string;
  photosCount: number;
  manualsCount: number;
  gpsCaptured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  total: number;
  assigned: number;
  pending: number;
  inProgress: number;
  completed: number;
  underReview: number;
  rejected: number;
}

interface InstallerOption {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeCode?: string;
}

interface InstallationsPageProps {
  embedded?: boolean;
}

export const InstallationsPage: React.FC<InstallationsPageProps> = ({ embedded = false }) => {
  const { user } = useAuth();

  const [installations, setInstallations] = useState<InstallationSummaryItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    assigned: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    underReview: 0,
    rejected: 0
  });
  const [installers, setInstallers] = useState<InstallerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedInstaller, setSelectedInstaller] = useState<string>('ALL');

  // Modals
  const [assignModalData, setAssignModalData] = useState<InstallationSummaryItem | null>(null);
  const [selectedInstallerId, setSelectedInstallerId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [reviewModalData, setReviewModalData] = useState<InstallationSummaryItem | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const isAdminOrManager =
    user?.role === 'SUPERADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'DEPARTMENT_HEAD';

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const [statsRes, listRes, installersRes] = await Promise.all([
        apiClient<DashboardStats>('/installations/dashboard-stats'),
        apiClient<{ items: InstallationSummaryItem[]; total: number }>('/installations?limit=100'),
        apiClient<InstallerOption[]>('/installations/installers/list').catch(() => [])
      ]);

      if (statsRes) setStats(statsRes);
      if (listRes?.items) setInstallations(listRes.items);
      if (installersRes) setInstallers(installersRes);
    } catch (err) {
      console.error('Failed to load installations data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignInstaller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalData || !selectedInstallerId) return;

    try {
      setIsAssigning(true);
      await apiClient(`/installations/${assignModalData._id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assignedInstallerId: selectedInstallerId,
          installationDate: scheduledDate || undefined,
          notes: assignNotes || undefined
        })
      });

      setAssignModalData(null);
      setSelectedInstallerId('');
      setScheduledDate('');
      setAssignNotes('');
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to assign installer.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReviewSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalData) return;

    if (reviewDecision === 'REJECT' && !rejectionReason.trim()) {
      alert('Rejection reason is mandatory when rejecting an installation report.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      await apiClient(`/installations/${reviewModalData._id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision: reviewDecision,
          rejectionReason: reviewDecision === 'REJECT' ? rejectionReason.trim() : undefined,
          remarks: reviewRemarks.trim() || undefined
        })
      });

      setReviewModalData(null);
      setRejectionReason('');
      setReviewRemarks('');
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Filtered List
  const filteredInstallations = installations.filter(item => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.installationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customerPhone?.includes(searchQuery) ||
      item.siteAddress?.city?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === 'ALL' ||
      item.status === selectedStatus ||
      (selectedStatus === 'UNDER_REVIEW' && item.status === InstallationStatus.SUBMITTED);

    const matchesInstaller =
      selectedInstaller === 'ALL' ||
      item.assignedInstallerId === selectedInstaller;

    return matchesSearch && matchesStatus && matchesInstaller;
  });

  const getStatusBadge = (status: InstallationStatus) => {
    switch (status) {
      case InstallationStatus.ASSIGNED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Assigned
          </span>
        );
      case InstallationStatus.IN_PROGRESS:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            In Progress
          </span>
        );
      case InstallationStatus.SUBMITTED:
      case InstallationStatus.UNDER_REVIEW:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Under Review
          </span>
        );
      case InstallationStatus.APPROVED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Approved
          </span>
        );
      case InstallationStatus.COMPLETED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            Completed
          </span>
        );
      case InstallationStatus.REJECTED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Rejected
          </span>
        );
      case InstallationStatus.PENDING:
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  return (
    <div className={`space-y-6 ${embedded ? '' : 'max-w-7xl mx-auto'} pb-12`}>
      {/* Header & Actions */}
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-solar-50 text-solar-700 border border-solar-200">
                <HardHat className="w-3.5 h-3.5 mr-1 text-solar-600" />
                Field Operations Hub
              </span>
              <span className="text-xs text-slate-400">• Rarebox Solar ERP</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Installer Panel &amp; Installation Management
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Record rooftop solar installations, equipment serials, barcode scans, GPS coordinates, and site photographs.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchData}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="Refresh Data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-solar-600' : ''}`} />
            </button>
            <Link
              to="/site-photos"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-300 font-bold text-sm transition shadow-2xs cursor-pointer"
              title="Generate Client Site Photos Compliance Document (SITE PHOTOS AT ...)"
            >
              <Camera className="w-4 h-4 text-amber-600" />
              <span>Site Photos Doc</span>
            </Link>
            <Link
              to="/installations/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-solar-600 hover:bg-solar-700 text-white font-bold text-sm shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Installation Entry</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Sleek quick toolbar for embedded dashboard to prevent redundant stacked banners */
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-solar-50 text-solar-700 border border-solar-200">
              <HardHat className="w-3.5 h-3.5 mr-1.5 text-solar-600" />
              Active Field Installation Queue
            </span>
            <span className="hidden md:inline text-xs text-slate-500 font-medium">
              Real-time synchronization with mobile submissions &amp; QA checks
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Link
              to="/site-photos"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-300 text-xs font-bold transition cursor-pointer"
              title="Generate Client Site Photos Compliance Document (SITE PHOTOS AT ...)"
            >
              <Camera className="w-3.5 h-3.5 text-amber-600" />
              <span>Site Photos Doc</span>
            </Link>
            <Link
              to="/create-document"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              title="Create Work Completion Report (WCR) or Annexure A"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-solar-600" />
              <span>Generate WCR / Docs</span>
            </Link>
            <Link
              to="/installations/new"
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Installation Entry</span>
            </Link>
          </div>
        </div>
      )}

      {/* 6 Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Assigned */}
        <div
          onClick={() => setSelectedStatus(InstallationStatus.ASSIGNED)}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatus === InstallationStatus.ASSIGNED
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Assigned</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.assigned}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ready for site work</div>
        </div>

        {/* Pending */}
        <div
          onClick={() => setSelectedStatus(InstallationStatus.PENDING)}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatus === InstallationStatus.PENDING
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.pending}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting assignment</div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setSelectedStatus(InstallationStatus.IN_PROGRESS)}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatus === InstallationStatus.IN_PROGRESS
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">In Progress</span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.inProgress}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active field execution</div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setSelectedStatus(InstallationStatus.COMPLETED)}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatus === InstallationStatus.COMPLETED
              ? 'bg-green-50/80 border-green-300 ring-2 ring-green-500/20'
              : 'bg-white border-slate-200 hover:border-green-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-green-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.completed}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Finished & closed</div>
        </div>

        {/* Under Review / Pending Approval */}
        <div
          onClick={() => setSelectedStatus('UNDER_REVIEW')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatus === 'UNDER_REVIEW'
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Under Review</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.underReview}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pending QA approval</div>
        </div>

        {/* Rejected */}
        <div
          onClick={() => setSelectedStatus(InstallationStatus.REJECTED)}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatus === InstallationStatus.REJECTED
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.rejected}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Needs resubmission</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, code, phone, installation ID, or city..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-solar-500/20 focus:border-solar-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status select */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          >
            <option value="ALL">All Statuses ({stats.total})</option>
            <option value={InstallationStatus.ASSIGNED}>Assigned ({stats.assigned})</option>
            <option value={InstallationStatus.IN_PROGRESS}>In Progress ({stats.inProgress})</option>
            <option value="UNDER_REVIEW">Under Review ({stats.underReview})</option>
            <option value={InstallationStatus.APPROVED}>Approved</option>
            <option value={InstallationStatus.COMPLETED}>Completed ({stats.completed})</option>
            <option value={InstallationStatus.REJECTED}>Rejected ({stats.rejected})</option>
            <option value={InstallationStatus.PENDING}>Pending ({stats.pending})</option>
          </select>

          {/* Installer select */}
          <select
            value={selectedInstaller}
            onChange={e => setSelectedInstaller(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-solar-500/20"
          >
            <option value="ALL">All Field Installers</option>
            {installers.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>

          {(selectedStatus !== 'ALL' || selectedInstaller !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus('ALL');
                setSelectedInstaller('ALL');
                setSearchQuery('');
              }}
              className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Installation Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <RotateCw className="w-8 h-8 animate-spin text-solar-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading installation records...</p>
          </div>
        ) : filteredInstallations.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-solar-50 rounded-2xl flex items-center justify-center text-solar-600 mx-auto">
              <HardHat className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Installation Records Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedStatus !== 'ALL'
                ? 'No installations match your search criteria. Try modifying your filters.'
                : 'Get started by creating your first solar installation entry from customer projects.'}
            </p>
            <Link
              to="/installations/new"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Installation</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Installation ID & Date</th>
                  <th className="px-5 py-3.5">Customer & Site Address</th>
                  <th className="px-5 py-3.5">System Capacity</th>
                  <th className="px-5 py-3.5">Assigned Installer</th>
                  <th className="px-5 py-3.5">Workflow Progress</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInstallations.map(item => (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition">
                    {/* ID & Date */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-xs text-solar-700">
                        {item.installationNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>

                    {/* Customer & Address */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{item.customerName}</div>
                      <div className="text-xs text-slate-500 flex items-center mt-0.5">
                        <MapPin className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {item.siteAddress.city || 'Site'}, {item.siteAddress.state || 'Chhattisgarh'}
                        </span>
                      </div>
                      {item.customerPhone && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.customerPhone}</div>
                      )}
                    </td>

                    {/* Capacity */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 flex items-center">
                        <Sun className="w-3.5 h-3.5 mr-1 text-solar-500" />
                        {item.capacityKw || item.panelDetails?.totalCalculatedKw || 0} kW
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.panelDetails?.totalPanels || 0} Solar Panels
                      </div>
                    </td>

                    {/* Assigned Installer */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {item.assignedInstallerName ? (
                        <div className="flex items-center space-x-1.5">
                          <div className="w-6 h-6 rounded-full bg-solar-100 text-solar-800 text-[10px] font-bold flex items-center justify-center">
                            {item.assignedInstallerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-800">
                              {item.assignedInstallerName}
                            </div>
                            {item.installationDate && (
                              <div className="text-[10px] text-slate-400">
                                Date:{' '}
                                {new Date(item.installationDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short'
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssignModalData(item)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Assign Crew</span>
                        </button>
                      )}
                    </td>

                    {/* Workflow Progress */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="w-36">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                          <span>Step {item.currentStep} of 11</span>
                          <span>{Math.round((item.currentStep / 11) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-solar-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${(item.currentStep / 11) * 100}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
                          <span>{item.photosCount}/10 Photos</span>
                          {item.gpsCaptured && <span className="text-emerald-600 font-bold">• GPS</span>}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                      {item.status === InstallationStatus.REJECTED && item.rejectionReason && (
                        <div
                          className="text-[10px] text-rose-600 mt-1 truncate max-w-[140px]"
                          title={item.rejectionReason}
                        >
                          {item.rejectionReason}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Link
                          to={`/installations/${item._id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          title="View Installation Report"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        <Link
                          to={`/site-photos?customerId=${item.customerId || ''}`}
                          className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition cursor-pointer"
                          title="Generate Client Site Photos Document (SITE PHOTOS AT ...)"
                        >
                          <Camera className="w-4 h-4" />
                        </Link>

                        {(item.status === InstallationStatus.IN_PROGRESS ||
                          item.status === InstallationStatus.ASSIGNED ||
                          item.status === InstallationStatus.REJECTED ||
                          item.isDraft) && (
                          <Link
                            to={`/installations/${item._id}/edit`}
                            className="p-1.5 rounded-lg text-solar-600 hover:text-solar-800 hover:bg-solar-50 transition cursor-pointer"
                            title="Edit / Resume Installation Wizard"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}

                        {isAdminOrManager && (
                          <>
                            <button
                              onClick={() => {
                                setAssignModalData(item);
                                setSelectedInstallerId(item.assignedInstallerId || '');
                                setScheduledDate(
                                  item.installationDate ? item.installationDate.split('T')[0] || '' : ''
                                );
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition cursor-pointer"
                              title="Assign or Reassign Installer"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>

                            {(item.status === InstallationStatus.SUBMITTED ||
                              item.status === InstallationStatus.UNDER_REVIEW) && (
                              <button
                                onClick={() => {
                                  setReviewModalData(item);
                                  setReviewDecision('APPROVE');
                                  setRejectionReason('');
                                  setReviewRemarks('');
                                }}
                                className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
                                title="Approve / Reject Report"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Assign Installer */}
      {assignModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Assign Field Installer</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {assignModalData.installationNumber} • {assignModalData.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalData(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignInstaller} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Field Installer / Crew *
                </label>
                <select
                  required
                  value={selectedInstallerId}
                  onChange={e => setSelectedInstallerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Choose Installer --</option>
                  {installers.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Scheduled Installation Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assignment Instructions / Site Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Bring extra DC MC4 connectors, rooftop ladder required..."
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning || !selectedInstallerId}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin QA Approval / Rejection */}
      {reviewModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Admin Installation Verification</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {reviewModalData.installationNumber} • {reviewModalData.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewModalData(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmission} className="space-y-4">
              {/* Decision */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Review Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center space-x-2 p-3 rounded-xl border cursor-pointer transition ${
                      reviewDecision === 'APPROVE'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="APPROVE"
                      checked={reviewDecision === 'APPROVE'}
                      onChange={() => setReviewDecision('APPROVE')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex items-center text-xs">
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                      Approve & Complete
                    </div>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-3 rounded-xl border cursor-pointer transition ${
                      reviewDecision === 'REJECT'
                        ? 'bg-rose-50 border-rose-500 text-rose-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="REJECT"
                      checked={reviewDecision === 'REJECT'}
                      onChange={() => setReviewDecision('REJECT')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex items-center text-xs">
                      <XCircle className="w-4 h-4 mr-1.5 text-rose-600" />
                      Reject / Resubmit
                    </div>
                  </label>
                </div>
              </div>

              {/* Rejection Reason (Mandatory if Reject) */}
              {reviewDecision === 'REJECT' && (
                <div>
                  <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1.5">
                    Rejection Reason (Mandatory) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Specify why the report is rejected (e.g. Inverter serial photo is blurry, earthing pit resistance not documented)..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-rose-50/50 border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-800"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    The field installer will receive this feedback and can edit the form to resubmit.
                  </p>
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Approval Notes / Verification Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional QA remarks for compliance records..."
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition shadow-xs disabled:opacity-50 ${
                    reviewDecision === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmittingReview ? 'Submitting...' : `Confirm ${reviewDecision === 'APPROVE' ? 'Approval' : 'Rejection'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
