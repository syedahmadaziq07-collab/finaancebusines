import React from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, MinusCircle, PiggyBank } from "lucide-react";

interface StatProp {
  title: string;
  value: number;
  changePercent: number;
  changeText: string;
  isLoading?: boolean;
  isRedDecrease?: boolean; // Expense increase is bad (red), income increase is good (green)
  showProgressBar?: boolean;
}

export default function StatCard({
  title,
  value,
  changePercent,
  changeText,
  isLoading = false,
  isRedDecrease = false,
  showProgressBar = false,
}: StatProp) {
  if (isLoading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-36 flex flex-col justify-between animate-pulse">
        <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
        <div className="h-8 bg-neutral-800 rounded w-1/2 my-2"></div>
        <div className="h-3 bg-neutral-800 rounded w-2/3"></div>
      </div>
    );
  }

  // Savings rate percentage if showing progress bar
  const progressPercent = showProgressBar ? changePercent : null;

  // Let's decide icon
  let cardIcon = <Wallet className="text-zinc-400" size={18} />;
  if (title.toUpperCase().includes("WORTH")) cardIcon = <TrendingUp className="text-zinc-400" size={18} />;
  else if (title.toUpperCase().includes("EXPENSE")) cardIcon = <MinusCircle className="text-zinc-400" size={18} />;
  else if (title.toUpperCase().includes("SAVING")) cardIcon = <PiggyBank className="text-zinc-400" size={18} />;

  // Determine change status colors
  // If expense increased (e.g. +8.3%), that's conventionally marked as bad (red accent)
  // If net worth or income increased, that's good (green accent)
  const isPositive = changePercent >= 0;
  const isBadAlert = (isRedDecrease && isPositive) || (!isRedDecrease && !isPositive);
  const badgeColor = isBadAlert ? "text-brand-red bg-red-950/15" : "text-brand-green bg-green-950/15";

  return (
    <div 
      id={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-brand-card border border-brand-border rounded-2xl p-6 hover:border-neutral-800 transition-all duration-300 group flex flex-col justify-between h-full hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono tracking-wider font-semibold text-brand-muted uppercase">
          {title}
        </span>
        <div className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          {cardIcon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between select-all">
        <span className="text-3xl font-display font-medium tracking-tight text-white">
          RM {value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
        
        {changeText !== "No data yet" && (
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
            {isBadAlert ? (
              <ArrowDownRight size={13} className="shrink-0" />
            ) : (
              <ArrowUpRight size={13} className="shrink-0" />
            )}
            <span>{isPositive ? "+" : ""}{changePercent}%</span>
          </span>
        )}
      </div>

      <div className="mt-2.5">
        {!showProgressBar ? (
          <p className="text-xs text-brand-muted font-light">{changeText}</p>
        ) : (
          <div className="space-y-1.5 w-full">
            <div className="flex justify-between text-[11px] text-brand-muted">
              <span>{changeText}</span>
              <span className="text-brand-green font-mono">{progressPercent}%</span>
            </div>
            {/* Elegant Slim Progress Bar with smooth transition */}
            <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800">
              <div 
                className="bg-brand-green h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent || 0))}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
