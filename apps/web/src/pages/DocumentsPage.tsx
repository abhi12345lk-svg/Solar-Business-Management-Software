import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Eye,
  FileCheck2,
  Archive,
  UploadCloud,
  File,
  X,
  Shield,
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
  Loader2
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

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
  const [classificationFilter, setClassificationFilter] = useState('');
  const [isArchivedFilter, setIsArchivedFilter] = useState(false);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
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

  // Form State: Version Modal
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionFilename, setVersionFilename] = useState('');
  const [versionDisplayName, setVersionDisplayName] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const versionFileInputRef = useRef<HTMLInputElement>(null);

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
      if (classificationFilter) queryParams.set('accessClassification', classificationFilter);
      if (isArchivedFilter) queryParams.set('isArchived', 'true');
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
  }, [search, customerFilter, categoryFilter, reviewFilter, classificationFilter, isArchivedFilter]);

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

  const handleVersionSelection = (file: File) => {
    setVersionFile(file);
    setVersionFilename(file.name);
    const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setVersionDisplayName(rawName.charAt(0).toUpperCase() + rawName.slice(1));
    setFormError(null);
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    if (!versionFile && !versionFilename.trim()) {
      setFormError('Please select a replacement file for this revision.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const targetFilename = versionFile ? versionFile.name : versionFilename.trim();
      const targetMime = versionFile ? (versionFile.type || selectedDoc.mimeType) : selectedDoc.mimeType;
      const targetSize = versionFile ? versionFile.size : selectedDoc.fileSizeBytes;

      const res = await apiClient<any>(`/documents/${selectedDoc._id}/new-version`, {
        method: 'POST',
        body: JSON.stringify({
          originalFilename: targetFilename,
          safeDisplayName: versionDisplayName.trim() || selectedDoc.safeDisplayName,
          mimeType: targetMime,
          fileSizeBytes: targetSize,
          versionNotes: versionNotes.trim() || undefined
        })
      });

      const newDocId = res?._id || res?.id;
      if (newDocId && versionFile) {
        try {
          const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
          await fetch(`/api/v1/documents/${newDocId}/content`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': versionFile.type || 'application/octet-stream',
              ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
            },
            body: versionFile
          });
        } catch (streamErr) {
          console.warn('Binary upload warning:', streamErr);
        }
      }

      setActionSuccess(`New version v${selectedDoc.version + 1} published successfully!`);
      setVersionModalOpen(false);
      setSelectedDoc(null);
      setVersionFile(null);
      setVersionFilename('');
      setVersionDisplayName('');
      setVersionNotes('');
      fetchDocuments();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload new document revision.');
    } finally {
      setIsSubmitting(false);
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
  const [previewImgError, setPreviewImgError] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewDoc?.viewUrl) {
      setPreviewBlobUrl(null);
      return;
    }
    let isMounted = true;
    setPreviewImgLoading(true);
    setPreviewImgError(false);

    fetch(previewDoc.viewUrl, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
        }
        return res.blob();
      })
      .then(blob => {
        if (!isMounted) return;
        const objectUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(objectUrl);
        setPreviewImgLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Document preview error:', err);
        setPreviewImgLoading(false);
        setPreviewImgError(true);
      });

    return () => {
      isMounted = false;
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewDoc?.viewUrl]);

  const handleModalFileReplace = async (file: File) => {
    if (!previewDoc?.docId) return;
    try {
      setPreviewImgLoading(true);
      setPreviewImgError(false);
      const csrfToken = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))?.[2];
      await fetch(`/api/v1/documents/${previewDoc.docId}/content`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : {})
        },
        body: file
      });

      setPreviewDoc(prev =>
        prev
          ? {
              ...prev,
              originalFilename: file.name,
              mimeType: file.type || prev.mimeType,
              viewUrl: `${prev.viewUrl}&_t=${Date.now()}`
            }
          : null
      );

      fetchDocuments();
      setActionSuccess(`"${file.name}" uploaded and replaced in vault successfully!`);
    } catch (err: any) {
      alert(err?.message || 'Failed to update document file.');
    } finally {
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
        setPreviewImgError(false);
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

  const handleArchive = async (doc: DocumentItem) => {
    if (
      !window.confirm(
        `Archive document ${doc.documentNumber} (${doc.safeDisplayName})? It will be marked inactive but preserved for audit compliance.`
      )
    ) {
      return;
    }

    try {
      await apiClient(`/documents/${doc._id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Archived by staff through Document Vault UI' })
      });
      setActionSuccess(`Document ${doc.documentNumber} moved to archive.`);
      fetchDocuments();
    } catch (err: any) {
      alert(err?.message || 'Failed to archive document.');
    }
  };

  // Stats Counters
  const totalCount = documents.length;
  const pendingCount = documents.filter(d => d.reviewStatus === 'PENDING_REVIEW').length;
  const acceptedCount = documents.filter(d => d.reviewStatus === 'ACCEPTED').length;
  const customerVisibleCount = documents.filter(
    d => d.accessClassification === 'CUSTOMER_VISIBLE'
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-solar-700 mb-1">
            <FolderLock className="w-4 h-4 text-solar-600" />
            <span>Rarebox Solar ERP • Compliance & Document Vault</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Document Vault & Project Compliance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Centralized digital repository for solar consumer KYC, DISCOM net metering, rooftop survey photos, and PM Surya Ghar subsidy dossiers.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setFormError(null);
              setSelectedFile(null);
              setUploadFilename('');
              setUploadDisplayName('');
              setUploadCustomerId(customerFilter || '');
              setUploadModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-solar-600 hover:bg-solar-700 active:bg-solar-800 text-white font-semibold text-sm rounded-xl shadow-sm transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document to Vault
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-4 hover:border-gray-300 transition">
          <div className="p-3 bg-gray-100 text-gray-700 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            <div className="text-xs font-medium text-gray-500">Total Vault Documents</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs flex items-center gap-4 hover:border-amber-300 transition">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
            <div className="text-xs font-medium text-amber-700">Pending Review / QA</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs flex items-center gap-4 hover:border-emerald-300 transition">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700">{acceptedCount}</div>
            <div className="text-xs font-medium text-emerald-700">Accepted & Verified</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs flex items-center gap-4 hover:border-blue-300 transition">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700">{customerVisibleCount}</div>
            <div className="text-xs font-medium text-blue-700">Client Portal Visible</div>
          </div>
        </div>
      </div>

      {/* Filter and Query Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Keyword Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by document number, title, or original file name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:border-solar-500 focus:outline-none transition"
            />
          </div>

          {/* Client / Customer Filter */}
          <div className="min-w-[190px]">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white font-medium"
            >
              <option value="">All Clients (No filter)</option>
              {customers.map(c => {
                const cId = c._id || c.id || '';
                const name = c.name || c.legalName || c.companyName || 'Client';
                return (
                  <option key={cId} value={cId}>
                    {name} • {c.customerCode}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Category Filter */}
          <div className="min-w-[180px]">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white"
            >
              <option value="">All Document Categories</option>
              {SOLAR_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Review Status Filter */}
          <div className="min-w-[160px]">
            <select
              value={reviewFilter}
              onChange={e => setReviewFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white"
            >
              <option value="">All Review Statuses</option>
              <option value="PENDING_REVIEW">⏳ Pending Review</option>
              <option value="ACCEPTED">✅ Accepted & Verified</option>
              <option value="REJECTED">❌ Rejected</option>
              <option value="RESUBMISSION_REQUIRED">🔄 Resubmission Required</option>
            </select>
          </div>

          {/* Access Classification */}
          <div className="min-w-[160px]">
            <select
              value={classificationFilter}
              onChange={e => setClassificationFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none bg-white"
            >
              <option value="">All Access Levels</option>
              <option value="CUSTOMER_VISIBLE">👁️ Customer Visible</option>
              <option value="INTERNAL_ONLY">🔒 Internal Only</option>
              <option value="RESTRICTED">🛡️ Restricted Confidential</option>
            </select>
          </div>

          {/* Include Archived Checkbox */}
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer pl-1 whitespace-nowrap">
            <input
              type="checkbox"
              checked={isArchivedFilter}
              onChange={e => setIsArchivedFilter(e.target.checked)}
              className="rounded border-gray-300 text-solar-600 focus:ring-solar-500"
            />
            <span>Include Archived</span>
          </label>

          {(search || customerFilter || categoryFilter || reviewFilter || classificationFilter || isArchivedFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setCustomerFilter('');
                setCategoryFilter('');
                setReviewFilter('');
                setClassificationFilter('');
                setIsArchivedFilter(false);
                setSearchParams({});
              }}
              className="text-xs text-gray-500 hover:text-gray-800 underline font-semibold cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-gray-500 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-solar-600" />
            <p className="font-semibold text-gray-700">Loading document vault...</p>
            <p className="text-xs text-gray-400">Fetching cryptographic download tokens and audit states</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-16 text-center text-gray-500 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-solar-50 text-solar-600 flex items-center justify-center">
              <FolderLock className="w-7 h-7" />
            </div>
            <p className="font-semibold text-gray-800 text-base">No documents found in vault.</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {customerFilter
                ? 'No documents registered for the selected client. Click "Upload Document to Vault" to add one.'
                : 'No files match your current filters. Click "Upload Document to Vault" to register new project paperwork.'}
            </p>
            <button
              onClick={() => {
                setUploadModalOpen(true);
                setUploadCustomerId(customerFilter || '');
              }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[850px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Document Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Linked Client</th>
                  <th className="py-3 px-4">Access Level</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4">Version & Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
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

                  return (
                    <tr key={doc._id} className="hover:bg-gray-50/80 transition">
                      {/* Document Details */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                            {doc.documentNumber}
                          </span>
                          {doc.isArchived && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-200 text-gray-600 uppercase">
                              Archived
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-gray-900 mt-1 line-clamp-1">
                          {doc.safeDisplayName}
                        </div>
                        <div className="text-xs text-gray-400 font-mono truncate flex items-center gap-1.5 mt-0.5">
                          <File className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{doc.originalFilename}</span>
                        </div>
                        {doc.rejectionReason && (
                          <div className="mt-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1 font-medium">
                            <span className="font-bold">QA Rejection:</span> {doc.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold">
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      {/* Linked Client */}
                      <td className="py-3 px-4">
                        {doc.customerId ? (
                          <div>
                            <div className="font-medium text-gray-900 text-xs">
                              {clientName || 'Registered Client'}
                            </div>
                            <div className="text-[11px] font-mono text-solar-700 font-semibold flex items-center gap-1">
                              <span>{doc.customerId.customerCode}</span>
                              {doc.customerId.primaryPhone && (
                                <span className="text-gray-400 font-normal">
                                  • {doc.customerId.primaryPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : doc.projectId ? (
                          <div>
                            <span className="font-mono text-xs font-semibold text-indigo-700">
                              {doc.projectId.projectNumber}
                            </span>
                            {doc.projectId.title && (
                              <div className="text-xs text-gray-500 truncate max-w-[150px]">
                                {doc.projectId.title}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 italic">
                            <Building className="w-3.5 h-3.5 text-gray-400" />
                            <span>General Internal</span>
                          </span>
                        )}
                      </td>

                      {/* Classification Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            doc.accessClassification === 'CUSTOMER_VISIBLE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : doc.accessClassification === 'RESTRICTED'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {doc.accessClassification === 'CUSTOMER_VISIBLE' ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          <span>{doc.accessClassification.replace(/_/g, ' ')}</span>
                        </span>
                      </td>

                      {/* Review Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isAccepted
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isRejected
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          {isPending && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                          {isRejected && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                          {isResubmission && <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />}
                          <span>{doc.reviewStatus.replace(/_/g, ' ')}</span>
                        </span>
                      </td>

                      {/* Version & Size */}
                      <td className="py-3 px-4 text-xs font-mono text-gray-600 whitespace-nowrap">
                        <div className="font-bold text-gray-800">v{doc.version}</div>
                        <div className="text-gray-500 text-[11px]">{formatFileSize(doc.fileSizeBytes)}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* In-App View / Preview Action */}
                          <button
                            onClick={() => handleViewDocument(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-solar-700 bg-solar-50 hover:bg-solar-100 border border-solar-200 rounded-lg transition cursor-pointer"
                            title="View / Inspect Document"
                          >
                            <Eye className="w-3.5 h-3.5 text-solar-600" />
                            <span>View</span>
                          </button>

                          {/* Direct Download Action */}
                          <button
                            onClick={() => handleDownloadSigned(doc)}
                            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Download verified binary via signed cryptographic token"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Review Action */}
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setNextReviewStatus('ACCEPTED');
                              setReviewNotes('');
                              setRejectionReason('');
                              setFormError(null);
                              setReviewModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition cursor-pointer"
                            title="Conduct QA / Compliance Review"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Review</span>
                          </button>

                          {/* New Version Action */}
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setVersionFile(null);
                              setVersionFilename(`v${doc.version + 1}_${doc.originalFilename}`);
                              setVersionDisplayName(doc.safeDisplayName);
                              setVersionNotes('');
                              setFormError(null);
                              setVersionModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-solar-700 hover:bg-solar-50 rounded-lg transition cursor-pointer"
                            title="Upload New Version Revision"
                          >
                            <Layers className="w-4 h-4" />
                          </button>

                          {/* Archive Action */}
                          {!doc.isArchived && (
                            <button
                              onClick={() => handleArchive(doc)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Archive Document"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
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
      {/* Modal: Upload New Version Revision                                        */}
      {/* ========================================================================= */}
      {versionModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-solar-50 text-solar-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Upload Version v{selectedDoc.version + 1}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Supersedes version v{selectedDoc.version}. Historical versions and audit trail are preserved.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVersionModalOpen(false)}
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

            <form onSubmit={handleUploadVersion} className="space-y-3.5">
              {/* Revision File Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Replacement File *
                </label>
                <input
                  type="file"
                  ref={versionFileInputRef}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleVersionSelection(file);
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx,.txt"
                  className="hidden"
                />

                {!versionFile ? (
                  <div
                    onClick={() => versionFileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-solar-500 rounded-xl p-4 text-center cursor-pointer hover:bg-solar-50/20 transition"
                  >
                    <Upload className="w-6 h-6 mx-auto text-solar-600 mb-1" />
                    <p className="text-xs font-bold text-gray-800">
                      Click to choose revision file
                    </p>
                    <p className="text-[11px] text-gray-400">
                      PDF, Images, CAD drawings up to 25 MB
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-solar-50 border border-solar-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 truncate max-w-xs">
                        {versionFile.name}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {formatFileSize(versionFile.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVersionFile(null)}
                      className="text-xs text-rose-600 font-bold"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Revision Display Title
                </label>
                <input
                  type="text"
                  value={versionDisplayName}
                  onChange={e => setVersionDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Revision Changelog / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Revised electrical SLD reflecting updated 15kVA inverter rating"
                  value={versionNotes}
                  onChange={e => setVersionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setVersionModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-solar-600 hover:bg-solar-700 text-white font-bold rounded-lg text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Uploading...' : 'Publish New Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* Modal: Document Preview / In-App Viewer                                   */}
      {/* ========================================================================= */}
      {previewDoc && previewDoc.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
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
                  href={previewDoc.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition"
                  title="Open Fullscreen in New Window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </a>
                <a
                  href={previewDoc.downloadUrl}
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
              {previewDoc.mimeType?.startsWith('image/') ||
              ['.jpg', '.jpeg', '.png', '.webp', '.svg'].some(ext =>
                previewDoc.originalFilename?.toLowerCase().endsWith(ext)
              ) ? (
                <div className="relative flex items-center justify-center w-full h-full min-h-[380px]">
                  {previewImgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 z-10">
                      <Loader2 className="w-8 h-8 animate-spin text-solar-500" />
                    </div>
                  )}

                  {previewImgError && !previewBlobUrl ? (
                    <div className="text-center p-8 space-y-3 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-xl">
                      <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 mx-auto flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <h4 className="text-white font-bold text-base">Image Preview Notice</h4>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        The browser could not directly render this image inline. You can open it in a new window, download the original file, or replace it with a new photo.
                      </p>
                      <div className="flex items-center justify-center gap-2.5 pt-2">
                        <label className="px-3.5 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload / Replace File</span>
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
                          href={previewDoc.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition inline-flex items-center space-x-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in New Tab</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={previewBlobUrl || previewDoc.viewUrl}
                      alt={previewDoc.title}
                      onLoad={() => setPreviewImgLoading(false)}
                      onError={() => {
                        if (!previewBlobUrl) {
                          setPreviewImgLoading(false);
                          setPreviewImgError(true);
                        }
                      }}
                      style={{
                        transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.15s ease-out'
                      }}
                      className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain ring-1 ring-white/10"
                    />
                  )}
                </div>
              ) : previewDoc.mimeType === 'application/pdf' ||
                previewDoc.originalFilename?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewBlobUrl || previewDoc.viewUrl}
                  title={previewDoc.title}
                  className="w-full h-[70vh] border-0 rounded-lg bg-white"
                />
              ) : (
                <div className="p-8 text-center space-y-3 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-xl">
                  <FileText className="w-12 h-12 mx-auto text-solar-500" />
                  <p className="font-semibold text-white text-sm">
                    Direct in-browser preview not supported for this file type.
                  </p>
                  <p className="text-xs text-slate-400">
                    Please download or open in a new tab to inspect its contents.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <a
                      href={previewDoc.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in New Tab</span>
                    </a>
                    <a
                      href={previewDoc.downloadUrl}
                      download={previewDoc.originalFilename}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download File</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
