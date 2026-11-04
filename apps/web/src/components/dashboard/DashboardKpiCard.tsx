import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export type KpiColor =
  'amber' | 'blue' | 'emerald' | 'purple' | 'sky' | 'rose' | 'indigo' | 'cyan' | 'orange' | 'teal';

interface DashboardKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  to?: string;
  color?: KpiColor;
  badge?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
}

const colorMap: Record<
  KpiColor,
  {
    bgIcon: string;
    textIcon: string;
    hoverBorder: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  amber: {
    bgIcon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    textIcon: 'text-amber-600',
    hoverBorder: 'hover:border-amber-500/50',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-400'
  },
  blue: {
    bgIcon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    textIcon: 'text-blue-600',
    hoverBorder: 'hover:border-blue-500/50',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-400'
  },
  emerald: {
    bgIcon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    textIcon: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-500/50',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-400'
  },
  purple: {
    bgIcon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    textIcon: 'text-purple-600',
    hoverBorder: 'hover:border-purple-500/50',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-700 dark:text-purple-400'
  },
  sky: {
    bgIcon: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    textIcon: 'text-sky-600',
    hoverBorder: 'hover:border-sky-500/50',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-700 dark:text-sky-400'
  },
  rose: {
    bgIcon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    textIcon: 'text-rose-600',
    hoverBorder: 'hover:border-rose-500/50',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-700 dark:text-rose-400'
  },
  indigo: {
    bgIcon: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    textIcon: 'text-indigo-600',
    hoverBorder: 'hover:border-indigo-500/50',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-700 dark:text-indigo-400'
  },
  cyan: {
    bgIcon: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    textIcon: 'text-cyan-600',
    hoverBorder: 'hover:border-cyan-500/50',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-700 dark:text-cyan-400'
  },
  orange: {
    bgIcon: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    textIcon: 'text-orange-600',
    hoverBorder: 'hover:border-orange-500/50',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-700 dark:text-orange-400'
  },
  teal: {
    bgIcon: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    textIcon: 'text-teal-600',
    hoverBorder: 'hover:border-teal-500/50',
    badgeBg: 'bg-teal-500/15',
    badgeText: 'text-teal-700 dark:text-teal-400'
  }
};

export const DashboardKpiCard: React.FC<DashboardKpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  to,
  color = 'amber',
  badge,
  trend
}) => {
  const scheme = colorMap[color] || colorMap.amber;

  const content = (
    <div
      className={`bg-card border border-border/80 rounded-xl p-4 sm:p-5 transition-all shadow-xs group h-full flex flex-col justify-between ${
        to ? `${scheme.hoverBorder} hover:shadow-md cursor-pointer` : ''
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-snug">
            {title}
          </span>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${scheme.bgIcon}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            {value}
          </div>
          {badge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${scheme.badgeBg} ${scheme.badgeText}`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground gap-2 pt-2 border-t border-border/40">
          {subtitle && <span className="line-clamp-1">{subtitle}</span>}
          {trend && (
            <span
              className={`inline-flex items-center text-[11px] font-semibold shrink-0 ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              )}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block min-w-0 h-full">
        {content}
      </Link>
    );
  }

  return content;
};
