import type { BaseUiDictionary, Dictionary, OrganContentDictionary } from "./types";
import { defaultLocale } from "./config";
import { extra } from "./extra";

/** Explicit maps keep each locale in its own chunk while staying statically
 *  analysable by both build pipelines (next build and vinext/Vite). */
const uiLoaders: Record<string, () => Promise<BaseUiDictionary>> = {
  en: () => import("./ui/en").then((m) => m.ui),
  xh: () => import("./ui/xh").then((m) => m.ui),
  zu: () => import("./ui/zu").then((m) => m.ui),
  af: () => import("./ui/af").then((m) => m.ui),
};

const organLoaders: Record<string, () => Promise<OrganContentDictionary>> = {
  en: () => import("./organs/en").then((m) => m.organs),
  xh: () => import("./organs/xh").then((m) => m.organs),
  zu: () => import("./organs/zu").then((m) => m.organs),
  af: () => import("./organs/af").then((m) => m.organs),
};

export async function getDictionary(locale: string): Promise<Dictionary> {
  const ui = await (uiLoaders[locale] ?? uiLoaders[defaultLocale])();
  const organs = await (organLoaders[locale] ?? organLoaders[defaultLocale])();
  // `extra` is keyed by locale in one file rather than split across the 12
  // ui/<locale>.ts modules; English is the fallback for an unknown code.
  return { ui: { ...ui, app: extra[locale] ?? extra[defaultLocale] }, organs };
}
