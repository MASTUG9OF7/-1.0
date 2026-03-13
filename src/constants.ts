export const BUBBLE_RADIUS = 20;
export const GRID_ROWS = 12;
export const GRID_COLS = 10;
export const CANVAS_WIDTH = 440;
export const CANVAS_HEIGHT = 640;

export const ALL_BUBBLE_TYPES = Array.from({ length: 28 }, (_, i) => ({
  id: `type_${i + 1}`,
  color: `hsl(${(i * 360) / 28}, 70%, 50%)`, // Generate distinct colors as fallback
  label: `${i + 1}`,
  icon: `${i + 1}.png`
}));

export const UI_COLORS = {
  primary: '#0047AB', // 圣晶石蓝
  accent: '#D4AF37',  // 灵基辉石金
  background: '#050A1A',
  surface: 'rgba(0, 71, 171, 0.4)',
  border: '#D4AF37',
  text: '#FFFFFF',
  secondaryText: '#B0C4DE',
};
