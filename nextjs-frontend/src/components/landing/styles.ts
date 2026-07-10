/** Shared Tailwind class strings for the landing page */
export const lp = {
  page: "overflow-x-clip bg-lp-bg font-body",
  section: "bg-lp-bg",
  container:
    "mx-auto max-w-[1300px] border-x border-dashed border-lp-border px-10 py-[100px]",
  containerHero:
    "relative z-[1] mx-auto flex max-w-[1300px] flex-col items-center gap-[50px] border-x border-dashed border-lp-border px-10 pt-[150px] pb-[100px]",
  stickySide: "sticky top-[150px]",
  gridTwoCol: "grid grid-cols-2 items-start gap-[50px]",
  cardOuter: "overflow-hidden rounded-[15px] border border-dashed border-lp-border p-[7px]",
  cardInner: "rounded-[10px] bg-lp-surface p-[30px]",
  dashedDivider: "border-t border-dashed border-lp-border",
  headingDisplay:
    "font-display font-medium tracking-[-0.04em] text-lp-text",
  headingHero:
    "text-center font-display text-[clamp(48px,5.5vw,76px)] max-w-[600px] leading-[1.15] font-medium tracking-[-1.6px] text-lp-text",
  headingSection:
    "font-display text-[clamp(32px,3.5vw,48px)] leading-[1.1] font-medium tracking-[-1.6px] text-lp-text",
  body: "font-body text-base leading-[1.4] text-lp-muted",
  bodySm: "font-body text-sm leading-normal text-lp-muted",
  label: "font-body text-[11px] font-semibold tracking-[0.1em] text-lp-muted uppercase",
  labelCaps: "font-body text-[10px] tracking-wider text-lp-muted uppercase",
  pill:
    "inline-flex items-center gap-2 rounded-full border border-dashed border-lp-border py-1.5 pr-3 pl-2.5 backdrop-blur-[2.5px]",
  iconBtn:
    "flex size-[35px] items-center justify-center rounded-[30px] border border-dashed border-lp-border bg-black/10",
  chip:
    "rounded-[30px] border border-dashed border-lp-border bg-black/10 px-[11px] py-2 font-body text-xs font-medium tracking-tight text-lp-text",
  motionEase: "ease-[cubic-bezier(0.16,1,0.3,1)]",
} as const;
