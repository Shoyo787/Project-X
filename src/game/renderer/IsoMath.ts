export const TILE_WIDTH = 68;
export const TILE_HEIGHT = 34;
export const Z_SCALE = 30;
export const INK_COLOR = '#2b2623';

export interface ScreenPoint {
  x: number;
  y: number;
}

export function gridToScreen(
  col: number,
  row: number,
  z: number,
  originX: number,
  originY: number,
): ScreenPoint {
  return {
    x: originX + (col - row) * (TILE_WIDTH * 0.5),
    y: originY + (col + row) * (TILE_HEIGHT * 0.5) - z * Z_SCALE,
  };
}

export function screenToGrid(
  screenX: number,
  screenY: number,
  originX: number,
  originY: number,
): { col: number; row: number } {
  const dx = screenX - originX;
  const dy = screenY - originY;
  const halfW = TILE_WIDTH * 0.5;
  const halfH = TILE_HEIGHT * 0.5;

  const colFloat = (dx / halfW + dy / halfH) * 0.5;
  const rowFloat = (dy / halfH - dx / halfW) * 0.5;

  return {
    col: Math.round(colFloat),
    row: Math.round(rowFloat),
  };
}

export function drawIsoTile(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
  depth: number,
  strokeColor = INK_COLOR,
  lineWidth = 1.4,
): void {
  const hw = w * 0.5;
  const hh = h * 0.5;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;

  if (depth > 0) {
    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + depth);
    ctx.lineTo(cx - hw, cy + depth);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(cx, cy + hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx + hw, cy + depth);
    ctx.lineTo(cx, cy + hh + depth);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.stroke();
  }

  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  height: number,
  topColor: string,
  leftColor: string,
  rightColor: string,
  lineWidth = 1.6,
  strokeColor = INK_COLOR,
): void {
  const topY = cy - height;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;

  // Left visible side face
  ctx.beginPath();
  ctx.moveTo(cx - rx, topY);
  ctx.lineTo(cx, topY + ry);
  ctx.lineTo(cx, cy + ry);
  ctx.lineTo(cx - rx, cy);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.stroke();

  // Right visible side face
  ctx.beginPath();
  ctx.moveTo(cx, topY + ry);
  ctx.lineTo(cx + rx, topY);
  ctx.lineTo(cx + rx, cy);
  ctx.lineTo(cx, cy + ry);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.stroke();

  // Top diamond cap
  ctx.beginPath();
  ctx.moveTo(cx, topY - ry);
  ctx.lineTo(cx + rx, topY);
  ctx.lineTo(cx, topY + ry);
  ctx.lineTo(cx - rx, topY);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function drawIsoPyramid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  height: number,
  leftColor: string,
  rightColor: string,
  lineWidth = 1.6,
  strokeColor = INK_COLOR,
): void {
  const apexX = cx;
  const apexY = cy - height;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;

  // Left-front triangle
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx, cy + ry);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.stroke();

  // Right-front triangle
  ctx.beginPath();
  ctx.moveTo(cx, cy + ry);
  ctx.lineTo(cx + rx, cy);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function drawIsoEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusTiles: number,
  strokeColor: string,
  fillColor: string | null,
  lineWidth = 1.8,
  dashed = false,
): void {
  const radiusX = radiusTiles * TILE_WIDTH * Math.SQRT1_2;
  const radiusY = radiusTiles * TILE_HEIGHT * Math.SQRT1_2;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (dashed) {
    ctx.setLineDash([7, 5]);
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}
