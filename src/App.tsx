import React, { useState, useEffect } from "react";
import { Download, Bell, Sparkles, RefreshCw, Layers, ShieldCheck, HelpCircle, Check, AlertTriangle, Menu, Database, Copy, Server, Edit2, Trash2, PlusCircle, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import StatCard from "./components/StatCard";
import CashFlowChart from "./components/CashFlowChart";
import SpendingChart from "./components/SpendingChart";
import Transactions from "./components/Transactions";
import Budgets from "./components/Budgets";
import Portfolio from "./components/Portfolio";
import Goals from "./components/Goals";
import { StatData, CashFlowPoint, SpendingCategory, Transaction, Budget, PortfolioData, Goal, StockInfo, Account, Business } from "./types";
import {
  isSupabaseConfigured,
  SUPABASE_SQL_CREATION_SCHEMA,
  getDbTransactions,
  addDbTransaction,
  updateDbTransaction,
  deleteDbTransaction,
  getDbBudgets,
  addDbBudget,
  updateDbBudget,
  deleteDbBudget,
  getDbPortfolioHoldings,
  addDbPortfolioHolding,
  updateDbPortfolioHolding,
  deleteDbPortfolioHolding,
  getDbGoals,
  addDbGoal,
  updateDbGoal,
  deleteDbGoal,
  getDbAccounts,
  addDbAccount,
  updateDbAccount,
  deleteDbAccount,
  getDbBusinesses,
  addDbBusiness,
  updateDbBusiness,
  deleteDbBusiness,
  syncLocalToSupabase,
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  reinitializeSupabaseClient
} from "./supabaseClient";
import BusinessOS from "./components/BusinessOS";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "ok" | "failed">("unknown");

  // Core Data States
  const [stats, setStats] = useState<StatData | null>(null);
  const [cashflow, setCashflow] = useState<CashFlowPoint[]>([]);
  const [spending, setSpending] = useState<SpendingCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Shared Name Source of Truth
  const [userName] = useState("Coya");
  const [userInitials] = useState("CO");

  // Dynamically calculate Stats and Chart Data based on actual active records:
  const recalculateAllMetrics = (
    txs: Transaction[],
    bgs: Budget[],
    stocks: StockInfo[],
    accts: Account[],
    goals: Goal[] = []
  ) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Calculate Income / Expenses for current month only
    let totalIncome = 0;
    let totalExpenses = 0;

    txs.forEach((t) => {
      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          if (d.getMonth() !== currentMonth) return;
          if (/\d{4}/.test(t.date) && d.getFullYear() !== currentYear) return;
        }
      }
      if (t.amount > 0) {
        totalIncome += t.amount;
      } else {
        totalExpenses += Math.abs(t.amount);
      }
    });

    // Calculate sum of active budget usages from transactions lists
    const updatedBudgets = bgs.map((b) => {
      const expenseSum = txs
        .filter((t) => t.category.toLowerCase() === b.name.toLowerCase() && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return { ...b, used: Math.max(b.used, expenseSum) };
    });

    // 2. Calculate Portfolio totals
    const portfolioTotal = stocks.reduce((sum, s) => sum + s.value, 0);

    // 3. Net worth is sum of all account balances
    const netWorthValue = accts.reduce((sum, a) => sum + a.balance, 0);

    // 4. Savings = total available value (accounts + portfolio + goals + business profit)
    const goalsSavedTotal = goals.reduce((sum, g) => sum + g.current, 0);
    const businessRevenue = txs.filter(t => t.business_id && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const businessExpenses = txs.filter(t => t.business_id && t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const businessNetProfit = businessRevenue - businessExpenses;
    let savingsValue: number;
    if (accts.length > 0) {
      // accounts exist: use balance + portfolio + goals + business profit
      savingsValue = netWorthValue + portfolioTotal + goalsSavedTotal + businessNetProfit;
    } else {
      // no accounts: all transactions summed already includes business transactions
      const allIncome = txs.reduce((sum, t) => t.amount > 0 ? sum + t.amount : sum, 0);
      const allExpenses = txs.reduce((sum, t) => t.amount < 0 ? sum + Math.abs(t.amount) : sum, 0);
      savingsValue = Math.max(0, allIncome - allExpenses) + portfolioTotal + goalsSavedTotal;
    }
    savingsValue = Math.max(0, savingsValue);

    const hasData = txs.length > 0 || stocks.length > 0 || accts.length > 0;

    const computedStats: StatData = {
      netWorth: {
        value: netWorthValue,
        changePercent: 0,
        changeText: hasData ? "Net Worth Balance" : "No data yet"
      },
      income: {
        value: totalIncome,
        changePercent: 0,
        changeText: totalIncome > 0 ? "This Month" : "No data yet"
      },
      expenses: {
        value: totalExpenses,
        changePercent: 0,
        changeText: totalExpenses > 0 ? "This Month" : "No data yet"
      },
      savings: {
        value: savingsValue,
        changePercent: 0,
        changeText: savingsValue > 0 ? "Total money + assets + business profit" : "No data yet"
      }
    };

    // Compile dynamic spending chart slice elements from real active expenses
    const expenseTransactions = txs.filter((t) => t.amount < 0);
    const categoriesMap: { [key: string]: number } = {};

    expenseTransactions.forEach((t) => {
      categoriesMap[t.category] = (categoriesMap[t.category] || 0) + Math.abs(t.amount);
    });

    const colors = ["#ffffff", "#e5e5e5", "#a3a3a3", "#737373", "#525252", "#404040", "#262626", "#171717"];
    const computedSpending: SpendingCategory[] = Object.keys(categoriesMap).map((catName, idx) => ({
      name: catName,
      value: categoriesMap[catName],
      color: colors[idx % colors.length]
    }));

    // Compile dynamic monthly cashflow charts (fully dynamic - no fallback month keys)
    const monthlyData: { [key: string]: { income: number; expenses: number } } = {};
    
    // Sort transactions chronologically
    const sortedTxs = [...txs].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });

    sortedTxs.forEach((t) => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      
      const monthLabel = d.toLocaleString("default", { month: "short" });
      if (!monthlyData[monthLabel]) {
        monthlyData[monthLabel] = { income: 0, expenses: 0 };
      }
      
      if (t.amount > 0) {
        monthlyData[monthLabel].income += t.amount;
      } else {
        monthlyData[monthLabel].expenses += Math.abs(t.amount);
      }
    });

    const computedCashflow: CashFlowPoint[] = Object.keys(monthlyData).map((month) => ({
      month,
      income: monthlyData[month].income,
      expenses: monthlyData[month].expenses
    }));

    return {
      stats: computedStats,
      spending: computedSpending,
      cashflow: computedCashflow,
      budgetsArray: updatedBudgets,
      portfolioData: {
        total: portfolioTotal,
        pnl: stocks.reduce((sum, s) => sum + (s.value * (s.change / 100)), 0),
        ytdPercent: 0,
        stocks
      }
    };
  };

  // Fetch all backend database data
  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Fetch from Supabase service clients
      const [dbTxs, dbBgs, dbAssets, dbGoals, dbAccts, dbBiz] = await Promise.all([
        getDbTransactions(),
        getDbBudgets(),
        getDbPortfolioHoldings(),
        getDbGoals(),
        getDbAccounts(),
        getDbBusinesses()
      ]);

      setTransactions(dbTxs);
      setBudgets(dbBgs);
      setGoals(dbGoals);
      setAccounts(dbAccts);
      setBusinesses(dbBiz);

      // Calculate aggregates
      const metrics = recalculateAllMetrics(dbTxs, dbBgs, dbAssets, dbAccts, dbGoals);
      setStats(metrics.stats);
      setSpending(metrics.spending);
      setCashflow(metrics.cashflow);
      setBudgets(metrics.budgetsArray);
      setPortfolio(metrics.portfolioData);

    } catch (err) {
      console.error("Supabase / Local DB fetch interrupted:", err);
      setApiError("Active database access offline. Using localized fallback engine.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Check connection status on mount and whenever supabaseClient reinitializes
  useEffect(() => {
    const check = async () => {
      const result = await testSupabaseConnection();
      setConnectionStatus(result.ok || result.message.includes("tables are missing") ? "ok" : "failed");
    };
    if (isSupabaseConfigured()) {
      reinitializeSupabaseClient();
      check();
    } else {
      setConnectionStatus("unknown");
    }
  }, []);

  // CRUD Handler - Transactions
  const handleAddTransaction = async (tx: { name: string; category: string; amount: number; date?: string }) => {
    try {
      await addDbTransaction(tx);
      showToastNotification(`Logged transaction: ${tx.name}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error writing transaction.`);
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    try {
      await updateDbTransaction(id, updates);
      showToastNotification(`Updated transaction: ${updates.name || "item"}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error updating transaction.`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDbTransaction(id);
      showToastNotification(`Deleted transaction bookkeeping row.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error deleting row from table.`);
    }
  };

  // CRUD Handler - Budgets
  const handleAddBudget = async (budget: { name: string; total: number; used?: number }) => {
    try {
      await addDbBudget(budget);
      showToastNotification(`Created budget allocation for ${budget.name}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error establishing budget.`);
    }
  };

  const handleUpdateBudget = async (id: string, updates: Partial<Budget>) => {
    try {
      await updateDbBudget(id, updates);
      showToastNotification(`Updated budget for ${updates.name || "Category"}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error updating limit.`);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await deleteDbBudget(id);
      showToastNotification(`Removed budget limit constraints.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error deleting budget row.`);
    }
  };

  // CRUD Handler - Portfolio stocks / holdings
  const handleBuyStock = async (stock: { ticker: string; company: string; amount: number; change?: number }) => {
    try {
      await addDbPortfolioHolding(stock);
      showToastNotification(`Acquired security holding: ${stock.ticker}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error purchasing asset.`);
    }
  };

  const handleUpdateStock = async (id: string, updates: Partial<StockInfo>) => {
    try {
      await updateDbPortfolioHolding(id, updates);
      showToastNotification(`Modified parameters for asset: ${updates.ticker || "Asset"}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error editing security stats.`);
    }
  };

  const handleDeleteStock = async (id: string) => {
    try {
      await deleteDbPortfolioHolding(id);
      showToastNotification(`Disposed active asset holding.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error removing assets from index.`);
    }
  };

  // CRUD Handler - Savings target goals
  const handleCreateGoal = async (goal: { name: string; current: number; target: number }) => {
    try {
      await addDbGoal(goal);
      showToastNotification(`Goal created: ${goal.name}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error setting saving milestone.`);
    }
  };

  const handleUpdateGoal = async (id: string, updates: Partial<Goal>) => {
    try {
      await updateDbGoal(id, updates);
      showToastNotification(`Savings target modified: ${updates.name || "Goal"}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error editing goal details.`);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await deleteDbGoal(id);
      showToastNotification(`Goal deleted permanently.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error removing savings target.`);
    }
  };

  const handleContributeToGoal = async (goalId: string, amount: number) => {
    try {
      const targetGoal = goals.find(g => g.id === goalId);
      if (targetGoal) {
        const nextVal = targetGoal.current + amount;
        await updateDbGoal(goalId, { current: nextVal });
        
        // Register an transfer transaction row for authenticity
        await addDbTransaction({
          name: `Goal Contribution: ${targetGoal.name}`,
          category: "Investment",
          amount: -amount
        });

        showToastNotification(`Deposited RM ${amount.toLocaleString()} into ${targetGoal.name}!`);
        await loadDashboardData();
      }
    } catch (err) {
      showToastNotification(`Error filing goal deposits.`);
    }
  };

  // CRUD Handler - Accounts
  const handleAddAccount = async (account: Omit<Account, "id" | "created_at">) => {
    try {
      await addDbAccount(account);
      showToastNotification(`Account linked: ${account.name}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error linking account.`);
    }
  };

  const handleUpdateAccount = async (id: string, updates: Partial<Account>) => {
    try {
      await updateDbAccount(id, updates);
      showToastNotification(`Updated account details.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error updating account.`);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteDbAccount(id);
      showToastNotification(`Account removed.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error deleting account.`);
    }
  };

  // CRUD Handler - Businesses
  const handleAddBusiness = async (biz: { name: string; type: string; description?: string; monthlyTarget?: number }) => {
    try {
      await addDbBusiness(biz);
      showToastNotification(`Business created: ${biz.name}`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error creating business.`);
    }
  };

  const handleUpdateBusiness = async (id: string, updates: Partial<Business>) => {
    try {
      await updateDbBusiness(id, updates);
      showToastNotification(`Business updated.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error updating business.`);
    }
  };

  const handleDeleteBusiness = async (id: string) => {
    try {
      await deleteDbBusiness(id);
      showToastNotification(`Business removed.`);
      await loadDashboardData();
    } catch (err) {
      showToastNotification(`Error deleting business.`);
    }
  };

  // Toast notifier helper
  const showToastNotification = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => {
      setShowToast(null);
    }, 4000);
  };

  // CSV Data Export
  const handleExportData = () => {
    showToastNotification("Generating financial ledger... CSV export complete!");
    const csvContent = 
      "data:text/csv;charset=utf-8,Category,Value,Allocation\n" + 
      budgets.map(b => `${b.name},${b.used},${b.total}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "FinanceOS_Ledger_June_2025.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_CREATION_SCHEMA);
    setCopiedSql(true);
    showToastNotification("SQL Creation Script copied to clipboard!");
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const alertsList = [
    { text: "Food budget is nearing monthly caution threshold (76% raw limit)", type: "warning" },
    { text: "Salary direct deposit of +RM 4,700 registered successfully", type: "success" },
    { text: "RM 142 dividend yield from AAPL successfully logged", type: "info" }
  ];

  return (
    <div className="flex bg-brand-bg min-h-screen text-white font-sans max-w-[1920px] mx-auto overflow-x-hidden antialiased">
      
      {/* Toast bubble notifications */}
      {showToast && (
        <div id="toast-bubble" className="fixed top-4 right-4 z-50 bg-[#111] border-l-2 border-brand-green border-y border-r border-[#222] rounded-r-xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <div className="h-4.5 w-4.5 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center font-bold text-xs shrink-0">
            ✓
          </div>
          <span className="text-xs text-zinc-200 font-medium">{showToast}</span>
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        userName={userName}
        userInitials={userInitials}
      />

      {/* CORE CONTAINER */}
      <main id="app-stage-wrapper" className="flex-1 min-w-0 flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 lg:space-y-8 h-screen overflow-y-auto">
        
        <div className="w-full max-w-[1440px] mx-auto flex flex-col space-y-6 lg:space-y-8 flex-1">
          
          {/* HEADER PANEL */}
          <header id="dashboard-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border/40 pb-5 shrink-0">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <button
                    id="mobile-nav-toggle"
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2.5 -ml-1 rounded-xl border border-brand-border bg-brand-card hover:bg-neutral-900 text-white md:hidden cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Open main navigation"
                  >
                    <Menu size={18} />
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <h2 className="text-[22px] sm:text-2xl md:text-3xl font-display font-medium tracking-tight text-white animate-fade-in">
                      Good morning, {userName}.
                    </h2>
                    
                    {/* Database Setup State Pill representation */}
                    <span className={`border text-[10px] font-mono py-0.5 px-2.5 rounded-full flex items-center gap-1.5 shrink-0 font-medium ${
                      connectionStatus === "ok"
                        ? "bg-[#0c2415] text-[#22c55e] border-[#22c55e]/20"
                        : connectionStatus === "failed"
                        ? "bg-red-950/20 text-red-400 border-red-500/10"
                        : "bg-amber-950/20 text-amber-500 border-amber-500/10"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        connectionStatus === "ok" ? "bg-[#22c55e]" : 
                        connectionStatus === "failed" ? "bg-red-400" : "bg-amber-500"
                      }`}></span>
                      <span>{connectionStatus === "ok" ? "CLOUD ACTIVE" : connectionStatus === "failed" ? "CONNECTION FAILED" : "DEVICE ONLY"}</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 md:hidden bg-neutral-900/50 border border-brand-border/60 py-1.5 px-2.5 rounded-xl">
                  <div className="h-5 w-5 rounded-md bg-white text-black flex items-center justify-center font-bold font-display text-xs">
                    F
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white tracking-widest uppercase">FinanceOS</span>
                </div>
              </div>
              <p className="text-xs text-brand-muted mt-1 select-none leading-relaxed">
              {connectionStatus === "ok"
                ? "Cloud database connected — all changes sync across devices."
                : connectionStatus === "failed"
                ? "Connection to cloud failed. Check your Supabase credentials in Settings."
                : "Data is saved only on this browser/device. Add Supabase credentials in Settings for cloud sync."}
              </p>
            </div>

            {/* Action Tools block */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto relative select-none">
              
              <button 
                id="header-refresh-btn"
                onClick={() => loadDashboardData()}
                title="Synchronize Database"
                className="p-2.5 rounded-xl border border-brand-border bg-brand-card hover:bg-neutral-900 text-brand-muted hover:text-white transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              </button>

              <button
                id="header-export-btn"
                onClick={handleExportData}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-brand-card hover:bg-neutral-900 border border-brand-border hover:border-neutral-700 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm shadow-black"
              >
                <Download size={13} className="text-zinc-400" />
                <span>Export</span>
              </button>

              <button
                id="header-alerts-btn"
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all border shadow-sm relative shrink-0 cursor-pointer ${
                  showAlertsDropdown 
                    ? "bg-white text-black border-white"
                    : "bg-[#18181b] text-neutral-300 border-brand-border hover:border-neutral-700 hover:text-white"
                }`}
              >
                <Bell size={13} className={showAlertsDropdown ? "text-black" : "text-brand-green"} />
                <span>Alerts</span>
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-red ring-[3px] ring-brand-bg shrink-0"></span>
              </button>

              {/* Notification Flyout */}
              {showAlertsDropdown && (
                <div 
                  id="alerts-dropdown-box"
                  className="absolute top-12 right-0 bg-[#121212] border border-brand-border rounded-xl p-4 w-72 shadow-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-200"
                >
                  <div className="flex items-center justify-between border-b border-brand-border pb-2.5 mb-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-brand-muted font-bold">System Alerts</span>
                    <span className="text-[9px] text-[#22c55e] border border-[#22c55e]/10 bg-green-950/20 px-1.5 py-0.5 rounded uppercase font-bold">Active</span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {alertsList.map((alert, index) => (
                      <div key={index} className="flex gap-2.5 items-start text-xs border-b border-[rgba(255,255,255,0.05)] pb-2.5 last:border-0 last:pb-0">
                        <div className="p-1 rounded bg-neutral-950 text-brand-muted shrink-0 mt-0.5 border border-zinc-900">
                          {alert.type === "warning" ? (
                            <AlertTriangle size={11} className="text-brand-red animate-bounce" />
                          ) : (
                            <Check size={11} className="text-brand-green" />
                          )}
                        </div>
                        <span className="text-zinc-300 font-medium leading-relaxed select-all">
                          {alert.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* CONTROLLABLE VIEW DEPENDENT ON TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6 lg:space-y-8 flex-1 flex flex-col justify-between shrink-0" id="overview-pane">
              
              {/* STAT CARDS ROW */}
              <section id="pane-stats-row" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full shrink-0">
                <StatCard
                  title="Net Worth"
                  value={stats?.netWorth.value || 0}
                  changePercent={stats?.netWorth.changePercent || 0}
                  changeText={stats?.netWorth.changeText || "RM 0 this month"}
                  isLoading={isLoading}
                />
                <StatCard
                  title="Income"
                  value={stats?.income.value || 0}
                  changePercent={stats?.income.changePercent || 0}
                  changeText={stats?.income.changeText || "This month"}
                  isLoading={isLoading}
                />
                <StatCard
                  title="Expenses"
                  value={stats?.expenses.value || 0}
                  changePercent={stats?.expenses.changePercent || 0}
                  changeText={stats?.expenses.changeText || "This month"}
                  isRedDecrease={true}
                  isLoading={isLoading}
                />
                <StatCard
                  title="Savings"
                  value={stats?.savings.value || 0}
                  changePercent={stats?.savings.changePercent || 0}
                  changeText={stats?.savings.changeText || "Total available money"}
                  isLoading={isLoading}
                />
              </section>

              {/* CHARTS GRAPH SECTION */}
              <section id="pane-charts-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full shrink-0">
                <div className="md:col-span-2">
                  <CashFlowChart data={cashflow} isLoading={isLoading} />
                </div>
                <div className="md:col-span-1">
                  <SpendingChart data={spending} isLoading={isLoading} />
                </div>
              </section>

              {/* LOWER SUB-METRICS BLOCK */}
              <section id="pane-lower-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full shrink-0">
                <div className="md:col-span-1">
                  <Transactions 
                    transactions={transactions} 
                    onAddTransaction={handleAddTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    isLoading={isLoading} 
                  />
                </div>
                <div className="md:col-span-1">
                  <Budgets 
                    budgets={budgets} 
                    onAddBudget={handleAddBudget}
                    onUpdateBudget={handleUpdateBudget}
                    onDeleteBudget={handleDeleteBudget}
                    isLoading={isLoading} 
                  />
                </div>
                <div className="md:col-span-2 xl:col-span-1">
                  <Portfolio 
                    portfolio={portfolio || { total: 0, pnl: 0, ytdPercent: 0, stocks: [] }} 
                    onBuyStock={handleBuyStock}
                    onUpdateStock={handleUpdateStock}
                    onDeleteStock={handleDeleteStock}
                    isLoading={isLoading} 
                  />
                </div>
              </section>

              {/* GOALS GRID FOOTER PANEL */}
              <section id="pane-goals-panel" className="w-full pt-2 shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1.5 w-1.5 bg-[#22c55e] rounded-full shrink-0"></div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-[#888]">Active Goals</h3>
                </div>
                <Goals 
                  goals={goals} 
                  onContributeToGoal={handleContributeToGoal}
                  onAddGoal={handleCreateGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onDeleteGoal={handleDeleteGoal}
                  isLoading={isLoading} 
                />
              </section>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6 flex-1 py-4 shrink-0" id="analytics-pane">
              <h3 className="font-display font-bold text-xl text-white">Advanced Financial Analytics</h3>
              <div className="grid grid-cols-1 gap-6">
                <CashFlowChart data={cashflow} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SpendingChart data={spending} />
                  <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-4">
                    <h4 className="font-display font-semibold text-sm text-neutral-300 uppercase font-mono tracking-wider">Metrics Drilldown</h4>
                    <div className="space-y-3.5 divide-y divide-neutral-900">
                      <div className="flex justify-between py-1.5 text-xs text-brand-muted">
                        <span>Current Active Transactions:</span>
                        <span className="font-bold text-brand-green font-mono">{transactions.length} items</span>
                      </div>
                      <div className="flex justify-between py-2 text-xs text-brand-muted">
                        <span>Defined Spend Thresholds:</span>
                        <span className="font-bold text-zinc-300 font-mono">{budgets.length} Category Limits</span>
                      </div>
                      <div className="flex justify-between py-3 text-xs text-brand-muted">
                        <span>Secured Investment Base:</span>
                        <span className="font-bold text-white font-mono">RM {(portfolio?.total || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <button onClick={() => showToastNotification("Synthesizing dynamic financial health analytics...")} className="w-full bg-neutral-950 hover:bg-neutral-900 py-2.5 rounded-lg text-xs font-semibold border border-brand-border transition-colors cursor-pointer">
                      Generate Deep Assessment Reports
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "accounts" && <AccountsTabContent
              accounts={accounts}
              onAddAccount={handleAddAccount}
              onUpdateAccount={handleUpdateAccount}
              onDeleteAccount={handleDeleteAccount}
              isLoading={isLoading}
              showToast={showToastNotification}
            />}

          {activeTab === "transactions" && (
            <div className="space-y-4 flex-1 py-4 shrink-0 animate-fade-in" id="transactions-pane">
              <h3 className="font-display font-bold text-xl text-white">Legible Transaction Bookkeeping</h3>
              <Transactions 
                transactions={transactions} 
                onAddTransaction={handleAddTransaction} 
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                isLoading={isLoading}
              />
            </div>
          )}

          {activeTab === "budgets" && (
            <div className="space-y-4 flex-1 py-4 shrink-0 animate-fade-in" id="budgets-pane">
              <h3 className="font-display font-bold text-xl text-white">Spend Limit Thresholds</h3>
              <Budgets 
                budgets={budgets} 
                onAddBudget={handleAddBudget} 
                onUpdateBudget={handleUpdateBudget}
                onDeleteBudget={handleDeleteBudget}
                isLoading={isLoading}
              />
            </div>
          )}

          {activeTab === "investments" && (
            <div className="space-y-4 flex-1 py-4 shrink-0 animate-fade-in" id="investments-pane">
              <h3 className="font-display font-bold text-xl text-white">Investments & Portfolios</h3>
              <Portfolio 
                portfolio={portfolio || { total: 0, pnl: 0, ytdPercent: 0, stocks: [] }} 
                onBuyStock={handleBuyStock} 
                onUpdateStock={handleUpdateStock}
                onDeleteStock={handleDeleteStock}
                isLoading={isLoading}
              />
            </div>
          )}

          {activeTab === "business" && (
            <div className="space-y-4 flex-1 py-4 shrink-0 animate-fade-in" id="business-pane">
              <BusinessOS
                businesses={businesses}
                transactions={transactions}
                onAddBusiness={handleAddBusiness}
                onUpdateBusiness={handleUpdateBusiness}
                onDeleteBusiness={handleDeleteBusiness}
                onAddTransaction={handleAddTransaction}
              />
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-6 flex-1 py-4 shrink-0 animate-fade-in" id="reports-pane">
              <h3 className="font-display font-bold text-xl text-white">Reports & Insights</h3>
              <div className="bg-[#121212] border border-brand-border rounded-xl p-8 text-center">
                <p className="text-sm text-zinc-500">Coming soon — comprehensive business and financial reports.</p>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6 flex-1 py-4 shrink-0 max-w-4xl animate-fade-in" id="settings-pane">
              <h3 className="font-display font-bold text-xl text-white">System Settings</h3>
              
              {/* SUPABASE CONNECTION UTILITY CALLOUT */}
              <div className="bg-[#121212] border border-brand-border rounded-xl p-5 md:p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-b border-zinc-900 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      connectionStatus === "ok" ? "bg-[#22c55e]/10 text-brand-green border-[#22c55e]/20" :
                      connectionStatus === "failed" ? "bg-red-950/20 text-red-400 border-red-500/10" :
                      "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}>
                      <Database size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Supabase Cloud Database Status</h4>
                      <p className="text-xs text-brand-muted mt-0.5">Maintain durable real-time tables across browser sessions</p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold self-start sm:self-auto border ${
                    connectionStatus === "ok"
                      ? "bg-[#0b1f12] text-[#22c55e] border-[#22c55e]/20"
                      : connectionStatus === "failed"
                      ? "bg-red-950/20 text-red-400 border-red-500/10"
                      : "bg-amber-950/20 text-amber-500 border-amber-500/10"
                  }`}>
                    {connectionStatus === "ok" ? "● ACTIVE INTEGRATION" :
                     connectionStatus === "failed" ? "● CONNECTION FAILED" :
                     "● LOCAL STORAGE FALLBACK ACTIVE"}
                  </span>
                </div>

                {connectionStatus !== "ok" && (
                  <div className="space-y-4 text-xs text-brand-muted leading-relaxed">
                    <p>
                      <strong className="text-zinc-200">Device Only Mode:</strong> data is saved only on this browser/device.
                    </p>

                    {/* CLOUD SYNC SETUP FORM */}
                    <CloudSyncSetupForm
                      onStatusChange={async () => {
                        reinitializeSupabaseClient();
                        const result = await testSupabaseConnection();
                        setConnectionStatus(result.ok ? "ok" : result.message.includes("tables are missing") ? "ok" : "failed");
                        showToastNotification(
                          result.ok || result.message.includes("tables are missing")
                            ? "Supabase connected successfully!"
                            : result.message
                        );
                        if (result.ok || result.message.includes("tables are missing")) {
                          await loadDashboardData();
                        }
                      }}
                      onClear={async () => {
                        clearSupabaseConfig();
                        setConnectionStatus("unknown");
                        reinitializeSupabaseClient();
                        await loadDashboardData();
                        showToastNotification("Cloud credentials cleared.");
                      }}
                    />

                    {/* Safe debug output — only shows existence, not values */}
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 space-y-1.5">
                      <p className="font-semibold text-zinc-200 uppercase font-mono text-[10px] tracking-wider">Env Variable Status</p>
                      <div className="font-mono text-[11px] space-y-0.5">
                        <div><span className="text-zinc-400">VITE_SUPABASE_URL exists:</span> <span className={Boolean((import.meta as any).env?.VITE_SUPABASE_URL) ? "text-brand-green" : "text-brand-red"}>{Boolean((import.meta as any).env?.VITE_SUPABASE_URL) ? "YES" : "NO"}</span></div>
                        <div><span className="text-zinc-400">VITE_SUPABASE_ANON_KEY exists:</span> <span className={Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ? "text-brand-green" : "text-brand-red"}>{Boolean((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ? "YES" : "NO"}</span></div>
                        <div className="text-[10px] text-zinc-500 mt-1">Build-time env vars are only available when set before <strong>npm run build</strong>.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SYNC LOCAL DATA TO SUPABASE (only when configured) */}
                {connectionStatus === "ok" && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-brand-green font-medium">
                        ✓ Your application is authenticated with Supabase. All active database states, transaction ledgers, category budgets, portfolio holdings, and targets are synchronized live.
                      </p>
                      <p className="text-xs text-brand-muted"><strong className="text-zinc-200">Cloud Active:</strong> data syncs across phone, iPad, and laptop.</p>
                    </div>
                    <div className="border-t border-zinc-900 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">Sync Local Data to Cloud</h4>
                          <p className="text-[11px] text-brand-muted mt-0.5">Upload any data stored on this device into Supabase so it appears on all devices.</p>
                        </div>
                        <button
                          onClick={async () => {
                            setSyncing(true);
                            setSyncResult(null);
                            const result = await syncLocalToSupabase();
                            setSyncResult(result);
                            setSyncing(false);
                            if (result.errors.length === 0) showToastNotification(`Synced ${result.synced} records to cloud.`);
                            else showToastNotification(`Sync completed with ${result.errors.length} error(s).`);
                            await loadDashboardData();
                          }}
                          disabled={syncing}
                          className="text-xs bg-brand-green/10 text-brand-green border border-brand-green/20 hover:bg-brand-green/20 font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                          <span>{syncing ? "Syncing..." : "Sync Now"}</span>
                        </button>
                      </div>
                      {syncResult && (
                        <div className="text-[11px] font-mono">
                          <span className="text-brand-green">{syncResult.synced} records synced.</span>
                          {syncResult.errors.length > 0 && (
                            <span className="text-brand-red ml-2">{syncResult.errors.length} errors.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* SQL COPIER FOR TABLE BOOTSTRAP */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-300 font-bold flex items-center gap-1.5">
                      <span>SQL Setup Script</span>
                    </span>
                    <button
                      onClick={copySqlToClipboard}
                      className="text-xs text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-950 border border-brand-border px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer font-semibold"
                    >
                      <Copy size={12} />
                      <span>{copiedSql ? "Copied!" : "Copy SQL Script"}</span>
                    </button>
                  </div>

                  <p className="text-xs text-brand-muted">
                    Before inserting data, open your <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-zinc-300 underline font-semibold">Supabase Workspace SQL Editor</a>, paste the script below, and run it to initialize all required schemas:
                  </p>

                  <pre className="bg-[#090909] p-4 rounded-xl border border-neutral-900 font-mono text-[10px] text-brand-green/90 overflow-x-auto max-h-[180px] leading-relaxed select-all">
                    {SUPABASE_SQL_CREATION_SCHEMA}
                  </pre>
                </div>
              </div>

              <div className="bg-brand-card border border-brand-border rounded-xl divide-y divide-neutral-900 overflow-hidden">
                <div className="p-5 space-y-2">
                  <h4 className="text-sm font-semibold text-white">FinanceOS Currency Mapping</h4>
                  <p className="text-xs text-brand-muted">Configure active base accounting representation standard.</p>
                  <select className="bg-neutral-950 border border-brand-border rounded-xl px-3 py-2 text-xs text-zinc-300 w-48 mt-2 cursor-pointer focus:outline-none" defaultValue="RM MYR (Malaysian Ringgit)">
                    <option value="RM MYR (Malaysian Ringgit)">RM MYR (Malaysian Ringgit)</option>
                    <option value="$ USD (United States Dollar)">$ USD (United States Dollar)</option>
                  </select>
                </div>

                <div className="p-5 space-y-2">
                  <h4 className="text-sm font-semibold text-white">Local Cache Flush Tool</h4>
                  <p className="text-xs text-brand-muted font-sans pt-0.5">Wipe the localized backup storage and start with a pristine slate.</p>
                  <button 
                    onClick={() => {
                      localStorage.clear();
                      setTransactions([]);
                      setBudgets([]);
                      setGoals([]);
                      setPortfolio({ total: 0, pnl: 0, ytdPercent: 0, stocks: [] });
                      recalculateAllMetrics([], [], [], []);
                      showToastNotification("Local cache index wiped successfully.");
                      loadDashboardData();
                    }}
                    className="bg-neutral-950 hover:bg-neutral-900 border border-brand-red hover:border-brand-red/80 font-semibold text-xs text-brand-red px-4 py-2.5 rounded-xl transition-all mt-2 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Flush Session Storage</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// ACCOUNTS TAB COMPONENT
// ==========================================
function AccountsTabContent({
  accounts,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  isLoading,
  showToast
}: {
  accounts: Account[];
  onAddAccount: (a: Omit<Account, "id" | "created_at">) => Promise<void>;
  onUpdateAccount: (id: string, u: Partial<Account>) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  isLoading: boolean;
  showToast: (msg: string) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState("Checking");
  const [addBank, setAddBank] = useState("");
  const [addLastFour, setAddLastFour] = useState("");
  const [addBalance, setAddBalance] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editBank, setEditBank] = useState("");
  const [editLastFour, setEditLastFour] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const accountTypes = ["Checking", "Savings", "Brokerage", "Credit Card", "Other"];

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addBank || !addBalance) return;
    setIsAdding(true);
    try {
      await onAddAccount({
        name: addName,
        type: addType,
        bank_name: addBank,
        last_four: addLastFour,
        balance: parseFloat(addBalance)
      });
      setAddName(""); setAddType("Checking"); setAddBank(""); setAddLastFour(""); setAddBalance("");
      setShowAddForm(false);
    } catch { } finally { setIsAdding(false); }
  };

  const handleStartEdit = (acc: Account) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditBank(acc.bank_name);
    setEditLastFour(acc.last_four);
    setEditBalance(acc.balance.toString());
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editName || !editBank || !editBalance) return;
    setIsUpdating(true);
    try {
      await onUpdateAccount(editingAccount.id, {
        name: editName,
        type: editType,
        bank_name: editBank,
        last_four: editLastFour,
        balance: parseFloat(editBalance)
      });
      setEditingAccount(null);
    } catch { } finally { setIsUpdating(false); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this account?")) {
      try { await onDeleteAccount(id); setEditingAccount(null); } catch { }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 flex-1 py-4 shrink-0" id="accounts-pane">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xl text-white">Linked Accounts</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-brand-card border border-brand-border rounded-xl p-5 h-32">
              <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
              <div className="h-6 bg-neutral-800 rounded w-1/2 mt-4"></div>
              <div className="h-3 bg-neutral-800 rounded w-2/3 mt-4"></div>
            </div>
          ))}
        </div>
    </div>
  );
}

// ==========================================
// Cloud Sync Setup Form (inline component)
// ==========================================
function CloudSyncSetupForm({ onStatusChange, onClear }: { onStatusChange: () => Promise<void>; onClear: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Pre-fill from existing config on mount
  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (cfg.url && cfg.source === "localStorage") {
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
    }
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Temporarily save so testSupabaseConnection can use these credentials
      saveSupabaseConfig(url.trim(), anonKey.trim());
      const result = await testSupabaseConnection();
      setTestResult(result.message);
      if (!result.ok) {
        clearSupabaseConfig();
      }
    } catch {
      setTestResult("Connection test failed.");
      clearSupabaseConfig();
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      saveSupabaseConfig(url.trim(), anonKey.trim());
      const result = await testSupabaseConnection();
      if (result.ok || result.message.includes("tables are missing")) {
        setTestResult(result.message);
        await onStatusChange();
      } else {
        setTestResult(result.message);
        clearSupabaseConfig();
      }
    } catch {
      setTestResult("Failed to save credentials.");
      clearSupabaseConfig();
    }
    setSaving(false);
  };

  const handleClear = async () => {
    setUrl("");
    setAnonKey("");
    setTestResult(null);
    await onClear();
  };

  return (
    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 space-y-3">
      <p className="font-semibold text-zinc-200 uppercase font-mono text-[10px] tracking-wider flex items-center gap-1.5">
        <Server size={11} className="text-amber-500" />
        Cloud Sync Setup
      </p>
      <p className="text-[11px] text-brand-muted">
        Paste your Supabase project credentials below to enable cloud data sync across all your devices.
        Only the <strong className="text-zinc-200">anon public key</strong> is needed.
      </p>
      <div className="space-y-2.5">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-brand-muted block mb-1">Supabase Project URL</label>
          <input
            type="url"
            placeholder="https://your-project-id.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-black/50 border border-zinc-900 hover:border-zinc-700 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-brand-muted block mb-1">Supabase Anon Public Key</label>
          <input
            type="text"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            className="w-full bg-black/50 border border-zinc-900 hover:border-zinc-700 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
          />
        </div>
      </div>
      {testResult && (
        <div className={`text-[11px] font-mono px-3 py-1.5 rounded-lg ${
          testResult.includes("connected") || testResult.includes("tables are missing")
            ? "bg-[#0c2415] text-brand-green border border-[#22c55e]/10"
            : "bg-red-950/20 text-red-400 border border-red-500/10"
        }`}>
          {testResult}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleTestConnection}
          disabled={testing || !url.trim() || !anonKey.trim()}
          className="text-xs border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40 cursor-pointer"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !url.trim() || !anonKey.trim()}
          className="text-xs bg-brand-green/10 text-brand-green border border-brand-green/20 hover:bg-brand-green/20 font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40 cursor-pointer"
        >
          {saving ? "Saving..." : "Save Cloud Credentials"}
        </button>
        <button
          onClick={handleClear}
          className="text-xs text-red-400 hover:text-red-300 border border-red-900/30 hover:border-red-700/50 px-3 py-1.5 rounded-lg transition-all font-semibold ml-auto cursor-pointer"
        >
          Clear Credentials
        </button>
      </div>
    </div>
  );
}

  return (
    <div className="space-y-6 flex-1 py-4 shrink-0" id="accounts-pane">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xl text-white">Linked Accounts</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
        >
          Link New Bank +
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.length === 0 ? (
          <div className="col-span-full text-center py-16 flex flex-col items-center justify-center border border-dashed border-brand-border rounded-xl p-8 bg-neutral-900/40">
            <p className="text-sm text-brand-muted">No accounts linked — add your first account</p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-brand-card border border-brand-border rounded-xl p-5 hover:border-neutral-700 transition-all duration-300 group relative"
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono tracking-wider font-semibold text-brand-muted uppercase">{acc.type}</span>
                <span className="text-[10px] font-mono font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
                  {acc.name}
                </span>
              </div>
              <p className="text-2xl font-display font-bold text-white mt-4 select-all">
                RM {acc.balance.toLocaleString()}
              </p>
              <p className="text-[10px] text-brand-muted font-mono tracking-wide mt-2">
                {acc.bank_name.toUpperCase()} {acc.last_four ? `•••• ${acc.last_four}` : ""}
              </p>
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(acc)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                  title="Edit account"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="p-1.5 text-zinc-400 hover:text-brand-red hover:bg-zinc-900/50 rounded-lg transition-colors cursor-pointer"
                  title="Delete account"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowAddForm(false)} className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors">
              <X size={16} />
            </button>
            <header className="mb-5">
              <h4 className="font-display font-semibold text-lg text-white">Add Account</h4>
              <p className="text-xs text-brand-muted mt-0.5">Link a new bank or financial account</p>
            </header>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Account Name</label>
                <input type="text" required placeholder="e.g. Maybank Savings" value={addName} onChange={(e) => setAddName(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Account Type</label>
                  <select value={addType} onChange={(e) => setAddType(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-2 py-2 text-sm text-white transition-colors cursor-pointer">
                    {accountTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Bank Name</label>
                  <input type="text" required placeholder="e.g. Maybank" value={addBank} onChange={(e) => setAddBank(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Last 4 Digits</label>
                  <input type="text" maxLength={4} placeholder="1234" value={addLastFour} onChange={(e) => setAddLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Balance (RM)</label>
                  <input type="number" required min="0" step="0.01" placeholder="0.00" value={addBalance} onChange={(e) => setAddBalance(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={isAdding} className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                  <PlusCircle size={14} />
                  <span>{isAdding ? "Linking..." : "Link Account"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setEditingAccount(null)} className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors">
              <X size={16} />
            </button>
            <header className="mb-5 flex justify-between items-start">
              <div>
                <h4 className="font-display font-semibold text-lg text-white">Edit Account</h4>
                <p className="text-xs text-brand-muted mt-0.5">Update account details</p>
              </div>
              <button type="button" onClick={() => handleDelete(editingAccount.id)} className="text-xs text-brand-red hover:text-red-400 bg-brand-red/10 border border-brand-red/20 hover:border-brand-red/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer font-mono">
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </header>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Account Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Account Type</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-2 py-2 text-sm text-white transition-colors cursor-pointer">
                    {accountTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Bank Name</label>
                  <input type="text" required value={editBank} onChange={(e) => setEditBank(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Last 4 Digits</label>
                  <input type="text" maxLength={4} value={editLastFour} onChange={(e) => setEditLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Balance (RM)</label>
                  <input type="number" required min="0" step="0.01" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3">
                <button type="button" onClick={() => setEditingAccount(null)} className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={isUpdating} className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                  <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
