"use client";

/**
 * SmoothInput — spring-animated caret input.
 *
 * Adapted from Skiper UI / skiper106.
 * Changes from original:
 *  - Removed `dialkit` (hardcoded production defaults)
 *  - Fixed `navigator.userAgent` SSR crash (lazy ref, browser-only)
 *  - Styled to match Averto design tokens (CSS variables)
 *  - `type` and `placeholder` driven by props only
 */

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import React, {
  type ComponentPropsWithoutRef,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Spring config — snappy but smooth (matches Skiper original)
const SPRING_CONFIG = { stiffness: 500, damping: 30, mass: 0.5 };
const REDUCED_SPRING  = { stiffness: 10000, damping: 100, mass: 0.1 };

// Wrapper: visual shell that replaces the native <input> border/bg
const wrapperBase =
  "w-full rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] " +
  "px-4 py-3 transition-colors duration-150 " +
  "focus-within:border-[var(--border-strong)] " +
  "focus-within:ring-1 focus-within:ring-[var(--border-strong)]";

// Inner <input>: transparent, no outline — caret is replaced by the overlay
const inputBase =
  "w-full bg-transparent outline-none text-[14px] text-[var(--text)] " +
  "placeholder:text-[var(--text-muted)] col-start-1 col-end-2 row-start-1 row-end-2 text-inherit";

// ── Types ─────────────────────────────────────────────────────────────────

type SmoothInputType = "text" | "password";

export type SmoothInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type"
> & {
  type?: SmoothInputType;
  wrapperClassName?: string;
};

// ── Component ─────────────────────────────────────────────────────────────

export const SmoothInput = ({
  className,
  wrapperClassName,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  type = "text",
  placeholder,
  style,
  ...props
}: SmoothInputProps) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const caretX       = useMotionValue(0);
  const caretOpacity = useMotionValue(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const ctxRef       = useRef<CanvasRenderingContext2D | null>(null);

  // Password bullet character — computed client-side to avoid SSR crash
  const pwCharRef = useRef<string>("\u2022");

  const metricsRef = useRef<{
    ctx: CanvasRenderingContext2D;
    letterSpacing: number;
    caretMargin: number;
    maxMargin: number;
    isPassword: boolean;
    pwCharWidth: number | null;
  } | null>(null);

  const prefersReducedMotion = useReducedMotion();

  const isControlled = value !== undefined;
  const inputValue   = isControlled ? String(value) : internalValue;

  const springCaretX = useSpring(
    caretX,
    prefersReducedMotion ? REDUCED_SPRING : SPRING_CONFIG,
  );

  // Detect FF vs Chrome bullet on the client only
  useEffect(() => {
    pwCharRef.current = /firefox|fxios/i.test(navigator.userAgent)
      ? "\u25CF"
      : "\u2022";
  }, []);

  // ── Canvas text-measurement ────────────────────────────────────────────

  const syncMetrics = () => {
    const input     = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      ctxRef.current    = canvasRef.current.getContext("2d");
    }
    const ctx = ctxRef.current;
    if (!ctx) return null;

    const styles    = window.getComputedStyle(input);
    const fontSize  = styles.fontSize;
    const fontFamily = styles.fontFamily;
    const isPassword = input.type === "password";

    // Firefox renders the filled circle slightly larger — adjust font size
    const isFfBullet = pwCharRef.current === "\u25CF";
    const font =
      isFfBullet && isPassword && !/chrome|chromium|crios/i.test(navigator.userAgent)
        ? `${parseFloat(fontSize) + 6.25}px ${fontFamily}`
        : `${fontSize} ${fontFamily}`;

    ctx.font = font;

    const paddingLeft   = parseInt(styles.paddingLeft, 10) || 0;
    const letterSpacing = parseInt(styles.letterSpacing, 10) || 0;
    const caretMargin   = paddingLeft;
    const maxMargin     = (container.offsetWidth || 0) - 10;
    const pwCharWidth   = isPassword ? ctx.measureText(pwCharRef.current).width : null;

    metricsRef.current = {
      ctx,
      letterSpacing,
      caretMargin,
      maxMargin,
      isPassword,
      pwCharWidth,
    };

    return metricsRef.current;
  };

  const measurePrefixWidth = (text: string, selectionStart: number) => {
    const metrics = metricsRef.current ?? syncMetrics();
    if (!metrics) return null;

    const { ctx, letterSpacing, caretMargin, maxMargin, isPassword, pwCharWidth } = metrics;

    let textWidth: number;

    if (isPassword && pwCharWidth !== null) {
      textWidth =
        selectionStart > 0
          ? pwCharWidth * selectionStart + caretMargin + letterSpacing * (selectionStart - 1)
          : caretMargin - 1;
    } else {
      const measured = ctx.measureText(text).width;
      textWidth =
        measured > 0
          ? measured + caretMargin + letterSpacing * Math.max(text.length - 1, 0)
          : caretMargin - 1;
    }

    if (textWidth > maxMargin) return null;
    return textWidth;
  };

  const updateCaretFromInput = (target: HTMLInputElement) => {
    const selStart = target.selectionStart ?? 0;
    const selEnd   = target.selectionEnd   ?? 0;

    if (selStart !== selEnd) {
      caretOpacity.set(0);
      return;
    }

    const textBeforeCaret = metricsRef.current?.isPassword
      ? ""
      : target.value.slice(0, selStart);

    const textWidth = measurePrefixWidth(textBeforeCaret, selStart);
    if (textWidth === null) return;

    caretOpacity.set(1);
    caretX.set(textWidth);
  };

  // Keep stable refs to avoid stale closures in event listeners
  const updateCaretRef       = useRef(updateCaretFromInput);
  const caretOpacityRef      = useRef(caretOpacity);
  updateCaretRef.current     = updateCaretFromInput;
  caretOpacityRef.current    = caretOpacity;

  // Sync caret when controlled value changes
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      updateCaretRef.current(input);
    }
  }, [inputValue]);

  // Sync caret when type changes
  useEffect(() => {
    syncMetrics();
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      updateCaretRef.current(input);
    }
  }, [type]);

  // Mount: attach selectionchange + ResizeObserver
  useEffect(() => {
    const input     = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    syncMetrics();

    const onSelectionChange = () => {
      if (document.activeElement === input) updateCaretRef.current(input);
    };

    const resizeObs = new ResizeObserver(() => {
      syncMetrics();
      if (document.activeElement === input) updateCaretRef.current(input);
    });

    document.addEventListener("selectionchange", onSelectionChange);
    resizeObs.observe(container);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      resizeObs.disconnect();
      canvasRef.current = null;
      ctxRef.current    = null;
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className={cn(wrapperBase, wrapperClassName)}>
      {/* Grid overlay: input + animated caret sit in the same cell */}
      <div
        ref={containerRef}
        className="relative grid grid-cols-1"
        style={{ caretColor: "transparent" }}
      >
        <input
          {...props}
          ref={inputRef}
          type={type}
          placeholder={placeholder}
          className={cn(inputBase, className)}
          style={style}
          value={inputValue}
          onChange={(e) => {
            if (!isControlled) setInternalValue(e.target.value);
            onChange?.(e);
          }}
          onFocus={(e) => {
            updateCaretRef.current(e.currentTarget);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            caretOpacityRef.current.set(0);
            onBlur?.(e);
          }}
          onKeyUp={(e) => {
            updateCaretRef.current(e.currentTarget as HTMLInputElement);
          }}
          onMouseUp={(e) => {
            updateCaretRef.current(e.currentTarget as HTMLInputElement);
          }}
        />

        {/* Animated caret overlay */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none col-start-1 col-end-2 row-start-1 row-end-2 h-[1em] w-[2px] self-center rounded-full"
          style={{
            x: springCaretX,
            opacity: caretOpacity,
            backgroundColor: "var(--text)",
          }}
        />
      </div>
    </div>
  );
};

export default SmoothInput;
