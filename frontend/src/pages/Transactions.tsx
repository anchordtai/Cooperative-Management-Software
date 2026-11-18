import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api, { transactionService, memberService } from '../services/api';

interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
  Member?: Member;
  status: 'pending' | 'completed' | 'failed';
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

const Transactions: React.FC = () => {
  const { can } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    memberId: '',
      type: 'deposit',
    amount: '',
    description: '',
    reference: '',
  });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'memberName', headerName: 'Member', width: 200, valueGetter: ({ row }) => row.Member ? `${row.Member.firstName} ${row.Member.lastName}` : '' },
    { field: 'type', headerName: 'Type', width: 130 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 130,
      valueFormatter: (params) => `₦${Number(params.value).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
    },
    { field: 'description', headerName: 'Description', width: 200 },
    { field: 'createdAt', headerName: 'Date', width: 180, valueFormatter: params => new Date(params.value).toLocaleDateString('en-NG') },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Box
          sx={{
            color:
              params.value === 'completed'
                ? 'success.main'
                : params.value === 'pending'
                ? 'warning.main'
                : 'error.main',
          }}
        >
          {params.value.charAt(0).toUpperCase() + params.value.slice(1)}
        </Box>
      ),
    },
    {
      field: 'review', headerName: 'Review', width: 200, sortable: false,
      renderCell: ({ row }) => can('withdrawals.decide') && row.type === 'withdrawal' && row.status === 'pending' && (
        <Box>
          <Button size="small" onClick={() => decideWithdrawal(row.id, 'approve')}>Approve</Button>
          <Button size="small" color="error" onClick={() => decideWithdrawal(row.id, 'reject')}>Reject</Button>
        </Box>
      )
    }
  ];

  const decideWithdrawal = async (id: string, decision: 'approve' | 'reject') => {
    const reference = decision === 'approve' ? window.prompt('Enter the confirmed payout reference')?.trim() : null;
    if (decision === 'approve' ? !reference : !window.confirm('Reject this withdrawal request?')) return;
    try {
      await api.patch(`/transactions/withdrawals/${id}/${decision}`, { reference });
      await fetchTransactions();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not review the withdrawal.');
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionService.getAll();
      setTransactions(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const data = await memberService.getAll();
      setMembers(data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch members');
    }
  };

  useEffect(() => {
    fetchTransactions();
    if (can('savings.deposit')) fetchMembers();
    // The request closures use the permissions supplied by the initial session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDialog = () => {
    setFormData({
      memberId: '',
      type: 'deposit',
      amount: '',
      description: '',
    reference: '',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transactionService.create({
        ...formData,
        amount: formData.amount,
      });
      handleCloseDialog();
      fetchTransactions();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create transaction');
    }
  };

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Transactions</Typography>
        {can('savings.deposit') && <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Record deposit
        </Button>}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

        <DataGrid
        rows={transactions}
          columns={columns}
          initialState={{
            pagination: {
            paginationModel: { pageSize: 10, page: 0 },
            },
          }}
        pageSizeOptions={[10]}
          checkboxSelection
          disableRowSelectionOnClick
        loading={loading}
      />

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Record savings deposit</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="dense">
              <InputLabel>Member</InputLabel>
              <Select
                value={formData.memberId}
                label="Member"
                onChange={(e) =>
                  setFormData({ ...formData, memberId: e.target.value })
                }
                required
              >
                {members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              margin="dense"
              name="amount"
              label="Amount"
              type="number"
              fullWidth
              required
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              InputProps={{
                startAdornment: '₦',
              }}
            />

            <TextField
              margin="dense"
              name="description"
              label="Description"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <TextField fullWidth required margin="dense" label="Transfer or receipt reference"
              value={formData.reference}
              inputProps={{ maxLength: 160 }}
              onChange={event => setFormData({ ...formData, reference: event.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              Create Transaction
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Transactions; 