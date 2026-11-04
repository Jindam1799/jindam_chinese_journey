#!/usr/bin/env bash
# pixelfx를 고정 커밋으로 다시 받아 third_party/pixelfx 에 넣습니다. (Patch Pixel 폰트와 갤러리는 제외)
#   bash tools/pixelfx/fetch-pixelfx.sh            # 기본 고정 커밋 (v0.3.0)
#   bash tools/pixelfx/fetch-pixelfx.sh <commit>   # 다른 커밋으로 올릴 때 (THIRD_PARTY_NOTICES.md·PINNED.md도 갱신하세요)
set -euo pipefail
PIN="${1:-a84159688af3ca37a4be05a0d422b94451b2e24e}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
git clone --quiet https://github.com/patch-gg/pixelfx "$TMP/pixelfx"
git -C "$TMP/pixelfx" checkout --quiet "$PIN"
rm -rf "$ROOT/third_party/pixelfx"
mkdir -p "$ROOT/third_party/pixelfx"
git -C "$TMP/pixelfx" archive --format=tar "$PIN" | tar -x -C "$ROOT/third_party/pixelfx"
cd "$ROOT/third_party/pixelfx"
rm -rf gallery docs/readme .github records tools/build-gallery.mjs tools/serve.mjs
if grep -rqi "PatchPixel" --include=*.js --include=*.mjs --include=*.css --include=*.html . ; then
  echo "경고: Patch Pixel 폰트 참조가 남아 있습니다. 확인하세요." >&2
fi
cat > PINNED.md <<MD
# pixelfx (vendored)

- 출처: https://github.com/patch-gg/pixelfx
- 고정 버전: commit \`$PIN\`
- 제외한 것: \`gallery/\`(Patch Pixel 폰트 포함, MIT 대상 아님), \`tools/build-gallery.mjs\`·\`tools/serve.mjs\`(갤러리 전용, 폰트 사용), \`docs/readme/\`(GIF), \`.github/\`
- 갱신: \`bash tools/pixelfx/fetch-pixelfx.sh <commit>\`

이 폴더의 코드는 수정하지 않습니다. 직접 만든 이펙트는 \`fx-src/<category>/<name>.js\`에 둡니다.
MD
rm -rf "$TMP"
echo "pixelfx $PIN → third_party/pixelfx"
