export default function NodePopup({
  selected,
  position,
  chatInputRef,
  setChatInput,
}) {
  return (
    <div
      className="absolute z-20 w-56 rounded-[14px] p-3"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: "#21252A",
        border: "1px solid rgba(255,179,0,0.2)",
        boxShadow:
          "0 0 0 1px rgba(255,179,0,0.05) inset, 0 16px 40px rgba(0,0,0,0.45)",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <p
        className="text-sm font-semibold leading-snug"
        style={{ color: "rgba(255,255,255,0.9)" }}
      >
        {selected.label}
      </p>
      <div className="mt-2 space-y-0.5">
        <p className="text-xs" style={{ color: "#A1A1AA" }}>
          <span style={{ color: "#6B7280" }}>Type </span>
          {selected.type}
        </p>
        <p className="text-xs" style={{ color: "#A1A1AA" }}>
          <span style={{ color: "#6B7280" }}>AWS </span>
          {selected.aws}
        </p>
      </div>
      <div
        className="mt-3 pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          type="button"
          className="text-xs font-medium transition-colors duration-150"
          style={{ color: "#FFB300" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#FFD060";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#FFB300";
          }}
          onClick={() => {
            setChatInput(`Tell me about the ${selected.label}`);
            if (chatInputRef.current) {
              chatInputRef.current.focus();
            }
          }}
        >
          Ask agent about this →
        </button>
      </div>
    </div>
  );
}
