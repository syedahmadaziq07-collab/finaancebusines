import React, { useState } from "react";
import { Coins, X, Landmark, HeartHandshake, Plus, Edit2, Trash2 } from "lucide-react";
import { Goal } from "../types";

interface GoalsProps {
  goals: Goal[];
  onContributeToGoal: (goalId: string, amount: number) => Promise<void>;
  onAddGoal?: (goal: { name: string; current: number; target: number }) => Promise<void>;
  onUpdateGoal: (id: string, goal: Partial<Goal>) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function Goals({ 
  goals, 
  onContributeToGoal, 
  onAddGoal, 
  onUpdateGoal,
  onDeleteGoal,
  isLoading = false 
}: GoalsProps) {
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Goal Form states
  const [showAddGoalForm, setShowAddGoalForm] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  // Edit Mode states inside selected goal modal
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editCurrent, setEditCurrent] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-brand-card border border-brand-border rounded-xl p-5 h-32 flex flex-col justify-between">
            <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
            <div className="h-6 bg-neutral-800 rounded w-1/3 my-2"></div>
            <div className="h-1.5 bg-neutral-900 rounded-full w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !amount) return;

    setIsSubmitting(true);
    try {
      await onContributeToGoal(selectedGoal.id, parseFloat(amount));
      setAmount("");
      setSelectedGoal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName || !goalTarget || !onAddGoal) return;

