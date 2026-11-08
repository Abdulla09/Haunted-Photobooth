export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Contain-fit `content` inside `viewport`, centered, preserving aspect ratio. */
export function fitRect(viewport: Size, content: Size): Rect {
  if (viewport.w <= 0 || viewport.h <= 0 || content.w <= 0 || content.h <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const scale = Math.min(viewport.w / content.w, viewport.h / content.h);
  const w = content.w * scale;
  const h = content.h * scale;
  return { x: (viewport.w - w) / 2, y: (viewport.h - h) / 2, w, h };
}
