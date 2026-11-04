// 4개 월드 × 8스테이지(x-8 보스) 데이터를 만들어 data/game-data.json 에 씁니다.
// 사용법: node tools/build-stages.cjs   (같은 시드 → 같은 맵. 손으로 고친 맵을 지키려면 이 스크립트 대신 JSON을 직접 수정)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── 어휘: 월드마다 9개 덩어리 ── */
const W = (id, hanzi, pinyin, meaning, reward) => ({
  id, hanzi, pinyin, meaning, reward,
  chars: Array.from(hanzi).map((h, i) => ({ h, p: pinyin.split(' ')[i] }))
});
const VOCAB = [
  // 월드 1: 하루 생활
  [W('heshui', '喝水', 'hē shuǐ', '물을 마시다', 'heal'), W('chifan', '吃饭', 'chī fàn', '밥을 먹다', 'score'), W('kanshu', '看书', 'kàn shū', '책을 보다', 'power'),
   W('shuijiao', '睡觉', 'shuì jiào', '잠을 자다', 'heal'), W('xishou', '洗手', 'xǐ shǒu', '손을 씻다', 'score'), W('shuaya', '刷牙', 'shuā yá', '이를 닦다', 'power'),
   W('chuanyi', '穿衣', 'chuān yī', '옷을 입다', 'score'), W('paobu', '跑步', 'pǎo bù', '달리기하다', 'power'), W('changge', '唱歌', 'chàng gē', '노래를 부르다', 'heal')],
  // 월드 2: 학교와 놀이
  [W('shangxue', '上学', 'shàng xué', '학교에 가다', 'score'), W('xiezi', '写字', 'xiě zì', '글씨를 쓰다', 'power'), W('huahua', '画画', 'huà huà', '그림을 그리다', 'heal'),
   W('tiaowu', '跳舞', 'tiào wǔ', '춤을 추다', 'power'), W('tingge', '听歌', 'tīng gē', '노래를 듣다', 'heal'), W('daqiu', '打球', 'dǎ qiú', '공놀이하다', 'score'),
   W('youyong', '游泳', 'yóu yǒng', '수영하다', 'power'), W('kaiche', '开车', 'kāi chē', '운전하다', 'score'), W('huijia', '回家', 'huí jiā', '집에 가다', 'heal')],
  // 월드 3: 음식과 집
  [W('chitang', '吃糖', 'chī táng', '사탕을 먹다', 'score'), W('henai', '喝奶', 'hē nǎi', '우유를 마시다', 'heal'), W('zuofan', '做饭', 'zuò fàn', '밥을 하다', 'power'),
   W('hecha', '喝茶', 'hē chá', '차를 마시다', 'heal'), W('maicai', '买菜', 'mǎi cài', '장을 보다', 'score'), W('xizao', '洗澡', 'xǐ zǎo', '목욕하다', 'heal'),
   W('qichuang', '起床', 'qǐ chuáng', '일어나다', 'power'), W('kaimen', '开门', 'kāi mén', '문을 열다', 'score'), W('kanhai', '看海', 'kàn hǎi', '바다를 보다', 'power')],
  // 월드 4: 자연과 여행
  [W('pashan', '爬山', 'pá shān', '산에 오르다', 'power'), W('kanhua', '看花', 'kàn huā', '꽃을 보다', 'heal'), W('zuochuan', '坐船', 'zuò chuán', '배를 타다', 'score'),
   W('xiayu', '下雨', 'xià yǔ', '비가 오다', 'heal'), W('guafeng', '刮风', 'guā fēng', '바람이 불다', 'power'), W('kanyun', '看云', 'kàn yún', '구름을 보다', 'score'),
   W('zhaoxiang', '照相', 'zhào xiàng', '사진을 찍다', 'score'), W('weiyu', '喂鱼', 'wèi yú', '물고기 밥을 주다', 'heal'), W('zhongshu', '种树', 'zhòng shù', '나무를 심다', 'power')]
];

