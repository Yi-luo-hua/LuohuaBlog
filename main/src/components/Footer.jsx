import clsx from "clsx";
import { FaGithub } from "react-icons/fa";
import { SiBilibili } from "react-icons/si";
import { useLocation } from "react-router-dom";

const socialLinks = [
  {
    href: "https://github.com/Yi-luo-hua",
    icon: <FaGithub />,
    label: "GitHub",
  },
  {
    href: "https://space.bilibili.com/313163065",
    icon: <SiBilibili />,
    label: "Bilibili",
  },
];

const footerThemes = {
  default: {
    shell:
      "border-t border-[#F2E6C9] bg-gradient-to-r from-[#FFF8E7] via-[#FFEAF4] to-[#EAF6FF] text-[#2B2B2B]",
    copy: "text-[#5F4B52]",
    icon: "text-[#2B2B2B] hover:text-[#FF8FAB]",
    tip: "border border-[#F2E6C9] bg-white/95 text-[#2B2B2B]",
  },
  bili: {
    shell:
      "border-t border-[#E8DFFB] bg-gradient-to-r from-[#EAF6FF] via-[#FFEAF4] to-[#F3E8FF] text-[#2D2A3A]",
    copy: "text-[#2D2A3A]/85",
    icon: "text-[#2D2A3A] hover:text-[#7C5CFF]",
    tip: "border border-[#E8DFFB] bg-white/95 text-[#2D2A3A]",
  },
  ai: {
    shell: "border-t border-[#F2E6C9] bg-[#FFF8E7] text-[#2B2B2B]",
    copy: "text-[#6B7280]",
    icon: "text-[#2B2B2B] hover:text-[#FF8FAB]",
    tip: "border border-[#F2E6C9] bg-white text-[#2B2B2B]",
  },
  friends: {
    shell:
      "border-t border-[#F2E6C9] bg-gradient-to-r from-[#FFF7ED] via-[#FFFDF7] to-[#EEF7FF] text-[#2B2B2B]",
    copy: "text-[#6B7280]",
    icon: "text-[#5F4B52] hover:text-[#74C0FC]",
    tip: "border border-[#F2E6C9] bg-[#FFFEFA]/95 text-[#5F4B52]",
  },
  moments: {
    shell:
      "border-t border-[#E8DFFB] bg-gradient-to-r from-[#FFFDFD] via-[#FFF4F8] to-[#F1FFFC] text-[#4A4456]",
    copy: "text-[#6A6674]",
    icon: "text-[#4A4456] hover:text-[#9B8FD4]",
    tip: "border border-[#E8DFFB] bg-white/95 text-[#4A4456]",
  },
};

const Footer = () => {
  const { pathname } = useLocation();
  const variant =
    pathname.startsWith("/bangumi") || pathname.startsWith("/bili")
      ? "bili"
      : pathname.startsWith("/ai-traffic")
        ? "ai"
        : pathname.startsWith("/friends")
          ? "friends"
          : pathname.startsWith("/moments")
            ? "moments"
            : "default";
  const theme = footerThemes[variant];

  return (
    <footer className={clsx("w-full py-4 md:py-5", theme.shell)}>
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        <p
          className={clsx(
            "text-center text-sm font-light md:justify-self-start md:text-left",
            theme.copy,
          )}
        >
          @Yi-luo-hua
        </p>

        <div className="flex justify-center gap-5 md:justify-self-center">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "group relative flex items-center gap-2 text-lg transition-colors duration-300 ease-in-out",
                theme.icon,
              )}
            >
              {link.icon}
              <span
                className={clsx(
                  "pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100",
                  theme.tip,
                )}
              >
                {link.label}
              </span>
            </a>
          ))}
        </div>

        <span className="hidden md:block" aria-hidden />
      </div>
    </footer>
  );
};

export default Footer;
