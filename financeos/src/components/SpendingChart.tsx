import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { SpendingCategory } from "../types";

interface SpendingChartProps {
  data: SpendingCategory[];
  isLoading?: boolean;
}

export default function SpendingChart({ data, isLoading = false }: SpendingChartProps) {
  if (isLoading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-[400px] flex flex-col justify-between animate-pulse">
        <div className="h-5 bg-neutral-800 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-neutral-900 rounded-full w-48 mx-auto my-4"></div>
        <div className="h-10 bg-neutral-800 rounded w-full"></div>
      </div>
    );
  }

  // Calculate total spending dynamically
  const totalSpending = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div id="spending-chart-container" className="bg-brand-card border border-brand-border rounded-2xl p-6 hover:border-neutral-800 transition-all duration-300 flex flex-col h-full justify-between">
      {/* Chart Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-zinc-800 text-zinc-300">
            <PieIcon size={14} />
          </span>
          <h3 className="font-display font-semibold text-base text-white tracking-tight">Spending</h3>
        </div>
        <p className="text-xs text-brand-muted mt-0.5">By category this month</p>
      </div>

      {/* Pie Chart and legend stage */}
      {data.length === 0 ? (
        <div className="h-56 w-full flex flex-col items-center justify-center border border-dashed border-brand-border/65 rounded-xl bg-neutral-900/20 p-6 my-auto">
          <p className="text-xs text-brand-muted font-mono uppercase tracking-wider">No spending data</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 my-auto pt-6 pb-2" id="spending-chart-content">
          {/* Real Donut Pie Chart with central summary */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#2a2a2a",
                    borderRadius: "12px",
                    padding: "8px 12px",
                    fontFamily: "var(--font-heading)",
                  }}
                  itemStyle={{ fontSize: "12px", color: "#ffffff" }}
                  formatter={(value: any) => [`RM ${Number(value).toLocaleString()}`, ""]}
                />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="85%"
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={600}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#1a1a1a" strokeWidth={1} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Central Label showing total expense */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-[10px] uppercase font-mono tracking-wider text-brand-muted">Total</span>
              <span className="text-sm sm:text-base md:text-xl font-display font-bold text-white tracking-tight">
                RM {totalSpending.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Categories Custom Legend Block */}
          <div className="flex-1 w-full space-y-2.5">
            {data.map((item) => {
              const percentage = ((item.value / totalSpending) * 100).toFixed(0);
              return (
                <div 
                  key={item.name} 
                  id={`spending-cat-${item.name.toLowerCase()}`}
                  className="flex items-center justify-between text-xs font-mono group p-1.5 hover:bg-neutral-900 rounded-lg transition-colors.md duration-150"
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-neutral-800" 
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <span className="text-zinc-300 font-sans font-medium text-sm transition-colors group-hover:text-white">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-brand-muted">
                      {percentage}%
                    </span>
                  </div>
                  <span className="text-white font-semibold text-sm select-all font-mono">
                    RM {item.value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
