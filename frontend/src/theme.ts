import { createTheme, PaletteMode } from '@mui/material';
import { brand } from './brand';

const { colors } = brand;

export default function buildTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#8BB8FF' : colors.royal },
      secondary: { main: dark ? colors.gold : '#08796F' },
      background: {
        default: dark ? colors.navy : colors.light,
        paper: dark ? colors.midnight : colors.white
      },
      text: {
        primary: dark ? '#EFF4FF' : colors.navy,
        secondary: dark ? '#C4D2EA' : '#4D5E7D'
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
        styleOverrides: { root: { textTransform: 'none', fontWeight: 700, borderRadius: 9, minHeight: 42 } }
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: { styleOverrides: { root: { borderRadius: 16 } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 9 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } }
    }
  });
}
