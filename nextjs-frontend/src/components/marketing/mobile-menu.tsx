"use client";

import { cn } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import React from 'react';
import { NAV_LINKS, Routes } from "@/constants";
import { Button } from "../ui/button";

interface Props {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const MobileMenu = ({ isOpen, setIsOpen }: Props) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                        duration: 0.15,
                        ease: [0.22, 0.61, 0.36, 1]
                    }}
                    className="lg:hidden flex flex-col flex-1 px-4 pb-6 overflow-y-auto"
                >
                    <ul className="flex flex-col items-start flex-1 w-full space-y-2 py-4">
                        {NAV_LINKS.map((item, index) => (
                            <motion.li
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    delay: index * 0.1,
                                    duration: 0.3
                                }}
                                onClick={() => setIsOpen(false)}
                                className="w-full"
                            >
                                <Link
                                    href={item.href}
                                    className="flex items-center w-full text-start px-4 py-3 text-base hover:text-primary font-medium transition transform rounded-lg text-foreground active:scale-95 hover:bg-foreground/5 active:opacity-80"
                                >
                                    {item.label}
                                </Link>
                            </motion.li>
                        ))}
                    </ul>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            delay: NAV_LINKS.length * 0.1,
                            duration: 0.3
                        }}
                        className="flex flex-col gap-3 pt-4"
                    >
                        <Link href={Routes.Login}>
                            <Button
                                size="default"
                                variant="ghost"
                                className="w-full"
                                onClick={() => setIsOpen(false)}
                            >
                                Log in
                            </Button>
                        </Link>
                        <Link href={Routes.Register}>
                            <Button
                                size="default"
                                variant="white"
                                className="w-full"
                                onClick={() => setIsOpen(false)}
                            >
                                Start for free
                            </Button>
                        </Link>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
};

export default MobileMenu;
