import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AccountBalance as AccountBalanceIcon,
  CreditCard as CreditCardIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import HistoryIcon from '@mui/icons-material/History';
import Brand from './Brand';
import { ProductAttribution } from './AuthBranding';
import { AppearanceButton } from './Appearance';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/app' },
  { text: 'Members', icon: <PeopleIcon />, path: '/app/members', permission: 'members.read' },
  { text: 'Transactions', icon: <AccountBalanceIcon />, path: '/app/transactions', permission: 'finance.read' },
  { text: 'Loans', icon: <CreditCardIcon />, path: '/app/loans', permission: 'finance.read' },
  { text: 'Reports', icon: <AssessmentIcon />, path: '/app/reports', permission: 'reports.read' },
  { text: 'Audit history', icon: <HistoryIcon />, path: '/app/audit', permission: 'audit.read' },
  { text: 'Staff access', icon: <PeopleIcon />, path: '/app/staff', adminOnly: true },
  { text: 'Settings', icon: <SettingsIcon />, path: '/app/settings', adminOnly: true },
];

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { logout, user, can } = useAuth();
  const [logoutFailed, setLogoutFailed] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      setLogoutFailed(true);
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Brand to="/app" />
      </Toolbar>
      <List>
        {menuItems.filter(item => (!item.adminOnly || user?.role === 'admin') && (!item.permission || can(item.permission))).map((item) => (
          <ListItemButton key={item.text} component={NavLink} to={item.path} end onClick={() => setMobileOpen(false)}
            sx={{ mx: 1, mb: 0.5, borderRadius: 2, '&.active': { bgcolor: 'action.selected', color: 'primary.main' } }}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        ))}
        <ListItemButton onClick={handleLogout} sx={{ mx: 1, borderRadius: 2 }}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary={logoutFailed ? "Sign out failed. Retry" : "Sign out"} />
        </ListItemButton>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        color="inherit"
        sx={{
          bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Cooperative workspace</Typography>
          <AppearanceButton />
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
        <ProductAttribution />
      </Box>
    </Box>
  );
};

export default Layout; 