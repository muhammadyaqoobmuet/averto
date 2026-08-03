Rebuild the landing page of nextjs-frontend to match a reference design. Do not touch the dashboard.

Reference source: /mnt/windows/pythoncrawl4aifinalsemster/splendid-turtle-502228.framer.app — a full local crawl (markdown/HTML/assets) of the target site. Read everything in this folder first — every section, layout, and copy block — before writing any code.

Scope:

- Only touch public/marketing landing page routes and components.
- Do not touch dashboard routes, or any shared layouts/providers/logic the dashboard depends on.
- Before editing anything, map the current project structure — which routes/components are landing vs. dashboard — and confirm the plan can't break the dashboard.

Design:

- Recreate every section from the crawled reference, same order and layout: nav, hero, all content sections, footer — whatever's in the crawl.
- Match spacing, typography scale, and layout structure as closely as possible.
- Recreate animations/interactions (scroll reveals, hovers, transitions) using whatever animation library is already in the project, or Framer Motion if none is set up.
- Override every color to a strict black-and-white/grayscale palette — ignore whatever colors the reference actually uses. Hierarchy and contrast come from shades of gray only, no other hues.

Content:

- Keep the reference's copy, structure, and tone as the base.
- Swap in my actual product branding/name anywhere the reference content is placeholder or brand-specific — pull it from my current landing page or README.

Implementation:

- Check package.json and existing config/components first — match the current stack and conventions, don't introduce a new styling system or UI library.
- Fully responsive across mobile/tablet/desktop.
- Use next/image for all images.
- Update SEO/meta tags to match the new content.

Verify:

- Landing page matches the reference's structure/sections, fully black & white.
- Dashboard still builds and runs unchanged.
- List every file touched when done.
