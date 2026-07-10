"use client";

import { cn } from "@/utils";
import { ArrowRightIcon, MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from 'react';
import { usePathname } from "next/navigation";
import Icons from "../global/icons";
import Wrapper from "../global/wrapper";
import { Button } from "../ui/button";
import MobileMenu from "./mobile-menu";
import { Logo } from "./logo";
import { NAV_LINKS, Routes } from "@/constants";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks";

const Navbar = () => {

    const [isOpen, setIsOpen] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <div className="relative w-full h-full">
            <div className="z-100 hidden lg:block fixed pointer-events-none inset-x-0 h-[88px] bg-[rgba(10,10,10,0.8)] backdrop-blur-sm [mask:linear-gradient(to_bottom,#000_20%,transparent_calc(100%-20%))]"></div>
            <header
                className={cn(
                    "fixed top-4 inset-x-0 mx-auto max-w-6xl px-2 md:px-12 z-100 transition-all duration-300 ease-in-out",
                    isOpen ? "h-[calc(100dvh-2rem)]" : "h-14 md:h-16"
                )}
            >
                <div className="backdrop-blur-xl rounded-xl lg:rounded-full border border-[rgba(255,255,255,0.1)] h-full flex flex-col overflow-hidden relative">
                    <div className="flex items-center justify-between w-full px-4 min-h-14 md:min-h-16 shrink-0 pb-1">
                        <div className="flex items-center flex-1 lg:flex-none">
                            <Logo
                                iconClassName="transition-all group-hover:drop-shadow-[0_0_8px_rgba(0,85,255,0.6)]"
                            />
                        </div>

                        <div className="lg:flex items-center hidden gap-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            {NAV_LINKS.map((item, index) => (
                                <Link
                                    key={index}
                                    href={item.href}
                                    className="text-sm text-foreground/70 hover:text-foreground font-medium transition-colors px-3 py-1.5"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 lg:gap-3">
                            <Link href={Routes.Login} className="hidden lg:flex">
                                <Button variant="ghost">Log in</Button>
                            </Link>
                            <Link href={Routes.Register}>
                                <Button variant="white" className="hidden lg:flex">
                                    Start for free
                                </Button>
                            </Link>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setIsOpen((prev) => !prev)}
                                className="lg:hidden"
                            >
                                {isOpen ? <XIcon className="size-4 duration-300" /> : <MenuIcon className="size-4 duration-300" />}
                            </Button>
                        </div>
                    </div>

                    <MobileMenu isOpen={isOpen} setIsOpen={setIsOpen} />
                </div>
            </header>
        </div>
    )
};

export default Navbar;
