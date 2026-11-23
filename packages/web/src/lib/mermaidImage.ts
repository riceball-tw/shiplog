import { register, render } from 'pele/core'
import gantt from 'pele/diagrams/gantt'

register(gantt)

export interface Rendered {
  svg: string
  width: number
  height: number
}

/** Mermaid gantt text -> themeable SVG (CSS variables); throws on invalid text. */
export function renderMermaid(text: string): Rendered {
  const { svg, width, height } = render(text)
  return { svg, width, height }
}

/** Light palette baked into exported images so they read on any white document. */
export const EXPORT_PALETTE: Record<string, string> = {
  bg: '#ffffff',
  fg: '#1f1f1f',
  muted: '#6b6b6b',
  line: '#1f1f1f',
  surface: '#f4f4f5',
  'surface-alt': '#e4e4e7',
  border: '#c4c4cc',
  accent: '#4f6bd8',
  font: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
}

/**
 * Standalone SVG: every `var(--pele-*)` and `var(--_*)` replaced by a concrete value,
 * plus a solid background, so it renders the same in any viewer.
 */
export function standaloneSvg({ svg, width, height }: Rendered, palette = EXPORT_PALETTE): string {
  let s = svg.replace(/var\(--pele-([a-z-]+),([^)]*)\)/g, (_, k: string, fb: string) => palette[k] ?? fb)
  const vars = new Map<string, string>()
  s = s.replace(/--_([a-z]+):([^;"]+);?/g, (_, k: string, v: string) => (vars.set(k, v), ''))
  for (let i = 0; i < 3; i++) s = s.replace(/var\(--_([a-z]+)\)/g, (m, k: string) => vars.get(k) ?? m)
  s = s.replace(/max-width:100%;height:auto;?/, '')
  return s.replace(/(<svg[^>]*>)/, `$1<rect width="${width}" height="${height}" fill="${palette.bg}"/>`)
}

/** Rasterize a standalone SVG to PNG at `scale`x. */
export function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.fillStyle = EXPORT_PALETTE.bg!
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png')
    }
    img.onerror = () => reject(new Error('Could not rasterize the SVG'))
    img.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
