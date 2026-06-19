import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, FolderPlus } from "lucide-react";
import { api } from "../../api";
import backgroundImage from "../../assets/create_page_back.webp";
import clyroLogo from "../../assets/logos/Clyro_logo.png";

export default function CreateProject() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreateProject = async (e) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) return;
    setCreatingProject(true);
    setCreateError("");
    try {
      const project = await api.createProject(trimmed);
      navigate(`/app/projects/${project.id}`, { replace: true });
    } catch (err) {
      setCreateError(err.message || "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const goToDashboard = () => navigate("/app/dashboard");

  return (
    <div className="relative h-screen min-h-screen w-screen overflow-x-hidden bg-black">
      {/* Background image layer */}
      <div
        className="absolute inset-0 z-0 bg-black"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Dark readability overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/70 via-black/55 to-black/85" />

      {/* Fixed navbar — 72px, full width, transparent black, subtle bottom border */}
      <nav className="fixed left-0 right-0 top-0 z-50 flex h-[72px] w-full items-center justify-between border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl sm:px-10">
        <button
          type="button"
          onClick={goToDashboard}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <img
            src={clyroLogo}
            alt="Clyro"
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
            Clyro
          </span>
        </button>

        <span className="hidden text-sm font-medium uppercase tracking-widest text-amber-300 sm:block">
          Untitled Project
        </span>

        <button
          type="button"
          onClick={goToDashboard}
          className="group flex items-center gap-1.5 text-xs font-medium text-white/70 transition-colors hover:text-white sm:text-sm"
        >
          <span className="hidden sm:inline">Back to Dashboard</span>
          <ArrowRight className="h-3.5 w-3.5 rotate-180 text-amber-300 transition-transform duration-200 group-hover:-translate-x-0.5" />
        </button>
      </nav>

      {/* Main split layout — starts below navbar */}
      <main className="relative z-10 flex h-full w-full flex-col lg:flex-row">
        {/* Left — empty cinematic space, no content, hidden below lg */}
        <div className="hidden lg:block lg:w-1/2 xl:w-[55%]" />

        {/* Right — hero content, vertically centered, left aligned */}
        <div className="flex w-full flex-1 items-center justify-center px-6 pt-[152px] sm:px-10 lg:w-1/2 lg:flex-none lg:justify-start lg:px-12 xl:w-[45%] xl:px-16">
          <div className="w-full max-w-[520px] text-center lg:text-left">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">
              Create a new
            </p>

            <h1 className="mt-5 inline-flex flex-nowrap whitespace-nowrap text-[52px] font-extrabold leading-[0.9] tracking-tight text-white md:text-[72px] lg:text-[84px] xl:text-[96px]">
              <span>PRO</span>
              <span className="bg-gradient-to-r from-[#F6D27A] via-[#E8B84B] to-[#B8860B] bg-clip-text text-transparent">
                JECT
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-[500px] text-base leading-relaxed text-white/80 lg:mx-0">
              Give your idea a name and take the first step towards building
              something{" "}
              <span className="bg-gradient-to-r from-[#F6D27A] to-[#B8860B] bg-clip-text font-semibold text-transparent">
                extraordinary
              </span>
              .
            </p>

            <form
              onSubmit={handleCreateProject}
              className="mx-auto mt-10 w-full max-w-[500px] lg:mx-0"
            >
              <label
                htmlFor="project-name"
                className="mb-3 block text-xs font-semibold uppercase tracking-[0.15em] text-amber-300/90"
              >
                Project name
              </label>

              <div className="relative">
                <FolderPlus className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-300/70" />
                <input
                  id="project-name"
                  className="h-[72px] w-full rounded-[20px] border border-amber-300/20 bg-black/40 pl-14 pr-5 text-base text-white placeholder:text-white/40 caret-amber-300 backdrop-blur-md transition-[border-color,box-shadow] duration-200 hover:border-amber-300/40 focus-visible:border-amber-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/20"
                  placeholder="Enter project name..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>

              {createError ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-red-400 lg:justify-start">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {createError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!projectName.trim() || creatingProject}
                className="group mt-7 flex h-[72px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#F6D27A] via-[#E8B84B] to-[#D4A017] text-base font-semibold text-black shadow-[0_8px_30px_rgba(212,160,23,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(212,160,23,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 lg:w-[320px]"
              >
                {creatingProject ? "Creating…" : "Next Step"}
                {!creatingProject ? (
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                ) : null}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