/* ── 월드 ── */
const WORLDS = [
  { theme: 'guilin', place: '구이린', names: ['리강 나루터', '코끼리 코 바위', '대나무 뗏목길', '양숴 들판', '달빛 언덕', '노을 강변', '안개 봉우리'],
    mix: ['mush', 'mush', 'gob', 'snail', 'bird', 'puppy'],
    boss: { kind: 'mush', name: '거대 혼동버섯', hp: 6, tint: 0xe6b8ff, minions: ['mush', 'gob', 'puppy'] } },
  { theme: 'zhangjiajie', place: '장자제', names: ['기둥 숲 입구', '구름 다리', '천자산', '금편 계곡', '하늘 사다리', '천문동 앞', '안개 절벽'],
    mix: ['mush', 'gob', 'gob', 'snail', 'bird', 'frog', 'monkey', 'puppy'],
    boss: { kind: 'gob', name: '왕먹깨비', hp: 7, tint: 0xb8c8ff, minions: ['gob', 'snail', 'monkey'] } },
  { theme: 'jiuzhaigou', place: '주자이거우', names: ['다섯 빛깔 호수', '거울 호수', '진주 여울', '노르랑 폭포', '단풍 숲길', '판다 호수', '긴 바다'],
    mix: ['frog', 'frog', 'mush', 'bird', 'thief', 'snail', 'dragon', 'monkey'],
    boss: { kind: 'frog', name: '대왕 병음개구리', hp: 8, tint: 0xffd0a0, minions: ['frog', 'mush', 'dragon'] } },
  { theme: 'huangshan', place: '황산', names: ['영객송 쉼터', '구름 바다', '광명정', '서해 협곡', '시신봉', '연꽃봉', '일출 정상'],
    mix: ['thief', 'gob', 'frog', 'bird', 'snail', 'mush', 'dragon', 'monkey', 'puppy'],
    boss: { kind: 'thief', name: '도둑대왕', hp: 10, tint: 0xffe08a, minions: ['thief', 'snail', 'monkey', 'dragon'] } }
];

/* ── 발판 배치 (5·8·11행) ── */
const LAYOUTS = [
  ['#....==========....#', '#=====........=====#', '#...============...#'],
  ['#=====.....========#', '#..===..======..===#', '#=======....=======#'],
  ['#..======..======..#', '#=======....=======#', '#.....========.....#'],
  ['#=====.===..===.===#', '#.====..====..====.#', '#===....====....===#'],
  ['#=======....=======#', '#....==========....#', '#=====........=====#'],
  ['#...====....====...#', '#==....======....==#', '#....====..====....#'],
  ['#.=============....#', '#....=============.#', '#.=============....#'],
  ['#===.===.===.===.==#', '#.===.===.===.===..#', '#===.===.===.===.==#']
];
const BOSS_LAYOUT = ['#===............===#', '#......======......#', '#====..........====#'];
const CODE = { mush: 'm', gob: 'k', thief: 't', bird: 'b', frog: 'f', snail: 's', dragon: 'd', monkey: 'o', puppy: 'p' };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const E = '#..................#';
const set = (row, c, ch) => row.slice(0, c) + ch + row.slice(c + 1);

