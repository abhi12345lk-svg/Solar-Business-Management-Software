import React, { useState, useEffect } from 'react';
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
  Lock,
  UploadCloud
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
    fullName?: string;
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

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
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
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('CUSTOMER_KYC');
  const [uploadClassification, setUploadClassification] = useState<
    'INTERNAL_ONLY' | 'CUSTOMER_VISIBLE' | 'RESTRICTED'
  >('INTERNAL_ONLY');
  const [uploadMime, setUploadMime] = useState('application/pdf');
  const [uploadSize, setUploadSize] = useState('1048576'); // 1 MB default
  const [uploadCustomerId, setUploadCustomerId] = useState('');
  const [uploadProjectId, setUploadProjectId] = useState('');

  // Form State: Version Modal
  const [versionFilename, setVersionFilename] = useState('');
  const [versionDisplayName, setVersionDisplayName] = useState('');
  const [versionNotes, setVersionNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const res = await apiClient<{ items: DocumentItem[] }>(
        `/documents?${queryParams.toString()}`
      );
      setDocuments(res?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [search, categoryFilter, reviewFilter, classificationFilter, isArchivedFilter]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFilename.trim() || !uploadDisplayName.trim()) {
      setFormError('Original filename and display name are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient('/documents', {
        method: 'POST',
        body: JSON.stringify({
          originalFilename: uploadFilename.trim(),
          safeDisplayName: uploadDisplayName.trim(),
          category: uploadCategory,
          accessClassification: uploadClassification,
          mimeType: uploadMime,
          fileSizeBytes: parseInt(uploadSize, 10) || 1024,
          customerId: uploadCustomerId.trim() || undefined,
          projectId: uploadProjectId.trim() || undefined
        })
      });

      setUploadModalOpen(false);
      setUploadFilename('');
      setUploadDisplayName('');
      setUploadCustomerId('');
      setUploadProjectId('');
      fetchDocuments();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register document.');
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

      setReviewModalOpen(false);
      setSelectedDoc(null);
      setReviewNotes('');
      setRejectionReason('');
      fetchDocuments();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record document review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    if (!versionFilename.trim()) {
      setFormError('Filename is required for the new version.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient(`/documents/${selectedDoc._id}/new-version`, {
        method: 'POST',
        body: JSON.stringify({
          originalFilename: versionFilename.trim(),
          safeDisplayName: versionDisplayName.trim() || undefined,
          mimeType: selectedDoc.mimeType,
          fileSizeBytes: selectedDoc.fileSizeBytes,
          versionNotes: versionNotes.trim() || undefined
        })
      });

      setVersionModalOpen(false);
      setSelectedDoc(null);
      setVersionFilename('');
      setVersionDisplayName('');
      setVersionNotes('');
      fetchDocuments();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload new document version.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSigned = async (doc: DocumentItem) => {
    try {
      const res = await apiClient<{ downloadUrl: string }>(`/documents/${doc._id}/access-url`);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to obtain authorized download URL.');
    }
  };

  const handleArchive = async (doc: DocumentItem) => {
    if (
      !window.confirm(
        `Archive document ${doc.documentNumber} (${doc.safeDisplayName})? It will be marked inactive but preserved for audit.`
      )
    ) {
      return;
    }

    try {
      await apiClient(`/documents/${doc._id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Archived by staff through Document Vault UI' })
      });
      fetchDocuments();
    } catch (err: any) {
      alert(err?.message || 'Failed to archive document.');
    }
  };

  // Stats
  const totalCount = documents.length;
  const pendingCount = documents.filter(d => d.reviewStatus === 'PENDING_REVIEW').length;
  const acceptedCount = documents.filter(d => d.reviewStatus === 'ACCEPTED').length;
  const customerVisibleCount = documents.filter(
    d => d.accessClassification === 'CUSTOMER_VISIBLE'
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-7 h-7 text-indigo-600" />
            Private Document Vault & Library
          </h1>
          <p className="text-sm text-gray-500">
            Secure private document repository with cryptographic HMAC download links, multi-version
            history, and verification gates.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <UploadCloud className="w-4 h-4" />
          Upload to Vault
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-gray-50 text-gray-700 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            <div className="text-xs text-gray-500">Total Documents</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
            <div className="text-xs text-gray-500">Pending QA / Review</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700">{acceptedCount}</div>
            <div className="text-xs text-gray-500">Accepted & Verified</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700">{customerVisibleCount}</div>
            <div className="text-xs text-gray-500">Client-Visible Files</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search document number, safe name, or file..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Categories</option>
          <option value="CUSTOMER_KYC">Customer KYC</option>
          <option value="ELECTRICITY_BILL">Electricity Bill</option>
          <option value="PROPERTY_DEED">Property Deed / Tax Receipt</option>
          <option value="COMMERCIAL_PROPOSAL">Commercial Proposal</option>
          <option value="SIGNED_CONTRACT">Signed Contract</option>
          <option value="DISCOM_APPLICATION">DISCOM Application</option>
          <option value="DISCOM_NOC">DISCOM Net Metering NOC</option>
          <option value="SUBSIDY_CLAIM">Subsidy Claim Dossier</option>
          <option value="ENGINEERING_DRAWING">Engineering SLD / CAD</option>
          <option value="INSTALLATION_EVIDENCE">Installation Evidence</option>
          <option value="COMMISSIONING_REPORT">Commissioning / Megger</option>
          <option value="WARRANTY_CERTIFICATE">Warranty Certificate</option>
          <option value="SERVICE_REPORT">Service Visit Report</option>
        </select>

        <select
          value={reviewFilter}
          onChange={e => setReviewFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Review Statuses</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="RESUBMISSION_REQUIRED">Resubmission Required</option>
        </select>

        <select
          value={classificationFilter}
          onChange={e => setClassificationFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Classifications</option>
          <option value="INTERNAL_ONLY">Internal Only</option>
          <option value="CUSTOMER_VISIBLE">Customer Visible</option>
          <option value="RESTRICTED">Restricted Confidential</option>
        </select>

        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer pl-2">
          <input
            type="checkbox"
            checked={isArchivedFilter}
            onChange={e => setIsArchivedFilter(e.target.checked)}
            className="rounded border-gray-300 text-gray-600 focus:ring-gray-500"
          />
          <span className="text-gray-600">Include Archived</span>
        </label>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Document Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading document vault...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Lock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No documents found in vault.</p>
            <p className="text-sm text-gray-400">
              Click &apos;Upload to Vault&apos; to register project files.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Document Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4">Ver & Size</th>
                  <th className="py-3 px-4">Linked Entity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map(doc => {
                  const sizeMb = (doc.fileSizeBytes / (1024 * 1024)).toFixed(2);
                  const isPending = doc.reviewStatus === 'PENDING_REVIEW';
                  const isAccepted = doc.reviewStatus === 'ACCEPTED';

                  return (
                    <tr key={doc._id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-mono text-xs font-bold text-indigo-600">
                          {doc.documentNumber}
                        </div>
                        <div className="font-semibold text-gray-900 line-clamp-1">
                          {doc.safeDisplayName}
                        </div>
                        <div className="text-xs text-gray-400 font-mono truncate">
                          {doc.originalFilename}
                        </div>
                        {doc.rejectionReason && (
                          <div className="text-xs text-red-600 font-medium mt-0.5">
                            Rejection Reason: {doc.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {doc.category.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            doc.accessClassification === 'CUSTOMER_VISIBLE'
                              ? 'bg-blue-100 text-blue-800'
                              : doc.accessClassification === 'RESTRICTED'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {doc.accessClassification.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isAccepted
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {doc.reviewStatus.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-mono text-gray-600">
                        <div>v{doc.version}</div>
                        <div className="text-gray-400 text-[11px]">{sizeMb} MB</div>
                      </td>

                      <td className="py-3 px-4 text-xs">
                        {doc.projectId ? (
                          <div className="text-indigo-600 font-mono font-medium">
                            {doc.projectId.projectNumber || 'Project'}
                          </div>
                        ) : doc.customerId ? (
                          <div className="text-gray-700 font-mono">
                            {doc.customerId.customerCode || 'Customer'}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Vault General</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownloadSigned(doc)}
                            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Download via Signed Access Link"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setNextReviewStatus('ACCEPTED');
                              setReviewNotes('');
                              setRejectionReason('');
                              setFormError(null);
                              setReviewModalOpen(true);
                            }}
                            className="text-xs font-medium text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50 transition"
                          >
                            Review
                          </button>

                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setVersionFilename(`v${doc.version + 1}_${doc.originalFilename}`);
                              setVersionDisplayName(doc.safeDisplayName);
                              setVersionNotes('');
                              setFormError(null);
                              setVersionModalOpen(true);
                            }}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
                          >
                            New Ver
                          </button>

                          {!doc.isArchived && (
                            <button
                              onClick={() => handleArchive(doc)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
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

      {/* Modal: Review Document */}
      {reviewModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-600" />
              Review Document: {selectedDoc.documentNumber}
            </h3>
            <p className="text-xs text-gray-500 font-medium">{selectedDoc.safeDisplayName}</p>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleReviewDocument} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Review Decision *
                </label>
                <select
                  value={nextReviewStatus}
                  onChange={e => setNextReviewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="ACCEPTED">Accept / Approve Document</option>
                  <option value="REJECTED">Reject Document</option>
                  <option value="RESUBMISSION_REQUIRED">Request Resubmission</option>
                </select>
              </div>

              {(nextReviewStatus === 'REJECTED' ||
                nextReviewStatus === 'RESUBMISSION_REQUIRED') && (
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    Rejection Reason (Minimum 5 characters) *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. SLD missing earthing pit impedance signature"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Internal Review Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Review observations..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload New Version */}
      {versionModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Upload Version {selectedDoc.version + 1}
            </h3>
            <p className="text-xs text-gray-500">
              Supersedes current version v{selectedDoc.version}. Historical versions and audit
              records are preserved.
            </p>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUploadVersion} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Original Filename *
                </label>
                <input
                  type="text"
                  value={versionFilename}
                  onChange={e => setVersionFilename(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Safe Display Name
                </label>
                <input
                  type="text"
                  value={versionDisplayName}
                  onChange={e => setVersionDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Version Changelog / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Revised electrical SLD reflecting updated 15kVA inverter rating"
                  value={versionNotes}
                  onChange={e => setVersionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setVersionModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Uploading...' : 'Publish New Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload to Vault */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Upload Document to Vault
            </h3>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Original Filename *
                </label>
                <input
                  type="text"
                  placeholder="e.g. customer_aadhaar_card.pdf"
                  value={uploadFilename}
                  onChange={e => {
                    setUploadFilename(e.target.value);
                    if (!uploadDisplayName) setUploadDisplayName(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified Aadhaar KYC Copy"
                  value={uploadDisplayName}
                  onChange={e => setUploadDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="CUSTOMER_KYC">Customer KYC</option>
                    <option value="ELECTRICITY_BILL">Electricity Bill</option>
                    <option value="PROPERTY_DEED">Property Deed / Tax Receipt</option>
                    <option value="COMMERCIAL_PROPOSAL">Commercial Proposal</option>
                    <option value="SIGNED_CONTRACT">Signed Contract</option>
                    <option value="DISCOM_APPLICATION">DISCOM Application</option>
                    <option value="DISCOM_NOC">DISCOM Net Metering NOC</option>
                    <option value="SUBSIDY_CLAIM">Subsidy Claim Dossier</option>
                    <option value="ENGINEERING_DRAWING">Engineering SLD / CAD</option>
                    <option value="INSTALLATION_EVIDENCE">Installation Evidence</option>
                    <option value="COMMISSIONING_REPORT">Commissioning / Megger</option>
                    <option value="WARRANTY_CERTIFICATE">Warranty Certificate</option>
                    <option value="SERVICE_REPORT">Service Visit Report</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Access Classification
                  </label>
                  <select
                    value={uploadClassification}
                    onChange={e => setUploadClassification(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="INTERNAL_ONLY">Internal Only</option>
                    <option value="CUSTOMER_VISIBLE">Customer Visible</option>
                    <option value="RESTRICTED">Restricted Confidential</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    MIME Type
                  </label>
                  <select
                    value={uploadMime}
                    onChange={e => setUploadMime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="application/pdf">PDF (application/pdf)</option>
                    <option value="image/jpeg">JPEG (image/jpeg)</option>
                    <option value="image/png">PNG (image/png)</option>
                    <option value="image/webp">WEBP (image/webp)</option>
                    <option value="text/csv">CSV (text/csv)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    File Size (Bytes)
                  </label>
                  <input
                    type="number"
                    value={uploadSize}
                    onChange={e => setUploadSize(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Project ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Hex Project ID"
                    value={uploadProjectId}
                    onChange={e => setUploadProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Customer ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Hex Customer ID"
                    value={uploadCustomerId}
                    onChange={e => setUploadCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Uploading...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
