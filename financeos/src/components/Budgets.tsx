import React, { useState } from "react";
import { Plus, X, Settings2, Edit2, Trash2 } from "lucide-react";
import { Budget } from "../types";

interface BudgetsProps {
  budgets: Budget[];
  onAddBudget: (budget: { name: string; total: number }) => Promise<void>;
  onUpdateBudget: (id: string, budget: Partial<Budget>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function Budgets({ 
  budgets, 
  onAddBudget, 
  onUpdateBudget,
  onDeleteBudget,
  isLoading = false 
}: BudgetsProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editName, setEditName] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 h-[400px] flex flex-col justify-between animate-pulse">
        <div className="h-5 bg-neutral-800 rounded w-1/4"></div>
        <div className="space-y-6 my-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
                <div className="h-4 bg-neutral-800 rounded w-10"></div>
              </div>
              <div className="h-2 bg-neutral-900 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !total) return;

    setIsSubmitting(true);
    try {
      await onAddBudget({
        name,
        total: parseFloat(total)
      });
      setName("");
      setTotal("");
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (b: Budget) => {
    setEditingBudget(b);
    setEditName(b.name);
    setEditTotal(b.total.toString());
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget || !editName || !editTotal) return;

    setIsUpdating(true);
    try {
      await onUpdateBudget(editingBudget.id, {
        name: editName,
        total: parseFloat(editTotal)
      });
      setEditingBudget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this budget card?")) {
      try {
        await onDeleteBudget(id);
        if (editingBudget?.id === id) {
          setEditingBudget(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div id="budgets-widget" className="bg-brand-card border border-brand-border rounded-2xl p-6 hover:border-neutral-800 transition-all duration-300 flex flex-col justify-between h-full">
      {/* Budgets Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-semibold text-base text-white tracking-tight">Budgets</h3>
          <p className="text-[11px] text-brand-muted font-mono uppercase mt-0.5">Category limits</p>
        </div>
        <span className="text-xs font-mono font-bold text-zinc-500 tracking-wider">DATABASE ACTIVE</span>
      </div>

      {/* Progress Rows scrolling or stacked */}
      <div className="space-y-4 flex-1 pr-0.5 overflow-y-auto max-h-[300px] scrollbar-thin" id="budgets-list-stage">
        {budgets.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center border border-dashed border-brand-border rounded-xl p-4 bg-neutral-900/40">
            <p className="text-xs text-brand-muted">No budgets set — add a budget to get started</p>
          </div>
        ) : (
          budgets.map((budget) => {
            const percentUsed = Math.round((budget.used / budget.total) * 100);
            const isOverlimit = budget.used > budget.total;
            
            return (
              <div 
                key={budget.id}
                id={`budget-row-${budget.id}`}
                className="group space-y-1.5"
              >
                {/* Labels Row */}
                <div className="flex justify-between items-baseline">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white group-hover:text-neutral-200 transition-colors">
                      {budget.name}
                    </span>
                    <button
                      onClick={() => handleStartEdit(budget)}
                      title="Edit limit"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-white transition-opacity cursor-pointer rounded"
                    >
                      <Edit2 size={10} />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      title="Delete budget"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-brand-red transition-opacity cursor-pointer rounded"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <span className="text-xs font-mono font-medium text-brand-muted select-all">
                    <span className="text-zinc-200">RM {budget.used.toLocaleString()}</span> / RM {budget.total.toLocaleString()}
                  </span>
                </div>

                {/* Progress Slider Bar */}
                <div className="relative w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-950">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isOverlimit 
                        ? "bg-brand-red shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                        : "bg-white"
                    }`}
                    style={{ width: `${Math.min(100, percentUsed)}%` }}
                  ></div>
                </div>

                {/* Info Sub-row */}
                <div className="flex justify-between text-[10px] text-brand-muted font-medium font-mono">
                  <span>{percentUsed}% used</span>
                  {isOverlimit ? (
                    <span className="text-brand-red">Exceeded by RM {(budget.used - budget.total).toLocaleString()}</span>
                  ) : (
                    <span>Remaining: RM {(budget.total - budget.used).toLocaleString()}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add New Budget Trigger Element at bottom */}
      <button 
        id="btn-add-budget-trigger"
        onClick={() => setShowForm(true)}
        className="w-full mt-6 bg-neutral-900/60 hover:bg-neutral-900 border border-brand-border hover:border-neutral-700 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.99] cursor-pointer"
      >
        <Plus size={14} />
        <span>Add Budget</span>
      </button>

      {/* LIGHT OVERLAY FORM - ADD */}
      {showForm && (
        <div id="add-budget-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            {/* Close */}
            <button 
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5">
              <h4 className="font-display font-semibold text-lg text-white">Create Category Budget</h4>
              <p className="text-xs text-brand-muted mt-0.5">Establish a safe monthly savings barrier</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Category Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subscriptions, Groceries, Travel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                />
              </div>

              {/* Total limit */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Monthly Limit (RM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 200, 500, 1000"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>{isSubmitting ? "Saving..." : "Add"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHT OVERLAY FORM - EDIT */}
      {editingBudget && (
        <div id="edit-budget-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            {/* Close */}
            <button 
              onClick={() => setEditingBudget(null)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5 flex justify-between items-start">
              <div>
                <h4 className="font-display font-semibold text-lg text-white">Modify Budget</h4>
                <p className="text-xs text-brand-muted mt-0.5">Edit monthly limits and filters</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(editingBudget.id)}
                className="text-xs text-brand-red hover:text-red-400 bg-brand-red/10 border border-brand-red/20 hover:border-brand-red/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer font-mono font-semibold"
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </header>

            <form onSubmit={handleUpdate} className="space-y-4">
              {/* Category */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Category Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white transition-colors"
                />
              </div>

              {/* Total limit */}
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Monthly Limit (RM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBudget(null)}
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
