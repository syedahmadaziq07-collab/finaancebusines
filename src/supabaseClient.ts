import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Transaction, Budget, StockInfo, Goal, Account, Business } from "./types";

// ==========================================
// RUNTIME SUPABASE CONFIG
// Priority: localStorage runtime > VITE env vars
// ==========================================

let _supabaseClient: SupabaseClient | null = null;

const envUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const envAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

function getRuntimeConfig(): { url: string; anonKey: string } {
  try {
    return {
      url: localStorage.getItem("finance_supabase_url") || "",
      anonKey: localStorage.getItem("finance_supabase_anon_key") || "",
    };
  } catch {
    return { url: "", anonKey: "" };
  }
}

function resolveConfig(): { url: string; anonKey: string } {
  const rt = getRuntimeConfig();
  if (rt.url && rt.anonKey) return rt;
  return { url: envUrl, anonKey: envAnonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = resolveConfig();
  return Boolean(url && anonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;
  const { url, anonKey } = resolveConfig();
  if (url && anonKey) {
    _supabaseClient = createClient(url, anonKey);
    return _supabaseClient;
  }
  return null;
}

export function reinitializeSupabaseClient(): void {
  _supabaseClient = null;
}

export function getSupabaseConfig(): { url: string; anonKey: string; source: string } {
  const rt = getRuntimeConfig();
  if (rt.url && rt.anonKey) return { ...rt, source: "localStorage" };
  if (envUrl && envAnonKey) return { url: envUrl, anonKey: envAnonKey, source: "env" };
  return { url: "", anonKey: "", source: "none" };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem("finance_supabase_url", url);
  localStorage.setItem("finance_supabase_anon_key", anonKey);
  reinitializeSupabaseClient();
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem("finance_supabase_url");
  localStorage.removeItem("finance_supabase_anon_key");
  reinitializeSupabaseClient();
}

export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "Invalid Supabase URL or anon key." };
  }
  try {
    const { error } = await client.from("transactions").select("id", { count: "exact", head: true }).limit(1);
    if (error) {
      if (error.code === "42P01") {
        return { ok: true, message: "Supabase connected, but tables are missing. Run the SQL setup." };
      }
      return { ok: false, message: "Invalid Supabase URL or anon key." };
    }
    return { ok: true, message: "Connected" };
  } catch {
    return { ok: false, message: "Invalid Supabase URL or anon key." };
  }
}

// ==========================================
// SQL Schema Setup Helper (for display)
// ==========================================
export const SUPABASE_SQL_CREATION_SCHEMA = `-- Execute this SQL script in your Supabase SQL Editor:

-- 1. Create Transactions Table
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  date text not null,
  amount numeric not null,
  type text not null, -- 'income' or 'expense'
  business_id uuid references businesses(id) on delete set null,
  notes text
);

-- 2. Create Businesses Table
create table if not exists businesses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  description text,
  monthly_target numeric default 0,
  status text not null default 'active',
  created_at timestamp with time zone default now()
);
alter table businesses enable row level security;
create policy "Allow all on businesses" on businesses for all using (true) with check (true);

-- 2. Create Budgets Table
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  category text not null unique,
  used numeric not null default 0,
  total numeric not null
);

-- 3. Create Portfolio Holdings Table
create table if not exists portfolio_holdings (
  id uuid default gen_random_uuid() primary key,
  ticker text not null unique,
  name text not null,
  value numeric not null default 0,
  change_percent numeric not null default 0
);

-- 4. Create Goals Table
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  current numeric not null default 0,
  target numeric not null
);

-- 5. Create Accounts Table
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  bank_name text not null,
  last_four text,
  balance numeric not null default 0,
  created_at timestamp with time zone default now()
);
alter table accounts enable row level security;
create policy "Allow all on accounts" on accounts for all using (true) with check (true);

-- Optional: Enable row level security (RLS) or disable for testing
-- alter table transactions disable row level security;
-- alter table budgets disable row level security;
-- alter table portfolio_holdings disable row level security;
-- alter table goals disable row level security;
`;

