import React, { useState } from "react";
import { Plus, X, ArrowUpRight, ArrowDownRight, Briefcase, PlusCircle, Coins, Edit2, Trash2 } from "lucide-react";
import { PortfolioData, StockInfo } from "../types";

interface PortfolioProps {
  portfolio: PortfolioData;
  onBuyStock: (purchase: { ticker: string; company: string; amount: number; change?: number }) => Promise<void>;
  onUpdateStock: (id: string, stock: Partial<StockInfo>) => Promise<void>;
  onDeleteStock: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function Portfolio({ 
  portfolio, 
  onBuyStock, 
  onUpdateStock,
  onDeleteStock,
  isLoading = false 
}: PortfolioProps) {
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [amount, setAmount] = useState("");
  const [estChange, setEstChange] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit stock holding state
  const [editingStock, setEditingStock] = useState<StockInfo | null>(null);
  const [editTicker, setEditTicker] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editChange, setEditChange] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Top-up state
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [topUpTicker, setTopUpTicker] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [isTopUpSubmitting, setIsTopUpSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-[400px] flex flex-col justify-between animate-pulse">
        <div className="h-5 bg-neutral-800 rounded w-1/4"></div>
        <div className="h-10 bg-neutral-800 rounded w-1/2 my-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-8 bg-neutral-800 rounded w-1/3"></div>
              <div className="h-8 bg-neutral-800 rounded w-10"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !company || !amount) return;

