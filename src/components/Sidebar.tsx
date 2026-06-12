import React from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  ArrowLeftRight, 
  Target, 
  Briefcase, 
  Settings,
  ShieldCheck,
  X
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  userName?: string;
  userInitials?: string;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isOpen = false, 
  onClose = () => {},
  userName = "Coya",
  userInitials = "CO"
}: SidebarProps) {
  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "accounts", label: "Accounts", icon: Wallet },
    { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
    { id: "budgets", label: "Budgets", icon: Target },
    { id: "investments", label: "Investments", icon: Briefcase },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-45 md:hidden animate-in fade-in duration-205"
        />
      )}

      <aside 
        id="sidebar" 
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-brand-border bg-brand-bg flex flex-col justify-between h-screen text-white select-none transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:w-20 xl:w-64 shrink-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Logo & Header */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between xl:justify-start gap-3 mb-8">
            <div className="flex items-center gap-3 justify-center md:justify-center xl:justify-start w-full xl:w-auto">
              <div className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-bold font-display text-lg shadow-md hover:scale-105 transition-transform shrink-0">
                F
              </div>
              <div className="md:hidden xl:block">
                <h1 className="font-display font-semibold tracking-tight text-[17px] leading-tight text-white">FinanceOS</h1>
                <p className="text-[10px] text-brand-muted font-mono tracking-wider uppercase">Personal Finance</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-card md:hidden cursor-pointer shrink-0"
              title="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5 overflow-y-auto flex-1 pr-1" id="sidebar-nav">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-item-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-center xl:justify-start gap-4 px-3 md:px-0 xl:px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group text-left min-h-[44px] ${
                    isActive
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "text-brand-muted hover:text-white hover:bg-brand-card"
                  }`}
                >
                  <Icon 
                    size={18} 
                    className={`transition-colors shrink-0 ${
                      isActive ? "text-black" : "text-brand-muted group-hover:text-white"
                    }`} 
                  />
                  <span className="md:hidden xl:block truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Information */}
        <div className="p-4 border-t border-brand-border" id="sidebar-footer">
          <div className="flex flex-col md:items-center xl:flex-row xl:items-center justify-between p-2 rounded-2xl bg-brand-card border border-brand-border hover:border-neutral-800 transition-all duration-200">
            <div className="flex flex-col md:items-center xl:flex-row gap-3">
              {/* User Avatar with Initials */}
              <div className="h-9 w-9 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-200 border border-neutral-700 font-display shrink-0">
                {userInitials}
              </div>
              <div className="md:hidden xl:block">
                <p className="text-xs font-semibold text-white">{userName}</p>
                <p className="text-[10px] text-brand-muted flex items-center gap-1">
                  <ShieldCheck size={11} className="text-brand-green" />
                  <span>Premium</span>
                </p>
              </div>
            </div>
            {/* Subtle menu dots */}
            <div className="md:hidden xl:block text-brand-muted hover:text-white px-1.5 cursor-pointer">
              •••
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