// ==========================================
// TRANSACTIONS CRUD
// ==========================================
export async function getDbTransactions(): Promise<Transaction[]> {
  const client = getSupabaseClient(); if (!client) {
    return JSON.parse(localStorage.getItem("finance_transactions") || "[]");
  }
  const { data, error } = await client
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Supabase error fetching transactions:", error);
    throw error;
  }

  // Map to UI model
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    date: row.date,
    amount: row.type === "expense" ? -Math.abs(Number(row.amount)) : Math.abs(Number(row.amount)),
    business_id: row.business_id || undefined,
    notes: row.notes || undefined
  }));
}

export async function addDbTransaction(tx: Omit<Transaction, "id" | "date"> & { date?: string }): Promise<Transaction> {
  const isExpense = tx.amount < 0;
  const dbRow: any = {
    name: tx.name,
    category: tx.category,
    date: tx.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    amount: Math.abs(tx.amount),
    type: isExpense ? "expense" : "income"
  };
  if (tx.business_id) dbRow.business_id = tx.business_id;
  if (tx.notes) dbRow.notes = tx.notes;

  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_transactions") || "[]");
    const newTx: Transaction = {
      id: "tx-" + Date.now(),
      name: tx.name,
      category: tx.category,
      date: dbRow.date,
      amount: tx.amount,
      business_id: tx.business_id,
      notes: tx.notes
    };
    local.unshift(newTx);
    localStorage.setItem("finance_transactions", JSON.stringify(local));
    return newTx;
  }

  const { data, error } = await client
    .from("transactions")
    .insert([dbRow])
    .select()
    .single();

  if (error) {
    console.error("Supabase error inserting transaction:", error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    date: data.date,
    amount: data.type === "expense" ? -Object(data.amount) : Object(data.amount),
    business_id: data.business_id || undefined,
    notes: data.notes || undefined
  };
}

export async function updateDbTransaction(id: string, tx: Partial<Transaction>): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_transactions") || "[]") as Transaction[];
    const idx = local.findIndex(t => t.id === id);
    if (idx > -1) {
      if (tx.name !== undefined) local[idx].name = tx.name;
      if (tx.category !== undefined) local[idx].category = tx.category;
      if (tx.amount !== undefined) local[idx].amount = tx.amount;
      if (tx.date !== undefined) local[idx].date = tx.date;
      if (tx.business_id !== undefined) local[idx].business_id = tx.business_id;
      if (tx.notes !== undefined) local[idx].notes = tx.notes;
      localStorage.setItem("finance_transactions", JSON.stringify(local));
    }
    return;
  }

  const updates: any = {};
  if (tx.name !== undefined) updates.name = tx.name;
  if (tx.category !== undefined) updates.category = tx.category;
  if (tx.date !== undefined) updates.date = tx.date;
  if (tx.notes !== undefined) updates.notes = tx.notes;
  if (tx.business_id !== undefined) updates.business_id = tx.business_id;
  if (tx.amount !== undefined) {
    updates.amount = Math.abs(tx.amount);
    updates.type = tx.amount < 0 ? "expense" : "income";
  }

  const { error } = await client
    .from("transactions")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDbTransaction(id: string): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_transactions") || "[]") as Transaction[];
    const filtered = local.filter(t => t.id !== id);
    localStorage.setItem("finance_transactions", JSON.stringify(filtered));
    return;
  }

  const { error } = await client
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// BUDGETS CRUD
// ==========================================
export async function getDbBudgets(): Promise<Budget[]> {
  const client = getSupabaseClient(); if (!client) {
    return JSON.parse(localStorage.getItem("finance_budgets") || "[]");
  }
  const { data, error } = await client
    .from("budgets")
    .select("*");

  if (error) {
    console.error("Supabase error fetching budgets:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.category,
    used: Number(row.used),
    total: Number(row.total)
  }));
}

