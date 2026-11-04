#!/usr/bin/env node
// pixelfx 메뉴: 검색 → 미리보기 → 게임에 추가 → 내보내기
//   npm run fx            (대화형 메뉴)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PFX = join(ROOT, "third_party", "pixelfx");
const CFG = join(ROOT, "tools", "pixelfx", "fx.config.json");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("close", () => process.exit(0));
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, stdio: "inherit" });
const load = () => JSON.parse(readFileSync(CFG, "utf8"));
const store = (c) => writeFileSync(CFG, JSON.stringify(c, null, 2) + "\n");

for (;;) {
  const cfg = load();
  console.log(`\n=== pixelfx 메뉴 (게임 이펙트 ${cfg.effects.length}개) ===
 1) 이펙트 검색            (예: poof, coin, frost)
 2) 미리보기 렌더          (contact.png 생성 → 이미지로 확인)
 3) 게임에 이펙트 추가
 4) 게임 이펙트 목록 / 삭제
 5) 전부 내보내기          (assets/fx 에 PNG+JSON+manifest)
 6) 이펙트 검사            (pixelfx check)
 0) 끝내기`);
  const ch = (await rl.question("> ")).trim();
  if (ch === "0" || ch === "") break;
  if (ch === "1") {
    const q = await rl.question("검색어: ");
    run("node", ["tools/list.mjs", ...q.split(/\s+/).filter(Boolean)], PFX);
  } else if (ch === "2") {
    const id = await rl.question("이펙트 id (category/name): ");
    const opts = await rl.question("옵션 JSON (없으면 Enter): ");
    run("node", ["tools/render.mjs", id.trim(), "--out", join(ROOT, "records"), ...(opts.trim() ? ["--opts", opts.trim()] : [])], PFX);
    console.log(`→ records/${id.trim()}/contact.png`);
  } else if (ch === "3") {
    const id = (await rl.question("이펙트 id (category/name, 자작은 custom:category/name): ")).trim();
    const key = (await rl.question("게임 안 이름(key, 영문): ")).trim();
    const fps = +(await rl.question("fps (Enter=15): ")).trim() || 15;
    const opts = (await rl.question("옵션 JSON (palette 등, 없으면 Enter): ")).trim();
    const use = (await rl.question("용도 메모: ")).trim();
    if (!id || !key) { console.log("id와 key가 필요해요."); continue; }
    cfg.effects = cfg.effects.filter(e => e.key !== key);
    cfg.effects.push({ key, id, fps, ...(opts ? { options: JSON.parse(opts) } : {}), use });
    store(cfg);
    run("node", ["tools/pixelfx/export.mjs", key, "--preview"], ROOT);
    console.log(`게임 코드에서: DT.FX.play(this, '${key}', x, y)`);
  } else if (ch === "4") {
    cfg.effects.forEach((e, i) => console.log(` ${i + 1}. ${e.key.padEnd(10)} ${e.id.padEnd(28)} ${e.use || ""}`));
    const d = (await rl.question("삭제할 번호 (Enter=취소): ")).trim();
    if (d) { cfg.effects.splice(+d - 1, 1); store(cfg); console.log("삭제했어요. 5) 내보내기로 manifest를 갱신하세요."); }
  } else if (ch === "5") {
    run("node", ["tools/pixelfx/export.mjs"], ROOT);
  } else if (ch === "6") {
    const id = await rl.question("검사할 id: ");
    run("node", ["tools/check.mjs", id.trim()], PFX);
  }
}
rl.close();