    setIsAddingGoal(true);
    try {
      await onAddGoal({
        name: goalName,
        target: parseFloat(goalTarget),
        current: goalCurrent ? parseFloat(goalCurrent) : 0
      });
      setGoalName("");
      setGoalTarget("");
      setGoalCurrent("");
      setShowAddGoalForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingGoal(false);
    }
  };

  const handleStartEdit = (goal: Goal) => {
    setIsEditMode(true);
    setEditName(goal.name);
    setEditTarget(goal.target.toString());
    setEditCurrent(goal.current.toString());
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !editName || !editTarget) return;

    setIsUpdating(true);
    try {
      await onUpdateGoal(selectedGoal.id, {
        name: editName,
        target: parseFloat(editTarget),
        current: editCurrent ? parseFloat(editCurrent) : 0
      });
      setIsEditMode(false);
      setSelectedGoal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this savings goal?")) {
      try {
        await onDeleteGoal(id);
        setSelectedGoal(null);
        setIsEditMode(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div id="goals-row-container" className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 w-full">
      {goals.map((goal) => {
        return (
          <div 
            key={goal.id}
            id={`goal-card-${goal.id}`}
            onClick={() => {
              setSelectedGoal(goal);
              setIsEditMode(false);
            }}
            className="bg-brand-card border border-brand-border rounded-xl p-5 hover:border-neutral-850 hover:bg-[#181818] transition-all duration-300 cursor-pointer group flex flex-col justify-between h-full select-none transform hover:-translate-y-0.5"
          >
            {/* Upper label and rate */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono tracking-wider font-semibold text-brand-muted uppercase truncate max-w-[130px]">
                {goal.name}
              </span>
              <span className="text-xs font-mono font-bold text-neutral-300 group-hover:text-white transition-colors">
                {goal.percent}%
              </span>
            </div>

            {/* Middle Values */}
            <div className="mt-3.5 flex items-baseline gap-1 select-all">
              <span className="text-xl font-display font-bold text-white leading-none">
                RM {goal.current.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-brand-muted">
                / RM {goal.target >= 1000 ? `${(goal.target / 1000).toFixed(0)}k` : goal.target}
              </span>
            </div>

            {/* Slider Chart bar */}
            <div className="mt-3 relative w-full h-1 bg-neutral-900 rounded-full overflow-hidden border border-neutral-950">
              <div 
                className="bg-zinc-200 h-full rounded-full transition-all duration-1000 ease-out group-hover:bg-[#22c55e]"
                style={{ width: `${Math.min(100, goal.percent)}%` }}
              ></div>
            </div>

            {/* Footer detail text */}
            <div className="mt-2 text-[10px] text-brand-muted font-medium font-mono flex items-center justify-between">
              <span>{goal.remainingText}</span>
              <span className="opacity-0 group-hover:opacity-100 text-[#22c55e] transition-opacity duration-200 flex items-center gap-0.5 font-sans font-semibold">
                Contribute +
              </span>
            </div>
          </div>
        );
      })}

      {/* Set a Goal trigger placeholder */}
      {onAddGoal && (
        <div 
          onClick={() => setShowAddGoalForm(true)}
          className="border-2 border-dashed border-brand-border hover:border-neutral-500 rounded-xl p-5 h-28 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-neutral-900/25 active:scale-[0.99] group text-brand-muted hover:text-white"
        >
          <Plus size={18} className="mb-1 text-brand-muted group-hover:text-brand-green group-hover:scale-110 transition-all" />
          <span className="text-xs font-semibold tracking-wide">Set a goal</span>
        </div>
      )}

      {/* QUICK CONTRIBUTION / MANAGE OVERLAY FORM */}
      {selectedGoal && (
        <div id="contribute-goal-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button 
              onClick={() => {
                setSelectedGoal(null);
                setIsEditMode(false);
              }}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <header className="mb-5 flex gap-3.5 items-center justify-between pr-8">
              <div className="flex gap-3.5 items-center">
                <div className="h-10 w-10 bg-neutral-900 border border-neutral-800 text-brand-green rounded-full flex items-center justify-center">
                  <Landmark size={18} />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-base text-white">
                    {isEditMode ? "Edit Savings Goal" : `Save for ${selectedGoal.name}`}
                  </h4>
                  <p className="text-xs text-brand-muted mt-0.5">
                    {isEditMode ? "Modify goal specifications" : "Transfer funds into this savings card"}
                  </p>
                </div>
              </div>
            </header>

            {!isEditMode ? (
              <form onSubmit={handleContribute} className="space-y-4">
                {/* Target Information Card */}
                <div id="goal-highlights-box" className="p-3.5 bg-neutral-950 border border-neutral-900 rounded-xl space-y-2 relative group">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(selectedGoal)}
                    title="Edit Goal info"
                    className="absolute top-2.5 right-2 text-zinc-500 hover:text-white text-xs bg-zinc-900/60 p-1.5 rounded-lg border border-neutral-850 hover:border-neutral-700 font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={10} />
                    <span>Manage</span>
                  </button>

                  <div className="flex justify-between text-xs text-brand-muted">
                    <span>Current Index:</span>
                    <span className="font-bold text-white">RM {selectedGoal.current.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-brand-muted">
                    <span>Target Barrier:</span>
                    <span className="font-bold text-white">RM {selectedGoal.target.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-brand-muted border-t border-neutral-900 pt-1.5 mt-1.5">
                    <span>Remaining Left:</span>
                    <span className="font-bold text-[#e5e5e5]">{selectedGoal.remainingText}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Transfer Amount (RM)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 100, 500, 1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGoal(null)}
                    className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <HeartHandshake size={14} />
                    <span>{isSubmitting ? "Transferring..." : "Deposit Cash"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-4">
                {/* Edit Form Fields */}
                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Goal Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white uppercase transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Target Milestone (RM)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editTarget}
                    onChange={(e) => setEditTarget(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Current Savings (RM)</label>
                  <input
                    type="number"
                    min="0"
                    value={editCurrent}
                    onChange={(e) => setEditCurrent(e.target.value)}
                    className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                  />
                </div>

                {/* Edit Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <span>{isUpdating ? "Updating..." : "Save Goal"}</span>
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedGoal.id)}
                    className="w-full mt-2 text-xs font-semibold font-mono text-brand-red bg-brand-red/10 border border-brand-red/20 hover:border-brand-red/40 hover:bg-brand-red/20 py-2.5 rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    <span>Delete Savings Goal</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ADD GOAL OVERLAY FORM */}
      {showAddGoalForm && (
        <div id="add-goal-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-brand-border rounded-2xl max-w-sm w-full p-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button 
              onClick={() => setShowAddGoalForm(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-white p-1 rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X size={16} />
            </button>

            <header className="mb-5 flex gap-3.5 items-center">
              <div className="h-10 w-10 bg-neutral-900 border border-neutral-800 text-brand-green rounded-full flex items-center justify-center">
                <Plus size={18} />
              </div>
              <div>
                <h4 className="font-display font-semibold text-base text-white">Create New Goal</h4>
                <p className="text-xs text-brand-muted mt-0.5">Establish a new target saving milestone</p>
              </div>
            </header>

            <form onSubmit={handleAddNewGoal} className="space-y-4">
              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VACATION, HOUSE DEPOSIT, EMERGENCY"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm text-white uppercase transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Target Amount (RM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5000, 10000, 50000"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] text-brand-muted font-mono uppercase block mb-1">Initial Deposit (Optional - RM)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 100, 500"
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  className="w-full bg-neutral-950 border border-brand-border hover:border-neutral-800 focus:border-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-white transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGoalForm(false)}
                  className="flex-1 border border-brand-border hover:border-neutral-800 text-xs text-brand-muted hover:text-white py-2.5 rounded-xl transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingGoal}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Landmark size={14} />
                  <span>{isAddingGoal ? "Creating..." : "Save Goal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export {};
