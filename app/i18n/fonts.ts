import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import type { ScriptGroup } from "./config";

// The display pair. Cormorant Garamond carries the "atelier" voice; DM Sans
// the interface. latin-ext covers the diacritics Afrikaans uses (ê, ë, ô…).
const cormorant = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const dmSans = DM_Sans({ variable: "--font-sans", subsets: ["latin", "latin-ext"] });

const webFonts: Record<ScriptGroup, { serif: { variable: string }; sans: { variable: string } }> = {
  latin: { serif: cormorant, sans: dmSans },
};

/** Font classes for a script — only this script's faces are requested. */
export function fontClassName(script: ScriptGroup) {
  const pair = webFonts[script] ?? webFonts.latin;
  return `${pair.serif.variable} ${pair.sans.variable}`;
}
