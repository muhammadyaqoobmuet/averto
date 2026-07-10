"use client";

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "motion/react"
import { cn } from "@/utils"
import { ArrowRightIcon } from "lucide-react"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer select-none relative overflow-hidden",
    {
        variants: {
            variant: {
                default: "bg-linear-to-r from-primary via-blue-400 to-primary bg-size-[200%_100%] bg-left hover:bg-right text-foreground shadow-lg hover:shadow-primary/25 border-0 active:scale-[0.98] transition-all duration-300",
                destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
                outline: "border border-foreground/20 bg-background/20 backdrop-blur-lg hover:bg-foreground/10 hover:border-foreground/40 text-foreground transition-all duration-300 active:scale-[0.98]",
                secondary: "bg-neutral-800 hover:bg-foreground text-foreground hover:text-background",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
                link: "text-primary underline-offset-4 hover:underline",
                stroke: "border-2 border-current bg-transparent hover:text-background relative overflow-hidden",
                white: "bg-white text-black hover:bg-primary hover:text-white",
                shimmer: "bg-neutral-900 text-white border border-white/10"
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-8 gap-1.5 px-3",
                lg: "h-10 px-6",
                icon: "size-9",
                "icon-sm": "size-8",
                "icon-lg": "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

interface Props extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, Props>(
    ({ className, variant, size, asChild = false, children, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"

        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            >
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {children}
                </span>
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