    setIsSubmitting(true);
    try {
      await onBuyStock({
        ticker: ticker.toUpperCase(),
        company,
        amount: parseFloat(amount),
        change: estChange ? parseFloat(estChange) : undefined
      });
      setTicker("");
      setCompany("");
      setAmount("");
      setEstChange("");
      setShowBuyForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (stock: StockInfo) => {
    setEditingStock(stock);
    setEditTicker(stock.ticker);
    setEditCompany(stock.company);
    setEditValue(stock.value.toString());
    setEditChange(stock.change.toString());
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStock || !editTicker || !editCompany || !editValue) return;

    setIsUpdating(true);
    try {
      const uniqueId = editingStock.id || editingStock.ticker; // fallback if no uuid
      await onUpdateStock(uniqueId, {
        ticker: editTicker.toUpperCase(),
        company: editCompany,
        value: parseFloat(editValue),
        change: editChange ? parseFloat(editChange) : 0
      });
      setEditingStock(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (stock: StockInfo) => {
    if (window.confirm(`Are you sure you want to remove ${stock.ticker} holding from your portfolio index?`)) {
      try {
        const uniqueId = stock.id || stock.ticker;
        await onDeleteStock(uniqueId);
        if (editingStock?.id === uniqueId || editingStock?.ticker === uniqueId) {
          setEditingStock(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpTicker || !topUpAmount) return;

    setIsTopUpSubmitting(true);
    try {
      const stock = portfolio.stocks.find(s => s.ticker === topUpTicker);
      if (!stock) return;
      const addAmount = parseFloat(topUpAmount);
      const uniqueId = stock.id || stock.ticker;
      await onUpdateStock(uniqueId, {
        value: stock.value + addAmount
      });
      setShowTopUpForm(false);
      setTopUpTicker("");
      setTopUpAmount("");
      setTopUpNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsTopUpSubmitting(false);
    }
  };

  return (
    <div id="portfolio-widget" className="bg-brand-card border border-brand-border rounded-2xl p-6 hover:border-neutral-800 transition-all duration-300 flex flex-col justify-between h-full">
      {/* Portfolio Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#22c55e]/10 text-brand-green">
              <Briefcase size={14} />
            </span>
            <h3 className="font-display font-semibold text-base text-white tracking-tight">Portfolio</h3>
          </div>
          <span className="text-xs font-mono font-medium text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
            YTD {portfolio.ytdPercent >= 0 ? "+" : ""}{portfolio.ytdPercent}% 
          </span>
        </div>

        {/* Total portfolio value summary card */}
        <div className="mt-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between" id="portfolio-vitals">
          <div>
            <span className="text-[10px] text-brand-muted font-mono uppercase">Total Value</span>
            <p className="text-xl font-display font-bold text-white tracking-tight mt-0.5 select-all">
              RM {portfolio.total.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-brand-muted font-mono uppercase">Unrealized P&L</span>
            <p className="text-sm font-semibold text-brand-green tracking-tight flex items-center gap-0.5 justify-end mt-0.5 select-all">
              <ArrowUpRight size={13} />
              <span>+RM {portfolio.pnl.toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Asset Stocks rows */}
      <div className="mt-4 space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-0.5 scrollbar-thin" id="portfolio-stocks-list">
        {portfolio.stocks.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-brand-border rounded-xl p-4 bg-neutral-900/40">
            <p className="text-xs text-brand-muted">No investments added</p>
          </div>
        ) : (
          portfolio.stocks.map((stock) => {
            const isPositiveChange = stock.change >= 0;
            return (
              <div 
                key={stock.ticker}
                id={`portfolio-row-${stock.ticker.toLowerCase()}`}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-900/40 transition-colors group cursor-pointer"
              >
                {/* Avatar circle + name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-8.5 w-8.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-neutral-300 flex items-center justify-center shrink-0 group-hover:border-neutral-700 transition-colors font-display">
                    {stock.ticker.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white tracking-tight leading-none font-sans">
                      {stock.ticker}
                    </p>
                    <p className="text-[10.5px] text-brand-muted truncate max-w-[120px] sm:max-w-none mt-1">
                      {stock.company}
                    </p>
                  </div>
                </div>

                {/* Price / valuation details + CRUD buttons */}
                <div className="flex items-center gap-2.5 text-right shrink-0">
                  <div>
                    <p className="text-[13px] font-semibold text-white tracking-tight select-all">
                      RM {stock.value.toLocaleString()}
                    </p>
                    <span className={`inline-flex items-center font-mono text-[10px] font-semibold ${
                      isPositiveChange ? "text-brand-green" : "text-brand-red"
                    }`}>
                      {isPositiveChange ? "+" : ""}{stock.change}%
                    </span>
                  </div>

                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 pl-1 border-l border-zinc-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(stock);
                      }}
                      title="Edit stock holding"
                      className="p-1 text-zinc-500 hover:text-white rounded transition-colors cursor-pointer"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(stock);
                      }}
                      title="Delete asset row"
                      className="p-1 text-zinc-500 hover:text-brand-red rounded transition-colors cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Buy stock & Top Up widget buttons */}
      <div className="mt-4 pt-4 border-t border-brand-border flex items-center justify-between gap-2.5">
        <button
          id="btn-buy-stock"
          onClick={() => setShowBuyForm(true)}
          className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.99] select-none cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Asset</span>
        </button>
        <button
          id="btn-top-up"
          onClick={() => {
            setTopUpTicker(portfolio.stocks.length > 0 ? portfolio.stocks[0].ticker : "");
            setTopUpAmount("");
            setTopUpNote("");
            setShowTopUpForm(true);
          }}
          disabled={portfolio.stocks.length === 0}
          className="flex-1 border border-brand-border hover:border-neutral-700 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-all font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={13} />
          <span>Add Value</span>
        </button>
        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest px-2 select-none">PORTFOLIO INDEX</span>
      </div>

      {/* LIGHT MODAL FOR BUYING STOCK */}
      {showBuyForm && (
        <div id="buy-asset-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            {/* Close */}
            <button 
              onClick={() => setShowBuyForm(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5">
              <h4 className="font-display font-semibold text-lg text-white">Purchase / Add Asset</h4>
              <p className="text-xs text-brand-muted mt-0.5">Augment your active holdings index</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ticker & Company */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Ticker ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NVDA, AMZN"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white font-mono uppercase transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="NVIDIA Corp"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                  />
                </div>
              </div>

              {/* Purchase amount */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Total Valuation (RM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Est change percentage */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Historical Return Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 12.5 (positive) or -4.2 (negative)"
                  value={estChange}
                  onChange={(e) => setEstChange(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBuyForm(false)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Coins size={13} />
                  <span>{isSubmitting ? "Executing Order..." : "Buy Asset"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHT MODAL FOR EDITING STOCK */}
      {editingStock && (
        <div id="edit-asset-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            {/* Close */}
            <button 
              onClick={() => setEditingStock(null)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5 flex justify-between items-start">
              <div>
                <h4 className="font-display font-semibold text-lg text-white">Modify Holding</h4>
                <p className="text-xs text-brand-muted mt-0.5">Edit asset valuation or symbol metrics</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(editingStock)}
                className="text-xs text-brand-red hover:text-red-400 bg-brand-red/10 border border-brand-red/20 hover:border-brand-red/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer font-mono font-semibold"
              >
                <Trash2 size={11} />
                <span>Remove</span>
              </button>
            </header>

            <form onSubmit={handleUpdate} className="space-y-4">
              {/* Ticker & Company */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Ticker ID</label>
                  <input
                    type="text"
                    required
                    value={editTicker}
                    onChange={(e) => setEditTicker(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white font-mono uppercase transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                  />
                </div>
              </div>

              {/* asset valuation input */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Holding Value (RM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* return change rate input */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Total Return Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editChange}
                  onChange={(e) => setEditChange(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStock(null)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHT MODAL FOR TOP-UP / ADD VALUE */}
      {showTopUpForm && (
        <div id="top-up-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            <button 
              onClick={() => setShowTopUpForm(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5">
              <h4 className="font-display font-semibold text-lg text-white">Add Value to Asset</h4>
              <p className="text-xs text-brand-muted mt-0.5">Top up existing holding with additional capital</p>
            </header>

            <form onSubmit={handleTopUp} className="space-y-4">
              {/* Select existing asset */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Select Asset</label>
                <select
                  required
                  value={topUpTicker}
                  onChange={(e) => setTopUpTicker(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors cursor-pointer"
                >
                  {portfolio.stocks.map((s) => (
                    <option key={s.ticker} value={s.ticker}>
                      {s.ticker} — RM {s.value.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount to add */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Amount to Add (RM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 100"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Optional note */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly top up"
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTopUpForm(false)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTopUpSubmitting}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <PlusCircle size={13} />
                  <span>{isTopUpSubmitting ? "Adding..." : "Add Value"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
