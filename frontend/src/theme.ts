import { createTheme, PaletteMode } from '@mui/material';

export default function buildTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#80d9be' : '#166353' },
      secondary: { main: dark ? '#eac88c' : '#8e5e24' },
      background: {
        default: dark ? '#111c1a' : '#f4f7f4',
        paper: dark ? '#172522' : '#ffffff'
      },
      text: {
        primary: dark ? '#edf7f3' : '#162a25',
        secondary: dark ? '#bbccc5' : '#536762'
      }
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 750, fontSize: '1.9rem', letterSpacing: '-0.035em' },
      h5: { fontWeight: 720, letterSpacing: '-0.025em' },
      h6: { fontWeight: 700 }
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: 'none', fontWeight: 700 } }
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: { styleOverrides: { root: { borderRadius: 16 } } }
    }
  });
}
