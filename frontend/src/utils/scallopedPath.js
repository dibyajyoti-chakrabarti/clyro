// Builds an SVG path `d` string for a rectangle whose TOP and BOTTOM edges are
// a "castle battlement" / stepped-notch frame: a repeating series of identical
// rectangular notches cut INWARD from the edge (never bulging past the
// rectangle's bounds), separated by flush flat segments with zero gap between
// them. The LEFT and RIGHT edges are plain straight vertical lines, and the
// corners are small plain rounded-corner arcs.
//
// The path is traced clockwise from the top-left corner. A short flat "leader"
// segment runs from each corner before the notch pattern starts, so the
// stepped pattern never touches/distorts the rounded corners. The notch count
// is derived from the usable edge length so the pattern always tiles evenly
// edge-to-edge with no stretched/partial notch at either end.
//
// Because the notches recede inward rather than bulging outward, the whole
// shape fits exactly within `width`/`height` — callers only need enough extra
// room for the stroke width itself, not for any outward bulge.
export function generateScallopedRectPath(width, height, notchWidth = 20, notchDepth = 11, cornerRadius = 12) {
  if (width <= 0 || height <= 0) return ''

  const cr = Math.max(0, Math.min(cornerRadius, width / 2 - 1, height / 2 - 1))
  const topLen = Math.max(0, width - 2 * cr)
  const leader = Math.min(notchWidth / 2, topLen / 2)
  const patternLen = Math.max(0, topLen - 2 * leader)

  const cycleWidth = notchWidth * 2
  const count = patternLen > 0 ? Math.max(1, Math.round(patternLen / cycleWidth)) : 0
  const unitWidth = count > 0 ? patternLen / count / 2 : 0

  // One edge's worth of notch commands, walking `x` from its start to its end
  // (dx is +unitWidth for the top edge's left->right walk, -unitWidth for the
  // bottom edge's right->left walk). `baseY` is the flush edge level and
  // `notchY` is the receded (inward) level.
  const buildNotches = (startX, baseY, notchY, dx) => {
    const cmds = []
    let x = startX
    for (let i = 0; i < count; i++) {
      cmds.push(`L ${x} ${notchY}`)
      x += dx
      cmds.push(`L ${x} ${notchY}`)
      cmds.push(`L ${x} ${baseY}`)
      x += dx
      cmds.push(`L ${x} ${baseY}`)
    }
    return { cmds, endX: x }
  }

  const parts = [`M ${cr} 0`]

  // top edge: left -> right, flush leader then inward notches then flush trailer
  parts.push(`L ${cr + leader} 0`)
  const top = buildNotches(cr + leader, 0, notchDepth, unitWidth)
  parts.push(...top.cmds)
  parts.push(`L ${width - cr} 0`)

  // top-right corner
  parts.push(`A ${cr} ${cr} 0 0 1 ${width} ${cr}`)

  // right edge: top -> bottom, straight
  parts.push(`L ${width} ${height - cr}`)

  // bottom-right corner
  parts.push(`A ${cr} ${cr} 0 0 1 ${width - cr} ${height}`)

  // bottom edge: right -> left, mirrors the top edge's pattern
  parts.push(`L ${width - cr - leader} ${height}`)
  const bottom = buildNotches(width - cr - leader, height, height - notchDepth, -unitWidth)
  parts.push(...bottom.cmds)
  parts.push(`L ${cr} ${height}`)

  // bottom-left corner
  parts.push(`A ${cr} ${cr} 0 0 1 0 ${height - cr}`)

  // left edge: bottom -> top, straight
  parts.push(`L 0 ${cr}`)

  // top-left corner
  parts.push(`A ${cr} ${cr} 0 0 1 ${cr} 0`)
  parts.push('Z')

  return parts.join(' ')
}
