/**
 * INS Solar Business Management Software — Project Site Photos Tab
 *
 * Displays statutory DISCOM / PM Surya Ghar consumer-verified inspection photos,
 * GPS geotags, equipment barcodes, and technical manuals directly within the Project detail view.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  MapPin,
  Calendar,
  ExternalLink,
  Barcode,
  Eye,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../lib/api.js';

interface ProjectSitePhotosTabProps {
  projectId: string;
  customerId: string;
  customerName?: string;
  projectCode?: string;
  isTerminal?: boolean;
}

export const ProjectSitePhotosTab: React.FC<ProjectSitePhotosTabProps> = ({
  projectId,
  customerId,
  customerName,
  projectCode
}) => {
  const [installation, setInstallation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; category: string } | null>(null);

  useEffect(() => {
    const fetchInstallation = async () => {
      try {
        setLoading(true);
        setError(null);
        // Try query by projectId first, then fallback by customerId
        let res: any = await apiClient<any>(`/installations?projectId=${projectId}&limit=1`);
        let items = res?.installations || res?.items || res?.data || (Array.isArray(res) ? res : []);
        
        if (!items || items.length === 0) {
          res = await apiClient<any>(`/installations?customerId=${customerId}&limit=1`);
          items = res?.installations || res?.items || res?.data || (Array.isArray(res) ? res : []);
        }

        if (items && items.length > 0) {
          // Fetch full installation detail
          const instId = items[0]._id || items[0].id;
          const detailRes = await apiClient<any>(`/installations/${instId}`);
          setInstallation(detailRes?.data || detailRes);
        } else {
          setInstallation(null);
        }
      } catch (err: any) {
        console.warn('Failed to load project statutory installation photos:', err);
        setError(err.message || 'Failed to load statutory site photos.');
      } finally {
        setLoading(false);
      }
    };

    if (projectId || customerId) {
      fetchInstallation();
    }
  }, [projectId, customerId]);

  if (loading) {
    return (
      <div className="bg-card border border-border/80 rounded-xl p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
        <div className="w-6 h-6 border-2 border-solar-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading statutory site inspection photos...</span>
      </div>
    );
  }

  const sitePhotos: any[] = installation?.sitePhotos || [];
  const panelDetails = installation?.panelDetails;
  const barcodes: any[] = installation?.inventoryRows || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-card border border-border/70 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-solar-500/10 text-solar-600">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Statutory DISCOM &amp; PM Surya Ghar Site Photos {projectCode ? `(${projectCode})` : ''}
              </h3>
              <p className="text-xs text-muted-foreground">
                Mandatory consumer-verified photos {customerName ? `for ${customerName}` : ''} required for DISCOM net metering inspection and central subsidy claim.
              </p>
            </div>
          </div>
        </div>

        <Link
          to={`/site-photos?projectId=${projectId}&customerId=${customerId}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>Launch Camera &amp; Upload Photos</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* No Installation Photos Yet */}
      {!installation || sitePhotos.length === 0 ? (
        <div className="bg-card border border-border/80 border-dashed rounded-xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-solar-500/10 text-solar-600 flex items-center justify-center">
            <Camera className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-foreground">No Inspection Photos Uploaded Yet</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Field installation crew can capture consumer-verified rooftop photos (structure, inverter, net meter, earthing pits) and scan equipment serial barcodes directly on mobile.
            </p>
          </div>
          <Link
            to={`/site-photos?projectId=${projectId}&customerId=${customerId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-solar-600 hover:bg-solar-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Open Field Photo Studio</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-xl border border-border/60 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Installation Code</span>
              <span className="font-semibold text-foreground">{installation.installationNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Inspection Status</span>
              <span className="font-semibold text-foreground uppercase">{installation.status || 'ASSIGNED'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Assigned Installer</span>
              <span className="font-semibold text-foreground">{installation.assignedInstallerName || 'Field Crew'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Total Photos Attached</span>
              <span className="font-semibold text-emerald-600">{sitePhotos.length} Photos Captured</span>
            </div>
          </div>

          {/* Photo Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sitePhotos.map((photo, idx) => {
              const photoUrl = photo.fileUrl || (photo.storageKey ? `/api/v1/installations/${installation._id}/photos-raw?key=${encodeURIComponent(photo.storageKey)}` : '');
              return (
                <div
                  key={photo._id || idx}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-xs flex flex-col group hover:border-solar-500/50 transition-all"
                >
                  <div className="relative aspect-4/3 bg-muted/60 flex items-center justify-center overflow-hidden">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={photo.title || 'Site photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground/40" />
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto({ url: photoUrl, title: photo.title || 'Site Photo', category: photo.category })}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                    >
                      <Eye className="w-5 h-5 mr-1" />
                      <span className="text-xs font-semibold">View Full</span>
                    </button>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white backdrop-blur-xs">
                      {photo.category?.replace(/_/g, ' ') || 'INSPECTION'}
                    </span>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-1">{photo.title || 'Inspection Photo'}</h4>
                      {photo.remarks && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{photo.remarks}</p>
                      )}
                    </div>

                    <div className="space-y-1 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                      {photo.gpsLocation?.latitude && photo.gpsLocation?.longitude && (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{photo.gpsLocation.latitude.toFixed(5)}, {photo.gpsLocation.longitude.toFixed(5)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{new Date(photo.uploadedAt || photo.timestamp || Date.now()).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scanned Hardware Barcodes / Serials */}
          {panelDetails && (panelDetails.panelSerialNumbers?.length > 0 || barcodes.length > 0) && (
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-solar-600" />
                  <span>Scanned Hardware Barcodes &amp; Serial Numbers</span>
                </h4>
                <span className="text-xs font-semibold text-muted-foreground">
                  {panelDetails.totalPanels ? `${panelDetails.totalPanels} Solar Panels` : ''}
                </span>
              </div>

              {panelDetails.panelSerialNumbers && panelDetails.panelSerialNumbers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Module Serial Numbers:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {panelDetails.panelSerialNumbers.map((s: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-muted/80 text-foreground font-mono text-[11px] border border-border/60"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">{previewPhoto.title}</h3>
                <span className="text-[11px] text-muted-foreground uppercase">{previewPhoto.category}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-2 bg-black/90 flex-1 flex items-center justify-center overflow-hidden">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
