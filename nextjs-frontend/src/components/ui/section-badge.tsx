"use client";

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/utils';

interface Props {
    title?: string;
    className?: string;
}

const SectionBadge = ({ title, className }: Props) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
            }}
            className="inline-block relative z-0 select-none"
        >

            <motion.div
                className={cn(
                    "relative z-0 px-4 pt-2 pb-1.5 rounded-full text-xs bg-[linear-gradient(110deg,#a3a3a3,45%,#fafafa,55%,#a3a3a3)] bg-size-[250%_100%] bg-clip-text animate-background-shine text-transparent font-medium uppercase bg-background/5 border-b border-foreground/10 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15),inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-sm overflow-hidden",
                    // "relative z-0 px-4 pt-2 pb-1.5 rounded-full text-xs bg-[linear-gradient(110deg,#0055ff,45%,#bfdbfe,55%,#0055ff)] bg-size-[250%_100%] bg-clip-text animate-background-shine text-transparent font-medium uppercase bg-background/10 shadow-[inset_0_0_50px_5px_rgba(0,85,255,0.2)] overflow-hidden",
                    className
                )}
                transition={{ duration: 0.2 }}
            >
                <div className="absolute top-0 inset-x-0 h-1.5 w-4/5 mx-auto bg-primary blur-lg"></div>
                {title}
            </motion.div>
        </motion.div>
    );
};

export default SectionBadge;
