#!/usr/bin/env node
/** Extracts the JSON chunk of a .glb as plain JSON — needed by to_hotspot_space.py
 *  for the node's translation. Usage: node dump_json_chunk.mjs <model.glb> <out.json> */
import { readFileSync, writeFileSync } from "node:fs";
function parseGlb(path) {
  const buf = readFileSync(path);
  let offset = 12, json = null;
  while (offset < buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunkData.toString("utf8"));
    offset += 8 + chunkLength;
  }
  return json;
}
const [, , inPath, outPath] = process.argv;
writeFileSync(outPath, JSON.stringify(parseGlb(inPath)));
console.log(`wrote ${outPath}`);
