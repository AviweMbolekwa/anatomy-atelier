/**
 * The user's "reduce motion" setting, read at the moment of each animation so
 * a change in system settings applies without a reload.
 *
 * CSS honours this through `@media (prefers-reduced-motion)`, but animations
 * driven from JavaScript (GSAP tweens, the 3D camera) never see that media
 * query and have to ask. Reduced motion means gentler, not none: movement and
 * scaling are skipped, short fades are kept because they help people follow
 * what changed.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function subscribeReducedMotion(listener: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
