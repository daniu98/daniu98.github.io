# Portfolio

Plain HTML/CSS/JS, no build step, deploys straight to GitHub Pages.

## Files
- `index.html` — structure and placeholder content
- `style.css` — all styling
- `script.js` — footer year + scroll-reveal on project cards

## What to edit
Search `index.html` for these and replace with your real info:
- "Your Name" (appears in `<title>`, hero, footer)
- Tagline in the hero
- The three `.project-card` blocks — name, description, tech stack, live/source links
- Bio paragraph in the About section
- Skills list in the legend
- Footer: email, GitHub, LinkedIn

## Deploy to GitHub Pages (from your `portfolio` folder)

```bash
# 1. Copy these files into your existing portfolio/ folder, replacing what's there

# 2. Stage and commit
git add .
git commit -m "Initial commit"

# 3. Push
git branch -M main
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source → Deploy from a branch → main / (root) → Save.**
Your site goes live at the URL shown there within a minute or two.

Any future `git push` to `main` auto-redeploys — no extra step needed.
