import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

  // JSON request body parser
  app.use(express.json());

  // CORS headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // HEALTH CHECK
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ==========================================
  // IN-MEMORY DATA STORES
  // ==========================================

  let stats = {
    netWorth: {
      value: 0,
      changePercent: 0,
      changeText: "RM 0 this month"
    },
    income: {
      value: 0,
      changePercent: 0,
      changeText: "This month"
    },
    expenses: {
      value: 0,
      changePercent: 0,
      changeText: "This month"
    },
    savings: {
      value: 0,
      changePercent: 0,
      changeText: "Saved this month"
    }
  };

  let cashflow: { month: string; income: number; expenses: number; }[] = [];

  let spending: { name: string; value: number; color: string; }[] = [];

  let transactions: { id: string; name: string; category: string; date: string; amount: number; }[] = [];

  let budgets: { id: string; name: string; used: number; total: number; }[] = [];

  let portfolio = {
    total: 0,
    pnl: 0,
    ytdPercent: 0,
    stocks: [] as { ticker: string; company: string; value: number; change: number; }[]
  };

  let goals: { id: string; name: string; current: number; target: number; percent: number; remainingText: string; }[] = [];

  // Helper to re-calculate aggregate figures
  function recalculateAggregates() {
    // Net worth = portfolio total + savings? For consistency, let's keep netWorth matching or updating dynamically when savings or cash is added.
    // Savings = Income - Expenses
    stats.savings.value = Math.max(0, stats.income.value - stats.expenses.value);
    stats.savings.changePercent = Math.round((stats.savings.value / stats.income.value) * 100);
  }

  // ==========================================
  // REST API ROUTING
  // ==========================================

  // Stats Endpoint
  app.get("/api/stats", (req, res) => {
    res.json(stats);
  });

  // Cashflow Endpoint
  app.get("/api/cashflow", (req, res) => {
    res.json(cashflow);
  });

  // Spending Endpoint
  app.get("/api/spending", (req, res) => {
    res.json(spending);
  });

  // Transactions Endpoint
  app.get("/api/transactions", (req, res) => {
    res.json(transactions);
  });

  // Add a Transaction
  app.post("/api/transactions", (req, res) => {
    const { name, category, amount, date } = req.body;
    if (!name || !category || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields: name, category, or amount." });
    }

    const value = parseFloat(amount);
    const newTx = {
      id: "tx-" + Date.now(),
      name,
      category,
      date: date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: value
    };

    transactions.unshift(newTx);

    // Update Stats
    if (value > 0) {
      stats.income.value += value;
      // Add income portion to net worth
      stats.netWorth.value += value;
    } else {
      const positiveExpense = Math.abs(value);
      stats.expenses.value += positiveExpense;
      stats.netWorth.value -= positiveExpense;

      // Update Budget if matches category
      const targetBudget = budgets.find(b => b.name.toLowerCase() === category.toLowerCase() || category.toLowerCase().includes(b.name.toLowerCase()));
      if (targetBudget) {
        targetBudget.used += positiveExpense;
      } else {
        // Also update Spending pie category
        const targetSpend = spending.find(s => s.name.toLowerCase() === category.toLowerCase() || category.toLowerCase().includes(s.name.toLowerCase()));
        if (targetSpend) {
          targetSpend.value += positiveExpense;
        } else {
          // If no matching pie, create one or add to first
          const colors = ["#ffffff", "#e5e5e5", "#a3a3a3", "#737373", "#525252", "#404040", "#262626", "#171717"];
          const nextColor = colors[spending.length % colors.length];
          spending.push({
            name: category,
            value: positiveExpense,
            color: nextColor
          });
        }
      }
    }

    // Refresh Cashflow's current month
    const dateObj = new Date();
    const currentMonthLabel = dateObj.toLocaleDateString("en-US", { month: "short" });
    let currentMonthData = cashflow.find(cf => cf.month === currentMonthLabel);
    if (!currentMonthData) {
      currentMonthData = { month: currentMonthLabel, income: 0, expenses: 0 };
      cashflow.push(currentMonthData);
    }
    
    if (value > 0) {
      currentMonthData.income += value;
    } else {
      currentMonthData.expenses += Math.abs(value);
    }

    recalculateAggregates();
    res.status(201).json(newTx);
  });

  // Budgets Endpoint
  app.get("/api/budgets", (req, res) => {
    res.json(budgets);
  });

  // Add a Budget
  app.post("/api/budgets", (req, res) => {
    const { name, total } = req.body;
    if (!name || total === undefined) {
      return res.status(400).json({ error: "Missing required fields: name or total." });
    }

    const budgetTotal = parseFloat(total);
    // Check if category budget already exists
    const existingIndex = budgets.findIndex(b => b.name.toLowerCase() === name.toLowerCase());

    if (existingIndex > -1) {
      budgets[existingIndex].total = budgetTotal;
      return res.json(budgets[existingIndex]);
    } else {
      // Find current expense in spending for this category, if any
      const matchingSpend = spending.find(s => s.name.toLowerCase() === name.toLowerCase());
      const initialUsed = matchingSpend ? matchingSpend.value : 0;

      const newBudget = {
        id: "b-" + Date.now(),
        name,
        used: initialUsed,
        total: budgetTotal
      };
      budgets.push(newBudget);
      res.status(201).json(newBudget);
    }
  });

  // Portfolio Endpoint
  app.get("/api/portfolio", (req, res) => {
    res.json(portfolio);
  });

  // Buy Stock / Asset (Interactive Portfolio additions)
  app.post("/api/portfolio/buy", (req, res) => {
    const { ticker, company, amount, change } = req.body;
    if (!ticker || !company || !amount) {
      return res.status(400).json({ error: "Missing fields: ticker, company, or amount." });
    }

    const value = parseFloat(amount);
    const existing = portfolio.stocks.find(s => s.ticker.toUpperCase() === ticker.toUpperCase());

    if (existing) {
      existing.value += value;
    } else {
      portfolio.stocks.push({
        ticker: ticker.toUpperCase(),
        company,
        value,
        change: change !== undefined ? parseFloat(change) : 2.5
      });
    }

    portfolio.total += value;
    stats.netWorth.value += value;

    // Log transaction
    const tx = {
      id: "tx-" + Date.now(),
      name: `Bought ${ticker.toUpperCase()}`,
      category: "Investment",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: -value
    };
    transactions.unshift(tx);

    res.json(portfolio);
  });

  // Goals Endpoint
  app.get("/api/goals", (req, res) => {
    res.json(goals);
  });

  // Add a Goal
  app.post("/api/goals", (req, res) => {
    const { name, current, target } = req.body;
    if (!name || target === undefined) {
      return res.status(400).json({ error: "Missing required fields: name or target." });
    }

    const goalCurrent = parseFloat(current || 0);
    const goalTarget = parseFloat(target);
    const percent = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : 0;
    const remaining = Math.max(0, goalTarget - goalCurrent);
    
    const newGoal = {
      id: "g-" + Date.now(),
      name: name.toUpperCase(),
      current: goalCurrent,
      target: goalTarget,
      percent,
      remainingText: remaining <= 0 ? "Completed!" : `RM ${remaining.toLocaleString()} remaining`
    };
    goals.push(newGoal);
    res.status(201).json(newGoal);
  });

  // Contribute money to a goal
  app.post("/api/goals/contribute", (req, res) => {
    const { goalId, amount } = req.body;
    if (!goalId || amount === undefined) {
      return res.status(400).json({ error: "Missing goalId or amount." });
    }

    const value = parseFloat(amount);
    const goal = goals.find(g => g.id === goalId);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found." });
    }

    goal.current += value;
    if (goal.current > goal.target) {
      goal.current = goal.target;
    }
    goal.percent = Math.round((goal.current / goal.target) * 100);

    const remaining = goal.target - goal.current;
    if (remaining <= 0) {
      goal.remainingText = "Completed!";
    } else {
      goal.remainingText = `RM ${remaining.toLocaleString()} remaining`;
    }

    // Deduct cash from savings stat for realism!
    stats.netWorth.value -= value; // Or keep networth same (asset reallocation) and log a transfer transaction
    const tx = {
      id: "tx-" + Date.now(),
      name: `Transfer to ${goal.name}`,
      category: "Savings Goal",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: -value
    };
    transactions.unshift(tx);

    res.json(goals);
  });

  // ==========================================
  // STATIC ASSETS & VITE SERVING MIDDLEWARE
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    // Develop Mode: Enable Vite Dev Server as a middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server linked to Express.");
  } else {
    // Production Mode: Serve built static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from client dist.");
  }

  // BIND AND LISTEN
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
