"use client";

import React, { useState } from 'react';
import Wrapper from '@/components/global/wrapper';
import Icons from '@/components/global/icons';
import { footerLinks, socialLinks } from '@/constants';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { cn } from "@/utils";
import { Logo } from "./logo";

const Footer = () => {

    const [email, setEmail] = useState<string>("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Newsletter:', email);
        setEmail('');
    };

    return (
        <footer className="w-full relative mt-16 lg:mt-24 overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-foreground/0 via-foreground/20 to-foreground/0" />
            <div className="absolute top-0 inset-x-0 w-1/2 mx-auto h-4 bg-foreground/40 blur-[4rem]" />

            <Wrapper className="py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
                    <div className="lg:col-span-4">
                        <Logo />
                        <p className="text-sm text-muted-foreground mt-4 max-w-xs">
                            Simple workspace for teams
                        </p>

                        <form onSubmit={handleSubmit} className="mt-6 w-full md:max-w-xs">
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="flex-1 h-8.5 text-sm bg-foreground/5 border-foreground/10 focus-visible:ring-0 focus-visible:ring-transparent rounded-full px-4"
                                />
                                <Button type="submit" size="sm" >
                                    Subscribe
                                </Button>
                            </div>
                        </form>
                    </div>

                    <div className="lg:col-span-2" />

                    <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-3 lg:place-items-end gap-8">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground mt-0">
                                Product
                            </h3>
                            <ul className="mt-4 space-y-3">
                                {footerLinks.product.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-foreground mt-0">
                                Resources
                            </h3>
                            <ul className="mt-4 space-y-3">
                                {footerLinks.resources.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-foreground mt-0">
                                Company
                            </h3>
                            <ul className="mt-4 space-y-3">
                                {footerLinks.company.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-12 pt-8 border-t border-foreground/5">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Avento. All rights reserved.
                    </p>

                    <div className="flex items-center gap-4">
                        {socialLinks.map((social) => (
                            <Link
                                key={social.label}
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-60 hover:opacity-100 transition-opacity"
                            >
                                <Image
                                    src={`/icons/integrations/${social.icon}.svg`}
                                    alt={social.label}
                                    width={20}
                                    height={20}
                                    className={cn(
                                        "size-5 grayscale",
                                        social.icon === "x" && "size-4",
                                    )}
                                />
                            </Link>
                        ))}
                    </div>
                </div>
            </Wrapper>
        </footer>
    );
};

export default Footer;
