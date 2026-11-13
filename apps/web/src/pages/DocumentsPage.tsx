import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  FileCheck2,
  UploadCloud,
  File,
  X,
  Building,
  XCircle,
  AlertTriangle,
  FolderLock,
  RefreshCw,
  Upload,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  FilePlus2,
  Trash2,
  Lock
} from 'lucide-react';
import { apiClient, getFullApiUrl } from '../lib/api.js';

interface DocumentItem {
  _id: string;
  documentNumber: string;
  originalFilename: string;
  safeDisplayName: string;
  category: string;
  accessClassification: 'INTERNAL_ONLY' | 'CUSTOMER_VISIBLE' | 'RESTRICTED';
  reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';
  storageKey: string;
  storageStatus: string;
  mimeType: string;
  fileSizeBytes: number;
  version: number;
  isLatestVersion: boolean;
  isArchived: boolean;
  createdAt: string;
  reviewNotes?: string;
  rejectionReason?: string;
  customerId?: {
    _id: string;
    customerCode?: string;
    name?: string;
    fullName?: string;
    companyName?: string;
    primaryPhone?: string;
    email?: string;
  };
  projectId?: {
    _id: string;
    projectNumber?: string;
    title?: string;
  };
  reviewActorId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  uploadedBy?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
}

interface CustomerOption {
  _id: string;
  id?: string;
  customerCode: string;
  name?: string;
  legalName?: string;
  companyName?: string;
  primaryPhone?: string;
}

