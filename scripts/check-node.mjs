/**
 * Enforces the Node version declared in package.json#engines and .nvmrc.
 * Run automatically before dev/build/test via npm's `pre` script hooks.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const required = (pkg.engines?.node ?? "").replace(/^[^\d]*/, "").trim();

function parse(version) {
  const [major, minor = "0", patch = "0"] = version.split(".").map((part) => parseInt(part, 10));
  return [major, minor, patch];
}

function atLeast(actual, minimum) {
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] > minimum[i]) return true;
    if (actual[i] < minimum[i]) return false;
  }
  return true;
}

if (!required) {
  process.exit(0);
}

const actual = parse(process.versions.node);
const minimum = parse(required);

if (!atLeast(actual, minimum)) {
  console.error(
    `\nThis project requires Node.js >=${required} (found ${process.versions.node}).\n` +
      `If you use nvm: run "nvm install" from the project root (see .nvmrc).\n`,
  );
  process.exit(1);
}