/* ── 다양한 지형: 계단(#) · 경사로(/ \\, 내려갈 때 미끄러짐) · 점프 구간(작은 발판) ── */
const empty = (m, r, c) => r >= 1 && r <= 13 && c >= 1 && c <= 18 && m[r][c] === '.';
function addStairs(m, R) {
  // 바닥에서 시작하는 3단 계단 (블록 2칸 너비씩 한 칸씩 올라감)
  const left = R() < 0.5;
  const c0 = left ? 1 + Math.floor(R() * 2) : 12 + Math.floor(R() * 2);
  for (let k = 0; k < 3; k++) {
    const cs = left ? [c0 + k * 2, c0 + k * 2 + 1] : [c0 + 5 - k * 2, c0 + 4 - k * 2];
    cs.forEach(c => { for (let r = 13 - k; r <= 13; r++) if (c >= 1 && c <= 18 && m[r][c] !== 'P') m[r] = set(m[r], c, '#'); });
  }
}
function addRamp(m, R, lowRow) {
  // lowRow 위(바닥 13행 또는 발판 10행)에서 3칸 위 발판(11행 또는 8행)으로 이어지는 45도 경사로
  const topRow = lowRow - 2, platRow = topRow;
  const row = m[platRow];
  const segs = [];
  for (let c = 1; c < 19; c++) {
    if (row[c] === '=' && row[c - 1] !== '=') segs.push(['start', c]);
    if (row[c] === '=' && row[c + 1] !== '=') segs.push(['end', c]);
  }
  for (const [kind, c] of DTshuffle(segs, R)) {
    const cells = kind === 'start' ? [[lowRow, c - 3, '/'], [lowRow - 1, c - 2, '/'], [lowRow - 2, c - 1, '/']]
                                   : [[lowRow - 2, c + 1, '\\'], [lowRow - 1, c + 2, '\\'], [lowRow, c + 3, '\\']];
    if (cells.every(([r, cc]) => empty(m, r, cc) && (r !== 13 || Math.abs(cc - 10) > 1))) {
      cells.forEach(([r, cc, ch]) => { m[r] = set(m[r], cc, ch); });
      return true;
    }
  }
  return false;
}
function addHops(m, R) {
  // 한 발판 줄을 지우고 높이가 다른 작은 발판들로 바꿈 (점프를 많이 해야 하는 구간)
  const r = R() < 0.5 ? 8 : 5;
  m[r] = '#' + m[r].slice(1, 19).replace(/=/g, '.') + '#';
  let c = 2 + Math.floor(R() * 2);
  let up = R() < 0.5;
  while (c < 18) {
    const rr = up ? r - 1 : r + 1;
    const w = R() < 0.6 ? 1 : 2;
    for (let k = 0; k < w && c + k < 19; k++) if (m[rr][c + k] === '.') m[rr] = set(m[rr], c + k, '=');
    c += w + 2 + Math.floor(R() * 2);
    up = !up;
  }
}
function DTshuffle(a, R) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function makeMap(layout, enemies, R, features) {
  const m = ['....................', E, E, E, E, layout[0], E, E, layout[1], E, E, layout[2], E, '#.........P........#', '####################'];
  const ORDER = { stairs: 0, hops: 1, ramp: 2, ramp2: 3 };
  (features || []).slice().sort((a, b) => ORDER[a] - ORDER[b]).forEach(f => {
    if (f === 'stairs') addStairs(m, R);
    else if (f === 'ramp') addRamp(m, R, 13);
    else if (f === 'ramp2') addRamp(m, R, 10);
    else if (f === 'hops') addHops(m, R);
  });
  // 놓을 수 있는 칸: 발판(5·8·11행) 바로 위, 바닥(13행)은 시작 위치에서 먼 곳
  const spots = [];
  for (let r = 3; r <= 13; r++) for (let c = 1; c < 19; c++) {
    if ((m[r][c] === '=' || (m[r][c] === '#' && r < 13)) && m[r - 1][c] === '.') spots.push([r - 1, c]);
  }
  for (let c = 1; c < 19; c++) if (Math.abs(c - 10) >= 6 && m[13][c] === '.') spots.push([13, c]);
  const air = [];
  [2, 6, 9].forEach(r => { for (let c = 2; c < 18; c++) air.push([r, c]); });
  const used = new Set();
  const take = (list) => {
    for (let tries = 0; tries < 200; tries++) {
      const [r, c] = list[Math.floor(R() * list.length)];
      if ([-1, 0, 1].some(d => used.has(r + ',' + (c + d)))) continue;
      used.add(r + ',' + c);
      return [r, c];
    }
    return null;
  };
  enemies.forEach(kind => {
    const p = take(kind === 'bird' ? air : spots);
    if (p) m[p[0]] = set(m[p[0]], p[1], CODE[kind]);
  });
  return m;
}

