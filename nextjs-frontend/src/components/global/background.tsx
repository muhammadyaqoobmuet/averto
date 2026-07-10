import Image from "next/image";

const Background = () => {
  return (
    <div className="w-full h-dvh absolute top-0 left-0 z-0 overflow-hidden">
      <div className="absolute top-0 inset-x-0 w-1/4 mx-auto h-1/4 blur-[8rem] bg-primary/30"></div>

      <div
        className="absolute inset-0 w-screen h-screen -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.1) 1.35px, transparent 1.35px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)",
        }}
      ></div>

      <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-20" />

      <div className="hidden lg:block absolute top-40 left-20 w-72 h-72 bg-primary/10 rounded-full blur-[100px] -z-20" />
      <div className="hidden lg:block absolute top-60 right-20 w-80 h-80 bg-tertiary/10 rounded-full blur-[100px] -z-20" />
    </div>
  );
};

export default Background;
