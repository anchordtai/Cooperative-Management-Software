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
  IconButton,
  Alert,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { memberService } from '../services/api';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'suspended';
  membershipNumber: string;
}

const Members: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const [success, setSuccess] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    status: 'inactive' as Member['status'],
  });

  const columns: GridColDef[] = [
    { field: 'membershipNumber', headerName: 'Membership number', width: 200 },
    { field: 'status', headerName: 'Status', width: 110 },
    { field: 'firstName', headerName: 'First Name', width: 130 },
    { field: 'lastName', headerName: 'Last Name', width: 130 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'joinDate', headerName: 'Join Date', width: 130 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 230,
      renderCell: (params) => canManage && (
        <Box>
          <IconButton
            color="primary"
            aria-label="Edit member"
            onClick={() => handleEdit(params.row)}
            size="small"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            color="error"
            aria-label="Deactivate member"
            onClick={() => handleDelete(params.row.id)}
            size="small"
          >
            <DeleteIcon />
          </IconButton>
          {params.row.status === 'active' && <Button size="small" onClick={() => handleInvite(params.row.id)}>Invite to sign in</Button>}
        </Box>
      ),
    },
  ];

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await memberService.getAll();
      setMembers(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleOpenDialog = (member?: Member) => {
    if (member) {
      setSelectedMember(member);
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email || '',
        status: member.status,
        phone: member.phone,
        address: member.address,
      });
    } else {
      setSelectedMember(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
    status: 'inactive' as Member['status'],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedMember(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedMember) {
        await memberService.update(selectedMember.id, formData);
      } else {
        await memberService.create(formData);
      }
      setSuccess(selectedMember ? 'Member updated.' : 'Member added. Set the membership status to Active before inviting them.');
      handleCloseDialog();
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save member');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deactivate this membership?')) {
      try {
        await memberService.delete(id);
        fetchMembers();
      } catch (err: any) {
        setError(err.message || 'Failed to deactivate member');
      }
    }
  };

  const handleInvite = async (id: string) => {
    setSuccess('');
    setError(null);
    try {
      await memberService.invite(id);
      setSuccess('Invitation sent.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not send the invitation.');
    }
  };

  const handleEdit = (member: Member) => {
    handleOpenDialog(member);
  };

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Members</Typography>
        {canManage && <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Member
        </Button>}
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

        <DataGrid
        rows={members}
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
        <DialogTitle>
          {selectedMember ? 'Edit Member' : 'Add New Member'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              name="firstName"
              label="First Name"
              type="text"
              fullWidth
              required
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />
            <TextField
              margin="dense"
              name="lastName"
              label="Last Name"
              type="text"
              fullWidth
              required
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
            />
            <TextField
              margin="dense"
              name="email"
              label="Email"
              type="email"
              fullWidth
              required
              disabled={Boolean(selectedMember)}
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <TextField
              margin="dense"
              name="phone"
              label="Phone"
              type="tel"
              fullWidth
              required
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
            <TextField
              margin="dense"
              name="address"
              label="Address"
              type="text"
              fullWidth
              multiline
              rows={3}
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          {selectedMember && <TextField select fullWidth margin="normal" label="Membership status"
            value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Member['status'] })}>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
          </TextField>}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedMember ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Members; 