export async function addDbBudget(budget: { name: string; total: number; used?: number }): Promise<Budget> {
  const dbRow = {
    category: budget.name,
    total: budget.total,
    used: budget.used || 0
  };

  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_budgets") || "[]") as Budget[];
    const existing = local.find(b => b.name.toLowerCase() === budget.name.toLowerCase());
    if (existing) {
      existing.total = budget.total;
      localStorage.setItem("finance_budgets", JSON.stringify(local));
      return existing;
    }
    const newBudget: Budget = {
      id: "b-" + Date.now(),
      name: budget.name,
      used: budget.used || 0,
      total: budget.total
    };
    local.push(newBudget);
    localStorage.setItem("finance_budgets", JSON.stringify(local));
    return newBudget;
  }

  const { data, error } = await client
    .from("budgets")
    .insert([dbRow])
    .select()
    .single();

  if (error) {
    // Handling duplicate category gracefully by updating total
    if (error.code === "23505") { // Unique restriction code
      const { data: updated, error: updateErr } = await client
        .from("budgets")
        .update({ total: budget.total })
        .eq("category", budget.name)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return {
        id: updated.id,
        name: updated.category,
        used: Number(updated.used),
        total: Number(updated.total)
      };
    }
    throw error;
  }

  return {
    id: data.id,
    name: data.category,
    used: Number(data.used),
    total: Number(data.total)
  };
}

export async function updateDbBudget(id: string, budget: Partial<Budget>): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_budgets") || "[]") as Budget[];
    const idx = local.findIndex(b => b.id === id);
    if (idx > -1) {
      if (budget.name !== undefined) local[idx].name = budget.name;
      if (budget.total !== undefined) local[idx].total = budget.total;
      if (budget.used !== undefined) local[idx].used = budget.used;
      localStorage.setItem("finance_budgets", JSON.stringify(local));
    }
    return;
  }

  const updates: any = {};
  if (budget.name !== undefined) updates.category = budget.name;
  if (budget.total !== undefined) updates.total = budget.total;
  if (budget.used !== undefined) updates.used = budget.used;

  const { error } = await client
    .from("budgets")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDbBudget(id: string): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_budgets") || "[]") as Budget[];
    const filtered = local.filter(b => b.id !== id);
    localStorage.setItem("finance_budgets", JSON.stringify(filtered));
    return;
  }

  const { error } = await client
    .from("budgets")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// PORTFOLIO CRUD
// ==========================================
export async function getDbPortfolioHoldings(): Promise<StockInfo[]> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_portfolio") || "null");
    return local?.stocks || [];
  }
  const { data, error } = await client
    .from("portfolio_holdings")
    .select("*");

  if (error) {
    console.error("Supabase error fetching portfolio:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id, // we preserve ID for deletion/edit
    ticker: row.ticker,
    company: row.name,
    value: Number(row.value),
    change: Number(row.change_percent)
  }));
}

export async function addDbPortfolioHolding(stock: { ticker: string; company: string; amount: number; change?: number }): Promise<StockInfo> {
  const dbRow = {
    ticker: stock.ticker.toUpperCase(),
    name: stock.company,
    value: stock.amount,
    change_percent: stock.change !== undefined ? stock.change : 2.5
  };

  const client = getSupabaseClient(); if (!client) {
    const localData = JSON.parse(localStorage.getItem("finance_portfolio") || '{"total":0,"pnl":0,"ytdPercent":0,"stocks":[]}') as any;
    const existingIdx = localData.stocks.findIndex((s: any) => s.ticker === stock.ticker.toUpperCase());
    
    if (existingIdx > -1) {
      localData.stocks[existingIdx].value += stock.amount;
    } else {
      localData.stocks.push({
        id: "p-" + Date.now(),
        ticker: stock.ticker.toUpperCase(),
        company: stock.company,
        value: stock.amount,
        change: stock.change !== undefined ? stock.change : 2.5
      });
    }
    
    localData.total += stock.amount;
    localStorage.setItem("finance_portfolio", JSON.stringify(localData));
    return localData.stocks.find((s: any) => s.ticker === stock.ticker.toUpperCase())!;
  }

  const { data, error } = await client
    .from("portfolio_holdings")
    .insert([dbRow])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { // Duplicate ticker
      const { data: existing } = await client
        .from("portfolio_holdings")
        .select("*")
        .eq("ticker", stock.ticker.toUpperCase())
        .single();
      const nextVal = Number(existing.value) + stock.amount;
      const { data: updated, error: updateErr } = await client
        .from("portfolio_holdings")
        .update({ value: nextVal })
        .eq("ticker", stock.ticker.toUpperCase())
        .select()
        .single();
      if (updateErr) throw updateErr;
      return {
        id: updated.id,
        ticker: updated.ticker,
        company: updated.name,
        value: Number(updated.value),
        change: Number(updated.change_percent)
      };
    }
    throw error;
  }

  return {
    id: data.id,
    ticker: data.ticker,
    company: data.name,
    value: Number(data.value),
    change: Number(data.change_percent)
  };
}

