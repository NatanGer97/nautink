# @nautink/site

The Nautink marketing page: one static HTML page with a little TypeScript, built with Vite.

```bash
pnpm --filter @nautink/site dev     # http://localhost:5191
pnpm --filter @nautink/site build   # writes dist/, a folder you can host anywhere
```

- The screenshots and the logo come straight from `docs/screenshots/` and `docs/brand/`, so updating
  the README screenshots updates the page too.
- Geist is self-hosted from the `geist` package, like the app: the page loads nothing from a
  third-party server.
- The build uses relative URLs (`base: './'`), so `dist/` works at a domain root or under a path such
  as GitHub Pages' `/nautink/`.
