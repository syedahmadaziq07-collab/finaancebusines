import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, LayoutGrid } from "lucide-react";
import { CashFlowPoint } from "../types";

interface CashFlowChartProps {
  data: CashFlowPoint[];
  isLoading?: boolean;
}

export default function CashFlowChart({ data, isLoading = false }: CashFlowChartProps) {
  const [range, setRange] = useState<"6M" | "1Y" | "All">("6M");

  if (isLoading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-[400px] flex flex-col justify-between animate-pulse">
        <div className="flex justify-between items-center h-12">
          <div className="h-5 bg-neutral-800 rounded w-1/4"></div>
          <div className="h-8 bg-neutral-800 rounded w-1/3"></div>
        </div>
        <div className="h-60 bg-neutral-900 rounded w-full flex items-center justify-center">
          <span className="text-xs text-brand-muted">Loading visualization...</span>
        </div>
      </div>
    );
  }

  // Generate dynamic data depending on selected range
  let displayedData = [...data];
  if (data.length === 0) {
    displayedData = [];
  } else if (range === "1Y") {
    // Only expand if there are real entries, preserving real boundaries
    displayedData = [...data];
  } else if (range === "All") {
    displayedData = [...data];
  }

  // Format tick labels for clean financial view
  const formatYAxis = (value: number) => {
    if (value >= 1000) return `RM${(value / 1000).toFixed(0)}k`;
    return `RM${value}`;
  };

  return (
    <div id="cash-flow-chart-container" className="bg-brand-card border border-brand-border rounded-2xl p-6 hover:border-neutral-800 transition-all duration-300">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#22c55e]/10 text-brand-green">
              <TrendingUp size={14} />
            </span>
            <h3 className="font-display font-semibold text-base text-white tracking-tight">Cash Flow</h3>
          </div>
          <p className="text-xs text-brand-muted mt-0.5">Income vs. Expenses — Last 6 months</p>
        </div>

        {/* Range Selector Toggles */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl shrink-0 self-start sm:self-auto font-mono">
          {(["6M", "1Y", "All"] as const).map((r) => (
            <button
              key={r}
              id={`toggle-range-${r.toLowerCase()}`}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                range === r
                  ? "bg-white text-black shadow-sm"
                  : "text-brand-muted hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Line Chart stage */}
      <div className="h-[180px] md:h-[240px] xl:h-[300px] w-full" id="cashflow-chart-stage">
        {displayedData.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-brand-border/60 rounded-xl bg-neutral-900/30">
            <p className="text-xs text-brand-muted font-mono uppercase tracking-wider">No data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayedData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              {/* Dark, subtle Grid with horizontal lines only */}
              <CartesianGrid stroke="#1e1e1e" strokeDasharray="3 3" vertical={false} />
              
              <XAxis
                dataKey="month"
                stroke="#525252"
                fontSize={11}
                fontWeight={500}
                fontFamily="var(--font-heading)"
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              
              <YAxis
                stroke="#525252"
                fontSize={11}
                fontWeight={500}
                fontFamily="var(--font-mono)"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
                dx={0}
              />
              
              {/* Premium custom tooltip styled for dark theme */}
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  borderColor: "#2a2a2a",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  fontFamily: "var(--font-heading)",
                }}
                labelStyle={{ color: "#888888", fontSize: "11px", marginBottom: "4px", fontWeight: 600 }}
                itemStyle={{ fontSize: "13px", padding: "2px 0" }}
                formatter={(value: any) => [`RM ${Number(value).toLocaleString()}`, ""]}
              />

              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                fontFamily="var(--font-heading)"
                wrapperStyle={{ fontSize: "12px", color: "#888888", paddingTop: "15px" }}
                formatter={(value) => (
                  <span className="text-zinc-300 font-medium ml-1.5 capitalize">{value}</span>
                )}
              />

              {/* Income Line - Pure minimalist White */}
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#ffffff"
                strokeWidth={2.5}
                dot={{ stroke: "#ffffff", strokeWidth: 1.5, r: 3, fill: "#1a1a1a" }}
                activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: "#ffffff" }}
                animationDuration={800}
              />

              {/* Expenses Line - Slate/Gray */}
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#71717a"
                strokeWidth={2.5}
                dot={{ stroke: "#71717a", strokeWidth: 1.5, r: 3, fill: "#1a1a1a" }}
                activeDot={{ r: 5, stroke: "#71717a", strokeWidth: 2, fill: "#71717a" }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
