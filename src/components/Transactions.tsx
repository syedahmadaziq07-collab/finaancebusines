import React, { useState } from "react";
import { 
  ShoppingBag, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coffee, 
  Home, 
  Coins, 
  Tv, 
  CreditCard,
  Plus,
  X,
  PlusCircle,
  Edit2,
  Trash2,
  Calendar
} from "lucide-react";
import { Transaction } from "../types";

interface TransactionsProps {
  transactions: Transaction[];
  onAddTransaction: (tx: { name: string; category: string; amount: number; date?: string }) => Promise<void>;
  onUpdateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function Transactions({ 
  transactions, 
  onAddTransaction, 
  onUpdateTransaction,
  onDeleteTransaction,
  isLoading = false 
}: TransactionsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Food");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for Editing Transaction
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<"expense" | "income">("expense");
  const [editDate, setEditDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-[400px] flex flex-col justify-between animate-pulse">
        <div className="h-5 bg-neutral-800 rounded w-1/4"></div>
        <div className="space-y-4 my-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="h-10 w-10 bg-neutral-800 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
                <div className="h-3 bg-neutral-800 rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-neutral-800 rounded w-10"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Get specific icon based on transaction name/category
  const getTransactionIcon = (name: string, category: string) => {
    const term = (name + " " + category).toLowerCase();
    if (term.includes("amazon") || term.includes("shopping")) {
      return <ShoppingBag size={15} className="text-zinc-300" />;
    }
    if (term.includes("salary") || term.includes("deposit") || term.includes("income")) {
      return <ArrowUpRight size={15} className="text-brand-green" />;
    }
    if (term.includes("starbucks") || term.includes("coffee") || term.includes("food") || term.includes("dining")) {
      return <Coffee size={15} className="text-zinc-300" />;
    }
    if (term.includes("rent") || term.includes("housing")) {
      return <Home size={15} className="text-zinc-300" />;
    }
    if (term.includes("dividend") || term.includes("invest") || term.includes("aapl") || term.includes("msft")) {
      return <Coins size={15} className="text-brand-green" />;
    }
    if (term.includes("netflix") || term.includes("subscription") || term.includes("spotify")) {
      return <Tv size={15} className="text-zinc-300" />;
    }
    return <CreditCard size={15} className="text-zinc-300" />;
  };

  const categories = [
    "Housing",
    "Food",
    "Transport",
    "Entertainment",
    "Shopping",
    "Income",
    "Investment",
    "Subscription",
    "Other"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;

    setIsSubmitting(true);
    try {
      const numericAmount = parseFloat(amount);
      const signedAmount = type === "expense" ? -Math.abs(numericAmount) : Math.abs(numericAmount);
      
      await onAddTransaction({
        name,
        category,
        amount: signedAmount,
        date: date || undefined
      });

      // Clear form
      setName("");
      setAmount("");
      setDate("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditName(tx.name);
    setEditCategory(tx.category);
    // Support display of absolute amount
    setEditAmount(Math.abs(tx.amount).toString());
    setEditType(tx.amount < 0 ? "expense" : "income");
    setEditDate(tx.date);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editName || !editAmount) return;

    setIsUpdating(true);
    try {
      const numericAmount = parseFloat(editAmount);
      const signedAmount = editType === "expense" ? -Math.abs(numericAmount) : Math.abs(numericAmount);
      
      await onUpdateTransaction(editingTx.id, {
        name: editName,
        category: editCategory,
        amount: signedAmount,
        date: editDate
      });
      setEditingTx(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this bookkeeping entry?")) {
      try {
        await onDeleteTransaction(id);
        if (editingTx?.id === id) {
          setEditingTx(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div id="transactions-widget" className="bg-brand-card border border-brand-border rounded-2xl p-6 hover:border-neutral-800 transition-all duration-300 flex flex-col justify-between h-full">
      {/* Header Panel */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-semibold text-base text-white tracking-tight">Transactions</h3>
          <p className="text-[11px] text-brand-muted font-mono uppercase mt-0.5">Live Updates</p>
        </div>
        <button 
          id="btn-add-transaction"
          onClick={() => {
            setDate(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
            setShowAddForm(true);
          }}
          className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-white border border-brand-border hover:border-neutral-700 bg-neutral-900/60 px-3 py-1.5 rounded-xl transition-colors shrink-0 cursor-pointer"
        >
          <Plus size={13} />
          <span>New</span>
        </button>
      </div>

      {/* Transaction Scroll Area */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 overflow-x-hidden flex-1 scrollbar-thin" id="tx-scrolling-container">
        {transactions.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-brand-border rounded-xl p-4 bg-neutral-900/40">
            <p className="text-xs text-brand-muted">No transactions yet — add your first transaction</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const isNegative = tx.amount < 0;
            const amountFormatted = (isNegative ? "-" : "+") + "RM " + Math.abs(tx.amount).toLocaleString(undefined, {
              minimumFractionDigits: tx.amount % 1 === 0 ? 0 : 2,
              maximumFractionDigits: 2
            });

            return (
              <div 
                key={tx.id}
                id={`tx-row-${tx.id}`}
                className="flex items-center justify-between group p-2 rounded-2xl hover:bg-neutral-900/40 transition-all duration-150"
              >
                {/* Text and Icon Column */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 group-hover:border-neutral-700 transition-colors">
                    {getTransactionIcon(tx.name, tx.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate max-w-[130px] sm:max-w-none">
                      {tx.name}
                    </p>
                    <p className="text-[11px] text-brand-muted tracking-wide flex items-center gap-1 mt-0.5">
                      <span>{tx.category}</span>
                      <span>•</span>
                      <span>{tx.date}</span>
                    </p>
                  </div>
                </div>

                {/* Amount and CRUD Actions Column */}
                <div className="flex items-center gap-3 shrink-0">
                  <span 
                    className={`text-sm font-semibold select-all font-mono tracking-tight ${
                      isNegative ? "text-brand-red" : "text-brand-green"
                    }`}
                  >
                    {amountFormatted}
                  </span>
                  
                  {/* Edit/Delete Actions */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 pl-1.5 border-l border-zinc-800">
                    <button
                      onClick={() => handleStartEdit(tx)}
                      title="Edit transaction details"
                      className="p-1 text-zinc-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      title="Delete bookkeeping row"
                      className="p-1 text-zinc-400 hover:text-brand-red hover:bg-zinc-900/50 rounded transition-colors cursor-pointer"
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

      {/* Footer "View all" summary indicator */}
      <div className="border-t border-brand-border pt-4 mt-4 flex items-center justify-between text-xs text-brand-muted">
        <span>Showing {transactions.length} entries</span>
        <span className="text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">SECURE DATABASE</span>
      </div>

      {/* LIGHT MODAL DIALOG CONTAINER - ADD */}
      {showAddForm && (
        <div id="add-tx-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button 
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5">
              <h4 className="font-display font-semibold text-lg text-white">Log Transaction</h4>
              <p className="text-xs text-brand-muted mt-0.5">Append a debit or credit row quickly</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Toggle Expense/Income */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1.5">Type</label>
                <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-900 font-mono">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      type === "expense"
                        ? "bg-brand-red text-white"
                        : "text-brand-muted hover:text-white"
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      type === "income"
                        ? "bg-brand-green text-black"
                        : "text-brand-muted hover:text-white"
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Merchant / Recipient</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amazon, Starbucks, Client Pay"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                />
              </div>

              {/* Amount & Category */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="24.99"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-2 py-2 text-sm text-white transition-colors cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Date optional */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Transaction Date</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jun 12"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl pl-9 pr-3 py-2 text-sm text-white transition-colors"
                  />
                  <Calendar size={13} className="absolute left-3.5 top-3 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <PlusCircle size={14} />
                  <span>{isSubmitting ? "Bookkeeping..." : "Post Entry"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHT MODAL DIALOG CONTAINER - EDIT */}
      {editingTx && (
        <div id="edit-tx-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button 
              onClick={() => setEditingTx(null)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5 flex justify-between items-start">
              <div>
                <h4 className="font-display font-semibold text-lg text-white">Edit Transaction</h4>
                <p className="text-xs text-brand-muted mt-0.5">Modify logged row parameters</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(editingTx.id)}
                className="text-xs text-brand-red hover:text-red-400 bg-brand-red/10 border border-brand-red/20 hover:border-brand-red/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer font-mono"
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </header>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              {/* Toggle Expense/Income */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1.5">Type</label>
                <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-900 font-mono">
                  <button
                    type="button"
                    onClick={() => setEditType("expense")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      editType === "expense"
                        ? "bg-brand-red text-white"
                        : "text-brand-muted hover:text-white"
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType("income")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      editType === "income"
                        ? "bg-brand-green text-black"
                        : "text-brand-muted hover:text-white"
                    }`}
                  >
                    Income (+)
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Merchant / Recipient</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                />
              </div>

              {/* Amount & Category */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-2 py-2 text-sm text-white transition-colors cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Transaction Date</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl pl-9 pr-3 py-2 text-sm text-white transition-colors"
                  />
                  <Calendar size={13} className="absolute left-3.5 top-3 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>{isUpdating ? "Updating..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
