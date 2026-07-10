"use client";

import React from 'react';
import { cn } from '@/utils';
import Wrapper from '../global/wrapper';
import SectionBadge from '../ui/section-badge';
import { motion } from 'framer-motion';
import { WORKFLOW_STEPS } from '@/constants/workflow';
import Image from 'next/image';

const Workflow = () => {
    return (
        <section id="workflow" className="w-full py-16 lg:py-24 relative overflow-hidden">

            <div className="hidden lg:block absolute -z-10 top-0 -right-1/4 size-1/3 bg-primary/10 rounded-full blur-[8rem]" />

            <Wrapper>
                <div className="flex flex-col items-center text-center">
                    <SectionBadge title="Workflow" />

                    <motion.h2
                        className="title mt-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        Chaos to clarity
                        <br />
                        in three steps
                    </motion.h2>

                    <motion.p
                        className="desc mt-4"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        Get your team on the same page with Avento OS
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-y-16 md:gap-y-8 gap-x-8 lg:gap-x-16 mx-auto relative mt-12">
                    {WORKFLOW_STEPS.map((step, index) => (
                        <React.Fragment key={index}>
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{
                                    duration: 0.6,
                                    delay: 0.4 + index * 0.2,
                                    ease: [0.16, 1, 0.3, 1]
                                }}
                                className="flex flex-col items-center text-center relative"
                            >
                                <div className={cn(
                                    "text-[120px] md:text-[140px] font-bold leading-none",
                                    "bg-linear-to-b from-primary/40 to-primary/0",
                                    "text-transparent bg-clip-text select-none"
                                )}>
                                    {step.number}
                                </div>

                                <div className="-mt-8 flex flex-col items-center">
                                    <h3 className="text-xl md:text-2xl font-semibold">
                                        {step.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground text-balance max-w-[280px] leading-relaxed mt-1">
                                        {step.description}
                                    </p>
                                </div>

                                {index < WORKFLOW_STEPS.length - 1 && (
                                    <motion.div
                                        className="flex md:hidden relative my-2 -bottom-8 rotate-90"
                                        initial={{ opacity: 0, y: -10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.6, delay: 0.6 + index * 0.2 }}
                                    >
                                        <Image
                                            src="/icons/arrow.svg"
                                            alt="arrow"
                                            width={24}
                                            height={24}
                                            className="w-12 h-auto opacity-80 object-contain"
                                        />
                                    </motion.div>
                                )}
                            </motion.div>

                            {index < WORKFLOW_STEPS.length - 1 && (
                                <motion.div
                                    className="hidden md:flex absolute top-1/2 -translate-y-1/2"
                                    style={{
                                        left: `calc(${(index + 1) * 33.333}% + ${index === 0 ? '-1.5rem' : '0.5rem'})`
                                    }}
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6, delay: 0.6 + index * 0.2 }}
                                >
                                    <Image
                                        src="/icons/arrow.svg"
                                        alt="arrow"
                                        width={24}
                                        height={24}
                                        className="w-12 h-auto opacity-80 object-contain"
                                    />
                                </motion.div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </Wrapper>
        </section>
    );
};

export default Workflow;
