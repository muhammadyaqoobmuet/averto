import React from "react";
import { cn } from "@/utils";

interface Props {
    className?: string;
    children: React.ReactNode;
}

const Wrapper = ({ children, className }: Props) => {
    return (
        <div
            className={cn(
                "w-full mx-auto max-w-7xl px-4 md:px-8 lg:px-12 xl:px-16",
                className
            )}
        >
            {children}
        </div>
    )
};

export default Wrapper
