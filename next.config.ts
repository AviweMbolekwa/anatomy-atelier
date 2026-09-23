import type { NextConfig } from "next";
import { defaultLocale } from "./app/i18n/config";

/**
 * GitHub Pages build: `PAGES_BASE_PATH=/anatomy-atelier npm run build:pages`.
 * Pages serves static files from a sub-path, so that build exports plain HTML
 * under the repo name. Every other target (local dev, Cloudflare, Vercel)
 * leaves this unset and keeps the normal server build.
 */
const pagesBasePath = process.env.PAGES_BASE_PATH;
const isPagesExport = pagesBasePath !== undefined;

const nextConfig: NextConfig = {
  // Pin the workspace root to this folder. Without it, Turbopack walks up,
  // finds any stray package-lock.json higher in the tree (e.g. in $HOME) and
  // resolves routes against the wrong directory — every page then 404s.
  turbopack: { root: import.meta.dirname },

  ...(isPagesExport
    ? {
        output: "export",
        basePath: pagesBasePath,
        // Emit /en/index.html rather than /en.html, which is what a static
        // host serves for /en/.
        trailingSlash: true,
        images: { unoptimized: true },
        // Hard-coded public paths (models, artwork, icons) read this.
        env: { NEXT_PUBLIC_BASE_PATH: pagesBasePath },
      }
    : {
        // Every route lives under /[locale], so `app/[locale]/layout.tsx` is the root
        // layout and there is no page at `/`. Send bare visits to the default
        // language. (Accept-Language negotiation would need middleware, which the
        // Cloudflare/vinext target does not run — the in-app switcher covers it.)
        // A static export can't redirect; the Pages workflow writes an index.html
        // that does the same thing.
        async redirects() {
          return [{ source: "/", destination: `/${defaultLocale}`, permanent: false }];
        },
      }),
};

export default nextConfig;
