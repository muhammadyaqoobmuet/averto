"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { cn } from "@/utils";
import Container from "../global/container";
import Wrapper from "../global/wrapper";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

const LOGOS = [
  { name: "Vercel", src: "/icons/companies/logo3.svg" },
  { name: "claude", src: "/icons/companies/logo-my-1.svg" },
  { name: "gemini", src: "/icons/companies/logo-my-2.svg" },
];

const Socials = () => {
  const logoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentSet, setCurrentSet] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextSet = (currentSet + 1) % 2;
      const currentLogos = logoRefs.current.filter(Boolean);

      const tl = gsap.timeline({
        onComplete: () => {
          setCurrentSet(nextSet);

          requestAnimationFrame(() => {
            const newLogos = logoRefs.current.filter(Boolean);
            newLogos.forEach((logo, index) => {
              if (logo) {
                gsap.set(logo, {
                  y: 20,
                  opacity: 0,
                  filter: "blur(10px)",
                });

                gsap.to(logo, {
                  y: 0,
                  opacity: 1,
                  filter: "blur(0px)",
                  duration: 0.6,
                  ease: "power2.out",
                  delay: index * 0.05,
                });
              }
            });
          });
        },
      });

      currentLogos.forEach((logo, index) => {
        if (logo) {
          tl.to(
            logo,
            {
              y: -20,
              opacity: 0,
              filter: "blur(10px)",
              duration: 0.5,
              ease: "power2.in",
            },
            index * 0.05,
          );
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [currentSet]);

  const visibleLogos = LOGOS.slice(currentSet * 6, currentSet * 6 + 6);

  return (
    <section className="w-full py-12">
      <Wrapper>
        <Container animation="fadeUp" className="text-center">
          <p className="text-sm text-transparent font-heading font-medium bg-clip-text bg-linear-to-r from-white/10 via-white/70 to-white/10 uppercase tracking-wider">
            Works seamlessly with
          </p>
        </Container>

        <div
          ref={containerRef}
          className="grid grid-cols-3 max-w-3xl mx-auto mt-6 relative z-0 group h-4"
        >
          {visibleLogos.map((logo, index) => (
            <div
              key={`${currentSet}-${index}`}
              className="h-16 md:h-20 w-full overflow-hidden flex items-center justify-center"
            >
              <div
                ref={(el) => {
                  logoRefs.current[index] = el;
                }}
                className={cn(
                  "w-full h-full",
                  "flex items-center justify-center",
                  "will-change-transform",
                )}
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={140}
                  height={60}
                  className="max-w-[150px] max-h-12 w-auto h-auto object-contain grayscale opacity-70 hover:opacity-100 transition-all duration-300"
                />
              </div>
            </div>
          ))}

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0 flex items-center justify-center backdrop-blur-[2px]">
            <Container
              animation="fadeUp"
              delay={0.2}
              className="text-center flex items-center justify-center size-full select-none"
            >
              <Link
                href="#"
                className="text-sm text-foreground/40 hover:text-foreground/90 flex items-center justify-center gap-1"
              >
                API SUPPORT
                <ChevronRightIcon className="size-3.5" />
              </Link>
            </Container>
          </div>
        </div>

        <Container
          animation="fadeUp"
          delay={0.2}
          className="text-center hidden mt-6"
        >
          <p className="text-sm text-foreground/40">
            Connect your favorite tools in seconds
          </p>
        </Container>
      </Wrapper>
    </section>
  );
};

export default Socials;
