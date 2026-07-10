"use client";

import React from 'react';
import Wrapper from '../global/wrapper';
import { Button } from '../ui/button';
import { ArrowRightIcon } from 'lucide-react';
import { Routes } from '@/constants';
import Link from 'next/link';
import { motion, useMotionValue } from 'framer-motion';
import { cn } from '@/utils';
import Balancer from 'react-wrap-balancer';
import Image from 'next/image';
import Container from "../global/container";

const badges = [
    { text: "Project Management", top: "15%", left: "5%" },
    { text: "Client Hub", top: "25%", right: "8%" },
    { text: "Smart Contracts", top: "60%", left: "10%" },
    { text: "Invoice Tracking", top: "70%", right: "18%" },
];

const FloatingBadge = ({ text, top, left, right, index }: { text: string; top: string; left?: string; right?: string; index: number }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
                opacity: 1,
                scale: 1,
                y: [0, -10, 0],
            }}
            transition={{
                opacity: { delay: index * 0.2, duration: 0.5 },
                scale: { delay: index * 0.2, duration: 0.5 },
                y: {
                    duration: 3 + index,
                    repeat: Infinity,
                    ease: "easeInOut",
                }
            }}
            style={{
                x,
                y,
                top,
                left,
                right,
            }}
            className="absolute hidden lg:block z-30"
        >
            <div className="px-3 py-1 rounded-lg border border-foreground/5 backdrop-blur-md">
                <span className="text-base font-handwriting text-foreground/80 whitespace-nowrap select-none">
                    {text}
                </span>
            </div>
        </motion.div>
    );
};

const Hero = () => {

    const badge = "Meet the Avento OS";
    const description = "Stop patching together Notion, Slack, and Excel. Avento creates a single source of truth for your projects, clients, and cash flow";

    return (
        <section className="relative w-full flex items-center justify-center pt-16 lg:pt-32 pb-4 overflow-hidden">
            <Wrapper className="relative z-10">
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className={cn(
                            "flex items-center justify-center gap-2 pl-1.5 pr-2 py-1.5 rounded-full",
                            "badge-glow backdrop-blur-md"
                        )}
                    >
                        <span className={cn(
                            "px-2 py-0.5 text-xs font-semibold rounded-full",
                            "bg-foreground text-background"
                        )}>
                            New
                        </span>
                        <Container words={true} className="w-min flex text-sm text-foreground/80">
                            {badge.split(" ").map((word, index) => (
                                <span className="w-min" key={index}>
                                    {word}&nbsp;
                                </span>
                            ))}
                        </Container>
                    </motion.div>

                    <h1 className="text-4xl md:text-6xl font-semibold tracking-tight font-heading mt-8">
                        <Balancer>
                            {"The OS for High".split(" ").map((word, index) => (
                                <motion.span
                                    initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
                                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                    className="inline-block"
                                    key={index}
                                >
                                    {word}&nbsp;
                                </motion.span>
                            ))}
                            <br />
                            {"Performance Agencies".split(" ").map((word, index) => (
                                <motion.span
                                    initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
                                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: (4 + index) * 0.05 }}
                                    className={cn(
                                        "inline-block",
                                        word === "Performance" && "bg-linear-to-r from-primary via-blue-500 to-primary bg-size-[200%_100%] animate-[shimmer_3s_ease-in-out_infinite] text-transparent bg-clip-text"
                                    )}
                                    key={index}
                                >
                                    {word}&nbsp;
                                </motion.span>
                            ))}
                        </Balancer>
                    </h1>

                    <p className="text-base md:text-lg text-foreground/70 mt-6 max-w-2xl">
                        <Balancer>
                            {description.split(" ").map((word, index) => (
                                <motion.span
                                    initial={{ filter: "blur(10px)", opacity: 0, y: 5 }}
                                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.3 + index * 0.02 }}
                                    className="inline-block"
                                    key={index}
                                >
                                    {word}&nbsp;
                                </motion.span>
                            ))}
                        </Balancer>
                    </p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        className={cn("flex items-center gap-4 flex-wrap justify-center mt-8")}
                    >
                        <Link href={Routes.Register}>
                            <Button size="lg">
                                Start for free
                            </Button>
                        </Link>
                        <Link href={Routes.Home}>
                            <Button size="lg" variant="outline">
                                Get demo
                            </Button>
                        </Link>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, filter: "blur(20px)", y: 30 }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className={cn("mt-10 lg:mt-20 relative")}
                >
                    <div className="relative mx-auto max-w-6xl rounded-2xl md:rounded-[32px] border border-foreground/10 bg-foreground/5 backdrop-blur-lg p-2">
                        <div className="absolute top-1/4 left-1/2 -z-10 w-4/5 h-1/3 -translate-x-1/2 -translate-y-1/2 bg-primary/20 blur-[10rem] opacity-50" />

                        <div className="rounded-lg md:rounded-[24px] border border-foreground/10 bg-background overflow-hidden">
                            <Image
                                src="/landing.png"
                                alt="Landing Preview"
                                width={1713}
                                height={918}
                                priority
                                className="w-full h-auto"
                            />
                        </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 z-20 w-full h-3/4 bg-linear-to-t from-background to-background/0 from-10% pointer-events-none" />

                    <div className="absolute top-0 inset-x-0 w-3/5 mx-auto h-1/10 rounded-full bg-primary blur-[4rem] opacity-40 -z-10"></div>

                    {badges.map((badge, index) => (
                        <FloatingBadge
                            key={index}
                            text={badge.text}
                            top={badge.top}
                            left={badge.left}
                            right={badge.right}
                            index={index}
                        />
                    ))}
                </motion.div>
            </Wrapper>
        </section>
    );
};

export default Hero;

