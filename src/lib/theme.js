import useStore from '../store/useStore'

export const PALETTES = {
  light: {
    bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0', borderMid: '#CBD5E1',
    text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
    accent: '#2563EB', accentSoft: '#DBEAFE', nav: '#1E293B',
  },
  dark: {
    bg: '#0F172A', surface: '#1E293B', border: '#334155', borderMid: '#475569',
    text: '#F8FAFC', textMid: '#CBD5E1', textSoft: '#94A3B8',
    accent: '#60A5FA', accentSoft: 'rgba(96,165,250,0.15)', nav: '#0F172A',
  },
}

export function useAppTheme() {
  const theme = useStore(s => s.theme)
  return PALETTES[theme]
}
