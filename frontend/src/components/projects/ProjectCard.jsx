import {
  ArrowUpRight,
  Trash2,
  Folder,
  Rocket,
  AlertTriangle,
  Loader2,
  Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import ProjectStatusBadge from "./ProjectStatusBadge";
import GitHubLogo from "../common/GitHubLogo";
import { hasInfra } from "../../lib/projectStatus";

function formatDate(value) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProjectCard({ project, onDelete, onManage, deleting = false }) {
  const status = deleting ? "deleting" : project.status || "default";
  const canManage = hasInfra(status) && !deleting;
  const iconClassName = "h-5 w-5";

  const renderProjectIcon = () => {
    if (status === "live") {
      return (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-green-500/20 bg-green-500/10 text-green-400 shadow-[0_8px_24px_rgba(34,197,94,0.12)]">
          <Rocket className={iconClassName} />
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_8px_24px_rgba(239,68,68,0.12)]">
          <AlertTriangle className={iconClassName} />
        </div>
      );
    }

    if (status === "repo_connected") {
      return (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 shadow-[0_8px_24px_rgba(59,130,246,0.12)]">
          <GitHubLogo className="h-5 w-5" />
        </div>
      );
    }

    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-300/20 to-yellow-500/10 text-amber-400 shadow-[0_8px_24px_rgba(251,191,36,0.12)]">
        <Folder
          className="h-5 w-5"
          strokeWidth={2.2}
          fill="currentColor"
          fillOpacity={0.15}
        />
      </div>
    );
  };

  return (
    <article className="group rounded-2xl border border-white/[0.08] bg-surface/40 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 hover:shadow-[0_20px_70px_rgba(251,191,36,0.12)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {renderProjectIcon()}

          <div className="min-w-0 space-y-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-text-primary">
                {project.name}
              </h3>

              <p className="mt-1 text-sm text-text-muted">
                {project.description ||
                  project.repo_full_name ||
                  "No description available."}
              </p>
            </div>

            <ProjectStatusBadge status={status} />
          </div>
        </div>

        <div className="flex items-center gap-5 md:shrink-0">
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Updated
            </p>

            <p className="mt-1 text-sm text-text-primary">
              {formatDate(
                project.updated_at || project.updatedAt || project.modified_at,
              )}
            </p>

            <p className="mt-1 text-xs text-text-muted">
              {project.environment || "Environment not set"}
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              aria-label="Manage infrastructure"
              onClick={() => onManage?.(project)}
              className="flex items-center justify-center text-text-muted transition-all duration-200 hover:scale-110 hover:text-amber-300"
            >
              <Settings2 strokeWidth={2.2} className="h-6 w-6" />
            </button>
          )}

          <button
            type="button"
            aria-label={deleting ? "Deleting project" : "Delete project"}
            disabled={deleting}
            onClick={() => onDelete?.(project)}
            className="flex items-center justify-center text-red-400 transition-all duration-200 hover:scale-110 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {deleting ? (
              <Loader2 strokeWidth={2.2} className="h-6 w-6 animate-spin" />
            ) : (
              <Trash2 strokeWidth={2.2} className="h-6 w-6" />
            )}
          </button>

          <Link
            to={`/app/projects/${project.id}`}
            className="flex items-center justify-center text-amber-400 transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 hover:text-amber-300"
          >
            <ArrowUpRight strokeWidth={2.3} className="h-7 w-7" />
          </Link>
        </div>
      </div>
    </article>
  );
}