export async function updateDbPortfolioHolding(id: string, stock: Partial<StockInfo>): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const localData = JSON.parse(localStorage.getItem("finance_portfolio") || '{"total":0,"pnl":0,"ytdPercent":0,"stocks":[]}') as any;
    const idx = localData.stocks.findIndex((s: any) => s.id === id || s.ticker === stock.ticker);
    if (idx > -1) {
      if (stock.ticker !== undefined) localData.stocks[idx].ticker = stock.ticker.toUpperCase();
      if (stock.company !== undefined) localData.stocks[idx].company = stock.company;
      if (stock.value !== undefined) {
        const diff = stock.value - localData.stocks[idx].value;
        localData.stocks[idx].value = stock.value;
        localData.total += diff;
      }
      if (stock.change !== undefined) localData.stocks[idx].change = stock.change;
      localStorage.setItem("finance_portfolio", JSON.stringify(localData));
    }
    return;
  }

  const updates: any = {};
  if (stock.ticker !== undefined) updates.ticker = stock.ticker.toUpperCase();
  if (stock.company !== undefined) updates.name = stock.company;
  if (stock.value !== undefined) updates.value = stock.value;
  if (stock.change !== undefined) updates.change_percent = stock.change;

  const { error } = await client
    .from("portfolio_holdings")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDbPortfolioHolding(id: string): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const localData = JSON.parse(localStorage.getItem("finance_portfolio") || '{"total":0,"pnl":0,"ytdPercent":0,"stocks":[]}') as any;
    const removedStock = localData.stocks.find((s: any) => s.id === id);
    if (removedStock) {
      localData.total -= removedStock.value;
      localData.stocks = localData.stocks.filter((s: any) => s.id !== id);
      localStorage.setItem("finance_portfolio", JSON.stringify(localData));
    }
    return;
  }

  const { error } = await client
    .from("portfolio_holdings")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// GOALS CRUD
// ==========================================
export async function getDbGoals(): Promise<Goal[]> {
  const client = getSupabaseClient(); if (!client) {
    return JSON.parse(localStorage.getItem("finance_goals") || "[]");
  }
  const { data, error } = await client
    .from("goals")
    .select("*");

  if (error) {
    console.error("Supabase error fetching goals:", error);
    throw error;
  }

  return (data || []).map((row: any) => {
    const current = Number(row.current);
    const target = Number(row.target);
    const percent = target > 0 ? Math.round((current / target) * 100) : 0;
    const remaining = Math.max(0, target - current);
    return {
      id: row.id,
      name: row.name.toUpperCase(),
      current,
      target,
      percent,
      remainingText: remaining <= 0 ? "Completed!" : `RM ${remaining.toLocaleString()} remaining`
    };
  });
}

