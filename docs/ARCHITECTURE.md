# Architecture

## Current State (v1.0)

Single-file HTML app:
- `index.html` contains all markup, styles, and data
- Content stored in a `CONTENT` JavaScript object (~600 KB)
- Renders modals on click, no backend

**Pros:** Zero setup, works offline, single file to share.
**Cons:** Large file, slow initial load at scale, hard to maintain content.

## Planned Refactor (v2.0)

Separate concerns:

**Benefits:**
- Faster initial load (content fetched on demand)
- Easier to edit one topic without touching a 600 KB file
- Enables GitHub Pages to serve content incrementally

**Migration path:**
1. Extract CSS to `assets/css/styles.css`
2. Extract JS to `assets/js/main.js`
3. Split `CONTENT` object: HTML → `content/**/*.html`, metadata → `content-index.js`
4. Update modal renderer to fetch content by key
