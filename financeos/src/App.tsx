import React, { useState, useEffect } from "react";
import { Download, Bell, Sparkles, RefreshCw, Layers, ShieldCheck, HelpCircle, Check, AlertTriangle, Menu, Database, Copy, Server } from "lucide-react";
import Sidebar from "./components/Sidebar";
import StatCard from "./components/StatCard";
import CashFlowChart from "./components/CashFlowChart";
import SpendingChart from "./components/SpendingChart";
import Transactions from "./components/Transactions";
import Budgets from "./components/Budgets";
import Portfolio from "./components/Portfolio";
import Goals from "./components/Goals";
import { StatData, CashFlowPoint, SpendingCategory, Transaction, Budget, PortfolioData, Goal, StockInfo } from "./types";
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
  deleteDbGoal
} from "./supabaseClient";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Core Data States
  const [stats, setStats] = useState<StatData | null>(null);
  const [cashflow, setCashflow] = useState<CashFlowPoint[]>([]);
  const [spending, setSpending] = useState<SpendingCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Shared Name Source of Truth
  const [userName] = useState("Syed Aziq");
  const [userInitials] = useState("SA");

  // Dynamically calculate Stats and Chart Data based on actual active records:
  const recalculateAllMetrics = (
    txs: Transaction[],
    bgs: Budget[],
    stocks: StockInfo[]
  ) => {
    // 1. Calculate Income / Expenses / Savings from transactions list
    let totalIncome = 0;
    let totalExpenses = 0;

    txs.forEach((t) => {
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
      return { ...b, used: expenseSum };
    });

    // 2. Calculate Portfolio totals
    const portfolioTotal = stocks.reduce((sum, s) => sum + s.value, 0);

    // 3. Net worth is portfolio assets + Cash Flow (with NO mock/baseline RM 125,000)
    const netWorthValue = portfolioTotal + (totalIncome - totalExpenses);

    const hasData = txs.length > 0 || stocks.length > 0;

    const computedStats: StatData = {
      netWorth: {
        value: netWorthValue,
        changePercent: 0,
        changeText: hasData ? "Net Worth Balance" : "No data yet"
      },
      income: {
        value: totalIncome,
        changePercent: 0,
        changeText: totalIncome > 0 ? "Total Income" : "No data yet"
      },
      expenses: {
        value: totalExpenses,
        changePercent: 0,
        changeText: totalExpenses > 0 ? "Total Expenses" : "No data yet"
      },
      savings: {
        value: Math.max(0, totalIncome - totalExpenses),
        changePercent: totalIncome > 0 ? Math.round((Math.max(0, totalIncome - totalExpenses) / totalIncome) * 100) : 0,
        changeText: totalIncome > 0 || totalExpenses > 0 ? "Savings Rate" : "No data yet"
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
      const [dbTxs, dbBgs, dbAssets, dbGoals] = await Promise.all([
        getDbTransactions(),
        getDbBudgets(),
        getDbPortfolioHoldings(),
        getDbGoals()
      ]);

      setTransactions(dbTxs);
      setBudgets(dbBgs);
      setGoals(dbGoals);

      // Calculate aggregates
      const metrics = recalculateAllMetrics(dbTxs, dbBgs, dbAssets);
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
  const handleAddBudget = async (budget: { name: string; total: number }) => {
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
                    {isSupabaseConfigured && (
                      <span className="animate-pulse border text-[10px] font-mono py-0.5 px-2.5 rounded-full flex items-center gap-1.5 shrink-0 font-medium bg-[#0c2415] text-[#22c55e] border-[#22c55e]/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]"></span>
                        <span>CLOUD ACTIVE</span>
                      </span>
                    )}
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
                {isSupabaseConfigured 
                  ? "Connected to cloud Supabase relational instance. All changes sync dynamically." 
                  : "No data — connect your account or add entries manually"}
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
                  changeText="Saved this month"
                  showProgressBar={true}
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

          {activeTab === "accounts" && (
            <div className="space-y-6 flex-1 py-4 shrink-0" id="accounts-pane">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xl text-white">Linked Accounts</h3>
                <button onClick={() => showToastNotification("OAuth linkages require bank consent flow.")} className="bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer">
                  Link New Bank +
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-brand-card border border-[#22c55e]/10 rounded-xl p-5 hover:border-[#22c55e]/30 transition-all cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono tracking-wider font-semibold text-brand-muted uppercase">Checking Account</span>
                    <span className="text-[10px] font-mono font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">Primary</span>
                  </div>
                  <p className="text-2xl font-display font-bold text-white mt-4">RM {(stats?.netWorth.value ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-brand-muted font-mono tracking-wide mt-2">CHASE BANK •••• 9242</p>
                </div>

                <div className="bg-brand-card border border-brand-border rounded-xl p-5 hover:border-neutral-850 transition-all cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono tracking-wider font-semibold text-brand-muted uppercase">Brokerage Securities</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-300 bg-neutral-800 px-2 py-0.5 rounded-full">Stocks</span>
                  </div>
                  <p className="text-2xl font-display font-bold text-white mt-4">RM {(portfolio?.total || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-brand-muted font-mono tracking-wide mt-2">VANGUARD FIDELITY •••• 7741</p>
                </div>
              </div>
            </div>
          )}

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

          {activeTab === "settings" && (
            <div className="space-y-6 flex-1 py-4 shrink-0 max-w-4xl animate-fade-in" id="settings-pane">
              <h3 className="font-display font-bold text-xl text-white">System Settings</h3>
              
              {/* SUPABASE CONNECTION UTILITY CALLOUT */}
              <div className="bg-[#121212] border border-brand-border rounded-xl p-5 md:p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-b border-zinc-900 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${isSupabaseConfigured ? "bg-[#22c55e]/10 text-brand-green border-[#22c55e]/20" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}>
                      <Database size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Supabase Cloud Database Status</h4>
                      <p className="text-xs text-brand-muted mt-0.5">Maintain durable real-time tables across browser sessions</p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold self-start sm:self-auto border ${
                    isSupabaseConfigured 
                      ? "bg-[#0b1f12] text-[#22c55e] border-[#22c55e]/20" 
                      : "bg-amber-950/20 text-amber-500 border-amber-500/10"
                  }`}>
                    {isSupabaseConfigured ? "● ACTIVE INTEGRATION" : "● LOCAL STORAGE FALLBACK ACTIVE"}
                  </span>
                </div>

                {!isSupabaseConfigured ? (
                  <div className="space-y-4 text-xs text-brand-muted leading-relaxed">
                    <p>
                      We currently fall back to browser <strong className="text-zinc-200">LocalStorage cache</strong> because Supabase credentials are not configured inside environment variables yet.
                    </p>
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 space-y-2">
                      <p className="font-semibold text-zinc-200 uppercase font-mono text-[10px] tracking-wider flex items-center gap-1.5">
                        <Server size={11} className="text-amber-500" />
                        Required configuration parameters:
                      </p>
                      <p>
                        Please declare the following keys inside the <strong className="text-zinc-200">Secrets (Settings API keys)</strong> panel in your AI Studio dashboard, or your <code className="bg-neutral-900 text-amber-500 px-1.5 py-0.5 rounded font-mono text-[11px]">.env</code> file:
                      </p>
                      <div className="bg-black/50 p-3 rounded-lg border border-zinc-900 font-mono text-[11px] text-zinc-300 space-y-1 select-all">
                        <div>VITE_SUPABASE_URL=https://your-project-id.supabase.co</div>
                        <div>VITE_SUPABASE_ANON_KEY=your-actual-anon-key</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-brand-green font-medium">
                    ✓ Your application is authenticated with Supabase. All active database states, transaction ledgers, category budgets, portfolio holdings, and targets are synchronized live.
                  </p>
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
                    Before inserting data, open your <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-zinc-300 underline font-semibold">Supabase Workspace SQL Editor</a>, paste the script below, and run it to initialize all four required schemas:
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
                      recalculateAllMetrics([], [], []);
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