export async function addDbGoal(goal: { name: string; current: number; target: number }): Promise<Goal> {
  const dbRow = {
    name: goal.name.toUpperCase(),
    current: goal.current,
    target: goal.target
  };

  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_goals") || "[]") as Goal[];
    const remaining = Math.max(0, goal.target - goal.current);
    const newGoal: Goal = {
      id: "g-" + Date.now(),
      name: goal.name.toUpperCase(),
      current: goal.current,
      target: goal.target,
      percent: goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0,
      remainingText: remaining <= 0 ? "Completed!" : `RM ${remaining.toLocaleString()} remaining`
    };
    local.push(newGoal);
    localStorage.setItem("finance_goals", JSON.stringify(local));
    return newGoal;
  }

  const { data, error } = await client
    .from("goals")
    .insert([dbRow])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { // duplicate name
      const { data: updated, error: updateErr } = await client
        .from("goals")
        .update({ target: goal.target, current: goal.current })
        .eq("name", goal.name.toUpperCase())
        .select()
        .single();
      if (updateErr) throw updateErr;
      const cur = Number(updated.current);
      const tar = Number(updated.target);
      const rem = Math.max(0, tar - cur);
      return {
        id: updated.id,
        name: updated.name.toUpperCase(),
        current: cur,
        target: tar,
        percent: tar > 0 ? Math.round((cur / tar) * 100) : 0,
        remainingText: rem <= 0 ? "Completed!" : `RM ${rem.toLocaleString()} remaining`
      };
    }
    throw error;
  }

  const cur = Number(data.current);
  const tar = Number(data.target);
  const rem = Math.max(0, tar - cur);
  return {
    id: data.id,
    name: data.name,
    current: cur,
    target: tar,
    percent: tar > 0 ? Math.round((cur / tar) * 100) : 0,
    remainingText: rem <= 0 ? "Completed!" : `RM ${rem.toLocaleString()} remaining`
  };
}

export async function updateDbGoal(id: string, goal: Partial<Goal>): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_goals") || "[]") as Goal[];
    const idx = local.findIndex(g => g.id === id);
    if (idx > -1) {
      if (goal.name !== undefined) local[idx].name = goal.name.toUpperCase();
      if (goal.target !== undefined) local[idx].target = goal.target;
      if (goal.current !== undefined) local[idx].current = goal.current;
      
      const newPercent = local[idx].target > 0 ? Math.round((local[idx].current / local[idx].target) * 100) : 0;
      const rem = Math.max(0, local[idx].target - local[idx].current);
      local[idx].percent = newPercent;
      local[idx].remainingText = rem <= 0 ? "Completed!" : `RM ${rem.toLocaleString()} remaining`;
      localStorage.setItem("finance_goals", JSON.stringify(local));
    }
    return;
  }

  const updates: any = {};
  if (goal.name !== undefined) updates.name = goal.name.toUpperCase();
  if (goal.current !== undefined) updates.current = goal.current;
  if (goal.target !== undefined) updates.target = goal.target;

  const { error } = await client
    .from("goals")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDbGoal(id: string): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_goals") || "[]") as Goal[];
    const filtered = local.filter(g => g.id !== id);
    localStorage.setItem("finance_goals", JSON.stringify(filtered));
    return;
  }

  const { error } = await client
    .from("goals")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// ACCOUNTS CRUD
// ==========================================
export async function getDbAccounts(): Promise<Account[]> {
  const client = getSupabaseClient(); if (!client) {
    return JSON.parse(localStorage.getItem("finance_accounts") || "[]");
  }
  const { data, error } = await client
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase error fetching accounts:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    bank_name: row.bank_name,
    last_four: row.last_four || "",
    balance: Number(row.balance),
    created_at: row.created_at
  }));
}

export async function addDbAccount(account: Omit<Account, "id" | "created_at">): Promise<Account> {
  const dbRow = {
    name: account.name,
    type: account.type,
    bank_name: account.bank_name,
    last_four: account.last_four || "",
    balance: account.balance
  };

  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_accounts") || "[]") as Account[];
    const newAccount: Account = {
      id: "a-" + Date.now(),
      ...account
    };
    local.unshift(newAccount);
    localStorage.setItem("finance_accounts", JSON.stringify(local));
    return newAccount;
  }

  const { data, error } = await client
    .from("accounts")
    .insert([dbRow])
    .select()
    .single();

  if (error) {
    console.error("Supabase error inserting account:", error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    bank_name: data.bank_name,
    last_four: data.last_four || "",
    balance: Number(data.balance),
    created_at: data.created_at
  };
}

