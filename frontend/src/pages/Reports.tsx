import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { memberService, loanService, transactionService } from '../services/api';
import { saveAs } from 'file-saver';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('monthly');
  const [timeRange, setTimeRange] = useState('year');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Aggregated data
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [memberStatusData, setMemberStatusData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [membersRes, loansRes, transactionsRes] = await Promise.all([
          memberService.getAll(),
          loanService.getAll(),
          transactionService.getAll(),
        ]);
        setMembers(membersRes.data);
        setLoans(loansRes.data);
        setTransactions(transactionsRes.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch report data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Aggregate monthly savings and loans
    const monthly: { [key: string]: { savings: number; loans: number } } = {};
    const now = new Date();
    // Only last 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = { savings: 0, loans: 0 };
    }
    // Transactions: savings (deposits), loan payments
    transactions.forEach((tx: any) => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) {
        if (tx.type === 'deposit') monthly[key].savings += Number(tx.amount);
        if (tx.type === 'loan_payment') monthly[key].loans += Number(tx.amount);
      }
    });
    // Loans: count new loans per month
    loans.forEach((loan: any) => {
      const date = new Date(loan.createdAt || loan.startDate || loan.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthly[key]) {
        monthly[key].loans += Number(loan.amount);
      }
    });
    // Prepare for chart
    const monthlyArr = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        name: key,
        savings: value.savings,
        loans: value.loans,
      }));
    setMonthlyData(monthlyArr);

    // Member status distribution
    const statusCount: { [key: string]: number } = {};
    members.forEach((m) => {
      const status = m.status || 'Active';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    setMemberStatusData(
      Object.entries(statusCount).map(([name, value]) => ({ name, value }))
    );
  }, [members, loans, transactions]);

  const handleReportTypeChange = (event: any) => {
    setReportType(event.target.value);
  };

  const handleTimeRangeChange = (event: any) => {
    setTimeRange(event.target.value);
  };

  const handleExport = () => {
    // Prepare CSV content
    let csv = 'Monthly Overview (Savings vs Loans)\n';
    csv += 'Month,Savings,Loans\n';
    monthlyData.forEach((row) => {
      csv += `${row.name},${row.savings},${row.loans}\n`;
    });
    csv += '\nMember Status Distribution\n';
    csv += 'Status,Count\n';
    memberStatusData.forEach((row) => {
      csv += `${row.name},${row.value}\n`;
    });
    // Create blob and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'report.csv');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Reports</Typography>
        <Button variant="contained" onClick={handleExport}>
          Export Report
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Report Type</InputLabel>
                <Select
                  value={reportType}
                  label="Report Type"
                  onChange={handleReportTypeChange}
                >
                  <MenuItem value="monthly">Monthly Overview</MenuItem>
                  <MenuItem value="quarterly">Quarterly Report</MenuItem>
                  <MenuItem value="annual">Annual Report</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  label="Time Range"
                  onChange={handleTimeRangeChange}
                >
                  <MenuItem value="month">This Month</MenuItem>
                  <MenuItem value="quarter">This Quarter</MenuItem>
                  <MenuItem value="year">This Year</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Typography variant="h6" gutterBottom>
              Savings vs Loans
            </Typography>
            <BarChart
              width={500}
              height={300}
              data={monthlyData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="savings" fill="#8884d8" />
              <Bar dataKey="loans" fill="#82ca9d" />
            </BarChart>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Member Status Distribution
            </Typography>
            <PieChart width={500} height={300}>
              <Pie
                data={memberStatusData}
                cx={250}
                cy={150}
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {memberStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Growth Trend
            </Typography>
            <LineChart
              width={1000}
              height={300}
              data={monthlyData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="savings"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
              <Line type="monotone" dataKey="loans" stroke="#82ca9d" />
            </LineChart>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports; 