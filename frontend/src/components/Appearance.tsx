import React, { createContext, useContext, useMemo, useState } from 'react';
import { CssBaseline, IconButton, PaletteMode, ThemeProvider, Tooltip } from '@mui/material';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import buildTheme from '../theme';

const AppearanceContext = createContext({ mode: 'light' as PaletteMode, toggle: () => {} });

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const saved = window.localStorage.getItem('ecooperative-appearance');
    return saved === 'dark' || saved === 'light'
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const theme = useMemo(() => buildTheme(mode), [mode]);

  function toggle() {
    const value = mode === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem('ecooperative-appearance', value);
    setMode(value);
  }

  return <AppearanceContext.Provider value={{ mode, toggle }}>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  </AppearanceContext.Provider>;
}

export function AppearanceButton() {
  const { mode, toggle } = useContext(AppearanceContext);
  const label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return <Tooltip title={label}>
    <IconButton aria-label={label} onClick={toggle} color="inherit">
      {mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
    </IconButton>
  </Tooltip>;
}
