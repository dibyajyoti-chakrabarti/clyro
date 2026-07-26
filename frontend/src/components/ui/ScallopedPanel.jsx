import { useLayoutEffect, useRef, useState } from 'react'
import { generateScallopedRectPath } from '../../utils/scallopedPath'

// Castle-battlement / stepped-notch frame: identical rectangular notches cut
// inward along the top/bottom edges, straight left/right edges, small rounded
// corners. Notches recede inward (never bulge past the container bounds), so
// no outward margin is needed — only enough to keep the stroke from clipping.
const NOTCH_WIDTH = 20
const NOTCH_DEPTH = 11
const CORNER_RADIUS = 12
const STROKE_WIDTH = 2
const MARGIN = STROKE_WIDTH / 2
// Matches the app's --color-surface token — the SVG shape is both the
// stepped border AND the card background, so the notches aren't clipped by a
// separate rounded-rect background/overflow-hidden.
const SURFACE_FILL = '#1c1e26'
const STROKE_COLOR = '#F6B93B'

// Wraps children in a stepped "castle battlement" frame. Sizes the SVG border
// to the measured content box via ResizeObserver, so the notch count and the
// frame itself stay correct as the container resizes (window resize, content
// reflow) or as children grow/shrink (e.g. a resource grid reflowing).
export function ScallopedPanel({ children, className = '', contentClassName = '' }) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const baseWidth = Math.max(size.width - MARGIN * 2, 0)
  const baseHeight = Math.max(size.height - MARGIN * 2, 0)
  const path = generateScallopedRectPath(baseWidth, baseHeight, NOTCH_WIDTH, NOTCH_DEPTH, CORNER_RADIUS)

  return (
    <div ref={wrapRef} className={`relative ${className}`.trim()} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
      {path ? (
        <svg
          className='pointer-events-none absolute inset-0 h-full w-full'
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio='none'
          aria-hidden='true'
        >
          <path d={path} transform={`translate(${MARGIN} ${MARGIN})`} fill={SURFACE_FILL} stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH} />
        </svg>
      ) : null}
      <div className={`relative ${contentClassName}`.trim()}>{children}</div>
    </div>
  )
}
