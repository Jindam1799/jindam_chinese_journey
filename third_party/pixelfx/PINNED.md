# pixelfx (vendored)

- 출처: https://github.com/patch-gg/pixelfx
- 고정 버전: v0.3.0, commit `a84159688af3ca37a4be05a0d422b94451b2e24e`
- 제외한 것: `gallery/`(Patch Pixel 폰트 포함, MIT 대상 아님), `tools/build-gallery.mjs`·`tools/serve.mjs`(갤러리 전용, 폰트 사용), `docs/readme/`(GIF), `.github/`
- 갱신: `bash tools/pixelfx/fetch-pixelfx.sh <commit>` (기본값은 위 커밋)

이 폴더의 코드는 수정하지 않습니다. 직접 만든 이펙트는 `fx-src/<category>/<name>.js`에 둡니다.