/* ── 진담 점프: 세로로 긴 등반 맵 (아래에서 가시덩굴·독초가 올라옴) ── */
function makeClimbMap(rows, R, mix, count) {
  const m = [];
  m.push('....................');
  m.push(E); m.push(E);
  m.push('#=========G========#');           // 골 발판 + 깃발
  for (let r = 4; r < rows - 2; r++) m.push(E);
  m.push('#.........P........#');
  m.push('####################');
  // 3줄마다 발판 줄: 조각 2~3개, 일부는 무너지는 발판(C) 또는 움직이는 발판(M)
  const platRows = [];
  for (let r = rows - 4; r >= 6; r -= 3) platRows.push(r);
  platRows.forEach((r, i) => {
    let row = E;
    const roll = R();
    if (i > 1 && roll < 0.2) {
      const c = 2 + Math.floor(R() * 14);
      row = set(row, c, 'M');
      // 움직이는 발판 줄에는 양 끝에 작은 쉼터를 둠
      row = set(set(row, 1, '='), 2, '=');
    } else {
      const segs = 2 + Math.floor(R() * 2);
      const zones = segs === 2 ? [[1, 9], [10, 18]] : [[1, 6], [7, 12], [13, 18]];
      zones.forEach(([a, b]) => {
        const w = 3 + Math.floor(R() * Math.min(4, b - a - 1));
        const st = a + Math.floor(R() * Math.max(1, b - a - w + 1));
        const crumble = i > 0 && R() < 0.3;
        for (let c = st; c < Math.min(19, st + w); c++) row = set(row, c, crumble ? 'C' : '=');
      });
    }
    m[r] = row;
  });
  // 경사로: 발판 끝에서 위 줄 발판으로 이어지는 오르막 (가끔)
  platRows.forEach((r, i) => {
    if (i < 2 || R() > 0.25 || r - 3 < 5) return;
    for (let c = 2; c < 16; c++) {
      if (m[r][c] === '=' && m[r][c + 1] === '.' && m[r - 3][c + 4] === '=' &&
          [[r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]].every(([rr, cc]) => m[rr][cc] === '.')) {
        m[r - 1] = set(m[r - 1], c + 1, '/'); m[r - 2] = set(m[r - 2], c + 2, '/'); m[r - 3] = set(m[r - 3], c + 3, '/');
        break;
      }
    }
  });
  // 가시 장애물(^): 일부 발판 위에 2칸짜리 가시 (닿으면 아야)
  platRows.forEach((r, i) => {
    if (i < 1 || R() > 0.3) return;
    const cs = [];
    for (let c = 1; c < 18; c++) if (m[r][c] === '=' && m[r][c + 1] === '=' && m[r - 1][c] === '.' && m[r - 1][c + 1] === '.') cs.push(c);
    if (cs.length < 3) return;
    const c = cs[Math.floor(R() * cs.length)];
    m[r - 1] = set(set(m[r - 1], c, '^'), c + 1, '^');
  });
  // 몬스터: 단단한 발판(=) 위에만
  const spots = [];
  platRows.forEach(r => { for (let c = 1; c < 19; c++) if (m[r][c] === '=' && r < rows - 6) spots.push([r - 1, c]); });
  const used = new Set();
  for (let i = 0; i < count && spots.length; i++) {
    const kind = mix[Math.floor(R() * mix.length)];
    if (kind === 'bird') {
      const r = 5 + Math.floor(R() * (rows - 14)), c = 3 + Math.floor(R() * 14);
      if (m[r][c] === '.') m[r] = set(m[r], c, 'b');
      continue;
    }
    for (let t = 0; t < 30; t++) {
      const [r, c] = spots[Math.floor(R() * spots.length)];
      if ([-1, 0, 1].some(d => used.has(r + ',' + (c + d)))) continue;
      used.add(r + ',' + c); m[r] = set(m[r], c, CODE[kind]); break;
    }
  }
  return m;
}

