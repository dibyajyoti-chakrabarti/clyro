export default function CanvasSurface({
  surfaceRef,
  startPan,
  movePan,
  endPan,
  setSelectedNode,
  setChatInput,
  step3ShowBanner,
  onDismissStep3Banner,
  surfaceBounds,
  canvasNodes,
  canvasConnections,
  nodePositions,
  accentByType,
  iconByType,
  selectedNode,
  selected,
  chatInputRef,
  CanvasNode,
  NodePopup,
  zoom = 1.0,
  openChatDrawer,
  handleAskAbout,
}) {
  const scaledW = Math.max((surfaceBounds.width || 800) * zoom, 800 * zoom)
  const scaledH = Math.max((surfaceBounds.height || 520) * zoom, 520 * zoom)
  const contentW = surfaceBounds.width || 800
  const contentH = surfaceBounds.height || 520

  return (
    <>
      <div
        ref={surfaceRef}
        className="relative h-full min-w-0 cursor-grab select-none overflow-auto rounded-[24px] active:cursor-grabbing transition-[opacity,transform,border-color,box-shadow] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]"
        style={{
          backgroundColor: "#1A1D1F",
          backgroundImage: `
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)),
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(rgba(255,179,0,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,179,0,0.08) 1px, transparent 1px)
          `,
          backgroundSize:
            "100% 100%, 20px 20px, 20px 20px, 100px 100px, 100px 100px",
          backgroundPosition: "0 0, center, center, center, center",
          border: "1px solid rgba(255,179,0,0.18)",
          boxShadow: `
            0 0 0 1px rgba(255,179,0,0.05) inset,
            0 12px 40px rgba(0,0,0,0.35)
          `,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "canvasGlassIn 420ms cubic-bezier(.22,1,.36,1) both",
        }}
        onMouseDown={startPan}
        onMouseMove={movePan}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onClick={() => setSelectedNode(null)}
      >
        {step3ShowBanner ? (
          <div className="sticky top-0 z-20 border-b border-[rgba(255,179,0,0.15)] bg-[rgba(255,179,0,0.07)] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#FFB300]">
                Architecture finalized
              </p>
              <button
                type="button"
                className="text-xs text-[rgba(255,179,0,0.6)] hover:text-[#FFB300] transition-colors duration-150"
                onClick={(event) => {
                  event.stopPropagation();
                  onDismissStep3Banner();
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {/* Spacer div — sets scroll dimensions to match zoom level */}
        <div style={{ width: scaledW, height: scaledH, position: "relative" }}>
          {/* Scaled content */}
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              top: 0,
              left: 0,
              width: contentW,
              height: contentH,
              backgroundColor: "transparent",
            }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <marker
                  id="arrow-head"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6.5"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="#6B7280" />
                </marker>
                <marker
                  id="arrow-head-selected"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6.5"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="#FFB300" />
                </marker>
              </defs>
              {(() => {
                const W = 176;
                const H = 74;
                const CORNER = 8;
                const STUB = 16;

                const roundedPath = (pts) => {
                  if (pts.length < 2) return "";
                  if (pts.length === 2) {
                    return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
                  }
                  let d = `M ${pts[0][0]} ${pts[0][1]}`;
                  for (let i = 1; i < pts.length - 1; i++) {
                    const [px, py] = pts[i - 1];
                    const [cx, cy] = pts[i];
                    const [nx, ny] = pts[i + 1];

                    const d1x = cx - px;
                    const d1y = cy - py;
                    const len1 = Math.hypot(d1x, d1y) || 1;
                    const r1 = Math.min(CORNER, len1 / 2);
                    const bx = cx - (d1x / len1) * r1;
                    const by = cy - (d1y / len1) * r1;

                    const d2x = nx - cx;
                    const d2y = ny - cy;
                    const len2 = Math.hypot(d2x, d2y) || 1;
                    const r2 = Math.min(CORNER, len2 / 2);
                    const ax = cx + (d2x / len2) * r2;
                    const ay = cy + (d2y / len2) * r2;

                    d += ` L ${bx} ${by} Q ${cx} ${cy} ${ax} ${ay}`;
                  }
                  const last = pts[pts.length - 1];
                  d += ` L ${last[0]} ${last[1]}`;
                  return d;
                };

                const sidePoint = (rect, side) => {
                  const { x, y } = rect;
                  switch (side) {
                    case "top":
                      return [x + W / 2, y];
                    case "bottom":
                      return [x + W / 2, y + H];
                    case "left":
                      return [x, y + H / 2];
                    case "right":
                      return [x + W, y + H / 2];
                    default:
                      return [x + W / 2, y + H / 2];
                  }
                };

                const stubPoint = (pt, side, dist) => {
                  switch (side) {
                    case "top":
                      return [pt[0], pt[1] - dist];
                    case "bottom":
                      return [pt[0], pt[1] + dist];
                    case "left":
                      return [pt[0] - dist, pt[1]];
                    case "right":
                      return [pt[0] + dist, pt[1]];
                    default:
                      return pt;
                  }
                };

                const pairCounts = {};
                canvasConnections.forEach((c) => {
                  const key = `${c.from}->${c.to}`;
                  pairCounts[key] = (pairCounts[key] || 0) + 1;
                });
                const pairSeen = {};

                return canvasConnections.map((connection, index) => {
                  const fromRect = nodePositions[connection.from];
                  const toRect = nodePositions[connection.to];
                  if (!fromRect || !toRect) return null;

                  const fromCx = fromRect.x + W / 2;
                  const fromCy = fromRect.y + H / 2;
                  const toCx = toRect.x + W / 2;
                  const toCy = toRect.y + H / 2;

                  const dx = toCx - fromCx;
                  const dy = toCy - fromCy;
                  const horizontalDominant = Math.abs(dx) >= Math.abs(dy);

                  let fromSide, toSide;
                  if (horizontalDominant) {
                    fromSide = dx >= 0 ? "right" : "left";
                    toSide = dx >= 0 ? "left" : "right";
                  } else {
                    fromSide = dy >= 0 ? "bottom" : "top";
                    toSide = dy >= 0 ? "top" : "bottom";
                  }

                  const start = sidePoint(fromRect, fromSide);
                  const end = sidePoint(toRect, toSide);
                  const startStub = stubPoint(start, fromSide, STUB);
                  const endStub = stubPoint(end, toSide, STUB);

                  const key = `${connection.from}->${connection.to}`;
                  const total = pairCounts[key];
                  const seenIndex = pairSeen[key] || 0;
                  pairSeen[key] = seenIndex + 1;
                  const offset =
                    total > 1 ? (seenIndex - (total - 1) / 2) * 14 : 0;

                  let points;
                  if (horizontalDominant) {
                    const midX = (startStub[0] + endStub[0]) / 2;
                    points = [
                      start,
                      startStub,
                      [midX, startStub[1] + offset],
                      [midX, endStub[1] + offset],
                      endStub,
                      end,
                    ];
                  } else {
                    const midY = (startStub[1] + endStub[1]) / 2;
                    points = [
                      start,
                      startStub,
                      [startStub[0] + offset, midY],
                      [endStub[0] + offset, midY],
                      endStub,
                      end,
                    ];
                  }

                  // Midpoint of the central segment — away from node edges
                  const labelPt = [
                    (points[2][0] + points[3][0]) / 2,
                    (points[2][1] + points[3][1]) / 2,
                  ];
                  const isActive =
                    selectedNode === connection.from ||
                    selectedNode === connection.to;

                  return (
                    <g key={`${connection.from}-${connection.to}-${index}`}>
                      <path
                        d={roundedPath(points)}
                        fill="none"
                        stroke={isActive ? "#FFB300" : "#6B7280"}
                        strokeWidth={isActive ? "1.75" : "1.5"}
                        strokeOpacity={isActive ? 1 : 0.8}
                        markerEnd={
                          isActive
                            ? "url(#arrow-head-selected)"
                            : "url(#arrow-head)"
                        }
                        style={{
                          transition:
                            "stroke 200ms ease, stroke-opacity 200ms ease",
                        }}
                      />
                      {connection.label ? (
                        <g>
                          <rect
                            x={labelPt[0] - (connection.label.length * 3.5 + 8)}
                            y={labelPt[1] - 16}
                            width={connection.label.length * 7 + 16}
                            height={13}
                            fill="#1A1D1F"
                            rx={3}
                          />
                          <text
                            x={labelPt[0]}
                            y={labelPt[1] - 6}
                            textAnchor="middle"
                            fontSize="10"
                            fontFamily="inherit"
                            fill={isActive ? "#D4D4D8" : "#A1A1AA"}
                            style={{ transition: "fill 200ms ease" }}
                          >
                            {connection.label}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                });
              })()}
            </svg>

            {canvasNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              const isSelected = selectedNode === node.id;

              return (
                <CanvasNode
                  key={node.id}
                  node={node}
                  isSelected={isSelected}
                  position={pos}
                  accentByType={accentByType}
                  iconByType={iconByType}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNode(node.id);
                  }}
                />
              );
            })}

            {selected && nodePositions[selected.id] ? (
              <NodePopup
                selected={selected}
                position={{
                  x: nodePositions[selected.id].x,
                  y: nodePositions[selected.id].y + 68,
                }}
                chatInputRef={chatInputRef}
                setChatInput={setChatInput}
                openChatDrawer={openChatDrawer}
                handleAskAbout={handleAskAbout}
              />
            ) : null}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes canvasGlassIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
