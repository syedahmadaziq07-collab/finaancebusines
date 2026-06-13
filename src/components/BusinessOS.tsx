import React, { useState, useMemo } from "react";
import { Plus, Building2, TrendingUp, TrendingDown, DollarSign, Eye, MoreHorizontal, X, Wallet, Layers, CalendarDays, FileText } from "lucide-react";
import { Business, Transaction } from "../types";

const BUSINESS_COLORS = ["#a855f7", "#8b5cf6", "#7c3aed", "#6d28d9", "#c084fc"];
const BUSINESS_TYPES = ["Digital Product", "Subscription", "Service", "Rental", "Other"];
const EXPENSE_CATEGORIES = ["Advertising", "Software", "Hosting", "Commission", "Tools", "Other"];

interface BusinessOSProps {
  businesses: Business[];
  transactions: Transaction[];
  onAddBusiness: (biz: { name: string; type: string; description?: string; monthlyTarget?: number }) => Promise<void>;
  onUpdateBusiness: (id: string, updates: Partial<Business>) => Promise<void>;
  onDeleteBusiness: (id: string) => Promise<void>;
  onAddTransaction: (tx: { name: string; category: string; amount: number; date?: string; business_id?: string; notes?: string }) => Promise<void>;
}

export default function BusinessOS({ businesses, transactions, onAddBusiness, onUpdateBusiness, onDeleteBusiness, onAddTransaction }: BusinessOSProps) {
  const [showNewBizModal, setShowNewBizModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState<{ businessId?: string; type: "income" | "expense" } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState<string | null>(null);

  // Form states - New Business
  const [bizName, setBizName] = useState("");
  const [bizType, setBizType] = useState("Digital Product");
  const [bizDesc, setBizDesc] = useState("");
  const [bizTarget, setBizTarget] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);

  // Form states - Add Transaction
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txBusiness, setTxBusiness] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txNotes, setTxNotes] = useState("");
  const [savingTx, setSavingTx] = useState(false);

  // Calculate business metrics
  const businessMetrics = useMemo(() => {
    return businesses.map(biz => {
      const bizTxs = transactions.filter(tx => tx.business_id === biz.id);
      const revenue = bizTxs.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
      const expenses = bizTxs.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const profit = revenue - expenses;
      const txCount = bizTxs.length;

      // This month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthTxs = bizTxs.filter(tx => {
        const d = new Date(tx.date);
        return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const monthRevenue = monthTxs.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
      const monthProfit = monthRevenue - monthTxs.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      return { revenue, expenses, profit, txCount, monthRevenue, monthProfit };
    });
  }, [businesses, transactions]);

  // Summary totals
  const totals = useMemo(() => {
    const totalRevenue = businessMetrics.reduce((sum, m) => sum + m.revenue, 0);
    const totalExpenses = businessMetrics.reduce((sum, m) => sum + m.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const activeBiz = businesses.filter(b => b.status === "active").length;
    return { totalRevenue, totalExpenses, totalProfit, activeBiz };
  }, [businessMetrics, businesses]);

  const formatRM = (v: number) => `RM ${v.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const handleNewBusiness = async () => {
    if (!bizName.trim()) return;
    setSavingBiz(true);
    try {
      await onAddBusiness({
        name: bizName.trim(),
        type: bizType,
        description: bizDesc.trim() || undefined,
        monthlyTarget: bizTarget ? Number(bizTarget) : undefined
      });
      setBizName(""); setBizType("Digital Product"); setBizDesc(""); setBizTarget("");
      setShowNewBizModal(false);
    } catch {}
    setSavingBiz(false);
  };

  const handleAddTransaction = async () => {
    if (!txName.trim() || !txAmount) return;
    setSavingTx(true);
    try {
      const amountNum = Math.abs(Number(txAmount));
      const finalAmount = txType === "expense" ? -amountNum : amountNum;
      // Map date from YYYY-MM-DD to display format
      const displayDate = txDate
        ? new Date(txDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : undefined;
      await onAddTransaction({
        name: txName.trim(),
        category: txType === "income" ? "Business Income" : txCategory || "Business Expense",
        amount: finalAmount,
        date: displayDate,
        business_id: txBusiness || showTxModal?.businessId || undefined,
        notes: txNotes.trim() || undefined
      });
      setTxName(""); setTxAmount(""); setTxCategory(""); setTxNotes("");
      setTxDate(new Date().toISOString().split("T")[0]);
      setShowTxModal(null);
    } catch {}
    setSavingTx(false);
  };

  const openTxModal = (businessId: string | undefined, type: "income" | "expense") => {
    setTxType(type);
    setTxBusiness(businessId || "");
    setShowTxModal({ businessId, type });
  };

  return (
    <div className="space-y-6 shrink-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-medium text-white">Business OS</h2>
          <p className="text-sm text-brand-muted mt-1">Track all your online income streams</p>
        </div>
        <button
          onClick={() => setShowNewBizModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-violet-600/20"
        >
          <Plus size={16} />
          <span>New Business</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151515] border border-zinc-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold">Total Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white">{formatRM(totals.totalRevenue)}</p>
          <p className="text-[11px] text-zinc-600">All time business income</p>
        </div>
        <div className="bg-[#151515] border border-zinc-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold">Total Expenses</span>
            <div className="p-2 rounded-xl bg-red-950/30 text-red-400 border border-red-900/30">
              <TrendingDown size={16} />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white">{formatRM(totals.totalExpenses)}</p>
          <p className="text-[11px] text-zinc-600">All time business costs</p>
        </div>
        <div className="bg-[#151515] border border-zinc-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold">Net Profit</span>
            <div className={`p-2 rounded-xl border ${totals.totalProfit >= 0 ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/30" : "bg-red-950/30 text-red-400 border-red-900/30"}`}>
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white">{formatRM(totals.totalProfit)}</p>
          <p className="text-[11px] text-zinc-600">{totals.totalProfit >= 0 ? "Profitable across all businesses" : "Net loss across businesses"}</p>
        </div>
        <div className="bg-[#151515] border border-zinc-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold">Active Businesses</span>
            <div className="p-2 rounded-xl bg-violet-950/30 text-violet-400 border border-violet-900/30">
              <Building2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white">{totals.activeBiz}</p>
          <p className="text-[11px] text-zinc-600">{businesses.length} total registered</p>
        </div>
      </div>

      {/* Business List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1.5 w-1.5 rounded-full bg-violet-400"></div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500">Business List</h3>
        </div>

        {businesses.length === 0 ? (
          <div className="bg-[#151515] border border-zinc-800/60 rounded-2xl p-10 text-center">
            <Building2 size={40} className="mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-400 text-sm font-medium">No businesses yet</p>
            <p className="text-xs text-zinc-600 mt-1">Click "New Business" to add your first online income stream.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {businesses.map((biz, idx) => {
              const metrics = businessMetrics[idx];
              if (!metrics) return null;
              const color = BUSINESS_COLORS[idx % BUSINESS_COLORS.length];
              return (
                <div key={biz.id} className="bg-[#151515] border border-zinc-800/60 hover:border-zinc-700/60 rounded-2xl p-5 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: color + "20", color }}>
                        {biz.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">{biz.name}</h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{biz.type}</p>
                      </div>
                    </div>

                    {/* Status + Metrics */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">
                        Active
                      </span>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 font-mono">Revenue</p>
                        <p className="text-sm font-semibold text-emerald-400">{formatRM(metrics.revenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 font-mono">Expenses</p>
                        <p className="text-sm font-semibold text-red-400">{formatRM(metrics.expenses)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 font-mono">Profit</p>
                        <p className={`text-sm font-semibold ${metrics.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRM(metrics.profit)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 font-mono">Txs</p>
                        <p className="text-sm font-semibold text-zinc-300">{metrics.txCount}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowDetailModal(biz.id)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all cursor-pointer"
                          title="View Business"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openTxModal(biz.id, "income")}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-950/50 transition-all cursor-pointer"
                        >
                          + Income
                        </button>
                        <button
                          onClick={() => openTxModal(biz.id, "expense")}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-950/30 text-red-400 border border-red-900/30 hover:bg-red-950/50 transition-all cursor-pointer"
                        >
                          + Expense
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setShowOptions(showOptions === biz.id ? null : biz.id)}
                            className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all cursor-pointer"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {showOptions === biz.id && (
                            <div className="absolute right-0 top-10 bg-[#1a1a1a] border border-zinc-800 rounded-xl p-2 shadow-2xl z-40 min-w-[140px]">
                              <button
                                onClick={() => { setShowDetailModal(biz.id); setShowOptions(null); }}
                                className="w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-all cursor-pointer"
                              >
                                View Details
                              </button>
                              <button
                                onClick={async () => {
                                  setShowOptions(null);
                                  const newStatus = biz.status === "active" ? "inactive" : "active";
                                  await onUpdateBusiness(biz.id, { status: newStatus });
                                }}
                                className="w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-all cursor-pointer"
                              >
                                {biz.status === "active" ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => {
                                  setShowOptions(null);
                                  if (window.confirm(`Delete "${biz.name}"? This will not delete linked transactions.`)) {
                                    onDeleteBusiness(biz.id);
                                  }
                                }}
                                className="w-full text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-3 py-2 rounded-lg transition-all cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW BUSINESS MODAL */}
      {showNewBizModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowNewBizModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-violet-950/30 text-violet-400 border border-violet-900/30">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">New Business</h3>
                <p className="text-xs text-zinc-500">Add a new income stream to track</p>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleNewBusiness(); }} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Business Name</label>
                <input type="text" required placeholder="e.g. Wallpaper Store" value={bizName} onChange={(e) => setBizName(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Business Type</label>
                <select value={bizType} onChange={(e) => setBizType(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors">
                  {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Description (optional)</label>
                <input type="text" placeholder="Brief description of your business" value={bizDesc} onChange={(e) => setBizDesc(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Monthly Target (RM, optional)</label>
                <input type="number" min="0" placeholder="e.g. 5000" value={bizTarget} onChange={(e) => setBizTarget(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setShowNewBizModal(false)} className="flex-1 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingBiz || !bizName.trim()} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                  <Plus size={14} />
                  <span>{savingBiz ? "Creating..." : "Save Business"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TRANSACTION MODAL */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowTxModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2.5 rounded-xl border ${showTxModal.type === "income" ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/30" : "bg-red-950/30 text-red-400 border-red-900/30"}`}>
                {showTxModal.type === "income" ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Add {showTxModal.type === "income" ? "Income" : "Expense"}</h3>
                <p className="text-xs text-zinc-500">Record a business transaction</p>
              </div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAddTransaction(); }} className="space-y-4">
              {/* Income/Expense Toggle */}
              <div className="flex bg-black/40 rounded-xl p-1 border border-zinc-800">
                <button type="button" onClick={() => setTxType("income")} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${txType === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"}`}>
                  Income
                </button>
                <button type="button" onClick={() => setTxType("expense")} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${txType === "expense" ? "bg-red-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"}`}>
                  Expense
                </button>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Name / Description</label>
                <input type="text" required placeholder={txType === "income" ? "e.g. Product Sale" : "e.g. Ad Spend"} value={txName} onChange={(e) => setTxName(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Amount (RM)</label>
                <input type="number" required min="0" step="0.01" placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Business</label>
                <select value={txBusiness || showTxModal.businessId || ""} onChange={(e) => setTxBusiness(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors">
                  <option value="">Select business...</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {txType === "expense" && (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Category</label>
                  <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors">
                    <option value="">Select category...</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Date</label>
                <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">Notes (optional)</label>
                <input type="text" placeholder="Any additional notes" value={txNotes} onChange={(e) => setTxNotes(e.target.value)} className="w-full bg-black/40 border border-zinc-800 hover:border-zinc-700 focus:border-violet-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-white transition-colors" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setShowTxModal(null)} className="flex-1 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingTx || !txName.trim() || !txAmount} className={`flex-1 text-xs font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${txType === "income" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-red-600 hover:bg-red-500 text-white"}`}>
                  {txType === "income" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{savingTx ? "Saving..." : `Save ${txType === "income" ? "Income" : "Expense"}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUSINESS DETAIL MODAL */}
      {showDetailModal && (() => {
        const biz = businesses.find(b => b.id === showDetailModal);
        if (!biz) return null;
        const idx = businesses.indexOf(biz);
        const metrics = businessMetrics[idx];
        if (!metrics) return null;
        const color = BUSINESS_COLORS[idx % BUSINESS_COLORS.length];
        const bizTxs = transactions.filter(tx => tx.business_id === biz.id).slice(0, 10);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#151515] border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowDetailModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer">
                <X size={16} />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0" style={{ backgroundColor: color + "20", color }}>
                  {biz.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{biz.name}</h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">
                      {biz.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{biz.type}{biz.description ? ` — ${biz.description}` : ""}</p>
                </div>
                <button
                  onClick={async () => {
                    const newName = prompt("Edit business name:", biz.name);
                    if (newName && newName.trim()) {
                      await onUpdateBusiness(biz.id, { name: newName.trim() });
                    }
                  }}
                  className="text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Edit
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-[10px] font-mono uppercase text-zinc-600 font-bold">Revenue</p>
                  <p className="text-lg font-semibold text-emerald-400 mt-1">{formatRM(metrics.revenue)}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-[10px] font-mono uppercase text-zinc-600 font-bold">Expenses</p>
                  <p className="text-lg font-semibold text-red-400 mt-1">{formatRM(metrics.expenses)}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-[10px] font-mono uppercase text-zinc-600 font-bold">Profit</p>
                  <p className={`text-lg font-semibold mt-1 ${metrics.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRM(metrics.profit)}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-[10px] font-mono uppercase text-zinc-600 font-bold">Transactions</p>
                  <p className="text-lg font-semibold text-white mt-1">{metrics.txCount}</p>
                </div>
              </div>

              {/* Monthly */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-[10px] font-mono uppercase text-zinc-600 font-bold flex items-center gap-1.5">
                    <CalendarDays size={11} /> This Month Revenue
                  </p>
                  <p className="text-lg font-semibold text-emerald-400 mt-1">{formatRM(metrics.monthRevenue)}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/60">
                  <p className="text-[10px] font-mono uppercase text-zinc-600 font-bold flex items-center gap-1.5">
                    <CalendarDays size={11} /> This Month Profit
                  </p>
                  <p className={`text-lg font-semibold mt-1 ${metrics.monthProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRM(metrics.monthProfit)}</p>
                </div>
              </div>

              {/* Recent Transactions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <FileText size={12} /> Recent Transactions
                  </h4>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setShowDetailModal(null); openTxModal(biz.id, "income"); }} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-950/30 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-950/50 transition-all cursor-pointer">
                      + Income
                    </button>
                    <button onClick={() => { setShowDetailModal(null); openTxModal(biz.id, "expense"); }} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-950/30 text-red-400 border border-red-900/30 hover:bg-red-950/50 transition-all cursor-pointer">
                      + Expense
                    </button>
                  </div>
                </div>
                {bizTxs.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-4 text-center">No transactions yet for this business.</p>
                ) : (
                  <div className="space-y-1.5">
                    {bizTxs.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2.5 border border-zinc-800/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${tx.amount >= 0 ? "bg-emerald-950/30 text-emerald-400" : "bg-red-950/30 text-red-400"}`}>
                            {tx.amount >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-white font-medium truncate">{tx.name}</p>
                            <p className="text-[10px] text-zinc-600">{tx.date}</p>
                          </div>
                        </div>
                        <p className={`text-xs font-semibold shrink-0 ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {tx.amount >= 0 ? "+" : ""}RM {Math.abs(tx.amount).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}