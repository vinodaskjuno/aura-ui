import { useThemeStore } from '../store/themeStore'

export interface GraphTheme {
  theme: 'dark1' | 'dark2' | 'light'
  isDark: boolean
  // Canvas graph
  graphBg: string
  gradColors: { start: string; mid: string; end: string }
  showStars: boolean
  starOpacity: number
  starColor: string
  // Canvas labels / links
  labelColor: string
  labelShadow: string
  linkOpacity: string  // hex suffix e.g. '88'
  // Cluster glow
  clusterAlpha1: string  // hex stop 0
  clusterAlpha2: string  // hex stop 0.55
  clusterBorder: string  // hex border
  // Panels
  panelBg: string
  panelBorder: string
  panelText: string
  panelSubtext: string
  panelCard: string
  panelCardBorder: string
  // Top bar
  topBarBg: string
  topBarBorder: string
  // Filter / Legend
  filterBg: string
  filterBorder: string
  legendBg: string
  legendBorder: string
  // Tooltip
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  tooltipSubtext: string
  // Form inputs
  inputBg: string
  inputBorder: string
  inputText: string
  inputBgFocus: string
  inputBorderFocus: string
  // Accent
  accent: string
  accentBg: string
  accentBorder: string
  // Misc
  mutedText: string
  sectionLabel: string
  divider: string
  rowHover: string
  // @xyflow/react node colors (for specialist flow views)
  flowNodeBg: string
  flowNodeBorder: string
  flowNodeText: string
  flowNodeSubtext: string
  flowNodeSelected: string
  flowEdgeColor: string
  flowEdgeLabelBg: string
  flowEdgeLabelText: string
  flowLaneBg: string
  flowLaneBorder: string
}

