import React from 'react';
import { Box, Button, Container, Divider, Grid, Link, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import ArrowForward from '@mui/icons-material/ArrowForward';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import QueryStatsOutlined from '@mui/icons-material/QueryStatsOutlined';
import Brand from '../components/Brand';
import { AppearanceButton } from '../components/Appearance';

const features = [
  { title: 'Member administration', text: 'Approve memberships, invite members to sign in and give staff access to the work they handle.', Icon: GroupsOutlined },
  { title: 'Savings and loans', text: 'Track deposits, approve withdrawals and manage loan applications, disbursements and repayments.', Icon: AccountBalanceWalletOutlined },
  { title: 'Financial reporting', text: 'Review recent transactions and export an activity report from your cooperative’s records.', Icon: QueryStatsOutlined }
];

export default function LandingPage() {
  return (
    <Box>
      <Container component="header" maxWidth="lg" sx={{ py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Brand />
          <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 2 }}>
            <Link component={RouterLink} to="/faq" color="text.secondary" underline="hover" sx={{ display: { xs: 'none', sm: 'block' } }}>FAQ</Link>
            <AppearanceButton />
            <Button component={RouterLink} to="/login" variant="outlined" sx={{ whiteSpace: 'nowrap' }}>Sign in</Button>
          </Stack>
        </Stack>
      </Container>
      <Divider />
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 5, md: 9 } }}>
        <Grid container spacing={{ xs: 4, md: 7 }} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stack spacing={3} alignItems="flex-start">
              <Typography variant="overline" color="primary" fontWeight={750}>Cooperative management</Typography>
              <Typography component="h1" sx={{
                fontSize: { xs: '2.7rem', sm: '3.7rem', md: '4.15rem' },
                fontWeight: 760, lineHeight: 1.03, letterSpacing: '-0.07em'
              }}>
                Empowering Cooperatives. <Box component="span" color="primary.main">Transforming Financial Communities.</Box>
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 460, fontSize: { xs: '1rem', md: '1.125rem' }, lineHeight: 1.65 }}>
                Manage members, savings, loans and financial records in one workspace. Give your members direct access to their accounts.
              </Typography>
              <Button size="large" variant="contained" component={RouterLink} to="/register" endIcon={<ArrowForward />}>
                Register a cooperative
              </Button>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box component="img" src="/cooperative-meeting.jpg" alt="Nigerian cooperative members reviewing records together"
              sx={{ width: '100%', display: 'block', aspectRatio: { xs: '16 / 11', md: '1.03' }, objectFit: 'cover', borderRadius: { xs: 4, md: 6 } }} />
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ mt: { xs: 4, md: 8 } }}>
          {features.map(({ title, text, Icon }) => <Grid item xs={12} md={4} key={title}>
            <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
              <Icon color="primary" />
              <Typography component="h2" variant="h6" sx={{ mt: 1.5 }}>{title}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>{text}</Typography>
            </Paper>
          </Grid>)}
        </Grid>
      </Container>
      <Divider />
      <Container component="footer" maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Brand />
          <Stack direction="row" spacing={2}>
            <Link component={RouterLink} to="/faq" color="text.secondary">FAQ</Link>
            <Link component={RouterLink} to="/contact" color="text.secondary">Contact</Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
