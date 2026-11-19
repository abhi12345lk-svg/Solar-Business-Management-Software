import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, UserCheck, FolderLock, ChevronRight, MapPin, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/api.js';

export interface InstallerWorkflowNavProps {
  activeStep: 'customers' | 'photos' | 'documents';
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  district?: string;
  onCustomerChange?: (custId: string) => void;
}

export const InstallerWorkflowNav: React.FC<InstallerWorkflowNavProps> = ({
  activeStep,
  customerId,
  customerName,
  customerCode,
  district
}) => {
  const [searchParams] = useSearchParams();
  const effectiveCustomerId = customerId || searchParams.get('customerId') || localStorage.getItem('solar_installer_active_customer_id') || '';

  const [displayCustomer, setDisplayCustomer] = useState<{
    id: string;
    name: string;
    code?: string;
    district?: string;
    photosDone?: boolean;
  } | null>(null);

  useEffect(() => {
    if (customerName) {
      setDisplayCustomer({
        id: effectiveCustomerId,
        name: customerName,
        code: customerCode,
        district: district,
        photosDone: !!localStorage.getItem(`solar_photos_${effectiveCustomerId}`)
      });
      if (effectiveCustomerId) {
        localStorage.setItem('solar_installer_active_customer_id', effectiveCustomerId);
      }
      return;
    }

    if (effectiveCustomerId) {
      const loadCust = async () => {
        try {
          const res: any = await apiClient<any>(`/customers/${effectiveCustomerId}`);
          const c = res?.data || res;
          if (c) {
            setDisplayCustomer({
              id: c._id || c.id || effectiveCustomerId,
              name: c.name || c.legalName || c.companyName || 'Solar Client',
              code: c.customerCode || 'CLIENT',
              district: c.installationAddress?.district || c.installationAddress?.city || 'Raipur',
              photosDone: !!localStorage.getItem(`solar_photos_${effectiveCustomerId}`)
            });
            localStorage.setItem('solar_installer_active_customer_id', effectiveCustomerId);
          }
        } catch {
          // ignore if customer not found
        }
      };
      loadCust();
    }
  }, [effectiveCustomerId, customerName, customerCode, district]);

  const customerQuery = displayCustomer?.id ? `?customerId=${displayCustomer.id}` : '';

  return (
    <div className="bg-card border border-solar-500/20 rounded-2xl p-3 shadow-2xs mb-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: 3-Step Connected Pipeline Stepper */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto py-0.5 scrollbar-none">
          {/* Step 1: Customer Directory */}
          <Link
            to={`/customers${customerQuery}`}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeStep === 'customers'
                ? 'bg-solar-600 text-white shadow-xs'
                : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              activeStep === 'customers' ? 'bg-white text-solar-700' : 'bg-muted text-foreground'
            }`}>
              1
            </span>
            <UserCheck className="w-3.5 h-3.5" />
            <span>Site List</span>
          </Link>

          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />

          {/* Step 2: Site Inspection Photos */}
          <Link
            to={`/site-photos${customerQuery}`}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeStep === 'photos'
                ? 'bg-solar-600 text-white shadow-xs'
                : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              activeStep === 'photos' ? 'bg-white text-solar-700' : 'bg-muted text-foreground'
            }`}>
              2
            </span>
            <Camera className="w-3.5 h-3.5" />
            <span>Site Photos</span>
          </Link>

          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />

          {/* Step 3: Site Documents */}
          <Link
            to={`/documents${customerQuery}`}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeStep === 'documents'
                ? 'bg-solar-600 text-white shadow-xs'
                : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              activeStep === 'documents' ? 'bg-white text-solar-700' : 'bg-muted text-foreground'
            }`}>
              3
            </span>
            <FolderLock className="w-3.5 h-3.5" />
            <span>Site Documents</span>
          </Link>
        </div>

        {/* Right: Active Site Context or Helpful Tip */}
        <div className="flex items-center space-x-2 justify-between lg:justify-end shrink-0 pt-1 lg:pt-0 border-t lg:border-t-0 border-border/50">
          {displayCustomer ? (
            <div className="flex items-center space-x-2 bg-solar-500/10 border border-solar-500/20 px-3 py-1 rounded-xl text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="truncate max-w-[200px] sm:max-w-[280px]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Active Site</span>
                <span className="font-bold text-foreground text-xs truncate">
                  {displayCustomer.name}
                </span>
                {displayCustomer.code && (
                  <span className="ml-1 text-[10px] font-mono font-bold text-solar-600">
                    ({displayCustomer.code})
                  </span>
                )}
              </div>
              {displayCustomer.photosDone && (
                <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Photos Done</span>
                </span>
              )}
              <Link
                to="/customers"
                className="text-[11px] text-solar-600 dark:text-solar-400 hover:underline font-bold ml-1 shrink-0"
                title="Switch active customer"
              >
                Change ▾
              </Link>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-solar-600 shrink-0" />
              <span>Select any customer from the site list to start 4-point site inspection &amp; sync dossiers</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
