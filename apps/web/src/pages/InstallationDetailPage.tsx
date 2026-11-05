import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  HardHat,
  ArrowLeft,
  Calendar,
  MapPin,
  Sun,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Download,
  ExternalLink,
  Edit,
  UserCheck,
  Layers,
  FileText,
  Camera,
  Compass,
  Zap,
  Boxes,
  QrCode,
  RotateCw,
  Eye,
  X,
  ZoomIn,
  ZoomOut,
  Building,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { InstallationStatus, SitePhotoCategory, TechnicalManualCategory } from '@ins-solar/shared';

interface SitePhotoItem {
  category: SitePhotoCategory;
  title: string;
  storageKey: string;
  fileUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  timestamp: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  remarks?: string;
}

interface EquipmentItem {
  equipmentName: string;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber: string;
  barcode: string;
  ratingCapacity: string;
  photoUrl?: string;
  remarks?: string;
}

interface InventoryRow {
  sNo: number;
  equipmentName: string;
  barcode: string;
  serialNumber: string;
  model: string;
  quantity: number;
  status: string;
  notes?: string;
}

interface TechnicalManualItem {
  category: TechnicalManualCategory;
  title: string;
  storageKey: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

interface InstallationDetail {
  _id: string;
  installationNumber: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  customerPhone?: string;
  projectId?: string;
  projectName?: string;
  siteAddress: {
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  capacityKw: number;
  assignedInstallerId?: string;
  assignedInstallerName?: string;
  installationDate?: string;
  completedDate?: string;
  status: InstallationStatus;
  currentStep: number;
  isDraft: boolean;
  rejectionReason?: string;
  adminReviewRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  equipment: {
    earthing: EquipmentItem;
    structure: EquipmentItem;
    panels: EquipmentItem;
    lightningProtection: EquipmentItem;
    inverter: EquipmentItem;
    netMeter: EquipmentItem;
  };

  panelDetails: {
    totalPanels: number;
    panelManufacturer: string;
    panelModel: string;
    panelWattage: number;
    totalCalculatedKw: number;
    serialNumbers: string[];
    barcodes: string[];
    remarks?: string;
  };

  inventory: InventoryRow[];
  photos: SitePhotoItem[];
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    capturedAt?: string;
    addressSnapshot?: string;
  };
  manuals: TechnicalManualItem[];
  history: Array<{
    action: string;
    performedByName: string;
    timestamp: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const InstallationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [installation, setInstallation] = useState<InstallationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'equipment' | 'inventory' | 'photos' | 'location' | 'manuals' | 'audit'>('overview');

  // Photo Lightbox modal
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhotoItem | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const isAdminOrManager =
    user?.role === 'SUPERADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'DEPARTMENT_HEAD';

  const fetchInstallation = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await apiClient<InstallationDetail>(`/installations/${id}`);
      if (res) {
        setInstallation(res);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to fetch installation details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallation();
  }, [id]);

  const handleReviewSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installation) return;