export function useGraphTheme(): GraphTheme {
  const { theme } = useThemeStore()

  if (theme === 'dark2') {
    return {
      theme, isDark: true,
      graphBg: 'rgba(10,10,10,0.97)',
      gradColors: { start: '#0d0d0d', mid: '#080808', end: '#030303' },
      showStars: true, starOpacity: 0.5, starColor: '255,255,255',
      labelColor: '#ffffff', labelShadow: 'rgba(0,0,0,0.95)',
      linkOpacity: '88',
      clusterAlpha1: '16', clusterAlpha2: '0a', clusterBorder: '20',
      panelBg: 'rgba(13,13,13,0.98)',
      panelBorder: 'rgba(255,255,255,0.09)',
      panelText: '#f0f0f0', panelSubtext: '#888888',
      panelCard: 'rgba(255,255,255,0.04)',
      panelCardBorder: 'rgba(255,255,255,0.07)',
      topBarBg: 'rgba(10,10,10,0.96)',
      topBarBorder: 'rgba(255,255,255,0.08)',
      filterBg: 'rgba(10,10,10,0.96)',
      filterBorder: 'rgba(255,255,255,0.09)',
      legendBg: 'rgba(8,8,8,0.93)',
      legendBorder: 'rgba(167,139,250,0.10)',
      tooltipBg: 'rgba(15,15,15,0.98)',
      tooltipBorder: 'rgba(255,255,255,0.12)',
      tooltipText: '#f0f0f0', tooltipSubtext: '#777777',
      inputBg: 'rgba(255,255,255,0.05)',
      inputBorder: 'rgba(255,255,255,0.10)',
      inputText: '#f0f0f0',
      inputBgFocus: 'rgba(255,255,255,0.09)',
      inputBorderFocus: '#e84c0e',
      accent: '#e84c0e', accentBg: 'rgba(232,76,14,0.12)', accentBorder: 'rgba(232,76,14,0.30)',
      mutedText: '#666666', sectionLabel: '#555555',
      divider: 'rgba(255,255,255,0.07)',
      rowHover: 'rgba(255,255,255,0.04)',
      flowNodeBg: 'rgba(20,20,20,0.95)',
      flowNodeBorder: 'rgba(232,76,14,0.35)',
      flowNodeText: '#f0f0f0',
      flowNodeSubtext: '#888888',
      flowNodeSelected: 'rgba(232,76,14,0.6)',
      flowEdgeColor: '#e84c0e',
      flowEdgeLabelBg: 'rgba(20,20,20,0.90)',
      flowEdgeLabelText: '#cccccc',
      flowLaneBg: 'rgba(255,255,255,0.02)',
      flowLaneBorder: 'rgba(255,255,255,0.07)',
    }
  }

  if (theme === 'light') {
    return {
      theme, isDark: false,
      graphBg: 'rgba(237,244,252,1.0)',
      gradColors: { start: '#cddff5', mid: '#deeaf8', end: '#edf3fb' },
      showStars: false, starOpacity: 0.12, starColor: '100,140,200',
      labelColor: '#0f172a', labelShadow: 'rgba(255,255,255,0.92)',
      linkOpacity: 'bb',
      clusterAlpha1: '14', clusterAlpha2: '09', clusterBorder: '1a',
      panelBg: 'rgba(255,255,255,0.98)',
      panelBorder: 'rgba(0,0,0,0.08)',
      panelText: '#0f172a', panelSubtext: '#64748b',
      panelCard: 'rgba(0,0,0,0.03)',
      panelCardBorder: 'rgba(0,0,0,0.06)',
      topBarBg: 'rgba(255,255,255,0.96)',
      topBarBorder: 'rgba(0,0,0,0.09)',
      filterBg: 'rgba(255,255,255,0.97)',
      filterBorder: 'rgba(0,0,0,0.08)',
      legendBg: 'rgba(252,254,255,0.96)',
      legendBorder: 'rgba(0,0,0,0.08)',
      tooltipBg: 'rgba(255,255,255,0.99)',
      tooltipBorder: 'rgba(0,0,0,0.09)',
      tooltipText: '#0f172a', tooltipSubtext: '#64748b',
      inputBg: 'rgba(0,0,0,0.04)',
      inputBorder: 'rgba(0,0,0,0.12)',
      inputText: '#0f172a',
      inputBgFocus: 'rgba(37,99,235,0.05)',
      inputBorderFocus: '#2563eb',
      accent: '#2563eb', accentBg: 'rgba(37,99,235,0.08)', accentBorder: 'rgba(37,99,235,0.25)',
      mutedText: '#94a3b8', sectionLabel: '#94a3b8',
      divider: 'rgba(0,0,0,0.06)',
      rowHover: 'rgba(0,0,0,0.03)',
      flowNodeBg: 'rgba(255,255,255,0.97)',
      flowNodeBorder: 'rgba(37,99,235,0.30)',
      flowNodeText: '#0f172a',
      flowNodeSubtext: '#64748b',
      flowNodeSelected: 'rgba(37,99,235,0.5)',
      flowEdgeColor: '#2563eb',
      flowEdgeLabelBg: 'rgba(255,255,255,0.95)',
      flowEdgeLabelText: '#1e3a8a',
      flowLaneBg: 'rgba(0,0,0,0.02)',
      flowLaneBorder: 'rgba(0,0,0,0.07)',
    }
  }

  // dark1 — Aura Navy (default)
  return {
    theme, isDark: true,
    graphBg: 'rgba(6,12,26,0.97)',
    gradColors: { start: '#0d0f2b', mid: '#060818', end: '#020408' },
    showStars: true, starOpacity: 1.0, starColor: '255,255,255',
    labelColor: '#ffffff', labelShadow: 'rgba(0,0,0,0.95)',
    linkOpacity: '88',
    clusterAlpha1: '1e', clusterAlpha2: '0c', clusterBorder: '25',
    panelBg: 'rgba(6,13,46,0.98)',
    panelBorder: 'rgba(255,255,255,0.12)',
    panelText: '#e2e8f0', panelSubtext: '#64748b',
    panelCard: 'rgba(255,255,255,0.04)',
    panelCardBorder: 'rgba(255,255,255,0.08)',
    topBarBg: 'rgba(6,13,46,0.95)',
    topBarBorder: 'rgba(255,255,255,0.10)',
    filterBg: 'rgba(6,12,26,0.95)',
    filterBorder: 'rgba(255,255,255,0.13)',
    legendBg: 'rgba(5,8,28,0.92)',
    legendBorder: 'rgba(167,139,250,0.15)',
    tooltipBg: 'rgba(6,13,46,0.98)',
    tooltipBorder: 'rgba(255,255,255,0.18)',
    tooltipText: '#f0f0ff', tooltipSubtext: '#6a7aaa',
    inputBg: 'rgba(255,255,255,0.07)',
    inputBorder: 'rgba(255,255,255,0.14)',
    inputText: '#e4e4f0',
    inputBgFocus: 'rgba(255,255,255,0.11)',
    inputBorderFocus: '#4a9eff',
    accent: '#4f8ef7', accentBg: 'rgba(74,158,255,0.12)', accentBorder: 'rgba(74,158,255,0.30)',
    mutedText: '#334155', sectionLabel: '#6a7aaa',
    divider: 'rgba(255,255,255,0.08)',
    rowHover: 'rgba(255,255,255,0.05)',
    flowNodeBg: 'rgba(6,18,60,0.97)',
    flowNodeBorder: 'rgba(74,158,255,0.30)',
    flowNodeText: '#e2e8f0',
    flowNodeSubtext: '#64748b',
    flowNodeSelected: 'rgba(74,158,255,0.55)',
    flowEdgeColor: '#4f8ef7',
    flowEdgeLabelBg: 'rgba(6,13,46,0.95)',
    flowEdgeLabelText: '#93c5fd',
    flowLaneBg: 'rgba(255,255,255,0.02)',
    flowLaneBorder: 'rgba(255,255,255,0.08)',
  }
}
