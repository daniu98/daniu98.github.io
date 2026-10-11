# Daniel Xiao — personal site

Plain HTML, CSS and JavaScript. No build step, no dependencies; push to `main` and
GitHub Pages redeploys.

## Layout

```
index.html                  the single-page portfolio
assets/css/site.css         all styling for index.html
assets/js/site-config.js    ← edit personal details, links and images HERE
assets/js/site.js           nav, scroll spy, reveal-on-scroll, photo rail
assets/doc/                 résumé PDF
assets/img/opt/             web-sized images used by index.html
assets/img/hockey/          original hockey photographs
assets/img/photography/     original landscape and travel photographs

style.css, script.js        the older design — still used by the pages below
creative.html               photography landing page  (older design)
nature.html, travel.html    photography galleries     (older design)
minecraft-background.html   standalone demo
```

`index.html` is self-contained. The photography pages still use the previous
design and are linked from the "Beyond the rink" section.

## Editing the site

**Links, email, résumé and photos** all live in one file: `assets/js/site-config.js`.
Change a value there and reload — nothing else to touch.

```js
links: { github: '…', linkedin: '…', resume: 'assets/doc/…pdf', … }
images: { hero: { small: '…-800.jpg', large: '…-1600.jpg', alt: '…' }, … }
```

The same URLs are also written into `index.html` as real `href`s so every link
still works with JavaScript disabled; `site-config.js` overrides them on load,
so it stays the single source of truth.

**Prose** (the About copy, project descriptions, job bullets) lives in
`index.html`, in sections marked with comment banners — `01 ABOUT`, `02 HOCKEY`,
`03 PROJECTS`, `04 WORK`, `05 BEYOND`, `06 CONTACT`.

**Design tokens** — colours, type, spacing — are the custom properties at the
top of `assets/css/site.css` under `/* 1. Tokens */`.

## Replacing a photograph

Images are served from `assets/img/opt/` at two or three widths via `srcset`.
To add a new one, drop the original in `assets/img/` and generate the sizes
(macOS `sips`, no install needed):

```bash
sips -s format jpeg -s formatOptions 58 -Z 1500 original.jpg --out assets/img/opt/name-1600.jpg
sips -s format jpeg -s formatOptions 50 -Z 760  original.jpg --out assets/img/opt/name-800.jpg
sips -s format jpeg -s formatOptions 48 -Z 420  original.jpg --out assets/img/opt/name-420.jpg   # thumbnails only
```

Then point `site-config.js` (or the `srcset` in `index.html`) at the new files.

## Notes

- Fully responsive; the nav collapses to a menu below 860px.
- Honours `prefers-reduced-motion` — scrolling and reveals become instant.
- All text meets WCAG AA contrast; every image has alt text.
- ~109 KB above the fold, ~530 KB for the whole page once scrolled.

## Deploy

```bash
git add .
git commit -m "Your message"
git push
```

Settings → Pages → Deploy from a branch → `main` / root.
