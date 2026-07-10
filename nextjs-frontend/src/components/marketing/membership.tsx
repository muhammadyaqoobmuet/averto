"use client";

import Wrapper from '@/components/global/wrapper';
import { Button } from '@/components/ui/button';
import { Marquee } from '@/components/ui/marquee';
import SectionBadge from '@/components/ui/section-badge';
import { pricingPlans, trustedCompanies } from '@/constants/membership';
import { cn } from '@/utils';
import NumberFlow from '@number-flow/react';
import { ArrowRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const integrationLogos = [
    '/icons/integrations/cursor.svg',
    '/icons/integrations/convex.svg',
    '/icons/integrations/dribbble.svg',
    '/icons/integrations/dub.svg',
    '/icons/integrations/asana.svg',
    '/icons/integrations/figma.svg',
    '/icons/integrations/heptabase.svg',
    '/icons/integrations/layers.svg',
    '/icons/integrations/mintlify.svg',
    '/icons/integrations/soldera.svg',
    '/icons/integrations/polar.svg',
    '/icons/integrations/slack.svg',
];

const Membership = () => {

    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

    return (
        <section id="membership" className="w-full py-16 lg:py-24 relative overflow-hidden">

            <div className="hidden lg:block absolute -z-10 top-0 -left-1/4 size-1/3 bg-primary/10 rounded-full blur-[8rem]" />

            <Wrapper>
                <div className="flex flex-col items-center text-center">
                    <SectionBadge title="Membership" />

                    <motion.h2
                        className="title mt-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        Simple pricing
                        <br />
                        for small teams
                    </motion.h2>

                    <motion.p
                        className="desc mt-4"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        Choose the plan that fits your team size and workflow
                    </motion.p>

                    <motion.div
                        className="flex items-center gap-3 mt-14 relative"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        <span
                            role="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={cn(
                                "text-sm font-medium transition-colors cursor-pointer",
                                billingCycle === 'monthly' ? 'text-primary' : 'text-muted-foreground'
                            )}>
                            Monthly
                        </span>

                        <button
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                            className={cn(
                                "relative w-10 h-6 rounded-full transition-colors cursor-pointer group",
                                "bg-foreground/10",
                            )}
                        >
                            <div className={cn(
                                "absolute top-0.5 left-0.5 size-5 rounded-full scale-90 shadow-[0_0_10px_rgba(0,85,255,0.8)] group-hover:scale-80 transition-all duration-300 bg-primary",
                                billingCycle === 'yearly' ? 'translate-x-4' : 'translate-x-0'
                            )} />
                        </button>

                        <span
                            role="button"
                            onClick={() => setBillingCycle('yearly')}
                            className={cn(
                                "text-sm font-medium transition-colors cursor-pointer",
                                billingCycle === 'yearly' ? 'text-primary' : 'text-muted-foreground'
                            )}>
                            Yearly
                        </span>

                        <div className="absolute -top-12 -right-3/5 flex flex-col gap-2">
                            <span className="text-base text-muted-foreground font-handwriting">
                                2 months free
                            </span>
                            <Image
                                src="/icons/curved-arrow.svg"
                                alt="arrow"
                                width={50}
                                height={20}
                                className="w-10 h-auto opacity-70"
                            />
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 max-w-3xl mx-auto">
                    {pricingPlans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            className={cn(
                                "relative rounded-xl lg:rounded-2xl p-5 lg:p-8 overflow-hidden",
                                "bg-cardbox",
                                "transition-all duration-300",
                            )}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                        >
                            {plan.popular && (
                                <>
                                    <div className="absolute top-0 inset-x-0 h-6 w-4/5 mx-auto bg-primary blur-[3rem]">
                                    </div>
                                    <div className="absolute top-0 inset-x-0 h-px w-full bg-linear-to-r from-primary/0 via-primary/50 to-primary/0"></div>
                                </>
                            )}

                            {plan.popular && (
                                <div className="absolute top-4 right-4">
                                    <span className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-full">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <div>
                                <h3 className="text-2xl font-semibold">
                                    {plan.name}
                                </h3>
                                <div className="flex items-baseline w-full mt-4">
                                    <span className="text-5xl font-semibold">
                                        $
                                    </span>
                                    <NumberFlow
                                        value={plan.price[billingCycle]}
                                        className="text-5xl font-semibold tracking-tight"
                                        format={{ notation: 'standard' }}
                                    />
                                    <motion.span
                                        key={billingCycle}
                                        initial={{ y: 20, opacity: 0, filter: 'blur(10px)' }}
                                        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                        exit={{ y: -20, opacity: 0, filter: 'blur(10px)' }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                        className="text-muted-foreground text-sm ml-1"
                                    >
                                        {billingCycle === 'monthly' ? '/month' : '/year'}
                                    </motion.span>
                                </div>
                                <p className="text-muted-foreground text-sm mt-4 leading-relaxed">
                                    {plan.description}
                                </p>
                            </div>

                            <Link href={plan.cta.href}>
                                <Button
                                    variant={plan.popular ? "default" : "secondary"}
                                    className={cn(
                                        "w-full mt-6"
                                    )}

                                >
                                    {plan.cta.text}
                                    <ArrowRight className="size-4" />
                                </Button>
                            </Link>

                            <ul className="space-y-3 mt-8">
                                {plan.features.map((feature, idx) => (
                                    <motion.li
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.3, delay: 0.6 + idx * 0.05 }}
                                        className={cn(
                                            "flex items-center gap-2 transition-all duration-200",
                                        )}
                                    >
                                        <Check className={cn(
                                            "size-3.5",
                                            feature.highlighted
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        )} />
                                        <span className={cn(
                                            "text-sm leading-relaxed",
                                            feature.highlighted
                                                ? "text-foreground font-medium"
                                                : "text-muted-foreground"
                                        )}>
                                            {feature.text}
                                        </span>
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    className="mt-6 max-w-3xl mx-auto"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                >
                    <div className="rounded-xl lg:rounded-2xl p-8 lg:p-8 bg-cardbox">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
                            <div>
                                <h3 className="text-2xl font-medium">
                                    {trustedCompanies.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {trustedCompanies.description}
                                </p>
                                <Link href={trustedCompanies.cta.href} className="cursor-pointer!">
                                    <Button variant="outline" className="text-primary mt-2 p-0! border-0 bg-transparent hover:text-primary/80 hover:bg-transparent">
                                        {trustedCompanies.cta.text}
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </Link>
                            </div>

                            <div className="flex flex-col gap-4 overflow-hidden relative z-0">
                                <Marquee pauseOnHover className="[--duration:30s] opacity-40 [--gap:2rem]">
                                    {integrationLogos.map((logo, idx) => (
                                        <div key={idx} className="flex items-center justify-center">
                                            <Image
                                                src={logo}
                                                alt=""
                                                width={32}
                                                height={32}
                                                className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
                                            />
                                        </div>
                                    ))}
                                </Marquee>

                                <Marquee reverse pauseOnHover className="[--duration:30s] opacity-40 [--gap:2rem]">
                                    {integrationLogos.map((logo, idx) => (
                                        <div key={idx} className="flex items-center justify-center">
                                            <Image
                                                src={logo}
                                                alt=""
                                                width={32}
                                                height={32}
                                                className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
                                            />
                                        </div>
                                    ))}
                                </Marquee>
                                <div className="from-cardbox pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-linear-to-r"></div>
                                <div className="from-cardbox pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-linear-to-l"></div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </Wrapper>
        </section>
    );
};

export default Membership;

