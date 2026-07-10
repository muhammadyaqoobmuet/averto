"use client";

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Logo } from "../marketing/logo";

const LoadingScreen = () => {

    const [isLoading, setIsLoading] = useState<boolean>(true);

    const overlayRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const progressFillRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const overlay = overlayRef.current;
        const progressBar = progressBarRef.current;
        const progressFill = progressFillRef.current;
        const logo = logoRef.current;

        if (!overlay || !progressBar || !progressFill || !logo) return;

        const tl = gsap.timeline({
            onComplete: () => {
                setTimeout(() => {
                    setIsLoading(false);
                }, 0);
            }
        });

        tl.set(overlay, { opacity: 1 })
            .set(progressBar, { opacity: 0, y: 20 })
            .set(logo, { opacity: 0, x: 100 })
            .set(progressFill, { scaleX: 0, transformOrigin: 'left' })

            .to(progressBar, {
                opacity: 1,
                y: 0,
                duration: 0.3,
                ease: "power2.out",
                delay: 0.1
            })

            .to(logo, {
                opacity: 1,
                x: 0,
                duration: 0.4,
                ease: "power3.out",
            }, "<0.05")

            .to(progressFill, {
                scaleX: 1,
                duration: 0.8,
                ease: "power2.inOut",
            }, "<")

            .to(overlay, {
                y: '-100%',
                duration: 0.6,
                ease: "power3.inOut",
                delay: 0.05
            });

        return () => {
            tl.kill();
        };
    }, []);

    if (!isLoading) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-10000 bg-background flex items-center justify-center"
            style={{ willChange: 'transform', opacity: 1 }}
        >
            <div className="flex flex-col items-center gap-3">
                <div
                    ref={logoRef}
                    style={{
                        willChange: 'transform, opacity',
                        opacity: 0,
                        transform: 'translateX(100px)'
                    }}
                >
                    <Logo showText={false} iconClassName="h-6 w-auto text-foreground" />
                </div>

                <div
                    ref={progressBarRef}
                    className="w-28 md:w-40 h-1 bg-foreground/20 rounded-full overflow-hidden mt-2"
                    style={{
                        willChange: 'transform, opacity',
                        opacity: 0,
                        transform: 'translateY(20px)'
                    }}
                >
                    <div
                        ref={progressFillRef}
                        className="h-full bg-foreground rounded-full"
                        style={{
                            willChange: 'transform',
                            transform: 'scaleX(0)',
                            transformOrigin: 'left'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;

