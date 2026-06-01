import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import clyroLogo from "../../assets/logos/Clyro_logo.png";
const navItems = ["Products", "Docs", "Pricing"];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="border-b border-white/[0.08] bg-background/95 text-text-primary backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <a
          href="/"
          className="inline-flex items-center gap-3 rounded-md text-lg font-semibold tracking-normal transition-colors hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Crylo home"
        >
          <img src={clyroLogo} alt="Clyro Logo" className="h-9 w-auto" />
          <span>Clyro</span>
        </a>

        <nav
          className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1 md:flex"
          aria-label="Primary navigation"
        >
          {navItems.map((item) => (
            <a
              key={item}
              href={`/${item.toLowerCase() === "products" ? "" : item.toLowerCase()}`}
              className="rounded-full px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </a>
          <Button size="sm" onClick={() => navigate("/signup")}>
            Start Building
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.03] text-text-primary transition-colors hover:border-amber-300/45 hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className="relative h-4 w-5" aria-hidden="true">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform ${isMenuOpen ? "translate-y-[7px] rotate-45" : ""}`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition-opacity ${isMenuOpen ? "opacity-0" : "opacity-100"}`}
            />
            <span
              className={`absolute bottom-0 left-0 h-0.5 w-5 rounded-full bg-current transition-transform ${isMenuOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
            />
          </span>
        </button>
      </div>

      <div
        id="mobile-navigation"
        className={`${isMenuOpen ? "block" : "hidden"} border-t border-white/[0.08] bg-background/98 md:hidden`}
      >
        <nav
          className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-6"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => (
            <a
              key={item}
              href={`/${item.toLowerCase() === "products" ? "" : item.toLowerCase()}`}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {item}
            </a>
          ))}
          <div className="mt-3 grid gap-2 border-t border-white/[0.08] pt-4">
            <a
              href="/login"
              className="rounded-md px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sign in
            </a>
            <Button size="sm" className="w-full" onClick={() => navigate("/signup")}>
              Start Building
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
