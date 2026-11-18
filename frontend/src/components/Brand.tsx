import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export default function Brand({ to = '/' }: { to?: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.1} component={Link} to={to}
      sx={{ color: 'text.primary', textDecoration: 'none', width: 'fit-content' }}>
      <Box aria-hidden="true" sx={{
        width: 36, height: 36, flexShrink: 0, borderRadius: 2.4, bgcolor: '#175c4d',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flexDirection: 'column', gap: '3px', pl: '9px'
      }}>
        <Box sx={{ width: 18, height: 3, borderRadius: 1, bgcolor: '#cdede0' }} />
        <Box sx={{ width: 13, height: 3, borderRadius: 1, bgcolor: '#efce92' }} />
        <Box sx={{ width: 18, height: 3, borderRadius: 1, bgcolor: '#cdede0' }} />
      </Box>
      <Typography variant="body2" fontWeight={800} letterSpacing="0.05em">E-COOPERATIVE</Typography>
    </Stack>
  );
}
