#!/usr/bin/env node
// pixelfx 이펙트 → 스프라이트 시트(PNG + Aseprite식 JSON) → assets/fx/ + manifest.json (게임이 자동으로 불러옴)
//
//   node tools/pixelfx/export.mjs                 fx.config.json 의 모든 이펙트
//   node tools/pixelfx/export.mjs poof            key 하나만
//   node tools/pixelfx/export.mjs --preview       contact.png 미리보기도 함께 (records/)
//
// 자작 이펙트는 fx-src/<category>/<name>.js 에 두고 config의 id를 "custom:<category>/<name>" 으로 적습니다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PFX = join(ROOT, "third_party", "pixelfx");
const lib = await import(join(PFX, "tools", "lib", "fxlib.mjs"));

const args = process.argv.slice(2);
const preview = args.includes("--preview");
const only = args.filter(a => !a.startsWith("--"));
const cfg = JSON.parse(readFileSync(join(ROOT, "tools", "pixelfx", "fx.config.json"), "utf8"));
const outDir = join(ROOT, cfg.outDir || "assets/fx");
mkdirSync(outDir, { recursive: true });

const manifestFile = join(outDir, "manifest.json");
let manifest = { generator: "tools/pixelfx/export.mjs", pixelfx: readPin(), effects: {} };
try { manifest = { ...JSON.parse(readFileSync(manifestFile, "utf8")), pixelfx: readPin() }; } catch { /* 처음 */ }
manifest.effects = manifest.effects || {};
const keys = new Set(cfg.effects.map(e => e.key));
for (const k of Object.keys(manifest.effects)) if (!keys.has(k)) delete manifest.effects[k];

let failed = 0;
for (const e of cfg.effects) {
  if (only.length && !only.includes(e.key)) continue;
  try {
    const custom = e.id.startsWith("custom:");
    const id = custom ? e.id.slice(7) : e.id;
    const fx = await lib.loadEffect(id, custom ? join(ROOT, "fx-src") : undefined);
    const r = lib.renderFrames(fx, { fps: e.fps, seed: e.seed, options: e.options });
    const s = lib.spriteSheet(fx, r, e.key);
    s.json.meta.image = `${e.key}.png`;
    lib.save(join(outDir, `${e.key}.png`), s.png);
    lib.save(join(outDir, `${e.key}.json`), JSON.stringify(s.json));
    if (preview) lib.save(join(ROOT, "records", e.key, "contact.png"), lib.contactSheet(fx, r, {}));
    const px = s.json.meta.pixelfx;
    manifest.effects[e.key] = {
      id: e.id, png: `${e.key}.png`, json: `${e.key}.json`, frames: px.frames, fps: px.fps,
      loop: px.loop, frameSize: px.frameSize, pivot: px.pivot, use: e.use || ""
    };
    console.log(`✔ ${e.key.padEnd(10)} ${e.id}  ${px.frames}f @${px.fps}fps  ${px.frameSize.join("x")}  pivot ${px.pivot.join(",")}`);
  } catch (err) {
    failed++;
    console.error(`✘ ${e.key}: ${err.stack || err}`);
  }
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
console.log(`→ ${manifestFile}`);
process.exit(failed ? 1 : 0);

function readPin() {
  try { return (readFileSync(join(PFX, "PINNED.md"), "utf8").match(/commit `([0-9a-f]+)`/) || [])[1] || "unknown"; } catch { return "unknown"; }
}
