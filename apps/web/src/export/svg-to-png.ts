import { viewBoxSize } from '../preview/view-math.ts';

import type { Size } from '../preview/view-math.ts';

export const MIN_PNG_SCALE: number = 1;
export const MAX_PNG_SCALE: number = 4;

/** Used when an SVG has no view box. */
const FALLBACK_SIZE: Size = { width: 800, height: 600 };

export interface PngOptions {
  /** 1–4: pixels per SVG unit. */
  scale: number;
  /** A CSS color to fill behind the diagram, or null for a transparent PNG. */
  background: string | null;
}

/** The PNG's pixel size for an SVG at `scale`. Throws for a scale outside 1–4. */
export function pngSize(svgSize: Size, scale: number): Size {
  if (!Number.isFinite(scale) || scale < MIN_PNG_SCALE || scale > MAX_PNG_SCALE) {
    throw new Error(`PNG scale must be between 1 and 4, got ${String(scale)}.`);
  }
  return { width: Math.round(svgSize.width * scale), height: Math.round(svgSize.height * scale) };
}

/** The SVG as a standalone document with its natural size, ready to draw into a canvas. */
export function standaloneSvg(svg: string): { markup: string; size: Size } {
  const root: Element = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const box: Size = viewBoxSize(root.getAttribute('viewBox'));
  const size: Size = box.width > 0 ? box : FALLBACK_SIZE;
  root.setAttribute('width', String(size.width));
  root.setAttribute('height', String(size.height));
  root.removeAttribute('style');
  return { markup: new XMLSerializer().serializeToString(root), size };
}

async function loadImage(markup: string): Promise<HTMLImageElement> {
  const image: HTMLImageElement = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  try {
    await image.decode();
  } catch {
    throw new Error('Could not load the diagram for PNG export.');
  }
  return image;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob: Blob | null = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (blob === null) {
    throw new Error('PNG export failed.');
  }
  return blob;
}

/** The rendered SVG as a PNG. Mermaid renders plain SVG text, so the canvas is never tainted. */
export async function svgToPng(svg: string, { scale, background }: PngOptions): Promise<Blob> {
  const { markup, size } = standaloneSvg(svg);
  const { width, height } = pngSize(size, scale);
  const image: HTMLImageElement = await loadImage(markup);
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (context === null) {
    throw new Error('This browser cannot draw a PNG.');
  }
  if (background !== null) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return canvasToBlob(canvas);
}
