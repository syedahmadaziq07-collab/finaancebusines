export interface StatData {
  netWorth: {
    value: number;
    changePercent: number;
    changeText: string;
  };
  income: {
    value: number;
    changePercent: number;
    changeText: string;
  };
  expenses: {
    value: number;
    changePercent: number;
    changeText: string;
  };
  savings: {
    value: number;
    changePercent: number;
    changeText: string;
  };
}

export interface CashFlowPoint {
  month: string;
  income: number;
  expenses: number;
}

export interface SpendingCategory {
  name: string;
  value: number;
  color: string;
}

export interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number; // Positive for income, negative for expense
  iconName?: string;
}

export interface Budget {
  id: string;
  name: string;
  used: number;
  total: number;
}

export interface StockInfo {
  id?: string;
  ticker: string;
  company: string;
  value: number;
  change: number; // e.g. 18.2 for +18.2%, -3.1 for -3.1%
}

export interface PortfolioData {
  total: number;
  pnl: number;
  ytdPercent: number;
  stocks: StockInfo[];
}

export interface Account {
  id: string;
  name: string;
  type: string;
  bank_name: string;
  last_four: string;
  balance: number;
  created_at?: string;
}

export interface Goal {
  id: string;
  name: string;
  current: number;
  target: number;
  percent: number;
  remainingText: string;
  type?: string;
}
