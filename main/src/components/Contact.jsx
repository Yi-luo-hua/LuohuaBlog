import AnimatedTitle from "./AnimatedTitle";
import Button from "./Button";

const ImageClipBox = ({ src, clipClass }) => (
  <div className={clipClass}>
    <img src={src} />
  </div>
);

const Contact = () => {
  return (
    <div id="end" className="my-20 min-h-96 w-screen px-10">
      <div className="relative rounded-lg bg-gray-700 py-24 text-white sm:overflow-hidden">
        <div className="absolute -left-20 top-0 hidden h-full w-72 overflow-hidden sm:block lg:left-20 lg:w-96">
          <ImageClipBox
            src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/contact-1.webp"
            clipClass="contact-clip-path-1"
          />
          <ImageClipBox
            src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/contact-2.webp"
            clipClass="contact-clip-path-2 lg:translate-y-40 translate-y-60"
          />
          <p className="absolute top-[45%] left-1/2 -translate-x-1/2 font-zentry text-xl uppercase text-white whitespace-nowrap">
            本站参考来源
            <span className="block text-center text-2xl mt-2">→</span>
          </p>
        </div>

        <div className="absolute -top-40 left-20 w-60 sm:top-1/2 md:left-auto md:right-10 lg:top-20 lg:w-80 hidden md:block">
          <ImageClipBox
            src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/swordman-partial.webp"
            clipClass="absolute md:scale-125"
          />
          <ImageClipBox
            src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/swordman.webp"
            clipClass="sword-man-clip-path md:scale-125"
          />
        </div>

        <div className="flex flex-col items-center text-center">
          <p className="mb-10 font-general text-[10px] uppercase">
            Source of the design
          </p>

          <AnimatedTitle
            title="Adrian<b> </b>H<b>a</b>jdin"
            className="special-font !md:text-[6.2rem] w-full font-zentry !text-5xl !font-black !leading-[.9]"
          />

          <Button
            title="Learn more"
            containerClass="mt-10 cursor-pointer"
            href="https://github.com/adrianhajdin/award-winning-website#introduction"
            target="_blank"
            rel="noopener noreferrer"
          />
        </div>
      </div>
    </div>
  );
};

export default Contact;
