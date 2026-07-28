import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

// Size tokens. `md` is the original form-control sizing (unchanged for existing
// callers); `sm` matches the compact inline controls used in dashboard toolbars.
const SIZES = {
  md: { height: 48, padding: "0 16px", radius: 12, font: 14, menuRadius: 24, itemHeight: 48, itemRadius: 16 },
  sm: { height: 30, padding: "0 10px", radius: 8, font: 13, menuRadius: 12, itemHeight: 32, itemRadius: 8 },
};

export default function GlassSelect({
  options = [],
  value,
  onChange,
  id,
  size = "md",
  ariaLabel,
  placeholder = "Select region",
  className = "",
  style,
}) {
  const t = SIZES[size] ?? SIZES.md;
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const containerRef = useRef(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setOpen((v) => !v);
  };

  const handleSelect = (val) => {
    onChange?.(val);
    setOpen(false);
  };

  const menu = open
    ? createPortal(
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
            zIndex: 99999,
          }}
        >
          <style>{`
            @keyframes dropIn {
              from { opacity: 0; transform: translateY(-6px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div
            style={{
              background: "rgba(3,6,15,0.97)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: `${t.menuRadius}px`,
              padding: "8px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              animation: "dropIn 220ms cubic-bezier(.22,1,.36,1) forwards",
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    width: "100%",
                    height: `${t.itemHeight}px`,
                    padding: t.padding,
                    borderRadius: `${t.itemRadius}px`,
                    border: "none",
                    cursor: "pointer",
                    fontSize: `${t.font}px`,
                    textAlign: "left",
                    outline: "none",
                    background: isSelected
                      ? "rgba(255,196,0,0.15)"
                      : "transparent",
                    color: isSelected ? "#FFC400" : "#e5e7eb",
                    transition: "background 150ms, color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,196,0,0.10)";
                      e.currentTarget.style.color = "#FFC400";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#e5e7eb";
                    }
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Check
                      size={14}
                      style={{ flexShrink: 0, color: "#FFC400" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", flex: size === "sm" ? "0 1 auto" : 1, ...style }}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: size === "sm" ? "6px" : "12px",
          height: `${t.height}px`,
          width: "100%",
          padding: t.padding,
          borderRadius: `${t.radius}px`,
          border: open
            ? "1px solid rgba(251,191,36,0.4)"
            : "1px solid rgba(255,255,255,0.08)",
          background: "rgba(3,6,15,0.90)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: "#e5e7eb",
          fontSize: `${t.font}px`,
          cursor: "pointer",
          outline: "none",
          boxShadow: open
            ? "0 0 0 3px rgba(251,191,36,0.12)"
            : "0 2px 12px rgba(0,0,0,0.18)",
          transition: "border 150ms, box-shadow 150ms",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={size === "sm" ? 14 : 16}
          style={{
            flexShrink: 0,
            color: "#9ca3af",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms",
          }}
        />
      </button>

      {menu}
    </div>
  );
}
