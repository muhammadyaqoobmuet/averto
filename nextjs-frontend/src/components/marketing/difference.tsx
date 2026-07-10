"use client";

import { AVENTO_FEATURES, OTHER_TOOLS } from '@/constants/difference';
import { motion } from 'framer-motion';
import Icons from "@/components/global/icons";
import Wrapper from '@/components/global/wrapper';
import SectionBadge from '@/components/ui/section-badge';

const Difference = () => {
    return (
        <section id="difference" className="w-full py-16 lg:py-24 relative overflow-hidden">
            <Wrapper>
                <div className="flex flex-col items-center text-center">
                    <SectionBadge title="The Difference" />

                    <motion.h2
                        className="title mt-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        Where Avento stands out
                    </motion.h2>

                    <motion.p
                        className="desc mt-4"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        Most tools cater to big teams or chaotic workflows
                    </motion.p>
                </div>

                <div className="relative max-w-5xl mx-auto mt-12">
                    <motion.div
                        className="grid lg:grid-cols-2 gap-16 lg:gap-28 relative"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="flex flex-col gap-y-6">
                            <motion.h3
                                className="text-2xl font-medium text-foreground/60 text-center"
                                initial={{ opacity: 0, y: -20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.4 }}
                            >
                                Other tools
                            </motion.h3>

                            <div className="space-y-3 relative">
                                {OTHER_TOOLS.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 15 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{
                                            duration: 0.5,
                                            delay: 0.2 + index * 0.1,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-foreground/5 backdrop-blur-sm hover:bg-foreground/8 border border-foreground/5 hover:border-foreground/10 transition-all duration-300 cursor-pointer"
                                    >
                                        <div className="size-1.5 rounded-full shrink-0 bg-red-500/70" />
                                        <span className="text-sm text-foreground/70 leading-relaxed">
                                            {item}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-y-6">
                            <motion.h3
                                className="text-2xl font-medium text-primary text-center"
                                initial={{ opacity: 0, y: -20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.4 }}
                            >
                                Avento
                            </motion.h3>

                            <div className="space-y-3 relative">
                                {AVENTO_FEATURES.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        viewport={{ once: true }}
                                        transition={{
                                            duration: 0.5,
                                            delay: 0.2 + index * 0.1,
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/7.5 backdrop-blur-sm hover:bg-primary/10 border border-primary/10 hover:border-primary/20 transition-all duration-300 cursor-pointer"
                                    >
                                        <div className="size-1.5 rounded-full shrink-0 bg-primary shadow-[0_0_8px_rgba(0,85,255,0.6)]" />
                                        <span className="text-sm text-foreground/90 leading-relaxed">
                                            {item}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center justify-center lg:pt-14">
                        <div className="absolute inset-y-0 h-full w-px bg-linear-to-b from-transparent via-primary/30 to-transparent" />

                        <motion.div
                            className="relative z-10 size-14 rounded-full bg-background border-2 border-primary/40 flex items-center justify-center shadow-[0_0_30px_rgba(0,85,255,0.4)]"
                            initial={{ scale: 0, rotate: -180 }}
                            whileInView={{ scale: 1, rotate: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Icons.icon className="size-5 text-foreground/80 mb-0.5 mr-0.5" />

                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-primary/30"
                                animate={{
                                    scale: [1, 1.4, 1],
                                    opacity: [0.6, 0, 0.6],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                }}
                            />
                        </motion.div>
                    </div>
                </div>
            </Wrapper>
        </section>
    );
};

export default Difference;


