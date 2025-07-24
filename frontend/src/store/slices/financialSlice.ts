import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'loan' | 'repayment';
  amount: number;
  date: string;
  description: string;
  memberId: string;
  status: 'pending' | 'completed' | 'failed';
}

interface Loan {
  id: string;
  memberId: string;
  amount: number;
  interestRate: number;
  term: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  remainingBalance: number;
}

interface FinancialState {
  transactions: Transaction[];
  loans: Loan[];
  totalShareCapital: number;
  totalSavings: number;
  totalLoans: number;
  loading: boolean;
  error: string | null;
}

const initialState: FinancialState = {
  transactions: [],
  loans: [],
  totalShareCapital: 0,
  totalSavings: 0,
  totalLoans: 0,
  loading: false,
  error: null,
};

const financialSlice = createSlice({
  name: 'financial',
  initialState,
  reducers: {
    fetchFinancialDataStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchFinancialDataSuccess: (state, action: PayloadAction<{
      transactions: Transaction[];
      loans: Loan[];
      totalShareCapital: number;
      totalSavings: number;
      totalLoans: number;
    }>) => {
      state.loading = false;
      state.transactions = action.payload.transactions;
      state.loans = action.payload.loans;
      state.totalShareCapital = action.payload.totalShareCapital;
      state.totalSavings = action.payload.totalSavings;
      state.totalLoans = action.payload.totalLoans;
      state.error = null;
    },
    fetchFinancialDataFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.push(action.payload);
    },
    updateTransaction: (state, action: PayloadAction<Transaction>) => {
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.transactions[index] = action.payload;
      }
    },
    addLoan: (state, action: PayloadAction<Loan>) => {
      state.loans.push(action.payload);
    },
    updateLoan: (state, action: PayloadAction<Loan>) => {
      const index = state.loans.findIndex(loan => loan.id === action.payload.id);
      if (index !== -1) {
        state.loans[index] = action.payload;
      }
    },
    updateFinancialTotals: (state, action: PayloadAction<{
      totalShareCapital: number;
      totalSavings: number;
      totalLoans: number;
    }>) => {
      state.totalShareCapital = action.payload.totalShareCapital;
      state.totalSavings = action.payload.totalSavings;
      state.totalLoans = action.payload.totalLoans;
    },
  },
});

export const {
  fetchFinancialDataStart,
  fetchFinancialDataSuccess,
  fetchFinancialDataFailure,
  addTransaction,
  updateTransaction,
  addLoan,
  updateLoan,
  updateFinancialTotals,
} = financialSlice.actions;

export default financialSlice.reducer; 