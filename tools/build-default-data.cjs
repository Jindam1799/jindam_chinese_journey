// data/game-data.json → js/default-data.js (JSON을 못 읽을 때 쓰는 내장 사본)
// 사용법: node tools/build-default-data.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/game-data.json'), 'utf8'));
const out = '/* 자동 생성: data/game-data.json 사본 (JSON을 못 불러올 때 사용). tools/build-default-data.js 로 갱신 */\n' +
  'window.DT = window.DT || {};\nwindow.DT.DEFAULT_DATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(root, 'js/default-data.js'), out);
console.log('js/default-data.js 갱신 완료 (스테이지 ' + data.stages.length + '개, 어휘 ' + data.vocab.length + '개, 퀴즈 ' + data.quiz.length + '개)');