const SOLAR_CATEGORIES: { value: string; label: string; icon: string; description: string }[] = [
  { value: 'ELECTRICITY_BILL', label: 'Electricity Bill', icon: '⚡', description: 'Recent DISCOM power tariff bill' },
  { value: 'AADHAAR_CARD', label: 'Aadhaar Card (KYC)', icon: '🪪', description: 'Applicant identity & address proof' },
  { value: 'PAN_CARD', label: 'PAN Card', icon: '💳', description: 'Income Tax PAN card for billing' },
  { value: 'PROPERTY_TAX_RECEIPT', label: 'Property / House Tax', icon: '🏛️', description: 'Municipal tax receipt or registry deed' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook / Cheque', icon: '🏦', description: 'Cancelled cheque / passbook for DBT subsidy' },
  { value: 'SITE_PHOTOS', label: 'Site & Rooftop Photos', icon: '📸', description: 'Rooftop layout, shadow & structure photos' },
  { value: 'SITE_GEOTAG_LOCATION', label: 'GPS Site Geotag', icon: '📍', description: 'Verified latitude/longitude installation coordinates' },
  { value: 'QUOTATION_PROPOSAL', label: 'Solar Quotation / Proposal', icon: '📑', description: 'Techno-commercial proposal & plant sizing' },
  { value: 'SIGNED_CONTRACT', label: 'Signed EPC Contract', icon: '🖋️', description: 'Executed turnkey installation agreement' },
  { value: 'NET_METERING_DOC', label: 'Net Metering Application', icon: '🔌', description: 'DISCOM net meter submission & SLD' },
  { value: 'SUBSIDY_DOC', label: 'PM Surya Ghar Subsidy', icon: '☀️', description: 'National CFA subsidy application dossier' },
  { value: 'WARRANTY_CERTIFICATE', label: 'Equipment Warranty', icon: '📜', description: 'Solar module, inverter & structure warranties' },
  { value: 'COMMISSIONING_REPORT', label: 'Joint Commissioning Report', icon: '📋', description: 'Plant synchronization & test report' },
  { value: 'CUSTOMER_KYC', label: 'General Customer KYC', icon: '👤', description: 'Customer documentation & identity files' },
  { value: 'OTHER', label: 'Other Documents', icon: '📁', description: 'Supplementary paperwork & general records' },
];

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getCategoryMeta = (categoryVal: string) => {
  const match = SOLAR_CATEGORIES.find(c => c.value === categoryVal);
  if (match) return match;
  return {
    value: categoryVal,
    label: categoryVal.replace(/_/g, ' '),
    icon: '📄',
    description: 'Document record'
  };
};

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const customerIdParam = searchParams.get('customerId') || '';

  // Filters
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState(customerIdParam);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [deleteModalDoc, setDeleteModalDoc] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Form State: Review Modal
  const [nextReviewStatus, setNextReviewStatus] = useState<
    'ACCEPTED' | 'REJECTED' | 'RESUBMISSION_REQUIRED'
  >('ACCEPTED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Form State: Upload Modal
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('ELECTRICITY_BILL');
  const [uploadClassification, setUploadClassification] = useState<
    'INTERNAL_ONLY' | 'CUSTOMER_VISIBLE' | 'RESTRICTED'
  >('CUSTOMER_VISIBLE');
  const [uploadCustomerId, setUploadCustomerId] = useState(customerIdParam);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!actionSuccess) return;
    const timer = setTimeout(() => setActionSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

  // Load registered customers for dropdown selector and client filtering
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await apiClient<any>('/customers?limit=100');
        const list = Array.isArray(res) ? res : res?.items || res?.data || [];
        setCustomers(list);
      } catch (err) {
        console.warn('Could not load customers for dropdown filter:', err);
      }
    };
    loadCustomers();
  }, []);

  // Sync customer filter with URL search param
  useEffect(() => {
    if (customerIdParam) {
      setCustomerFilter(customerIdParam);
      setUploadCustomerId(customerIdParam);
    }
  }, [customerIdParam]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set('search', search.trim());
      if (categoryFilter) queryParams.set('category', categoryFilter);
      if (reviewFilter) queryParams.set('reviewStatus', reviewFilter);
      if (customerFilter) queryParams.set('customerId', customerFilter);

      const res = await apiClient<any>(`/documents?${queryParams.toString()}`);
      setDocuments(Array.isArray(res) ? res : res?.items || res?.documents || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load document vault records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [search, customerFilter, categoryFilter, reviewFilter]);

  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    setUploadFilename(file.name);
    // Sanitize display name (strip extension and format readable title)
    const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const formattedTitle = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    setUploadDisplayName(formattedTitle);
    setFormError(null);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !uploadFilename.trim()) {
      setFormError('Please select a real document file to upload.');
      return;
    }
    if (!uploadDisplayName.trim()) {
      setFormError('Display name is required for compliance audit.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const targetFilename = selectedFile ? selectedFile.name : uploadFilename.trim();
      const targetMime = selectedFile ? (selectedFile.type || 'application/pdf') : 'application/pdf';
      const targetSize = selectedFile ? selectedFile.size : 1024;

      // 1. Register Document Metadata
      const docRes = await apiClient<any>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          originalFilename: targetFilename,
          safeDisplayName: uploadDisplayName.trim(),
          category: uploadCategory,
          accessClassification: uploadClassification,
          mimeType: targetMime,
          fileSizeBytes: targetSize,
          customerId: uploadCustomerId.trim() || undefined
        })
      });

      const docId = docRes?._id || docRes?.id;

      // 2. Stream actual binary file content to storage
      if (docId && selectedFile) {
        try {
          const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
          await fetch(`/api/v1/documents/${docId}/content`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': selectedFile.type || 'application/octet-stream',
              ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
            },
            body: selectedFile
          });
        } catch (streamErr) {
          console.warn('Binary upload warning:', streamErr);
        }
      }

      setActionSuccess(`Document "${uploadDisplayName.trim()}" successfully uploaded to vault!`);
      setUploadModalOpen(false);
      setSelectedFile(null);
      setUploadFilename('');
      setUploadDisplayName('');
      fetchDocuments();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload document to vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;

    if (
      (nextReviewStatus === 'REJECTED' || nextReviewStatus === 'RESUBMISSION_REQUIRED') &&
      (!rejectionReason || rejectionReason.trim().length < 5)
    ) {
      setFormError(
        'A descriptive rejection reason (minimum 5 characters) is required when rejecting or requesting resubmission.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient(`/documents/${selectedDoc._id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          reviewStatus: nextReviewStatus,
          reviewNotes: reviewNotes.trim() || undefined,
          rejectionReason: rejectionReason.trim() || undefined
        })
      });

      setActionSuccess(`Document ${selectedDoc.documentNumber} review recorded as ${nextReviewStatus}!`);
      setReviewModalOpen(false);
      setSelectedDoc(null);
      setReviewNotes('');
      setRejectionReason('');
      fetchDocuments();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record document review decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteModalDoc) return;
    try {
      setIsDeleting(true);
      await apiClient(`/documents/${deleteModalDoc._id}`, { method: 'DELETE' });
      setActionSuccess(`Document "${deleteModalDoc.safeDisplayName}" (${deleteModalDoc.documentNumber}) deleted successfully.`);
      setDeleteModalDoc(null);
      fetchDocuments();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete document.');
    } finally {
      setIsDeleting(false);
    }
  };

  // State: Preview Modal
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    docId: string;
    title: string;
    documentNumber: string;
    originalFilename: string;
    mimeType: string;
    viewUrl: string;
    downloadUrl: string;
  } | null>(null);

  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewImgLoading, setPreviewImgLoading] = useState(true);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewSvgContent, setPreviewSvgContent] = useState<string | null>(null);

  useEffect(() => {
    if (!previewDoc?.viewUrl) {
      setPreviewBlobUrl(null);
      setPreviewSvgContent(null);
      return;
    }
    let isMounted = true;
    setPreviewImgLoading(true);
    setPreviewBlobUrl(null);
    setPreviewSvgContent(null);

    const targetUrl = getFullApiUrl(previewDoc.viewUrl);

    fetch(targetUrl, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('image/svg+xml') || previewDoc.originalFilename?.toLowerCase().endsWith('.svg')) {
          const svgText = await res.text();
          if (!isMounted) return;
          setPreviewSvgContent(svgText);
          setPreviewBlobUrl(null);
        } else {
          const blob = await res.blob();
          if (!isMounted) return;
          if (blob.type.includes('svg')) {
            const svgText = await blob.text();
            if (!isMounted) return;
            setPreviewSvgContent(svgText);
            setPreviewBlobUrl(null);
          } else {
            const objectUrl = URL.createObjectURL(blob);
            setPreviewBlobUrl(objectUrl);
            setPreviewSvgContent(null);
          }
        }
        setPreviewImgLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn('Document preview loading notice:', err);
        setPreviewBlobUrl(targetUrl);
        setPreviewImgLoading(false);
      });

    return () => {
      isMounted = false;
      if (previewBlobUrl && previewBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewDoc?.viewUrl]);

  const handleModalFileReplace = async (file: File) => {
    if (!previewDoc?.docId) return;
    try {
      setPreviewImgLoading(true);
      const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
      const uploadUrl = getFullApiUrl(`/documents/${previewDoc.docId}/content`);
      await fetch(uploadUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
        },
        body: file
      });

      // Instantaneous local preview
      if (file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg')) {
        const text = await file.text();
        setPreviewSvgContent(text);
        setPreviewBlobUrl(null);
      } else {
        const directBlobUrl = URL.createObjectURL(file);
        setPreviewBlobUrl(directBlobUrl);
        setPreviewSvgContent(null);
      }
      setPreviewImgLoading(false);

      // Re-fetch fresh signed access URL
      const urlInfo = await apiClient<{ downloadUrl: string; viewUrl?: string }>(
        `/documents/${previewDoc.docId}/access-url`
      );
      const freshViewUrl = urlInfo.viewUrl || `${urlInfo.downloadUrl}&inline=true`;

      setPreviewDoc(prev =>
        prev
          ? {
              ...prev,
              originalFilename: file.name,
              mimeType: file.type || prev.mimeType,
              viewUrl: freshViewUrl,
              downloadUrl: urlInfo.downloadUrl
            }
          : null
      );

      fetchDocuments();
      setActionSuccess(`"${file.name}" uploaded and replaced in vault successfully!`);
    } catch (err: any) {
      alert(err?.message || 'Failed to update document file.');
      setPreviewImgLoading(false);
    }
  };

  const handleViewDocument = async (doc: DocumentItem) => {
    try {
      const res = await apiClient<{ downloadUrl: string; viewUrl?: string; mimeType?: string }>(
        `/documents/${doc._id}/access-url`
      );
      if (res?.downloadUrl) {
        const viewUrl = res.viewUrl || `${res.downloadUrl}&inline=true`;
        setPreviewZoom(1);
        setPreviewRotation(0);
        setPreviewImgLoading(true);
        setPreviewBlobUrl(null);
        setPreviewSvgContent(null);
        setPreviewDoc({
          isOpen: true,
          docId: doc._id,
          title: doc.safeDisplayName || doc.documentNumber,
          documentNumber: doc.documentNumber,
          originalFilename: doc.originalFilename,
          mimeType: doc.mimeType || res.mimeType || 'application/pdf',
          viewUrl,
          downloadUrl: res.downloadUrl
        });
      } else {
        alert('Could not generate view link for this document.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to open document preview.');
    }
  };

  const handleDownloadSigned = async (doc: DocumentItem) => {
    try {
      const res = await apiClient<{ downloadUrl: string }>(`/documents/${doc._id}/access-url`);
      if (res?.downloadUrl) {
        const a = document.createElement('a');
        a.href = res.downloadUrl;
        a.download = doc.originalFilename || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert('Could not generate download link. Please verify file storage status.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to obtain authorized download URL.');
    }
  };

  // Stats Counters
  const totalCount = documents.length;
  const pendingCount = documents.filter(d => d.reviewStatus === 'PENDING_REVIEW').length;
  const acceptedCount = documents.filter(d => d.reviewStatus === 'ACCEPTED').length;
  const rejectedCount = documents.filter(
    d => d.reviewStatus === 'REJECTED' || d.reviewStatus === 'RESUBMISSION_REQUIRED'
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-solar-500/10 text-solar-600 flex items-center justify-center font-bold shrink-0">
            <FolderLock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight whitespace-nowrap">
                Document Vault &amp; Compliance
              </h1>
              <span className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-solar-500/10 text-solar-700 dark:text-solar-300 border border-solar-200 dark:border-solar-800">
                {totalCount} Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block mt-0.5">
              Centralized repository for solar KYC, DISCOM net metering, site photos, and PM Surya Ghar dossiers
            </p>
          </div>
        </div>

        {/* Action Buttons: Generate Agreement & Upload File */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <Link
            to="/documents/create"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-card hover:bg-muted text-foreground font-bold text-xs rounded-xl shadow-2xs border border-border transition cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4 text-solar-600" />
            <span>Generate Document</span>
          </Link>

          <button
            onClick={() => {
              setFormError(null);
              setSelectedFile(null);
              setUploadFilename('');
              setUploadDisplayName('');
              setUploadCustomerId(customerFilter || '');
              setUploadModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload to Vault</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Interactive Stat Cards (Clickable Quick Filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Documents */}
        <div
          onClick={() => setReviewFilter('')}
          className={`p-3.5 sm:p-4 rounded-xl border bg-card shadow-2xs flex items-center gap-3.5 cursor-pointer transition ${
            !reviewFilter
              ? 'border-solar-500 ring-2 ring-solar-500/20'
              : 'border-border hover:border-solar-300'
          }`}
          title="Click to show all documents"
        >
          <div className="w-10 h-10 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-foreground">{totalCount}</div>
            <div className="text-xs font-semibold text-muted-foreground truncate">Total Vault Files</div>
          </div>
        </div>

        {/* Pending Review */}
        <div
          onClick={() => setReviewFilter(reviewFilter === 'PENDING_REVIEW' ? '' : 'PENDING_REVIEW')}
          className={`p-3.5 sm:p-4 rounded-xl border bg-card shadow-2xs flex items-center gap-3.5 cursor-pointer transition ${
            reviewFilter === 'PENDING_REVIEW'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
              : 'border-border hover:border-amber-300'
          }`}
          title="Click to filter Pending Review"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-amber-600">{pendingCount}</div>
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">Pending Review / QA</div>
          </div>
        </div>

        {/* Accepted & Verified */}
        <div
          onClick={() => setReviewFilter(reviewFilter === 'ACCEPTED' ? '' : 'ACCEPTED')}
          className={`p-3.5 sm:p-4 rounded-xl border bg-card shadow-2xs flex items-center gap-3.5 cursor-pointer transition ${
            reviewFilter === 'ACCEPTED'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5'
              : 'border-border hover:border-emerald-300'
          }`}
          title="Click to filter Accepted & Verified"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-emerald-600">{acceptedCount}</div>
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">Accepted &amp; Verified</div>
          </div>
        </div>

        {/* Rejected / Resubmission Required */}
        <div
          onClick={() => setReviewFilter(reviewFilter === 'REJECTED' ? '' : 'REJECTED')}
          className={`p-3.5 sm:p-4 rounded-xl border bg-card shadow-2xs flex items-center gap-3.5 cursor-pointer transition ${
            reviewFilter === 'REJECTED'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5'
              : 'border-border hover:border-rose-300'
          }`}
          title="Click to filter Rejected Documents"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-rose-600">{rejectedCount}</div>
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 truncate">Rejected / Resubmit</div>
          </div>
        </div>
      </div>

      {/* Filter and Query Control Bar - 1 Balanced Professional Row */}
      <div className="bg-card p-3 sm:p-3.5 rounded-xl border border-border shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-center">
          {/* Keyword Search */}
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by doc #, title, or filename..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-border rounded-lg text-xs bg-background text-foreground focus:ring-2 focus:ring-solar-500 focus:outline-none transition"
            />
          </div>

          {/* Client / Customer Filter */}
          <div className="lg:col-span-3">
            <select
              value={customerFilter}
              onChange={e => {
                setCustomerFilter(e.target.value);
                if (e.target.value) {
                  setSearchParams({ customerId: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
              className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:ring-2 focus:ring-solar-500 focus:outline-none font-medium cursor-pointer"
            >
              <option value="">All Clients (No filter)</option>
              {customers.map(c => {
                const cId = c._id || c.id || '';
                const name = c.name || c.legalName || c.companyName || 'Client';
                return (
                  <option key={cId} value={cId}>
                    {name} ({c.customerCode})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:ring-2 focus:ring-solar-500 focus:outline-none cursor-pointer"
            >
              <option value="">All Document Categories</option>
              {SOLAR_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Review Status Filter & Reset */}
          <div className="lg:col-span-2 flex items-center gap-1.5">
            <select
              value={reviewFilter}
              onChange={e => setReviewFilter(e.target.value)}
              className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:ring-2 focus:ring-solar-500 focus:outline-none cursor-pointer font-medium"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_REVIEW">⏳ Pending Review</option>
              <option value="ACCEPTED">✅ Accepted</option>
              <option value="REJECTED">❌ Rejected</option>
              <option value="RESUBMISSION_REQUIRED">🔄 Resubmission</option>
            </select>

            {(search || customerFilter || categoryFilter || reviewFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCustomerFilter('');
                  setCategoryFilter('');
                  setReviewFilter('');
                  setSearchParams({});
                }}
                className="px-2 py-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-300 rounded-lg font-bold transition shrink-0 cursor-pointer"
                title="Reset Filters"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Table - 5 Columns, No Awkward Breaking, Actions Always Visible */}
      <div className="bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-solar-600" />
            <p className="font-semibold text-foreground">Loading document vault...</p>
            <p className="text-xs text-muted-foreground">Fetching verified files and audit trail</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-solar-500/10 text-solar-600 flex items-center justify-center">
              <FolderLock className="w-7 h-7" />
            </div>
            <p className="font-bold text-foreground text-base">No documents found in vault.</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {customerFilter
                ? 'No documents found for this selected client. Click "Upload to Vault" or "Generate Document" to add files.'
                : 'No files match your current filter criteria.'}
            </p>
            <button
              onClick={() => {
                setUploadModalOpen(true);
                setUploadCustomerId(customerFilter || '');
              }}
              className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload First Document</span>
            </button>
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full table-fixed text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-[30%]">Document Details</th>
                  <th className="py-2.5 px-3 w-[18%]">Category &amp; Access</th>
                  <th className="py-2.5 px-3 w-[18%]">Linked Client</th>
                  <th className="py-2.5 px-3 w-[14%]">Status &amp; Date</th>
                  <th className="py-2.5 px-3 w-[20%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {documents.map(doc => {
                  const meta = getCategoryMeta(doc.category);
                  const isPending = doc.reviewStatus === 'PENDING_REVIEW';
                  const isAccepted = doc.reviewStatus === 'ACCEPTED';
                  const isRejected = doc.reviewStatus === 'REJECTED';
                  const isResubmission = doc.reviewStatus === 'RESUBMISSION_REQUIRED';

                  const clientName =
                    doc.customerId?.name ||
                    doc.customerId?.fullName ||
                    doc.customerId?.companyName ||
                    (doc.customerId?.customerCode ? `Client (${doc.customerId.customerCode})` : null);

                  const formattedDate = doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'Recent';

                  return (
                    <tr key={doc._id} className="hover:bg-muted/30 transition">
                      {/* 1. Document Details & File Metadata */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                            {doc.documentNumber}
                          </span>
                          {doc.isArchived && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase border border-border shrink-0">
                              Archived
                            </span>
                          )}
                        </div>

                        {/* Title - clickable for quick view */}
                        <div
                          onClick={() => handleViewDocument(doc)}
                          className="font-bold text-foreground text-xs mt-1 hover:text-solar-600 transition cursor-pointer truncate"
                          title={doc.safeDisplayName}
                        >
                          {doc.safeDisplayName}
                        </div>

                        {/* File Name + Version + File Size */}
                        <div className="text-[11px] text-muted-foreground flex items-center space-x-1.5 mt-0.5 font-mono truncate">
                          <File className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="truncate" title={doc.originalFilename}>
                            {doc.originalFilename}
                          </span>
                          <span className="shrink-0">• v{doc.version}</span>
                          <span className="shrink-0">• {formatFileSize(doc.fileSizeBytes)}</span>
                        </div>

                        {/* QA Rejection Reason if any */}
                        {doc.rejectionReason && (
                          <div
                            className="mt-1 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 font-medium truncate"
                            title={doc.rejectionReason}
                          >
                            <span className="font-bold mr-1">QA:</span>
                            <span>{doc.rejectionReason}</span>
                          </div>
                        )}
                      </td>

                      {/* 2. Category & Visibility Badge */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          {/* Category Badge */}
                          <div className="truncate">
                            <span
                              className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-md text-[11px] font-bold truncate max-w-full"
                              title={meta.label}
                            >
                              <span className="shrink-0">{meta.icon}</span>
                              <span className="truncate">{meta.label}</span>
                            </span>
                          </div>

                          {/* Access Visibility Pill */}
                          <div>
                            <span
                              className={`inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                doc.accessClassification === 'CUSTOMER_VISIBLE'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                  : doc.accessClassification === 'RESTRICTED'
                                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                    : 'bg-muted text-muted-foreground border border-border'
                              }`}
                            >
                              {doc.accessClassification === 'CUSTOMER_VISIBLE' ? (
                                <Eye className="w-2.5 h-2.5 shrink-0" />
                              ) : (
                                <Lock className="w-2.5 h-2.5 shrink-0" />
                              )}
                              <span className="truncate">
                                {doc.accessClassification === 'CUSTOMER_VISIBLE'
                                  ? 'Customer'
                                  : doc.accessClassification === 'INTERNAL_ONLY'
                                    ? 'Internal'
                                    : 'Restricted'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Linked Client - Symmetrical & Clean */}
                      <td className="py-3 px-3">
                        {doc.customerId ? (
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-xs truncate" title={clientName || 'Registered Client'}>
                              {clientName || 'Registered Client'}
                            </div>
                            <div className="text-[11px] font-mono text-solar-600 dark:text-solar-400 font-bold truncate">
                              {doc.customerId.customerCode}
                            </div>
                            {doc.customerId.primaryPhone && (
                              <div className="text-[10px] text-muted-foreground truncate font-sans">
                                {doc.customerId.primaryPhone}
                              </div>
                            )}
                          </div>
                        ) : doc.projectId ? (
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                              {doc.projectId.projectNumber}
                            </span>
                            {doc.projectId.title && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {doc.projectId.title}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-xs text-muted-foreground italic truncate">
                            <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">General Internal</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Review Status & Date */}
                      <td className="py-3 px-3">
                        <div>
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isAccepted
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : isPending
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                  : isRejected
                                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                            }`}
                          >
                            {isAccepted && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                            {isPending && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
                            {isRejected && <XCircle className="w-3 h-3 text-rose-600 shrink-0" />}
                            {isResubmission && <AlertTriangle className="w-3 h-3 text-purple-600 shrink-0" />}
                            <span className="truncate">
                              {isAccepted ? 'Accepted' : isPending ? 'Pending' : isRejected ? 'Rejected' : 'Resubmit'}
                            </span>
                          </span>

                          <div className="text-[10px] text-muted-foreground mt-1 font-medium truncate">
                            {formattedDate}
                          </div>
                        </div>
                      </td>

                      {/* 5. Actions - Aligned Right & Fully Visible with 0 Scroll */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* 1. In-App View / Preview Action */}
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc)}
                            className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-bold text-solar-700 dark:text-solar-300 bg-solar-500/10 hover:bg-solar-500/20 border border-solar-500/20 rounded-lg transition cursor-pointer shrink-0"
                            title="View / Inspect Document"
                          >
                            <Eye className="w-3.5 h-3.5 text-solar-600" />
                            <span>View</span>
                          </button>

                          {/* 2. Direct Download Action */}
                          <button
                            type="button"
                            onClick={() => handleDownloadSigned(doc)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition cursor-pointer shrink-0 border border-transparent hover:border-border"
                            title="Download verified document binary"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Review Action */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDoc(doc);
                              setNextReviewStatus('ACCEPTED');
                              setReviewNotes('');
                              setRejectionReason('');
                              setFormError(null);
                              setReviewModalOpen(true);
                            }}
                            className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-lg transition cursor-pointer border shrink-0 ${
                              isPending
                                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                : 'bg-muted/60 text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                            }`}
                            title={isPending ? 'Pending QA Review - Click to Review' : 'Update Review Decision'}
                          >
                            <FileCheck2 className={`w-3.5 h-3.5 ${isPending ? 'text-amber-600' : 'text-muted-foreground'}`} />
                            <span>Review</span>
                          </button>

                          {/* 4. Delete Action */}
                          <button
                            type="button"
                            onClick={() => setDeleteModalDoc(doc)}
                            className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer shrink-0 border border-transparent hover:border-border"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Modal: Upload to Vault (Real File Picker & Client Selector)                */}
      {/* ========================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-solar-50 text-solar-600 rounded-xl">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Upload Document to Vault
                  </h3>
                  <p className="text-xs text-gray-500">
                    Add customer KYC, net metering SLD, site photos, or subsidy files to compliance archive.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-4">
              {/* File Dropzone Area */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Select File to Upload *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelection(file);
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx,.txt"
                  className="hidden"
                />

                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelection(file);
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      isDragging
                        ? 'border-solar-500 bg-solar-50/50'
                        : 'border-gray-300 hover:border-solar-500 hover:bg-solar-50/20'
                    }`}
                  >
                    <UploadCloud className="w-10 h-10 mx-auto text-solar-600 mb-2" />
                    <p className="text-sm font-semibold text-gray-800">
                      Click to choose file or drag & drop here
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Supports PDF, JPEG, PNG, WEBP, Excel, Word (Up to 25 MB)
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-solar-50/40 border border-solar-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-solar-100 text-solar-700 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 truncate max-w-xs">
                          {selectedFile.name}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Binary Document'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadFilename('');
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 hover:bg-rose-50 rounded"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Display Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Document Title / Display Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified Aadhaar KYC Copy"
                  value={uploadDisplayName}
                  onChange={e => setUploadDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none"
                  required
                />
              </div>

              {/* Client / Customer Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Assign to Client (Optional)
                </label>
                <select
                  value={uploadCustomerId}
                  onChange={e => setUploadCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white font-medium"
                >
                  <option value="">🏢 General Vault / Internal Company Document</option>
                  {customers.map(c => {
                    const cId = c._id || c.id || '';
                    const name = c.name || c.legalName || c.companyName || 'Client';
                    return (
                      <option key={cId} value={cId}>
                        {name} • {c.customerCode} ({c.primaryPhone || 'No Phone'})
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Selecting a client automatically organizes this document under their personal KYC dossier.
                </p>
              </div>

              {/* Category & Access Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Solar Compliance Category *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white"
                  >
                    {SOLAR_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Portal Access Visibility
                  </label>
                  <select
                    value={uploadClassification}
                    onChange={e => setUploadClassification(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="CUSTOMER_VISIBLE">👁️ Customer Visible (Portal)</option>
                    <option value="INTERNAL_ONLY">🔒 Internal Only (Staff)</option>
                    <option value="RESTRICTED">🛡️ Restricted Confidential</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-solar-600 hover:bg-solar-700 active:bg-solar-800 text-white font-bold rounded-lg text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading to Vault...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Save Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal: Review Document (Accept, Reject, Resubmission)                     */}
      {/* ========================================================================= */}
      {reviewModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Review Document: {selectedDoc.documentNumber}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium truncate max-w-xs">
                    {selectedDoc.safeDisplayName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleReviewDocument} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Review Decision *
                </label>
                <select
                  value={nextReviewStatus}
                  onChange={e => setNextReviewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none font-semibold bg-white"
                >
                  <option value="ACCEPTED">✅ Accept & Verify Document</option>
                  <option value="REJECTED">❌ Reject Document</option>
                  <option value="RESUBMISSION_REQUIRED">🔄 Request Client Resubmission</option>
                </select>
              </div>

              {(nextReviewStatus === 'REJECTED' || nextReviewStatus === 'RESUBMISSION_REQUIRED') && (
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">
                    Rejection / Resubmission Reason (Min 5 chars) *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. SLD missing earthing pit impedance or signature blurry"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-rose-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Internal Verification Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Verification observations, discom approval stamp notes..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-solar-600 hover:bg-solar-700 text-white font-bold rounded-lg text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Recording...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal: Delete Document Confirmation                                       */}
      {/* ========================================================================= */}
      {deleteModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Document</h3>
                <p className="text-xs text-muted-foreground">Permanent deletion from vault and customer dossier</p>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-xl border border-border text-xs space-y-1">
              <div className="font-bold text-foreground truncate">{deleteModalDoc.safeDisplayName}</div>
              <div className="font-mono text-muted-foreground text-[11px] flex items-center gap-2">
                <span>{deleteModalDoc.documentNumber}</span>
                <span>•</span>
                <span className="truncate">{deleteModalDoc.originalFilename}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalDoc(null)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteDocument}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* Modal: Document Preview / In-App Viewer                                   */}
      {/* ========================================================================= */}
      {previewDoc && previewDoc.isOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
          style={{ zIndex: 100 }}
          onClick={e => {
            if (e.target === e.currentTarget) setPreviewDoc(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-gray-50/80">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 bg-solar-50 text-solar-600 rounded-xl shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                      {previewDoc.title}
                    </h3>
                    {previewDoc.documentNumber && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 shrink-0 border border-gray-300">
                        {previewDoc.documentNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate font-mono">
                    {previewDoc.originalFilename}
                  </p>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex items-center space-x-2 shrink-0">
                {/* Image Zoom & Rotate Controls */}
                {previewDoc.mimeType?.startsWith('image/') ||
                ['.jpg', '.jpeg', '.png', '.webp'].some(ext =>
                  previewDoc.originalFilename?.toLowerCase().endsWith(ext)
                ) ? (
                  <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 space-x-1 text-xs shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[10px] px-1 font-bold text-gray-600 min-w-[38px] text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-3 w-px bg-gray-200" />
                    <button
                      type="button"
                      onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"
                      title="Rotate 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    {(previewZoom !== 1 || previewRotation !== 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewZoom(1);
                          setPreviewRotation(0);
                        }}
                        className="text-[10px] text-solar-600 font-bold px-1.5 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ) : null}

                <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-solar-50 hover:bg-solar-100 text-solar-700 border border-solar-200 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Replace File</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        handleModalFileReplace(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <a
                  href={getFullApiUrl(previewDoc.viewUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition"
                  title="Open Fullscreen in New Window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </a>
                <a
                  href={getFullApiUrl(previewDoc.downloadUrl)}
                  download={previewDoc.originalFilename}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-solar-600 hover:bg-solar-700 text-white shadow-2xs transition"
                  title="Download Document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center min-h-[420px] max-h-[75vh] relative select-none">
              {previewImgLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-solar-500" />
                  <p className="text-slate-300 text-sm font-medium">Loading document preview...</p>
                </div>
              ) : previewSvgContent ? (
                <div
                  style={{
                    transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="w-full max-w-4xl max-h-[70vh] flex items-center justify-center p-2 rounded-lg shadow-2xl overflow-auto ring-1 ring-white/10 bg-slate-900"
                  dangerouslySetInnerHTML={{ __html: previewSvgContent }}
                />
              ) : previewDoc.mimeType === 'application/pdf' ||
                previewDoc.originalFilename?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewBlobUrl || getFullApiUrl(previewDoc.viewUrl)}
                  title={previewDoc.title}
                  className="w-full h-[70vh] border-0 rounded-lg bg-white shadow-2xl"
                />
              ) : (
                <div className="relative flex items-center justify-center w-full h-full min-h-[380px]">
                  <img
                    src={previewBlobUrl || getFullApiUrl(previewDoc.viewUrl)}
                    alt={previewDoc.title}
                    style={{
                      transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain ring-1 ring-white/10"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
