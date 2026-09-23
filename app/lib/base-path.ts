/**
 * Prefix for deployments served from a sub-path. GitHub Pages hosts a project
 * site at `/<repo>/`, so every hard-coded public path ("/models/…", "/og.jpg")
 * needs the prefix there. Next adds it to its own scripts and routes, but not
 * to plain strings. Empty everywhere else (local dev, Cloudflare, Vercel).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
