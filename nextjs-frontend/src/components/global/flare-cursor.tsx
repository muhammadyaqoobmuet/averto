"use client";

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const FlareCursor = () => {

    const cursorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cursor = cursorRef.current;
        if (!cursor) return;

        const moveCursor = (e: MouseEvent) => {
            gsap.to(cursor, {
                x: e.clientX,
                y: e.clientY,
                duration: 0.5,
                ease: "power2.out",
            });
        };

        const handleMouseDown = () => {
            gsap.to(cursor, {
                scale: 0.9,
                duration: 0.2,
                ease: "back.out(3)",
            });
        };

        const handleMouseUp = () => {
            gsap.to(cursor, {
                scale: 1,
                duration: 0.3,
                ease: "elastic.out(1, 0.3)",
            });
        };

        const handleMouseEnter = () => {
            gsap.to(cursor, {
                scale: 1.4,
                duration: 0.3,
                ease: "power2.out",
            });
        };

        const handleMouseLeave = () => {
            gsap.to(cursor, {
                scale: 1,
                duration: 0.3,
                ease: "elastic.out(1, 0.3)",
            });
        };

        const interactiveElements = document.querySelectorAll(
            'a, button, [role="button"], input, textarea, select'
        );

        interactiveElements.forEach((el) => {
            el.addEventListener('mouseenter', handleMouseEnter);
            el.addEventListener('mouseleave', handleMouseLeave);
        });

        window.addEventListener('mousemove', moveCursor);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', moveCursor);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            interactiveElements.forEach((el) => {
                el.removeEventListener('mouseenter', handleMouseEnter);
                el.removeEventListener('mouseleave', handleMouseLeave);
            });
        };
    }, []);

    return (
        <div
            ref={cursorRef}
            className="pointer-events-none fixed top-0 left-0 z-9999 hidden lg:block"
            style={{
                width: '14px',
                height: '14px',
                transform: 'translate(-50%, -50%)',
            }}
        >
            <div className="w-full h-full rounded-full bg-foreground" />
        </div>
    );
};

export default FlareCursor;

