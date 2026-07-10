"use client";

import { motion } from "framer-motion";
import { AV_MATEO, GRAIN, HERO_BG, REVEAL_EASE } from "./constants";
import { lp } from "./styles";
import { Badge, DarkBtn, OutlineBtn, StarRating, TypewriterCursor } from "./ui";
import Image from "next/image";

const heroFade = (delay: number) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: REVEAL_EASE },
});

export function HeroSection() {
  return (
    <section id="Header" className="relative bg-lp-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-repeat opacity-[0.18] mix-blend-screen"
        style={{
          backgroundImage: `url(${GRAIN})`,
          backgroundSize: "256px 256px",
        }}
      />

      <div className={lp.containerHero}>
        <div className="flex w-full flex-col items-center gap-[15px]">
          <motion.div {...heroFade(0.2)}>
            <Badge label="AI Agent Platform" />
          </motion.div>

          <motion.h1 {...heroFade(0.3)} className={lp.headingHero}>
            Deploy AI agents that work for you, 24/7.
          </motion.h1>

          <motion.p
            {...heroFade(0.5)}
            className="mx-auto max-w-[600px] text-center font-body text-base leading-[1.4] text-lp-muted"
          >
            Averto helps teams build chatbots, voice agents, and workflow
            automations - all in one intelligent platform.
          </motion.p>

          <motion.div
            {...heroFade(0.7)}
            className="flex flex-wrap items-center justify-center gap-2.5 pt-[5px]"
          >
            <DarkBtn href="/signup" label="Get started" />
            <OutlineBtn href="/contact" label="Talk to sales" />
          </motion.div>
        </div>

        <motion.div
          {...heroFade(0.9)}
          className="grid w-full grid-cols-6 gap-[7px] rounded-[15px] border border-dashed border-lp-border p-[7px]"
        >
          {/* Left card — hero visual + chat UI */}
          <div className="relative col-span-4 flex min-h-[350px] flex-col items-center justify-end overflow-hidden rounded-[10px] bg-lp-surface px-[50px] pt-[50px]">
            <img
              src={HERO_BG}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full object-cover object-center"
            />

            <div className="relative z-[2] w-full max-w-[504px] rounded-t-[15px] border bg-[var(--lp-card-bg)] p-5" style={{ borderColor: "var(--lp-card-border)" }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={lp.chip}>GPT 5.5</div>
                  <div className={lp.iconBtn}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--lp-icon-stroke)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <path d="M12 3c-2.5 3-4 6-4 9s1.5 6 4 9" />
                      <path d="M12 3c2.5 3 4 6 4 9s-1.5 6-4 9" />
                    </svg>
                  </div>
                </div>
              </div>

              <TypewriterCursor />

              <div className="flex items-center justify-between">
                <div className="flex gap-[5px]">
                  {[0, 1].map((k) => (
                    <div
                      key={k}
                      className="flex items-center justify-center rounded-2xl border border-dashed border-lp-border bg-black/10 p-2"
                    >
                      {k === 0 ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#262626"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <rect x="9" y="2" width="6" height="12" rx="3" />
                          <path d="M4.5 10.5a7.5 7.5 0 0015 0" />
                          <line x1="12" y1="18" x2="12" y2="22" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#262626"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <line x1="8" y1="12" x2="21" y2="12" />
                          <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-[5px]">
                  <div className="flex items-center justify-center rounded-[30px] border border-dashed border-lp-border bg-black/5 p-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#262626"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <line x1="12" y1="2" x2="12" y2="22" />
                      <line x1="8" y1="5" x2="16" y2="5" />
                      <line x1="6" y1="9" x2="18" y2="9" />
                      <line x1="4.5" y1="13" x2="19.5" y2="13" />
                      <line x1="6" y1="17" x2="18" y2="17" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                    </svg>
                  </div>
                  <div className="flex size-[35px] items-center justify-center rounded-[30px] bg-lp-dark">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l14-8-5 8 5 8-14-8z" fill="white" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right card — testimonial */}
          <div className="col-span-2 flex flex-col justify-between gap-[50px] rounded-[10px] border border-dashed border-lp-border bg-lp-surface p-[30px]">
            <div className="flex flex-col gap-[15px]">
              <StarRating rating="4.9" />
              <p className="font-display text-[17px] leading-[1.3] font-medium tracking-[-0.02em] text-lp-dark">
                &ldquo;Averto replaced our automation workflows and gave our
                team real-time visibility across every customer touch.&rdquo;
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-dashed border-lp-border p-2.5">
              <Image
                src={AV_MATEO}
                alt="Mateo Alvarez"
                width={50}
                height={50}
                className="size-[50px] shrink-0 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="font-display text-sm leading-[1.1] font-medium tracking-[-0.5px] text-lp-text">
                  M.YAQOOB
                </p>
                <p className="mt-0.5 font-body text-[11px] text-lp-muted">
                  FULL STACK DEVELOPER
                </p>
              </div>
              <a
                href="https://x.com/jackub_halepoto"
                target="_blank"
                rel="noopener"
                className="flex size-[38px] shrink-0 items-center justify-center rounded-full border border-dashed border-lp-border bg-lp-bg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4.5 3.75L9 9.75L4.5 16.5H9L12 12.75L15 16.5H19.5L15 9.75L19.5 3.75H15L12 7.5L9 3.75Z"
                    stroke="var(--lp-muted)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