    if (reviewDecision === 'REJECT' && !rejectionReason.trim()) {
      alert('Please provide a mandatory reason for rejecting this installation.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      await apiClient(`/installations/${installation._id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision: reviewDecision,
          rejectionReason: reviewDecision === 'REJECT' ? rejectionReason.trim() : undefined,
          remarks: reviewRemarks.trim() || undefined
        })
      });

      setShowReviewModal(false);
      await fetchInstallation();
    } catch (err: any) {
      alert(err?.message || 'Review submission failed.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RotateCw className="w-8 h-8 animate-spin text-solar-500" />
        <p className="text-sm font-semibold text-slate-600">Loading installation details...</p>
      </div>
    );
  }

  if (!installation) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Installation Record Not Found</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          The requested installation record could not be loaded or has been deleted.
        </p>
        <Link
          to="/installations"
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-solar-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-solar-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Installation Hub</span>
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: InstallationStatus) => {
    switch (status) {
      case InstallationStatus.ASSIGNED:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Assigned
          </span>
        );
      case InstallationStatus.IN_PROGRESS:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            In Progress
          </span>
        );
      case InstallationStatus.SUBMITTED:
      case InstallationStatus.UNDER_REVIEW:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            Under Review
          </span>
        );
      case InstallationStatus.APPROVED:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Approved & QA Verified
          </span>
        );
      case InstallationStatus.COMPLETED:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            Completed & Operational
          </span>
        );
      case InstallationStatus.REJECTED:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Rejected / Resubmission Required
          </span>
        );
      case InstallationStatus.PENDING:
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Pending Assignment
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:space-y-4">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs print:border-none print:shadow-none">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/installations"
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-solar-600 transition print:hidden"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Installations
            </Link>
            <span className="text-slate-300 print:hidden">•</span>
            <span className="font-mono text-xs font-bold text-solar-700 bg-solar-50 px-2 py-0.5 rounded-md border border-solar-200">
              {installation.installationNumber}
            </span>
            {installation.isDraft && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Draft
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {installation.customerName} — Solar Installation Report
            </h1>
            <div>{getStatusBadge(installation.status)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
              {installation.siteAddress.city || 'Site'}, {installation.siteAddress.state || 'Chhattisgarh'}
            </span>
            <span className="flex items-center">
              <Sun className="w-3.5 h-3.5 mr-1 text-solar-500" />
              Capacity: {installation.capacityKw || installation.panelDetails?.totalCalculatedKw || 0} kW
            </span>
            {installation.assignedInstallerName && (
              <span className="flex items-center">
                <UserCheck className="w-3.5 h-3.5 mr-1 text-blue-500" />
                Installer: {installation.assignedInstallerName}
              </span>
            )}
            <span className="flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Date: {new Date(installation.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 print:hidden">
          <button
            onClick={printReport}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Report</span>
          </button>

          {(installation.status === InstallationStatus.IN_PROGRESS ||
            installation.status === InstallationStatus.ASSIGNED ||
            installation.status === InstallationStatus.REJECTED ||
            installation.isDraft) && (
            <Link
              to={`/installations/${installation._id}/edit`}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span>Continue / Edit Form</span>
            </Link>
          )}

          {isAdminOrManager && (
            <button
              onClick={() => {
                setShowReviewModal(true);
                setReviewDecision('APPROVE');
                setRejectionReason('');
                setReviewRemarks('');
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>QA Review & Verification</span>
            </button>
          )}
        </div>
      </div>

      {/* Rejection Notice Banner */}
      {installation.status === InstallationStatus.REJECTED && installation.rejectionReason && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Installation Report Returned for Revision
            </h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              <strong>Admin Feedback:</strong> {installation.rejectionReason}
            </p>
            <p className="text-[11px] text-rose-600">
              Please click "Continue / Edit Form" above to address these remarks and resubmit.
            </p>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            System Capacity
          </div>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <Sun className="w-4 h-4 mr-1 text-solar-500" />
            {installation.panelDetails?.totalCalculatedKw || installation.capacityKw || 0} kW
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rooftop Solar PV</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Solar Panels
          </div>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <Layers className="w-4 h-4 mr-1 text-blue-500" />
            {installation.panelDetails?.totalPanels || 0} Nos
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {installation.panelDetails?.panelWattage || 0}W / module
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Site Photographs
          </div>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <Camera className="w-4 h-4 mr-1 text-purple-500" />
            {installation.photos?.length || 0} / 10
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Verified site photos</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            GPS Geotagging
          </div>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <Compass className="w-4 h-4 mr-1 text-emerald-500" />
            {installation.gpsLocation ? 'Captured' : 'Pending'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {installation.gpsLocation?.accuracyMeters
              ? `Accurate to ±${installation.gpsLocation.accuracyMeters}m`
              : 'Site coordinates'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Inventory Rows
          </div>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <Boxes className="w-4 h-4 mr-1 text-amber-500" />
            {installation.inventory?.length || 0} Items
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Barcodes scanned</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Technical Manuals
          </div>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <FileText className="w-4 h-4 mr-1 text-indigo-500" />
            {installation.manuals?.length || 0} Docs
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">PDFs & datasheets</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-1 border-b border-slate-200 overflow-x-auto pb-px print:hidden">
        {[
          { key: 'overview', label: 'Overview & Customer', icon: Building },
          { key: 'equipment', label: 'Equipment & Panels', icon: Zap },
          { key: 'inventory', label: `Inventory Table (${installation.inventory?.length || 0})`, icon: Boxes },
          { key: 'photos', label: `Site Photos (${installation.photos?.length || 0}/10)`, icon: Camera },
          { key: 'location', label: 'Live GPS Site Location', icon: Compass },
          { key: 'manuals', label: `Technical Manuals (${installation.manuals?.length || 0})`, icon: FileText },
          { key: 'audit', label: 'Workflow & Audit History', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-solar-600 text-solar-700 bg-solar-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Overview & Customer */}
      {(activeTab === 'overview' || window.matchMedia('print').matches) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Building className="w-5 h-5 text-solar-600" />
              <h3 className="font-bold text-slate-900">Customer & Site Profile</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Customer Name</span>
                <span className="text-slate-900 font-bold text-sm">{installation.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Customer ID / Code</span>
                <span className="text-slate-900 font-mono font-bold">
                  {installation.customerCode || installation.customerId}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Mobile Number</span>
                <span className="text-slate-900 font-bold">{installation.customerPhone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Linked EPC Project</span>
                <span className="text-slate-900 font-bold">
                  {installation.projectName || 'Direct Solar Installation'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block font-semibold mb-0.5">Installation Site Address</span>
                <span className="text-slate-900 font-medium">
                  {installation.siteAddress.addressLine1 || ''} {installation.siteAddress.city || ''},{' '}
                  {installation.siteAddress.state || ''} - {installation.siteAddress.pincode || ''}
                </span>
              </div>
            </div>
          </div>

          {/* Installation Project Meta */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <HardHat className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Field Execution Status</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Installation ID</span>
                <span className="font-mono text-solar-700 font-black text-sm">
                  {installation.installationNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Current Status</span>
                <div>{getStatusBadge(installation.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Assigned Field Crew</span>
                <span className="text-slate-900 font-bold">
                  {installation.assignedInstallerName || 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Scheduled Date</span>
                <span className="text-slate-900 font-bold">
                  {installation.installationDate
                    ? new Date(installation.installationDate).toLocaleDateString('en-IN')
                    : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Completed Date</span>
                <span className="text-slate-900 font-bold">
                  {installation.completedDate
                    ? new Date(installation.completedDate).toLocaleDateString('en-IN')
                    : 'Pending completion'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold mb-0.5">Reviewer / QA Officer</span>
                <span className="text-slate-900 font-bold">
                  {installation.reviewedAt
                    ? `Approved on ${new Date(installation.reviewedAt).toLocaleDateString('en-IN')}`
                    : 'Awaiting QA Verification'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Equipment & Solar Panels */}
      {(activeTab === 'equipment' || window.matchMedia('print').matches) && (
        <div className="space-y-6">
          {/* Solar Panel Calculation Card */}
          <div className="bg-gradient-to-r from-solar-50 via-amber-50 to-orange-50 p-6 rounded-2xl border border-solar-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-solar-800 font-black text-lg">
                  <Sun className="w-5 h-5 text-solar-600" />
                  <span>Solar PV Module Capacity Calculation</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Formula: Total Number of Panels × Panel Wattage Rating = Total Installed System Capacity
                </p>
              </div>

              <div className="bg-white px-6 py-3 rounded-xl border border-solar-300 shadow-2xs text-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Calculated Capacity
                </span>
                <span className="text-2xl font-black text-solar-700">
                  {installation.panelDetails?.totalPanels || 0} ×{' '}
                  {installation.panelDetails?.panelWattage || 0}W ={' '}
                  <span className="text-slate-900">
                    {installation.panelDetails?.totalCalculatedKw || installation.capacityKw || 0} kW
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-solar-200/80 text-xs">
              <div>
                <span className="text-slate-500 block font-semibold">Panel Manufacturer</span>
                <span className="font-bold text-slate-900">
                  {installation.panelDetails?.panelManufacturer || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Panel Model Number</span>
                <span className="font-bold text-slate-900">
                  {installation.panelDetails?.panelModel || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Total Module Count</span>
                <span className="font-bold text-slate-900">
                  {installation.panelDetails?.totalPanels || 0} Modules
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Individual Module Wattage</span>
                <span className="font-bold text-slate-900">
                  {installation.panelDetails?.panelWattage || 0} Watts
                </span>
              </div>
            </div>
          </div>

          {/* 6 Equipment Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Earthing System */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center mr-2">
                    A
                  </span>
                  Earthing System
                </span>
                <span className="text-[10px] font-bold text-slate-400">GROUNDING</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400">Make / Brand: </span>
                  <span className="font-bold text-slate-900">{installation.equipment?.earthing?.brand || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Model: </span>
                  <span className="text-slate-900">{installation.equipment?.earthing?.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Serial No: </span>
                  <span className="font-mono text-slate-900">{installation.equipment?.earthing?.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Rating / Resistance: </span>
                  <span className="text-slate-900">{installation.equipment?.earthing?.ratingCapacity || 'N/A'}</span>
                </div>
                {installation.equipment?.earthing?.remarks && (
                  <div className="text-[11px] text-slate-500 italic mt-1">
                    "{installation.equipment.earthing.remarks}"
                  </div>
                )}
              </div>
            </div>

            {/* Solar Mounting Structure */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center mr-2">
                    B
                  </span>
                  Solar Structure
                </span>
                <span className="text-[10px] font-bold text-slate-400">MOUNTING</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400">Type / Make: </span>
                  <span className="font-bold text-slate-900">{installation.equipment?.structure?.brand || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Structure Model: </span>
                  <span className="text-slate-900">{installation.equipment?.structure?.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Serial / Batch: </span>
                  <span className="font-mono text-slate-900">{installation.equipment?.structure?.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Tilt & Azimuth: </span>
                  <span className="text-slate-900">{installation.equipment?.structure?.ratingCapacity || 'N/A'}</span>
                </div>
                {installation.equipment?.structure?.remarks && (
                  <div className="text-[11px] text-slate-500 italic mt-1">
                    "{installation.equipment.structure.remarks}"
                  </div>
                )}
              </div>
            </div>

            {/* Solar Panels Equipment */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-solar-100 text-solar-800 text-xs font-bold flex items-center justify-center mr-2">
                    C
                  </span>
                  Solar PV Modules
                </span>
                <span className="text-[10px] font-bold text-slate-400">GENERATION</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400">Manufacturer: </span>
                  <span className="font-bold text-slate-900">{installation.equipment?.panels?.brand || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Module Model: </span>
                  <span className="text-slate-900">{installation.equipment?.panels?.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Serial No / Batch: </span>
                  <span className="font-mono text-slate-900">{installation.equipment?.panels?.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Total Rating: </span>
                  <span className="text-slate-900">{installation.equipment?.panels?.ratingCapacity || 'N/A'}</span>
                </div>
                {installation.equipment?.panels?.remarks && (
                  <div className="text-[11px] text-slate-500 italic mt-1">
                    "{installation.equipment.panels.remarks}"
                  </div>
                )}
              </div>
            </div>

            {/* Lightning Protection */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 text-xs font-bold flex items-center justify-center mr-2">
                    D
                  </span>
                  Lightning Protection
                </span>
                <span className="text-[10px] font-bold text-slate-400">SAFETY</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400">Make / Brand: </span>
                  <span className="font-bold text-slate-900">{installation.equipment?.lightningProtection?.brand || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Arrester Model: </span>
                  <span className="text-slate-900">{installation.equipment?.lightningProtection?.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Serial Number: </span>
                  <span className="font-mono text-slate-900">{installation.equipment?.lightningProtection?.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Arrester Rating: </span>
                  <span className="text-slate-900">{installation.equipment?.lightningProtection?.ratingCapacity || 'N/A'}</span>
                </div>
                {installation.equipment?.lightningProtection?.remarks && (
                  <div className="text-[11px] text-slate-500 italic mt-1">
                    "{installation.equipment.lightningProtection.remarks}"
                  </div>
                )}
              </div>
            </div>

            {/* Solar Inverter */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center mr-2">
                    E
                  </span>
                  Solar Inverter
                </span>
                <span className="text-[10px] font-bold text-slate-400">CONVERSION</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400">Inverter Make: </span>
                  <span className="font-bold text-slate-900">{installation.equipment?.inverter?.brand || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Model: </span>
                  <span className="text-slate-900">{installation.equipment?.inverter?.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Serial Number: </span>
                  <span className="font-mono text-slate-900">{installation.equipment?.inverter?.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">kW / kVA Rating: </span>
                  <span className="text-slate-900">{installation.equipment?.inverter?.ratingCapacity || 'N/A'}</span>
                </div>
                {installation.equipment?.inverter?.remarks && (
                  <div className="text-[11px] text-slate-500 italic mt-1">
                    "{installation.equipment.inverter.remarks}"
                  </div>
                )}
              </div>
            </div>

            {/* Net Meter / Generation Meter */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center">
                  <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center mr-2">
                    F
                  </span>
                  Net / Generation Meter
                </span>
                <span className="text-[10px] font-bold text-slate-400">GRID COMPLIANCE</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-400">Meter Brand: </span>
                  <span className="font-bold text-slate-900">{installation.equipment?.netMeter?.brand || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Model: </span>
                  <span className="text-slate-900">{installation.equipment?.netMeter?.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Meter Serial Number: </span>
                  <span className="font-mono text-slate-900">{installation.equipment?.netMeter?.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Class / Rating: </span>
                  <span className="text-slate-900">{installation.equipment?.netMeter?.ratingCapacity || 'N/A'}</span>
                </div>
                {installation.equipment?.netMeter?.remarks && (
                  <div className="text-[11px] text-slate-500 italic mt-1">
                    "{installation.equipment.netMeter.remarks}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Inventory & Scanned Barcodes */}
      {(activeTab === 'inventory' || window.matchMedia('print').matches) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Equipment Inventory & Barcode Scans</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every scanned equipment barcode, component serial number, and verified stock status.
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg font-mono">
              Total {installation.inventory?.length || 0} Components
            </span>
          </div>

          {installation.inventory?.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No inventory equipment rows have been recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">S.No.</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Barcode / QR</th>
                    <th className="px-4 py-3">Serial Number</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {installation.inventory?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-400">{row.sNo || idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.equipmentName}</td>
                      <td className="px-4 py-3 font-mono text-solar-700 font-bold flex items-center space-x-1">
                        <QrCode className="w-3.5 h-3.5 text-solar-500 shrink-0" />
                        <span>{row.barcode || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{row.serialNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.model || 'N/A'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.quantity || 1}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {row.status || 'VERIFIED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Site Photographs (10 Categories) */}
      {(activeTab === 'photos' || window.matchMedia('print').matches) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Installation Site Photographs ({installation.photos?.length || 0} / 10)
              </h3>
              <p className="text-xs text-slate-500">
                10 Mandatory rooftop solar site photograph categories with timestamps and GPS geotags.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.values(SitePhotoCategory).map((category, idx) => {
              const photo = installation.photos?.find(p => p.category === category);
              const label = category.replace(/_/g, ' ');

              return (
                <div
                  key={category}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
                >
                  {/* Photo Header */}
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 truncate" title={label}>
                      {idx + 1}. {label}
                    </span>
                    {photo ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Photo Uploaded" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" title="Pending Photo" />
                    )}
                  </div>

                  {/* Thumbnail / Placeholder */}
                  <div className="aspect-4/3 bg-slate-900 relative flex items-center justify-center overflow-hidden group">
                    {photo ? (
                      <>
                        <img
                          src={photo.fileUrl}
                          alt={photo.title || label}
                          className="w-full h-full object-cover transition group-hover:scale-105 duration-200"
                        />
                        <button
                          onClick={() => {
                            setSelectedPhoto(photo);
                            setPhotoZoom(1);
                          }}
                          className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
                        >
                          <Eye className="w-6 h-6 drop-shadow-md" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Camera className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-500 block">No Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Footer details */}
                  <div className="p-3 text-[11px] space-y-1 flex-1 flex flex-col justify-between">
                    {photo ? (
                      <>
                        <div className="text-slate-400 truncate" title={photo.originalFilename}>
                          {photo.originalFilename}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>
                            {new Date(photo.uploadedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </span>
                          <span className="font-mono">{(photo.fileSizeBytes / 1024).toFixed(0)} KB</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Slot awaiting upload</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Live GPS Site Location */}
      {(activeTab === 'location' || window.matchMedia('print').matches) && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center">
                <Compass className="w-5 h-5 mr-2 text-emerald-600" />
                Live GPS Geolocation Coordinates
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Device GPS hardware coordinate verification captured at the customer rooftop installation site.
              </p>
            </div>

            {installation.gpsLocation && (
              <a
                href={`https://maps.google.com/?q=${installation.gpsLocation.latitude},${installation.gpsLocation.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer print:hidden"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Google Maps</span>
              </a>
            )}
          </div>

          {installation.gpsLocation ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Coordinates Info */}
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Verified Coordinates
                  </span>
                  <div className="text-lg font-mono font-black text-slate-900">
                    {installation.gpsLocation.latitude.toFixed(6)},{' '}
                    {installation.gpsLocation.longitude.toFixed(6)}
                  </div>
                  <div className="text-xs text-emerald-700 mt-1 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Accuracy: ±{installation.gpsLocation.accuracyMeters || 5} meters
                  </div>
                </div>

                <div className="text-xs space-y-2 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-400">Captured At: </span>
                    <span className="font-bold text-slate-800">
                      {installation.gpsLocation.capturedAt
                        ? new Date(installation.gpsLocation.capturedAt).toLocaleString('en-IN')
                        : 'At time of installation'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400">Site Address: </span>
                    <span className="text-slate-800">
                      {installation.siteAddress.city}, {installation.siteAddress.state} -{' '}
                      {installation.siteAddress.pincode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Map Preview Iframe (OpenStreetMap embed) */}
              <div className="md:col-span-2 h-72 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                <iframe
                  title="Site Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${installation.gpsLocation.longitude - 0.005}%2C${installation.gpsLocation.latitude - 0.005}%2C${installation.gpsLocation.longitude + 0.005}%2C${installation.gpsLocation.latitude + 0.005}&layer=mapnik&marker=${installation.gpsLocation.latitude}%2C${installation.gpsLocation.longitude}`}
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Compass className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No GPS coordinates captured yet.</p>
              <p className="text-xs text-slate-400">
                The field installer can capture live coordinates directly from the mobile browser.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Technical Manuals & Documents */}
      {(activeTab === 'manuals' || window.matchMedia('print').matches) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Technical Manuals & Commissioning Documents</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inverter user guides, solar panel datasheets, structure certificates, and single-line diagrams.
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg font-mono">
              {installation.manuals?.length || 0} Files Attached
            </span>
          </div>

          {installation.manuals?.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No technical manuals or datasheets attached to this installation.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {installation.manuals?.map((manual, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{manual.title}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span className="font-semibold text-indigo-600">
                          {manual.category.replace(/_/g, ' ')}
                        </span>
                        <span>•</span>
                        <span>{manual.fileName}</span>
                        <span>•</span>
                        <span>{(manual.fileSizeBytes / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={manual.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View / Download</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit History Timeline */}
      {(activeTab === 'audit' || window.matchMedia('print').matches) && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-slate-600" />
            <h3 className="font-bold text-slate-900">Installation Audit Trail & Verification Logs</h3>
          </div>

          <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 py-2">
            {installation.history?.map((hist, idx) => (
              <div key={idx} className="relative pl-6">
                <div className="absolute -left-1.75 top-1 w-3.5 h-3.5 rounded-full bg-solar-500 ring-4 ring-white" />
                <div className="text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 font-mono">
                      {hist.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      by {hist.performedByName} •{' '}
                      {new Date(hist.timestamp).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {hist.notes && (
                    <p className="text-slate-600 text-[11px] mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                      {hist.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Fullscreen Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 select-none">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Lightbox Header */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h4 className="text-sm font-bold">{selectedPhoto.title}</h4>
                <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                  <span className="text-solar-400 font-semibold">
                    {selectedPhoto.category.replace(/_/g, ' ')}
                  </span>
                  <span>•</span>
                  <span>{new Date(selectedPhoto.uploadedAt).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPhotoZoom(prev => Math.min(prev + 0.25, 3))}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPhotoZoom(prev => Math.max(prev - 0.25, 0.5))}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <a
                  href={selectedPhoto.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Open Fullscreen in New Window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lightbox Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[360px] bg-slate-950">
              <img
                src={selectedPhoto.fileUrl}
                alt={selectedPhoto.title}
                style={{
                  transform: `scale(${photoZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Admin QA Review */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Admin QA Verification</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {installation.installationNumber} • {installation.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmission} className="space-y-4">
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

              {reviewDecision === 'REJECT' && (
                <div>
                  <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-1.5">
                    Rejection Reason (Mandatory) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide specific feedback on why the report is rejected..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-rose-50/50 border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Approval Notes / QA Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional verification remarks for compliance records..."
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
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
