import React from 'react';
import { Box, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { brand } from '../brand';

export default function Brand({ to = '/', inverse, onNavigate }: { to?: string; inverse?: boolean; onNavigate?: () => void }) {
  const theme = useTheme();
  const dark = inverse ?? theme.palette.mode === 'dark';
  return (
    <Box component={Link} to={to} onClick={onNavigate} aria-label={`${brand.name} home`}
      sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, width: 'fit-content' }}>
      <Box component="img" src={dark ? brand.logo.dark : brand.logo.light} alt={brand.name}
        width={669} height={132} sx={{ width: 'auto', height: { xs: 36, sm: 40 }, display: 'block' }} />
    </Box>
  );
}
