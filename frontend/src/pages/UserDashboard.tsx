import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, Avatar, Divider } from '@mui/material';
// import { PieChart } from '@mui/x-charts';
import api from '../services/api';

const UserDashboard: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    // Fetch user profile
    api.get('/auth/me').then(res => setProfile(res.data.data));
    // Fetch user loans
    api.get('/financial/loans/my').then(res => setLoans(res.data.data));
    // Fetch user transactions
    api.get('/transactions/my').then(res => setTransactions(res.data.data));
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Welcome, {profile?.firstName || 'User'}!</Typography>
      <Grid container spacing={3}>
        {/* Overview Cards */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Total Loan Balance</Typography>
              <Typography variant="h4" color="primary">₦{loans.reduce((sum, l) => sum + (l.balance || 0), 0)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Total Paid</Typography>
              <Typography variant="h4" color="secondary">₦{transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + (t.amount || 0), 0)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Next Payment Due</Typography>
              <Typography variant="h4">{loans[0]?.nextDueDate ? new Date(loans[0].nextDueDate).toLocaleDateString() : '--'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* Profile Section */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" flexDirection="column" alignItems="center">
                <Avatar sx={{ width: 64, height: 64, mb: 2 }}>{profile?.firstName?.[0]}</Avatar>
                <Typography variant="h6">{profile?.firstName} {profile?.lastName}</Typography>
                <Typography color="textSecondary">{profile?.email}</Typography>
                <Typography color="textSecondary">{profile?.phone}</Typography>
                <Button variant="outlined" sx={{ mt: 2 }}>Edit Profile</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {/* Loans Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>My Loans</Typography>
              <Divider sx={{ mb: 2 }} />
              {loans.length === 0 ? <Typography>No loans found.</Typography> : (
                <Box>
                  {loans.map((loan, idx) => (
                    <Box key={loan.id} mb={2}>
                      <Typography><b>Amount:</b> ₦{loan.amount} | <b>Status:</b> {loan.status} | <b>Due:</b> {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '--'}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              <Button variant="contained" sx={{ mt: 2 }}>Request New Loan</Button>
            </CardContent>
          </Card>
        </Grid>
        {/* Transactions Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>My Transactions</Typography>
              <Divider sx={{ mb: 2 }} />
              {transactions.length === 0 ? <Typography>No transactions found.</Typography> : (
                <Box>
                  {transactions.map((tx, idx) => (
                    <Box key={tx.id} mb={1}>
                      <Typography><b>{tx.type}</b> - ₦{tx.amount} on {new Date(tx.date).toLocaleDateString()}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        {/* Simple Chart Section */}
        {/* <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Loan vs Payment Chart</Typography>
              <PieChart
                series={[{
                  data: [
                    { id: 0, value: loans.reduce((sum, l) => sum + (l.amount || 0), 0), label: 'Loans' },
                    { id: 1, value: transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + (t.amount || 0), 0), label: 'Payments' },
                  ],
                }]}
                width={300}
                height={200}
              />
            </CardContent>
          </Card>
        </Grid> */}
      </Grid>
    </Box>
  );
};

export default UserDashboard; 