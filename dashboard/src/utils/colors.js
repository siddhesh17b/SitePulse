export function getContrastColors(hexColor) {
  let hex = (hexColor || '#000000').replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const isLight = yiq >= 170;

  return {
    isLight,
    text: isLight ? '#0f172a' : '#ffffff',
    textMuted: isLight ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.88)',
    headerBorder: isLight ? '1px solid #e2e8f0' : 'none',
    activeTab: isLight ? '#0f172a' : (hexColor || '#000000'),
    closeBtnBg: isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.14)',
    bubbleBorder: isLight ? '1px solid #cbd5e1' : 'none',
    launcherBorder: isLight ? '1px solid #cbd5e1' : 'none'
  };
}
