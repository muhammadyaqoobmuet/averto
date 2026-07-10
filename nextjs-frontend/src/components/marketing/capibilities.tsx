"use client";

import { capabilities, stats, AVATAR_ITEMS } from '@/constants/capabilities';
import Wrapper from '@/components/global/wrapper';
import SectionBadge from '@/components/ui/section-badge';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Users, Calendar, FileText, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { AnimatedTooltip } from '@/components/ui/animated-tooltip';
import { cn } from '@/utils';
import { Button } from "../ui/button";
import Image from "next/image";

const Capibilities = () => {
    return (
        <section id="capabilities" className="w-full py-16 lg:py-24 relative overflow-hidden">
            <div className="hidden lg:block absolute -z-10 top-0 -left-1/4 size-1/3 bg-primary/10 rounded-full blur-[8rem]" />

            <Wrapper>
                <div className="flex flex-col items-center text-center">
                    <SectionBadge title="Capabilities" />

                    <motion.h2
                        className="title mt-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                    >
                        Built for how you work
                    </motion.h2>

                    <motion.p
                        className="desc mt-4"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                    >
                        Clients, projects, tasks, and invoices in one clean interface
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-12 max-w-5xl mx-auto">
                    <motion.div
                        className={cn(
                            "lg:col-span-7 relative group",
                            "rounded-xl lg:rounded-2xl p-8 overflow-hidden",
                            "bg-cardbox",
                            "transition-all duration-500"
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                    >

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-semibold">
                                    {capabilities[0].title}
                                </h3>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                {capabilities[0].description}
                            </p>
                        </div>

                        <div className="mt-6 relative grow h-48 transition-colors duration-300 z-0">
                            <Image
                                src={capabilities[0].illustration}
                                alt="Client"
                                width={500}
                                height={500}
                                unoptimized
                                className="w-full mx-auto h-full object-contain object-center z-10"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        className={cn(
                            "lg:col-span-5 relative group",
                            "rounded-xl lg:rounded-2xl p-8 overflow-hidden",
                            "bg-cardbox",
                            "transition-all duration-500"
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                    >

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-semibold">
                                    {capabilities[1].title}
                                </h3>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                {capabilities[1].description}
                            </p>
                        </div>

                        <div className="mt-6 relative grow h-48 transition-colors duration-300 z-0">
                            <Image
                                src={capabilities[1].illustration}
                                alt="Project"
                                width={500}
                                height={500}
                                unoptimized
                                className="w-full mx-auto h-full object-contain object-center z-10"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        className={cn(
                            "lg:col-span-4 relative group",
                            "rounded-xl lg:rounded-2xl p-6 overflow-hidden",
                            "bg-cardbox",
                            "transition-all duration-500"
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.6 }}
                    >

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold">
                                    {capabilities[2].title}
                                </h3>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {capabilities[2].description}
                            </p>
                        </div>

                        <div className="mt-6 relative grow h-48 transition-colors duration-300 z-0">
                            <Image
                                src={capabilities[2].illustration}
                                alt="Team"
                                width={500}
                                height={500}
                                unoptimized
                                className="w-full mx-auto h-full object-contain object-center z-10"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        className={cn(
                            "lg:col-span-4 relative group",
                            "rounded-xl lg:rounded-2xl p-6 overflow-hidden",
                            "bg-cardbox",
                            "transition-all duration-500"
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.7 }}
                    >

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold">
                                    {capabilities[3].title}
                                </h3>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {capabilities[3].description}
                            </p>
                        </div>

                        <div className="mt-6 relative grow h-48 transition-colors duration-300 z-0">
                            <Image
                                src={capabilities[3].illustration}
                                alt="Team"
                                width={500}
                                height={500}
                                unoptimized
                                className="w-full mx-auto h-full object-contain object-center z-10"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        className="lg:col-span-4 flex flex-col gap-4"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 0.8 }}
                    >
                        <motion.div
                            className={cn(
                                "relative group rounded-xl lg:rounded-2xl p-6 overflow-visible",
                                "bg-cardbox",
                                "transition-all duration-500"
                            )}
                        >
                            <div className="relative overflow-visible">
                                <div className="flex overflow-visible">
                                    <AnimatedTooltip items={AVATAR_ITEMS} />
                                </div>
                                <h3 className="text-2xl bg-linear-to-r from-foreground to-foreground/70 text-transparent bg-clip-text font-medium mt-4">
                                    {stats[0]?.value} {stats[0]?.label}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    already using Avento
                                </p>
                            </div>
                        </motion.div>

                        <motion.div
                            className={cn(
                                "relative group rounded-xl lg:rounded-2xl p-6 overflow-hidden",
                                "bg-cardbox",
                                "transition-all duration-500"
                            )}
                        >
                            <div className="relative">
                                <div className="flex items-baseline gap-1">
                                    <h3 className="text-3xl bg-linear-to-r from-foreground to-foreground/70 text-transparent bg-clip-text font-semibold">
                                        {stats[1]?.value} Sends
                                    </h3>
                                </div>
                                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                                    {stats[1]?.description}
                                </p>
                                <Link href="#">
                                    <Button size="sm" variant="outline" className="mt-2">
                                        {stats[1]?.button?.text}
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </Wrapper>
        </section>
    );
};

export default Capibilities;
