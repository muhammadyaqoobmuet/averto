import Link from "next/link";
import { cn } from "@/utils";

export function AvertoMark({ className }: { className?: string }) {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            aria-hidden="true"
            className={className}
        >
            <rect
                width="22"
                height="22"
                rx="6"
                fill="currentColor"
                fillOpacity="0.12"
            />
            <path
                d="M11 5L15.5 16H6.5L11 5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                fill="none"
            />
            <path
                d="M8.2 13h5.6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function Logo({
    className,
    iconClassName,
    showText = true,
}: {
    className?: string;
    iconClassName?: string;
    showText?: boolean;
}) {
    return (
        <Link
            href="/"
            className={cn(
                "flex items-center gap-2.5 text-foreground group",
                className,
            )}
        >
            <AvertoMark className={cn("w-auto h-5", iconClassName)} />
            {showText && (
                <span className="font-semibold text-[15px] tracking-tight">
                    Averto
                </span>
            )}
        </Link>
    );
}
