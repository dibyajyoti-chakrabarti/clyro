import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

const STYLES_ID = 'clyro-dropdown-styles'
const INJECTED_CSS = `
  @keyframes clyroDropdownOpen {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  .clyro-dropdown-panel { scrollbar-width: thin; scrollbar-color: rgba(245,166,35,0.45) transparent; }
  .clyro-dropdown-panel::-webkit-scrollbar { width: 10px; }
  .clyro-dropdown-panel::-webkit-scrollbar-track { background: transparent; }
  .clyro-dropdown-panel::-webkit-scrollbar-thumb {
    background: rgba(245,166,35,0.45);
    border-radius: 8px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  .clyro-dropdown-panel::-webkit-scrollbar-thumb:hover { background: rgba(245,166,35,0.7); background-clip: content-box; }
`

// How tall the option list may get, and the smallest height still worth
// showing before the panel flips above the trigger instead.
const MAX_PANEL_HEIGHT = 320
const MIN_PANEL_HEIGHT = 180

const TRIGGER_BASE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  width: '100%',
  padding: '14px 18px',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  border: 'none',
  borderRadius: '12px',
  color: 'white',
  fontSize: '15px',
  textAlign: 'left',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'background 0.2s ease, box-shadow 0.2s ease',
}

const TRIGGER_SHADOW_DEFAULT = [
  '0 0 0 1px rgba(245,166,35,0.15)',
  '0 2px 4px rgba(0,0,0,0.6)',
  '0 8px 24px rgba(0,0,0,0.5)',
  'inset 0 1px 0 rgba(255,200,80,0.18)',
  'inset 0 -1px 0 rgba(0,0,0,0.4)',
].join(', ')

const TRIGGER_SHADOW_ACTIVE = [
  '0 0 0 1px rgba(245,166,35,0.35)',
  '0 4px 12px rgba(0,0,0,0.6)',
  '0 12px 32px rgba(0,0,0,0.5)',
  'inset 0 1px 0 rgba(255,210,100,0.28)',
  'inset 0 -1px 0 rgba(0,0,0,0.5)',
  '0 0 20px rgba(245,166,35,0.08)',
].join(', ')

const TRIGGER_BG_ACTIVE  = 'linear-gradient(160deg, rgba(50,38,12,0.9) 0%, rgba(20,15,5,0.95) 100%)'
const TRIGGER_BG_DEFAULT = 'linear-gradient(160deg, rgba(40,30,10,0.85) 0%, rgba(15,12,5,0.92) 100%)'

/**
 * Custom themed dropdown that replaces native <select>.
 * The options panel is rendered via React Portal into document.body so it
 * floats above every ancestor's overflow/stacking context.
 *
 * Props:
 *   options      – [{ value, label }]
 *   value        – currently selected value string
 *   onChange     – (value: string) => void
 *   placeholder  – shown when nothing is selected
 *   label        – optional label rendered above the trigger
 *   disabled     – grays out and blocks interaction
 */