const STORY = [
  { // 구이린
    0: [['N', '“구이린의 산과 물은 천하제일!”이라는 말이 있을 만큼 아름다운 곳, 구이린에 도착했어요.'], ['H', '와! 산봉우리가 꼭 죽순처럼 동글동글 솟아 있어!']],
    1: [['N', '리강 물에 코를 담그고 물을 마시는 듯한 바위, 상비산(코끼리 코 산)이에요.'], ['H', '코끼리 바위 뒤에 몬스터들이 숨어 있어. 喝水! 물 한 모금 마시고 가자!']],
    2: [['N', '리강에서는 대나무 뗏목을 타고 봉우리 사이를 천천히 지나가요.'], ['H', '뗏목길에 조각이 떠다녀! 하나도 놓치지 말자.']],
    3: [['N', '양숴의 들판에는 논과 마을 사이로 카르스트 봉우리가 우뚝 서 있어요.'], ['H', '똥강아지가 여기저기 똥을 누고 다니네… 밟지 않게 조심!']],
    4: [['N', '월량산(달빛 언덕)에는 산 한가운데 커다란 반달 모양 구멍이 뚫려 있어요.'], ['H', '달빛 구멍 너머로 조각이 반짝여!']],
    5: [['N', '해 질 녘 리강은 강물까지 주황빛으로 물들어요.'], ['H', '노을이 지기 전에 다 모으자!']],
    6: [['N', '아침이 되면 봉우리 사이로 하얀 안개가 피어올라요.'], ['H', '안개 속에서 커다란 그림자가 움직였어… 보스가 가까이 있어!']],
    J: [['N', '진담 점프! 아래에서 가시덩굴이 쑥쑥 자라 올라와요.'], ['H', '제한 시간 안에 꼭대기 깃발까지 올라가야 해. 가자!']],
    B: [['B', '크하하! 이 혼란의 포자로 모든 말을 뒤죽박죽 만들어 주마!'], ['H', '거대 혼동버섯! 졸개들을 봉인해서 구체로 맞혀 주자!']]
  },
  { // 장자제
    0: [['N', '하늘을 찌르는 사암 기둥이 3천 개가 넘게 솟은 곳, 장자제에 도착했어요.'], ['H', '기둥 하나하나가 거인처럼 커!']],
    1: [['N', '장자제 협곡 위에는 아찔한 유리 다리가 놓여 있어요. 발밑이 훤히 보여요!'], ['H', '아래 보면 안 돼… 앞만 보고 가자!']],
    2: [['N', '천자산에 오르면 구름 위로 봉우리들이 섬처럼 떠 있어요.'], ['H', '던짐원숭이가 복숭아를 던져! 포물선을 잘 보고 피하자.']],
    3: [['N', '금편계는 맑은 시냇물이 기둥 사이를 따라 흐르는 골짜기예요.'], ['H', '시냇물 소리가 좋다~ 그래도 방심은 금물!']],
    4: [['N', '어떤 기둥 사이에는 하늘로 이어진 듯한 계단과 사다리가 있어요.'], ['H', '하늘 사다리라니, 꼭대기엔 뭐가 있을까?']],
    5: [['N', '천문산의 천문동은 산에 뻥 뚫린 거대한 하늘 문이에요. 999개의 계단이 이어져요.'], ['H', '999계단! 다리가 후들후들…']],
    6: [['N', '절벽 사이로 짙은 안개가 밀려와요.'], ['H', '안개 속에서 먹물 냄새가 나… 왕먹깨비가 틀림없어!']],
    J: [['N', '진담 점프! 이번엔 아래에서 독초가 올라와요.'], ['H', '사암 기둥을 타고 위로, 위로!']],
    B: [['B', '먹물 비를 맞아라! 너희 말 덩어리는 전부 시커멓게 칠해 주지!'], ['H', '왕먹깨비! 돌진할 때 조심하고, 구체로 반격하자!']]
  },
  { // 주자이거우
    0: [['N', '아홉 개의 티베트 마을이 있는 골짜기, 주자이거우예요. 호수 물빛이 보석 같아요.'], ['H', '물이 에메랄드색이야! 바닥까지 다 보여!']],
    1: [['N', '오채지(다섯 빛깔 호수)는 보는 곳마다 물빛이 파랑, 초록, 노랑으로 달라져요.'], ['H', '불뿜이가 입에서 불을 뿜어! 정면에 서 있지 말자!']],
    2: [['N', '경해(거울 호수)는 바람이 없으면 하늘과 산이 거울처럼 비쳐요.'], ['H', '거울 호수에 내 얼굴이 비친다. 오늘도 멋진걸!']],
    3: [['N', '진주탄(진주 여울)에서는 물방울이 진주처럼 튀어 올라요.'], ['H', '반짝반짝 물방울 사이에 조각이 섞여 있어!']],
    4: [['N', '노르랑 폭포는 넓고 낮게 펼쳐진 계단 모양 폭포예요.'], ['H', '폭포 물보라가 시원해!']],
    5: [['N', '가을이 되면 주자이거우 숲은 빨강, 주황, 노랑 단풍으로 물들어요.'], ['H', '단풍잎이 흩날려. 꼭 불꽃놀이 같아!']],
    6: [['N', '장해(긴 바다)는 주자이거우에서 가장 크고 높은 곳에 있는 호수예요.'], ['H', '호수 건너편에서 개굴개굴… 엄청 큰 소리야!']],
    J: [['N', '진담 점프! 가시덩굴이 폭포를 타고 올라와요.'], ['H', '젖은 발판은 미끄러울지도 몰라. 집중!']],
    B: [['B', '개굴! 내 점프 한 번이면 땅이 흔들린다! 충격파를 피할 수 있겠냐?'], ['H', '대왕 병음개구리! 착지할 때 충격파를 점프로 피하자!']]
  },
  { // 황산
    0: [['N', '기이한 소나무, 기묘한 바위, 구름 바다, 온천! 네 가지 절경으로 유명한 황산이에요.'], ['H', '드디어 마지막 산이야. 모두 힘내자!']],
    1: [['N', '구름이 발아래 바다처럼 펼쳐지는 황산의 운해예요.'], ['H', '구름 위를 걷는 기분이야!']],
    2: [['N', '광명정은 해돋이와 운해를 한눈에 볼 수 있는 높은 봉우리예요.'], ['H', '저기 해가 떠오른다!']],
    3: [['N', '서해대협곡은 깎아지른 절벽 사이로 좁은 길이 이어지는 협곡이에요.'], ['H', '몬스터가 사방에서 공격해! 조심조심…']],
    4: [['N', '시신봉의 이름에는 “직접 보고서야 그 아름다움을 믿었다”는 뜻이 담겨 있어요.'], ['H', '정말 믿기지 않을 만큼 멋진 경치야!']],
    5: [['N', '연화봉은 연꽃처럼 생긴 황산에서 가장 높은 봉우리예요.'], ['H', '연꽃 봉우리 꼭대기가 보여!']],
    6: [['N', '일출 정상에 오르자, 커다란 자루를 멘 그림자가 나타났어요.'], ['H', '조각을 훔쳐 간 범인… 도둑대왕이야!']],
    J: [['N', '진담 점프! 마지막 등반이에요. 독초가 빠르게 올라와요!'], ['H', '영객송이 꼭대기에서 손을 흔들어 주는 것 같아!']],
    B: [['B', '흐흐흐, 숲의 말 조각은 전부 내 자루 속에 있지! 돌려받고 싶으면 와 봐라!'], ['H', '도둑대왕! 모두의 말을 돌려줘!']]
  }
];

