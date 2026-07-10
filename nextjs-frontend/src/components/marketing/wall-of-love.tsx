"use client";

import Wrapper from '@/components/global/wrapper';
import SectionBadge from '@/components/ui/section-badge';
import { testimonials } from '@/constants/testimonials';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const WallOfLove = () => {

    const [direction, setDirection] = useState<number>(0);
    const [currentIndex, setCurrentIndex] = useState<number>(0);

    const handlePrevious = () => {
        setDirection(-1);
        setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setDirection(1);
        setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
    };

    useEffect(() => {
        const timer = setInterval(() => {
            handleNext();
        }, 5000);

        return () => clearInterval(timer);
    }, []);

    const currentTestimonial = testimonials[currentIndex];

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0,
            filter: 'blur(10px)'
        }),
        center: {
            x: 0,
            opacity: 1,
            filter: 'blur(0px)'
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -100 : 100,
            opacity: 0,
            filter: 'blur(10px)'
        })
    };

    return (
        <section className="w-full py-16 lg:py-24 relative overflow-hidden">

            <div className="hidden lg:block absolute -z-10 top-0 -right-1/4 size-1/3 bg-primary/10 rounded-full blur-[8rem]" />

            <Wrapper>
                <div className="flex flex-col items-center text-center">
                    <SectionBadge title="Wall of Love" />

                    <motion.h2
                        className="title mt-6"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        Loved by teams
                        <br />
                        around the world
                    </motion.h2>

                    <motion.p
                        className="desc mt-4"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        See what freelancers and teams are saying about Avento
                    </motion.p>
                </div>

                <div className="w-full md:max-w-2xl lg:max-w-3xl mx-auto mt-12 relative">
                    <div className="relative rounded-2xl px-6 py-8 lg:p-12 overflow-hidden bg-cardbox">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={currentIndex}
                                custom={direction}
                                variants={variants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                className="relative flex flex-col items-center text-center"
                            >
                                <div className="relative mt-0 md:mt-2">
                                    <div className="hidden lg:block absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                                    <Image
                                        src={currentTestimonial.avatar}
                                        alt={currentTestimonial.name}
                                        width={80}
                                        height={80}
                                        className="relative size-20 rounded-full object-cover border-2 border-primary/20"
                                    />
                                </div>

                                <p className="text-base md:text-lg lg:text-xl text-foreground/90 text-balance leading-relaxed mt-6 max-w-full md:max-w-xl lg:max-w-2xl">
                                    "{currentTestimonial.text}"
                                </p>

                                <div className="mt-6">
                                    <h4 className="text-base font-semibold text-foreground">
                                        {currentTestimonial.name}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {currentTestimonial.role}
                                    </p>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center justify-center gap-3 mt-6">
                        <button
                            onClick={handlePrevious}
                            className="size-10 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 hover:border-primary/30 flex items-center justify-center transition-all group cursor-pointer"
                        >
                            <ChevronLeft className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>

                        <button
                            onClick={handleNext}
                            className="size-10 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 hover:border-primary/30 flex items-center justify-center transition-all group cursor-pointer"
                        >
                            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                    </div>
                </div>
            </Wrapper>
        </section>
    );
};

export default WallOfLove;