export async function updateDbAccount(id: string, account: Partial<Account>): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_accounts") || "[]") as Account[];
    const idx = local.findIndex(a => a.id === id);
    if (idx > -1) {
      if (account.name !== undefined) local[idx].name = account.name;
      if (account.type !== undefined) local[idx].type = account.type;
      if (account.bank_name !== undefined) local[idx].bank_name = account.bank_name;
      if (account.last_four !== undefined) local[idx].last_four = account.last_four;
      if (account.balance !== undefined) local[idx].balance = account.balance;
      localStorage.setItem("finance_accounts", JSON.stringify(local));
    }
    return;
  }

  const updates: any = {};
  if (account.name !== undefined) updates.name = account.name;
  if (account.type !== undefined) updates.type = account.type;
  if (account.bank_name !== undefined) updates.bank_name = account.bank_name;
  if (account.last_four !== undefined) updates.last_four = account.last_four;
  if (account.balance !== undefined) updates.balance = account.balance;

  const { error } = await client
    .from("accounts")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDbAccount(id: string): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_accounts") || "[]") as Account[];
    const filtered = local.filter(a => a.id !== id);
    localStorage.setItem("finance_accounts", JSON.stringify(filtered));
    return;
  }

  const { error } = await client
    .from("accounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// BUSINESSES CRUD
// ==========================================
export async function getDbBusinesses(): Promise<Business[]> {
  const client = getSupabaseClient(); if (!client) {
    return JSON.parse(localStorage.getItem("finance_businesses") || "[]");
  }
  const { data, error } = await client
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase error fetching businesses:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description || undefined,
    monthlyTarget: row.monthly_target ? Number(row.monthly_target) : undefined,
    status: row.status || "active",
    created_at: row.created_at
  }));
}

export async function addDbBusiness(business: { name: string; type: string; description?: string; monthlyTarget?: number }): Promise<Business> {
  const dbRow: any = {
    name: business.name,
    type: business.type,
    status: "active"
  };
  if (business.description) dbRow.description = business.description;
  if (business.monthlyTarget) dbRow.monthly_target = business.monthlyTarget;

  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_businesses") || "[]") as Business[];
    const newBiz: Business = {
      id: "biz-" + Date.now(),
      name: business.name,
      type: business.type,
      description: business.description,
      monthlyTarget: business.monthlyTarget,
      status: "active"
    };
    local.unshift(newBiz);
    localStorage.setItem("finance_businesses", JSON.stringify(local));
    return newBiz;
  }

  const { data, error } = await client
    .from("businesses")
    .insert([dbRow])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    description: data.description || undefined,
    monthlyTarget: data.monthly_target ? Number(data.monthly_target) : undefined,
    status: data.status || "active",
    created_at: data.created_at
  };
}

