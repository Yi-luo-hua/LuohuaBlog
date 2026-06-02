import { FaGithub, FaEnvelope } from "react-icons/fa";
import { SiBilibili, SiVercel } from "react-icons/si";

const socialLinks = [
  { href: "https://github.com/bistutzyy", icon: <FaGithub />, label: "GitHub" },
  { href: "https://space.bilibili.com/1061280173?spm_id_from=333.1007.0.0", icon: <SiBilibili />, label: "Bilibili" },
  { href: "https://tzyy11.vercel.app/", icon: <SiVercel />, label: "Vercel" },
  { href: "mailto:nzc173236231@gmail.com", icon: <FaEnvelope />, label: "nzc173236231@gmail.com" },
];

const Footer = () => {
  return (
    <footer className="w-screen bg-[#5542ff] py-4 text-black">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
        <p className="text-center text-sm font-light md:text-left">
          @bistutzyy
        </p>

        <div className="flex justify-center gap-4 md:justify-start">
          {socialLinks.map((link, index) => (
            <a
              key={index}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-2 text-black transition-colors duration-500 ease-in-out hover:text-white"
            >
              {link.icon}
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white px-2 py-0.5 text-xs text-black opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                {link.label}
              </span>
            </a>
          ))}
        </div>

        <p className="text-center text-sm font-light md:text-right">
          本站仅作学习使用，感谢开源
        </p>
      </div>
    </footer>
  );
};

export default Footer;