const stages = [];
WORLDS.forEach((w, wi) => {
  const pool = VOCAB[wi].map(v => v.id);
  for (let n = 0; n < 8; n++) {
    const id = `${wi + 1}-${n + 1}`;
    const R = rng(wi * 100 + n * 7 + 3);
    const chunks = [0, 1, 2].map(k => pool[(n * 3 + k) % pool.length]);
    if (n === 7) {
      stages.push({ id, name: `${w.place} · ${w.boss.name}`, theme: w.theme, chunks, map: makeMap(BOSS_LAYOUT, [], R),
        boss: w.boss, world: wi + 1, story: STORY[wi].B });
      continue;
    }
    const count = Math.min(16, 10 + Math.floor(n * 0.7) + wi);
    const enemies = [];
    for (let i = 0; i < count; i++) enemies.push(w.mix[Math.floor(R() * w.mix.length)]);
    const layout = LAYOUTS[(wi * 3 + n) % LAYOUTS.length];
    // 지형 다양화: 뒤로 갈수록 기능이 늘어남 (1-1·1-2는 평평한 연습 스테이지)
    const level = wi * 7 + n;
    const POOL = [['stairs'], ['ramp'], ['hops'], ['ramp', 'stairs'], ['ramp2', 'hops'], ['ramp', 'ramp2'], ['stairs', 'hops', 'ramp']];
    const features = level < 2 ? [] : POOL[(level - 2) % POOL.length].concat(level > 14 ? ['ramp'] : []).concat(level > 21 ? ['hops'] : []);
    stages.push({ id, name: `${w.place} · ${w.names[n]}`, theme: w.theme, chunks, map: makeMap(layout, enemies, R, features), world: wi + 1, story: STORY[wi][n], terrain: features });
    if (n === 3) {
      // x-4 다음: 진담 점프 등반 미션
      const CR = rng(wi * 999 + 17);
      const rows = 64 + wi * 8;
      stages.push({ id: `${wi + 1}-J`, name: `${w.place} · 진담 점프!`, theme: w.theme, chunks: [0, 1, 2].map(k => pool[(k * 4 + wi) % pool.length]),
        map: makeClimbMap(rows, CR, w.mix, 14 + wi * 3), world: wi + 1,
        // 문제 관문: 12줄마다 (지나가면 퀴즈, 틀리면 가시가 더 빨라짐)
        climb: { time: 80 - wi * 5, hazard: wi % 2 === 0 ? 'thorn' : 'poison', speed: 12 + wi * 2, accel: 0.25 + wi * 0.04,
          gates: Array.from({ length: Math.floor((rows - 16) / 12) }, (_, k) => rows - 10 - k * 12).filter(r => r > 6) },
        story: STORY[wi].J });
    }
  }
});

const vocab = [].concat(...VOCAB);
stages.forEach(s => {
  if ((!s.climb && s.map.length !== 15) || s.map.some(r => r.length !== 20)) throw new Error('맵 크기 오류 ' + s.id);
});
const data = { version: 3, vocab, quiz: [], stages };
fs.writeFileSync(path.join(ROOT, 'data/game-data.json'), JSON.stringify(data, null, 1));
console.log(`스테이지 ${stages.length}개 (보스 ${stages.filter(s => s.boss).length}), 어휘 ${vocab.length}개`);
stages.forEach(s => console.log(s.id.padEnd(4), String(s.map.join('').replace(/[^mktbfs]/g, '').length).padStart(2), s.boss ? 'BOSS ' + s.boss.name : s.name));