export default function DropDown({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  label,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  // panelPos holds the fixed-position coordinates computed from the trigger's rect
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0, maxHeight: MAX_PANEL_HEIGHT })

  const triggerRef = useRef(null)
  const panelRef   = useRef(null)

  const selected = options.find((o) => o.value === value) ?? null

  // Inject keyframe + scrollbar CSS once
  useEffect(() => {
    if (document.getElementById(STYLES_ID)) return
    const tag = document.createElement('style')
    tag.id = STYLES_ID
    tag.textContent = INJECTED_CSS
    document.head.appendChild(tag)
  }, [])

  // Close on outside click — must check both trigger and portaled panel
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target)
      const inPanel   = panelRef.current?.contains(e.target)
      if (!inTrigger && !inPanel) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Keep the panel pinned to the trigger when an ancestor scrolls or the window
  // resizes. Scrolling *inside* the panel must be ignored: it is a capture-phase
  // listener, so the panel's own scroll would otherwise reposition/close it and
  // make a long option list impossible to scroll through.
  useEffect(() => {
    if (!open) return
    const reposition = (e) => {
      if (e?.target instanceof Node && panelRef.current?.contains(e.target)) return
      computePos()
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  // Reset focused index when panel opens/closes
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value)
      setFocusedIndex(idx >= 0 ? idx : 0)
    } else {
      setFocusedIndex(-1)
    }
  }, [open, value, options])

  // Scroll focused item into view inside the panel
  useEffect(() => {
    if (!open || focusedIndex < 0 || !panelRef.current) return
    panelRef.current.children[focusedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, focusedIndex])

  // Place the panel below the trigger, or above it when the space below is too
  // tight, and size it to whatever room is actually left on screen.
  const computePos = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const gap = 4
    const margin = 12
    const below = window.innerHeight - rect.bottom - gap - margin
    const above = rect.top - gap - margin
    const dropUp = below < MIN_PANEL_HEIGHT && above > below
    const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, dropUp ? above : below))
    setPanelPos({
      top: dropUp ? Math.max(margin, rect.top - gap - maxHeight) : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
  }

  const toggle = () => {
    if (disabled) return
    if (!open) computePos()
    setOpen((v) => !v)
  }

  const select = (val) => { onChange?.(val); setOpen(false) }

  const handleKeyDown = (e) => {
    if (disabled) return
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open && focusedIndex >= 0) select(options[focusedIndex].value)
        else { computePos(); setOpen(true) }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!open) { computePos(); setOpen(true); break }
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) { computePos(); setOpen(true); break }
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  const isActive = open || hovered

  const triggerStyle = {
    ...TRIGGER_BASE,
    background: isActive ? TRIGGER_BG_ACTIVE : TRIGGER_BG_DEFAULT,
    boxShadow: isActive ? TRIGGER_SHADOW_ACTIVE : TRIGGER_SHADOW_DEFAULT,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  }

  const panelStyle = {
    position: 'fixed',
    top: panelPos.top,
    left: panelPos.left,
    width: panelPos.width,
    zIndex: 99999,
    background: 'rgba(18, 13, 4, 0.82)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    borderRadius: '12px',
    border: '1px solid rgba(245, 166, 35, 0.2)',
    boxShadow: [
      '0 20px 60px rgba(0,0,0,0.85)',
      '0 8px 24px rgba(0,0,0,0.6)',
      'inset 0 1px 0 rgba(255,200,80,0.15)',
      'inset 0 -1px 0 rgba(0,0,0,0.5)',
    ].join(', '),
    maxHeight: `${panelPos.maxHeight ?? MAX_PANEL_HEIGHT}px`,
    overflowY: 'auto',
    overflowX: 'hidden',
    // Stop the wheel from chaining to the page once the list hits its end.
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    paddingBlock: '4px',
    animation: 'clyroDropdownOpen 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {label ? (
        <p
          style={{
            marginBottom: '8px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          {label}
        </p>
      ) : null}

      <button
        ref={triggerRef}
        type='button'
        role='combobox'
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={triggerStyle}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            color: selected ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)',
            fontStyle: selected ? 'normal' : 'italic',
            letterSpacing: '0.01em',
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          style={{
            flexShrink: 0,
            width: '16px',
            height: '16px',
            color: open ? '#f5a623' : 'rgba(255,200,80,0.5)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s ease, color 0.2s ease',
          }}
        />
      </button>

      {open ? createPortal(
        <div
          ref={panelRef}
          role='listbox'
          className='clyro-dropdown-panel'
          style={panelStyle}
          aria-label={label ?? placeholder}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: '11px 14px',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.01em',
              }}
            >
              No options
            </div>
          ) : (
            options.map((opt, idx) => {
              const isSelected = opt.value === value
              const isFocused  = idx === focusedIndex

              const optBackground = isSelected
                ? 'linear-gradient(135deg, rgba(245,166,35,0.22) 0%, rgba(245,166,35,0.10) 100%)'
                : isFocused
                  ? 'linear-gradient(135deg, rgba(245,166,35,0.14) 0%, rgba(245,166,35,0.06) 100%)'
                  : 'transparent'

              const optShadow = isSelected
                ? 'inset 0 1px 0 rgba(255,200,80,0.15), 0 0 0 1px rgba(245,166,35,0.2)'
                : isFocused
                  ? 'inset 0 1px 0 rgba(255,200,80,0.1)'
                  : 'none'

              return (
                <div
                  key={opt.value}
                  role='option'
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    // mousedown so the outside-click handler doesn't race-close before selection
                    e.preventDefault()
                    select(opt.value)
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 14px',
                    fontSize: '14px',
                    letterSpacing: '0.01em',
                    cursor: 'pointer',
                    color: isSelected ? '#f5a623' : 'rgba(255,255,255,0.85)',
                    background: optBackground,
                    boxShadow: optShadow,
                    transition: 'background 0.12s ease, box-shadow 0.12s ease',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {isSelected ? (
                    <Check
                      style={{
                        flexShrink: 0,
                        marginLeft: '8px',
                        width: '13px',
                        height: '13px',
                        color: '#f5a623',
                      }}
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
