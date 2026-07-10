
"use client";

import { useIsMobile } from "@/hooks";
import { cn } from "@/utils";
import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface ContainerProps {
    children: ReactNode;
    className?: string
    animation?: "fadeUp" | "fadeDown" | "fadeLeft" | "fadeRight" | "scaleUp" | "blurIn" | "slideUp" | "slideDown" | "zoomIn" | "zoomOut" | "rotateIn";
    delay?: number;
    duration?: number;
    words?: boolean;
    once?: boolean;
    threshold?: number;
}

const getVariants = (animation: string) => {
    switch (animation) {
        case "fadeUp":
            return { opacity: 0, y: 20 };
        case "fadeDown":
            return { opacity: 0, y: -20 };
        case "fadeLeft":
            return { opacity: 0, x: -20 };
        case "fadeRight":
            return { opacity: 0, x: 20 };
        case "scaleUp":
            return { opacity: 0, scale: 0.95 };
        case "blurIn":
            return {
                opacity: 0,
                filter: "blur(10px)",
                y: 10
            };
        case "slideUp":
            return { opacity: 0, y: 40 };
        case "slideDown":
            return { opacity: 0, y: -40 };
        case "zoomIn":
            return { opacity: 0, scale: 0.8 };
        case "zoomOut":
            return { opacity: 0, scale: 1.2 };
        case "rotateIn":
            return { opacity: 0, rotate: -10, scale: 0.95 };
        default:
            return { opacity: 0, y: 20 };
    }
};

const Container = ({
    children,
    className,
    animation = "fadeUp",
    delay = 0,
    duration = 0.5,
    words = false,
    once = true,
    threshold = 0.1,
}: ContainerProps) => {

    const isMobile = useIsMobile();

    if (isMobile) {
        return <div className={className}>{children}</div>;
    }

    if (words && typeof children === "string") {
        return (
            <div className={cn(
                "w-full mx-auto",
                className
            )}>
                {children.split(" ").map((word, index) => (
                    <motion.span
                        key={index}
                        initial={{
                            opacity: 0,
                            filter: "blur(10px)",
                            y: 10,
                        }}
                        whileInView={{
                            opacity: 1,
                            filter: "blur(0px)",
                            y: 0,
                        }}
                        viewport={{ once, amount: threshold }}
                        transition={{
                            duration: 0.9,
                            delay: (delay + index) * 0.05,
                            ease: [0.22, 0.61, 0.36, 1]
                        }}
                        className="inline-block"
                    >
                        {word}&nbsp;
                    </motion.span>
                ))}
            </div>
        );
    }

    return (
        <motion.div
            className={className}
            initial={getVariants(animation)}
            whileInView={{
                opacity: 1,
                y: 0,
                x: 0,
                scale: 1,
                rotate: 0,
                filter: "blur(0px)",
            }}
            viewport={{ once, amount: threshold }}
            transition={{
                duration,
                delay,
                ease: [0.22, 0.61, 0.36, 1]
            }}
        >
            {children}
        </motion.div>
    );
};

export default Container; 
