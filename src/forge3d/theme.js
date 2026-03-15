export function getThemeColors(theme = 'dark') {
  return theme === 'dark'
    ? {
        bg: '#13141f',
        bgPanel: '#1e1f30',
        bgDark: '#16172a',
        bgDarker: '#1a1b2e',
        text: '#c8c9db',
        textMuted: '#8a8baa',
        textFaint: '#5c5d7a',
        border: '#2a2b3d',
        borderHover: '#3a3b55',
        accent: '#4fc3f7',
        accentHover: '#4dd0e1',
        error: '#e57373',
        warn: '#ffb74d',
        success: '#81c784',
        logoGlow: 'linear-gradient(135deg,#4fc3f7,#7c4dff)',
        btnHover: '#2a2b40',
      }
    : {
        bg: '#f0f2f5',
        bgPanel: '#ffffff',
        bgDark: '#f7f9fa',
        bgDarker: '#fafbfc',
        text: '#333333',
        textMuted: '#666666',
        textFaint: '#999999',
        border: '#e0e0e0',
        borderHover: '#d0d0d0',
        accent: '#1565c0',
        accentHover: '#1976d2',
        error: '#c62828',
        warn: '#f57c00',
        success: '#2e7d32',
        logoGlow: 'linear-gradient(135deg,#1565c0,#4527a0)',
        btnHover: '#f0f0f0',
      };
}
