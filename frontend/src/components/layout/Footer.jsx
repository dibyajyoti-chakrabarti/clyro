import clyroLogo from "../../assets/logos/Clyro_logo.png";
import twitterLogo from "../../assets/logos/twitter-fill.svg";
import linkedinLogo from "../../assets/logos/linkedin-box-fill.svg";
import discordLogo from "../../assets/logos/discord-fill.svg";
import GitHubLogo from "../common/GitHubLogo";

const navLinks = [
  "Product",
  "Features",
  "Pricing",
  "Docs",
  "Changelog",
  "About",
  "Contact",
];

const socialLinks = [
  { label: "GitHub", icon: GitHubLogo },
  { label: "Twitter", icon: twitterLogo },
  { label: "LinkedIn", icon: linkedinLogo },
  { label: "Discord", icon: discordLogo },
];

function linkHref(label) {
  return `/${label.toLowerCase()}`;
}

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/[0.08] bg-background text-text-muted">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-5 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10 xl:px-12">
        <a
          href="/"
          className="inline-flex items-center gap-3 text-sm font-semibold text-text-primary transition-colors hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Clyro home"
        >
          <img src={clyroLogo} alt="Clyro Logo" className="h-8 w-auto" />
          <span>Clyro</span>
        </a>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
            {navLinks.map((link) => (
              <li key={link}>
                <a
                  href={linkHref(link)}
                  className="transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="flex items-center gap-3" aria-label="Social links">
          {socialLinks.map((social) => (
            <li key={social.label}>
              <a
                href="/"
                aria-label={social.label}
                className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {typeof social.icon === "string" ? (
                  <img
                    src={social.icon}
                    alt={social.label}
                    className="h-5 w-5 opacity-80 transition-opacity hover:opacity-100"
                  />
                ) : (
                  <social.icon className="h-5 w-5 opacity-80 transition-opacity hover:opacity-100" alt={social.label} />
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
