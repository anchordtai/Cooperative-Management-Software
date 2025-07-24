import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { loanService, memberService } from '../services/api';

// TODO: Replace with actual loan type
interface Loan {
  id: number;
  memberId: string;
  memberName?: string;
  amount: number;
  interestRate?: number;
  term: number;
  startDate?: string;
  endDate?: string;
  status: 'pending' | 'active' | 'completed' | 'defaulted';
  remainingBalance?: number;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

const Loans: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    purpose: '',
    term: '',
  });

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const data = await loanService.getAll();
      setLoans(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch loans');
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
    fetchLoans();
    fetchMembers();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'completed':
        return 'info';
      case 'defaulted':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'memberId', headerName: 'Member ID', width: 100 },
    {
      field: 'memberName',
      headerName: 'Member Name',
      width: 150,
      valueGetter: (params) => {
        if (params.row.memberName) return params.row.memberName;
        const member = members.find((m) => m.id === params.row.memberId);
        return member ? `${member.firstName} ${member.lastName}` : '';
      },
    },
    {
      field: 'amount',
      headerName: 'Loan Amount',
      width: 130,
      renderCell: (params) => `₦${params.value?.toLocaleString()}`,
    },
    { field: 'term', headerName: 'Term (months)', width: 120 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (params) => (
      <Chip label={params.value} color={getStatusColor(params.value) as any} size="small" />
    ) },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params) => (
        <Box>
          <Button size="small" variant="outlined" onClick={() => handleViewLoan(params.row.id)}>
            View
          </Button>
        </Box>
      ),
    },
  ];

  const handleViewLoan = (id: number) => {
    // TODO: Implement view loan details
    console.log('View loan:', id);
  };

  const handleOpenDialog = () => {
    setFormData({ memberId: '', amount: '', purpose: '', term: '' });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loanService.create({
        ...formData,
        amount: parseFloat(formData.amount),
        term: parseInt(formData.term),
      });
      handleCloseDialog();
      fetchLoans();
    } catch (err: any) {
      setError(err.message || 'Failed to create loan');
    }
  };

  const handleRefresh = () => {
    fetchLoans();
  };

  const filteredLoans = loans.filter((loan) => {
    const member = members.find((m) => m.id === loan.memberId);
    const memberName = member ? `${member.firstName} ${member.lastName}` : '';
    return (
      String(loan.memberId).toLowerCase().includes(searchQuery.toLowerCase()) ||
      memberName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Loans</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          New Loan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search loans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <IconButton onClick={handleRefresh} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>

        <DataGrid
          rows={filteredLoans}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[10, 25, 50]}
          checkboxSelection
          disableRowSelectionOnClick
          autoHeight
          loading={loading}
        />
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>New Loan</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="dense">
              <InputLabel>Member</InputLabel>
              <Select
                value={formData.memberId}
                label="Member"
                onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
            />
            <TextField
              margin="dense"
              name="purpose"
              label="Purpose"
              type="text"
              fullWidth
              required
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            />
            <TextField
              margin="dense"
              name="term"
              label="Term (months)"
              type="number"
              fullWidth
              required
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              Add Loan
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Loans; 