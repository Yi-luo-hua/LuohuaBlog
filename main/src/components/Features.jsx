import { useState, useRef } from "react";
import { TiLocationArrow } from "react-icons/ti";

export const BentoTilt = ({ children, className = "" }) => {
  const [transformStyle, setTransformStyle] = useState("");
  const itemRef = useRef(null);

  const handleMouseMove = (event) => {
    if (!itemRef.current) return;

    const { left, top, width, height } =
      itemRef.current.getBoundingClientRect();

    const relativeX = (event.clientX - left) / width;
    const relativeY = (event.clientY - top) / height;

    const tiltX = (relativeY - 0.5) * 5;
    const tiltY = (relativeX - 0.5) * -5;

    const newTransform = `perspective(700px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(.95, .95, .95)`;
    setTransformStyle(newTransform);
  };

  const handleMouseLeave = () => {
    setTransformStyle("");
  };

  return (
    <div
      ref={itemRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform: transformStyle }}
    >
      {children}
    </div>
  );
};

export const BentoCard = ({ src, title, description, linkUrl, linkText }) => {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [hoverOpacity, setHoverOpacity] = useState(0);
  const hoverButtonRef = useRef(null);

  const handleMouseMove = (event) => {
    if (!hoverButtonRef.current) return;
    const rect = hoverButtonRef.current.getBoundingClientRect();

    setCursorPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const handleMouseEnter = () => setHoverOpacity(1);
  const handleMouseLeave = () => setHoverOpacity(0);

  return (
    <div className="relative size-full">
      <video
        src={src}
        loop
        muted
        autoPlay
        className="absolute left-0 top-0 size-full object-cover object-center"
      />
      <div className="relative z-10 flex size-full flex-col justify-between p-4 md:p-5 text-blue-50">
        <div className="inline-block rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm max-w-full">
          <h1 className="bento-title special-font text-yellow-300 text-xl sm:text-2xl md:text-6xl !leading-tight break-words">{title}</h1>
          {description && (
            <p className="mt-3 text-xs md:text-base text-white font-semibold break-words">{description}</p>
          )}
        </div>

        {linkUrl && (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer">
            <div
              ref={hoverButtonRef}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="border-hsla relative flex w-fit cursor-pointer items-center gap-1 overflow-hidden rounded-full bg-yellow-400 px-5 py-2 text-xs uppercase text-black font-bold"
            >
              <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
                style={{
                  opacity: hoverOpacity,
                  background: `radial-gradient(100px circle at ${cursorPosition.x}px ${cursorPosition.y}px, #fbbf24cc, #f59e0b66)`,
                }}
              />
              <TiLocationArrow className="relative z-20" />
              <p className="relative z-20">{linkText}</p>
            </div>
          </a>
        )}
      </div>
    </div>
  );
};

const COS =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main";

const Features = () => (
  <section className="bg-black pb-52">
    <div className="container mx-auto px-3 md:px-10">
      <div className="px-5 py-32">
        <p className="font-circular-web text-lg text-blue-50">
          There will be three hidden surprises here
        </p>
      </div>

      <BentoTilt className="border-hsla relative mb-7 h-96 w-full overflow-hidden rounded-md md:h-[65vh]">
        <BentoCard
          src={`${COS}/videos/feature-1.mp4`}
          title={<>导<b>航</b>站</>}
          description="个人导航页，常用链接与工具一站直达。"
          linkUrl="https://chengzi-two.vercel.app/"
          linkText="Let's go! 导航站"
        />
      </BentoTilt>

      <div className="grid h-[135vh] w-full grid-cols-2 grid-rows-3 gap-7">
        <BentoTilt className="bento-tilt_1 row-span-1 md:col-span-1 md:row-span-2">
          <BentoCard
            src={`${COS}/videos/feature-2.mp4`}
            title={<>Frag<b>m</b>ented Solitude</>}
            description="A gentle corner dedicated to casual thoughts, everyday whims, and transient sparks of inspiration. Whispering stories to the wind, captured in the warmth of passing days."
            linkUrl="/blog/"
            linkText="Enter Garden"
          />
        </BentoTilt>

        <BentoTilt className="bento-tilt_1 row-span-1 ms-32 md:col-span-1 md:ms-0">
          <BentoCard
            src={`${COS}/videos/feature-3.mp4`}
            title={<>The Chr<b>o</b>nicles of Creation</>}
            description="A minimalist sanctuary detailing full-stack engineering milestones, digital circuit layouts, and the architecture of hardware logic. Where wild ideas shape into reality, code by code."
            linkUrl="/build/"
            linkText="Access Lab"
          />
        </BentoTilt>

        <BentoTilt className="bento-tilt_1 me-14 md:col-span-1 md:me-0">
          <BentoCard
            src={`${COS}/videos/feature-4.mp4`}
            title={<>Rei<b>m</b>u</>}
            description="A Reimu-themed blog space for thoughts, stories, and inspiration."
            linkUrl="https://blog1-reimu.vercel.app/"
            linkText="Let's go! 博客3"
          />
        </BentoTilt>

        <BentoTilt className="bento-tilt_2">
          <div className="flex size-full flex-col justify-between bg-violet-300 p-5">
            <h1 className="bento-title special-font max-w-64 text-black">
              M<b>o</b>re co<b>m</b>ing s<b>o</b>on.
            </h1>

            <TiLocationArrow className="m-5 scale-[5] self-end" />
          </div>
        </BentoTilt>

        <BentoTilt className="bento-tilt_2">
          <video
            src={`${COS}/videos/feature-5.mp4`}
            loop
            muted
            autoPlay
            className="size-full object-cover object-center"
          />
        </BentoTilt>
      </div>
    </div>
  </section>
);

export default Features;
