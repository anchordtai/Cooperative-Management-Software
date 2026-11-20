import React from 'react';
import { Stack, Typography } from '@mui/material';
import { brand } from '../brand';
import Brand from './Brand';

export function AuthBranding() {
  return <Stack alignItems="center" spacing={0.75} sx={{ mb: 2, textAlign: 'center' }}>
    <Brand />
    <Typography variant="body2" color="text.secondary">{brand.tagline}</Typography>
  </Stack>;
}

export function ProductAttribution() {
  return <Typography component="footer" variant="caption" color="text.secondary" sx={{ mt: 3, pt: 2, display: 'block', textAlign: 'center', borderTop: 1, borderColor: 'divider', width: '100%' }}>{brand.attribution}</Typography>;
}