export async function updateDbBusiness(id: string, updates: Partial<Business>): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_businesses") || "[]") as Business[];
    const idx = local.findIndex(b => b.id === id);
    if (idx > -1) {
      if (updates.name !== undefined) local[idx].name = updates.name;
      if (updates.type !== undefined) local[idx].type = updates.type;
      if (updates.description !== undefined) local[idx].description = updates.description;
      if (updates.monthlyTarget !== undefined) local[idx].monthlyTarget = updates.monthlyTarget;
      if (updates.status !== undefined) local[idx].status = updates.status;
      localStorage.setItem("finance_businesses", JSON.stringify(local));
    }
    return;
  }

  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.monthlyTarget !== undefined) dbUpdates.monthly_target = updates.monthlyTarget;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { error } = await client
    .from("businesses")
    .update(dbUpdates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDbBusiness(id: string): Promise<void> {
  const client = getSupabaseClient(); if (!client) {
    const local = JSON.parse(localStorage.getItem("finance_businesses") || "[]") as Business[];
    const filtered = local.filter(b => b.id !== id);
    localStorage.setItem("finance_businesses", JSON.stringify(filtered));
    return;
  }

  const { error } = await client
    .from("businesses")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ==========================================
// SYNC LOCAL DATA TO SUPABASE
// ==========================================
export async function syncLocalToSupabase(): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];

  const client = getSupabaseClient(); if (!client) {
    errors.push("Supabase is not configured. Set credentials in Settings page to enable cloud sync.");
    return { synced, errors };
  }

  // Sync transactions
  try {
    const localTxs: Transaction[] = JSON.parse(localStorage.getItem("finance_transactions") || "[]");
    for (const tx of localTxs) {
      const isExpense = tx.amount < 0;
      const { error } = await client.from("transactions").upsert(
        { id: tx.id, name: tx.name, category: tx.category, date: tx.date, amount: Math.abs(tx.amount), type: isExpense ? "expense" : "income" },
        { onConflict: "id" }
      );
      if (!error) synced++;
      else errors.push(`Transaction ${tx.name}: ${error.message}`);
    }
  } catch (e: any) { errors.push(`Transactions: ${e.message}`); }

  // Sync budgets
  try {
    const localBgs: Budget[] = JSON.parse(localStorage.getItem("finance_budgets") || "[]");
    for (const b of localBgs) {
      const { error } = await client.from("budgets").upsert(
        { id: b.id, category: b.name, used: b.used, total: b.total },
        { onConflict: "id" }
      );
      if (!error) synced++;
      else errors.push(`Budget ${b.name}: ${error.message}`);
    }
  } catch (e: any) { errors.push(`Budgets: ${e.message}`); }

  // Sync portfolio holdings
  try {
    const localPortfolio = JSON.parse(localStorage.getItem("finance_portfolio") || '{"stocks":[]}');
    for (const s of localPortfolio.stocks || []) {
      const { error } = await client.from("portfolio_holdings").upsert(
        { id: s.id, ticker: s.ticker, name: s.company, value: s.value, change_percent: s.change || 0 },
        { onConflict: "id" }
      );
      if (!error) synced++;
      else errors.push(`Stock ${s.ticker}: ${error.message}`);
    }
  } catch (e: any) { errors.push(`Portfolio: ${e.message}`); }

  // Sync goals
  try {
    const localGoals: Goal[] = JSON.parse(localStorage.getItem("finance_goals") || "[]");
    for (const g of localGoals) {
      const { error } = await client.from("goals").upsert(
        { id: g.id, name: g.name, current: g.current, target: g.target },
        { onConflict: "id" }
      );
      if (!error) synced++;
      else errors.push(`Goal ${g.name}: ${error.message}`);
    }
  } catch (e: any) { errors.push(`Goals: ${e.message}`); }

  // Sync accounts
  try {
    const localAccts: Account[] = JSON.parse(localStorage.getItem("finance_accounts") || "[]");
    for (const a of localAccts) {
      const { error } = await client.from("accounts").upsert(
        { id: a.id, name: a.name, type: a.type, bank_name: a.bank_name, last_four: a.last_four, balance: a.balance },
        { onConflict: "id" }
      );
      if (!error) synced++;
      else errors.push(`Account ${a.name}: ${error.message}`);
    }
  } catch (e: any) { errors.push(`Accounts: ${e.message}`); }

  // Sync businesses
  try {
    const localBizes: Business[] = JSON.parse(localStorage.getItem("finance_businesses") || "[]");
    for (const b of localBizes) {
      const { error } = await client.from("businesses").upsert(
        { id: b.id, name: b.name, type: b.type, description: b.description || null, monthly_target: b.monthlyTarget || 0, status: b.status },
        { onConflict: "id" }
      );
      if (!error) synced++;
      else errors.push(`Business ${b.name}: ${error.message}`);
    }
  } catch (e: any) { errors.push(`Businesses: ${e.message}`); }

  return { synced, errors };
}
