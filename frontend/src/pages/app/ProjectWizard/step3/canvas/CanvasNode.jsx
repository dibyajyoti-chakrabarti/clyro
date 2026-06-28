import CloudFrontLogo from "../../../../../assets/aws_logos/CloudFront.svg";
import ElastiCacheLogo from "../../../../../assets/aws_logos/ElastiCache.svg";
import FargateLogo from "../../../../../assets/aws_logos/Fargate.svg";
import RDSLogo from "../../../../../assets/aws_logos/RDS.svg";
import SQSLogo from "../../../../../assets/aws_logos/Simple Queue Service.svg";

const resolveIcon = (node) => {
  const label =
    `${node.label ?? ""} ${node.aws ?? ""} ${node.type ?? ""}`.toLowerCase();
  if (
    label.includes("cloudfront") ||
    label.includes("s3") ||
    label.includes("frontend") ||
    label.includes("react")
  )
    return { icon: CloudFrontLogo, service: "CloudFront" };
  if (
    label.includes("elasticache") ||
    label.includes("redis") ||
    label.includes("cache")
  )
    return { icon: ElastiCacheLogo, service: "ElastiCache" };
  if (
    label.includes("rds") ||
    label.includes("postgres") ||
    label.includes("database")
  )
    return { icon: RDSLogo, service: "RDS" };
  if (
    label.includes("sqs") ||
    label.includes("queue") ||
    label.includes("task queue")
  )
    return { icon: SQSLogo, service: "SQS" };
  return { icon: FargateLogo, service: "Fargate" };
};

const accentByNode = (node) => {
  const label =
    `${node.label ?? ""} ${node.aws ?? ""} ${node.type ?? ""}`.toLowerCase();
  if (
    label.includes("cloudfront") ||
    label.includes("s3") ||
    label.includes("frontend") ||
    label.includes("react")
  )
    return "#8B5CF6";
  if (
    label.includes("elasticache") ||
    label.includes("redis") ||
    label.includes("cache")
  )
    return "#EF4444";
  if (
    label.includes("rds") ||
    label.includes("postgres") ||
    label.includes("database")
  )
    return "#3B82F6";
  if (
    label.includes("sqs") ||
    label.includes("queue") ||
    label.includes("task queue")
  )
    return "#F59E0B";
  if (label.includes("celery") || label.includes("worker")) return "#F97316";
  return "#10B981";
};

export default function CanvasNode({
  node,
  isSelected,
  position,
  accentByType,
  iconByType,
  onClick,
}) {
  const { icon } = resolveIcon(node);
  const accent = accentByNode(node);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        borderColor: isSelected ? accent : `${accent}55`,
        boxShadow: isSelected
          ? `0 0 0 1px ${accent}22 inset, 0 0 20px ${accent}28, 0 16px 36px rgba(0,0,0,0.5)`
          : `0 0 0 1px ${accent}10 inset, 0 4px 24px rgba(0,0,0,0.35), 0 0 12px ${accent}15`,
        backgroundColor: "#16191D",
      }}
      className="absolute w-[220px] rounded-[18px] border text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.015]"
    >
      {/* top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-[18px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}CC, transparent)`,
          opacity: isSelected ? 1 : 0.6,
          transition: "opacity 300ms ease",
        }}
      />

      {/* glass inner highlight */}
      <div
        className="absolute inset-0 rounded-[18px] pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)",
        }}
      />

      {/* status dot */}
      <span
        className="absolute right-3 top-3 h-[7px] w-[7px] rounded-full"
        style={{
          backgroundColor: "#22C55E",
          boxShadow:
            "0 0 0 3px rgba(34,197,94,0.15), 0 0 8px rgba(34,197,94,0.4)",
        }}
      />

      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* icon container */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px]"
          style={{
            backgroundColor: `${accent}18`,
            border: `1px solid ${accent}40`,
            boxShadow: `0 0 16px ${accent}18`,
          }}
        >
          <img src={icon} alt="" className="h-8 w-8 object-contain" />
        </div>

        {/* text */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-semibold leading-5 tracking-[-0.01em]"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {node.label}
          </p>
          <div
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              backgroundColor: `${accent}12`,
              border: `1px solid ${accent}30`,
            }}
          >
            <span
              className="h-1 w-1 rounded-full shrink-0"
              style={{ backgroundColor: accent, opacity: 0.8 }}
            />
            <span
              className="truncate text-[11px] font-medium tracking-wide"
              style={{ color: `${accent}DD` }}
            >
              {node.aws}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

