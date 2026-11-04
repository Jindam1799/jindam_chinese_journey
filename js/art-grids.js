/* 도트 그래픽 원본 데이터 (16x16 등). '.' = 투명. 팔레트 문자는 PALETTE 참고.
   이미지 파일 없이 코드로 텍스처를 생성하므로 GitHub Pages에서 리소스 로딩 실패가 없습니다. */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});
  const E = '................';

  const PALETTE = {
    K: '#1a1c2c', // 외곽선
    G: '#38b764', g: '#a7f070', D: '#257179', // 초록 계열
    W: '#f4f4f4', P: '#ff8c9a', B: '#8a4b2a', R: '#b13e53',
    M: '#b55088', m: '#7a2f6a', c: '#f2d3ab', // 혼동버섯
    I: '#333c57', i: '#566c86', // 먹깨비
    N: '#29366f', n: '#3b5dc9', S: '#f2c0a2', U: '#f4f4f4', u: '#b13e53', y: '#ffcd75', // 단어도둑
    Y: '#ffcd75', O: '#ef7d57', C: '#73eff7', L: '#94b0c2',
    Q: '#41a6f6', q: '#b8e6ff', // 성조새 · 퐁이
    A: '#c27c4a', a: '#f2c38a'  // 도토
  };

  function rep(base, changes) {
    const r = base.slice();
    for (const k in changes) r[k] = changes[k];
    return r;
  }
  // 한 줄을 빼고 위쪽을 한 칸 내려서 '찌그러진' 프레임을 만든다
  function squash(rows, removeRow) {
    return [E].concat(rows.slice(0, removeRow), rows.slice(removeRow + 1));
  }
  // 몸통(0~13행)을 한 칸 위로 올린다 (다리 사이가 벌어진 느낌)
  function bobUp(rows) {
    return rows.slice(1, 14).concat([E, rows[14], rows[15]]);
  }

  /* ───────── 툭이 (오른쪽을 바라봄) ───────── */
  const TUK = [
    E,
    '........gg......',
    '......ggGg.gg...',
    '.....gGGgDgGGg..',
    '......ggDDgg....',
    '....KKKKKKKKK...',
    '...KGGgggGGGGK..',
    '..KGgggGGGGGGGK.',
    '..KGgGGGWKGWKGK.',
    '..KGGGGGKKGKKGK.',
    '..KGGGGPGGGGGPK.',
    '..KGGGGGGKKGGGK.',
    '...KGGGGGGGGGK..',
    '....KKKKKKKKK...',
    '....KBK...KBK...',
    '....BBB...BBB...'
  ];
  const EYES_CLOSED = { 8: '..KGgGGGGGGGGGK.', 9: '..KGGGGGKKGKKGK.' };
  const tukIdle2 = squash(TUK, 7);
  const tukBlink = rep(TUK, EYES_CLOSED);
  const tukRun1 = rep(bobUp(TUK), { 14: '...KBK.....KBK..', 15: '...BBB.....BBB..' });
  const tukRun2 = rep(TUK, { 14: '.....KBKKBK.....', 15: '.....BBBBBB.....' });
  const tukJump = rep(bobUp(TUK), { 13: '.....KBKKBK.....', 14: '.....BBBBBB.....', 15: E });
  const tukFall = rep(TUK, { 14: '..KBK.......KBK.', 15: '..BB.........BB.' });
  const tukShoot = rep(TUK, {
    8: '..KGgGGGGKGGKGK.', 9: '..KGGGGGKKGKKGK.',
    11: '..KGGGGGGKRKGGK.', 12: '...KGGGGGGKGGK..'
  });
  const tukHurt = rep(TUK, {
    7: '..KGgggKGGGKGGK.', 8: '..KGgGGGKGGKGGK.', 9: '..KGGGGKGGGGKGK.',
    11: '..KGGGGGKRRKGGK.'
  });
  const tukWin = rep(bobUp(rep(TUK, Object.assign({}, EYES_CLOSED, { 11: '..KGGGGGKRRKGGK.' }))),
    { 14: '...KBK.....KBK..', 15: '...BBB.....BBB..' });

  // 구체 밀기 · 드롭킥 (오른쪽 기준)
  const tukPush1 = rep(TUK, { 8: '..KGgGGGWKGWKGKK', 9: '..KGGGGGKKGKKGKg', 10: '..KGGGGPGGGGGPKg', 11: '..KGGGGGGKKGGGKK',
    14: '...KBK.....KBK..', 15: '...BBB.....BBB..' });
  const tukPush2 = rep(tukPush1, { 14: '.....KBKKBK.....', 15: '.....BBBBBB.....' });
  // 드롭킥: ① 몸을 웅크리고 뛰어오름 → ② 두 발을 앞으로 쭉 뻗음 (게임에서 몸을 뒤로 젖혀 회전)
  const shiftL = (rows, n) => { const r = rows.map(l => l.slice(n) + '.'.repeat(n)); r.shiftL = n; return r; };
  const tukKick = shiftL(rep(TUK, { 8: '..KGgGGGGKGGKGK.', 9: '..KGGGGGKKGKKGK.', 11: '..KGGGGGKRRKGGK.', 14: E, 15: E }), 2);
  // 두 다리를 모아 오른쪽 아래로 쭉 (게임에서 몸을 뒤로 40도 젖히면 앞으로 수평 발차기가 됨)
  tukKick[12] = '.KGGGGGGGGGKK...';
  tukKick[13] = '..KKKKKKKKKBBK..';
  tukKick[14] = '..........KBBBK.';
  tukKick[15] = '...........KBBBK';
  const tukPunch = rep(bobUp(rep(TUK, { 8: '..KGgGGGGKGGKGK.', 9: '..KGGGGGKKGKKGK.' })),
    { 13: '.....KBKKBK.....', 14: '......BBBB......', 15: E });

  /* ───────── 혼동버섯 ───────── */
  const MUSH = [
    E,
    '.....KKKKKK.....',
    '...KKMMMMMMKK...',
    '..KMMWWMMMMMMK..',
    '.KMMWWMMMMWWMMK.',
    '.KMMMMMMMMWWMMK.',
    'KMWWMMMMMMMMMMMK',
    'KMWWMMMMmmMMMMMK',
    '.KKKKKKKKKKKKKK.',
    '...KccccccccK...',
    '...KcKKccKKcK...',
    '...KcKWccKWcK...',
    '...KccccccccK...',
    '...KcccKKcccK...',
    '...KKKK..KKKK...',
    E
  ];
  const mushB = rep(squash(MUSH, 12), { 14: '..KKKK....KKKK..' });
  const mushS1 = rep(MUSH, { 10: '...KcKccccKcK...', 11: '...KccKccKccK...', 13: '...KccKKKKccK...' });
  const mushS2 = rep(squash(mushS1, 12), { 14: '..KKKK....KKKK..' });

  /* ───────── 먹깨비 ───────── */
  const GOB = [
    E,
    '...K........K...',
    '...KK......KK...',
    '....KKKKKKKK....',
    '...KIIIIIIIIK...',
    '..KIiiIIIIIIIK..',
    '..KIiWWIIWWIIK..',
    '..KIIWKIIWKIIK..',
    '.KIIIIIIIIIIIIK.',
    '.KIIIRRRRRRIIIK.',
    '.KIIIRWRRWRIIIK.',
    '.KIIIIRRRRIIIIK.',
    '..KIIIIIIIIIIK..',
    '..KIKIIKKIIKIK..',
    '...K.KK..KK.K...',
    E
  ];
  const gobB = rep(squash(GOB, 8), { 14: '..K..KK..KK..K..' });
  const gobS1 = rep(GOB, { 6: '..KIiKIIIIKIIK..', 7: '..KIIIKIIKIIIK..', 9: '.KIIIIRRRRIIIIK.', 10: '.KIIIRRRRRRIIIK.' });
  const gobS2 = squash(gobS1, 8);

  /* ───────── 단어도둑 ───────── */
  const THIEF = [
    E,
    '.....KKKKKK.....',
    '....KNNNNNNK....',
    '...KNNnNNNNNK...',
    '...KSSSSSSSSK...',
    '...KKKKKKKKKK...',
    '...KKWKKKKWKK...',
    '...KSSSSSSSSK...',
    '...KSSSKKSSSK...',
    '....KKKKKKKK....',
    '..KUuUuUuUuK.yy.',
    '.KSKUuUuUuKSKyy.',
    '..KuUuUuUuUKyyy.',
    '...KNNKKNNK.Kyy.',
    '...KK....KK.....',
    E
  ];
  const thiefB = rep(THIEF, { 13: '..KNNK..KNNK.yy.', 14: '..KK......KK....' });
  const thiefS1 = rep(THIEF, { 6: '...KKKWKKWKKK...', 8: '...KSSKKKKSSK...' });
  const thiefS2 = rep(thiefS1, { 13: '..KNNK..KNNK.yy.', 14: '..KK......KK....' });

  /* ───────── 성조새 (하늘을 날아다님) ───────── */
  const BIRD = [
    E,
    'WW....KKKK....WW',
    'WWW.KKQQQQKK.WWW',
    '.WWKQQQQQQQQKWW.',
    '..KQQWKQQWKQQK..',
    '..KQQKKQQKKQQK..',
    '.KQqQQQOOQQQqQK.',
    '.KQqqQQKKQQqqQK.',
    '.KQQqqqqqqqqQQK.',
    '..KQQqqqqqqQQK..',
    '...KKQQQQQQKK...',
    '.....KKKKKK.....',
    '......Y..Y......',
    '.....YY..YY.....',
    E, E
  ];
  const birdB = rep(BIRD, {
    1: E, 2: '....KKQQQQKK....', 3: '...KQQQQQQQQK...',
    6: 'WKQqQQQOOQQQqQKW', 7: 'WKQqqQQKKQQqqQKW', 8: 'WWKQqqqqqqqqQKWW'
  });
  const BIRD_X = { 4: '..KQQKQQQQKQQK..', 5: '..KQKQKQQKQKQK..' };
  const birdS1 = rep(BIRD, BIRD_X);
  const birdS2 = rep(birdB, BIRD_X);

  /* ───────── 병음개구리 (높이 점프) ───────── */
  const FROG = [
    E, E, E,
    '...KKK....KKK...',
    '..KWWWK..KWWWK..',
    '..KWKWKKKKWKWK..',
    '.KOOOOOOOOOOOOK.',
    'KOOOOOOOOOOOOOOK',
    'KOOPOOOOOOOOPOOK',
    'KOOOKKKKKKKKOOOK',
    '.KOOOOOOOOOOOOK.',
    '.KOOYYYYYYYYOOK.',
    'KOOKYYYYYYYYKOOK',
    'KOOKKYYYYYYKKOOK',
    '.KKK.KKKKKK.KKK.',
    E
  ];
  const FROG_LEGS = { 13: '.KOK.KYYYYK.KOK.', 14: '.KK...KKKK...KK.' };
  const frogB = rep(FROG, FROG_LEGS);
  const frogS1 = rep(FROG, { 5: '..KKWKKKKKKWKK..', 9: 'KOOOKRRRRRRKOOOK' });
  const frogS2 = rep(frogS1, FROG_LEGS);

  /* ───────── 느림보달팽이 (단단함) ───────── */
  const SNAIL = [
    E, E, E,
    '...KKKKK........',
    '..KOOOOOK...K.K.',
    '.KOOYYYOOK..K.K.',
    '.KOYOOOYOK.KccK.',
    'KOYOOYOOYOKcWKcK',
    'KOYOYYOOYOKccccK',
    'KOYOOOOYOOKcPccK',
    'KOOYYYYOOKcccccK',
    '.KOOOOOOKccccccK',
    'KKKKKKKKccccccK.',
    'KcccccccccccccK.',
    '.KKKKKKKKKKKKK..',
    E
  ];
  const snailB = rep(SNAIL, { 4: '..KOOOOOK..K..K.', 13: '.KccccccccccccK.', 14: '..KKKKKKKKKKKK..' });
  const snailS1 = rep(SNAIL, { 7: 'KOYOOYOOYOKcKKcK', 9: 'KOYOOOOYOOKcRRcK' });
  const snailS2 = rep(snailS1, { 13: '.KccccccccccccK.', 14: '..KKKKKKKKKKKK..' });

  /* ───────── 불뿜이 (입에서 불을 뿜는 꼬마 용) ───────── */
  const DRAGON = [
    E,
    '.....KK..KK.....',
    '....KYK..KYK....',
    '...KKRRKKRRKK...',
    '..KRRRRRRRRRRK..',
    '..KRWKRRRRWKRK..',
    '.KRRKKRRRRKKRRK.',
    'KORRRRRRRRRRRROK',
    'KOOKKKRRRRKKKOOK',
    '.KOOOOKKKKOOOOK.',
    '..KRRRRRRRRRRK..',
    '.KYKRYYYYYYRKYK.',
    '.KYKRYYYYYYRKYK.',
    '..KKRRRRRRRRKK..',
    '...KRK....KRK...',
    E
  ];
  const dragonB = rep(DRAGON, { 14: '..KRK......KRK..' });
  const DRAGON_X = { 5: '..KRKRKRRKRKRK..', 6: '.KRRRKRRRRKRRRK.', 8: 'KOOKRRRRRRRRKOOK' };
  const dragonS1 = rep(DRAGON, DRAGON_X);
  const dragonS2 = rep(dragonB, DRAGON_X);

  /* ───────── 던짐원숭이 (복숭아를 포물선으로 던짐) ───────── */
  const MONKEY = [
    E,
    '.....KKKKKK.....',
    '...KKBBBBBBKK...',
    '..KBBBBBBBBBBK..',
    '.KcKBccccccBKcK.',
    '.KcKcWKccWKcKcK.',
    '..KBcKKccKKcBK..',
    '..KBcccPPcccBK..',
    '...KBccKKccBK...',
    '....KKBBBBKK....',
    '...KBBBBBBBBK...',
    '..KcKBBBBBBKcK..',
    '..KcKBBccBBKcK..',
    '...K.KBBBBK.K...',
    '....KBK..KBK....',
    E
  ];
  const monkeyB = rep(MONKEY, { 11: '..KBKBBBBBBKcK..', 12: '.KcKKBBccBBK.KK.', 14: '...KBK....KBK...' });
  const MONKEY_X = { 5: '.KcKcKcccKcKKcK.', 6: '..KBccKccKccBK..', 8: '...KBcKKKKcBK...' };
  const monkeyS1 = rep(MONKEY, MONKEY_X);
  const monkeyS2 = rep(monkeyB, MONKEY_X);

  /* ───────── 똥강아지 (지나가며 똥을 누고 감) ───────── */
  const PUPPY = [
    E, E,
    '..KK........KK..',
    '.KBBK......KBBK.',
    '.KBBKKKKKKKKBBK.',
    '..KKccccccccKK..',
    '..KcWKccccWKcK..',
    '..KcKKccccKKcK..',
    '..KccccKKcccc K.'.replace(' ', 'c'),
    '...KccRRRRccK...',
    '....KKKKKKKK....',
    '..KBBccccccBBK..',
    '.KBBcccccccccBK.',
    '.KBBBBBBBBBBBBKK',
    '..KcK.KK.KK.KcK.',
    E
  ];
  const puppyB = rep(PUPPY, { 14: '..KcKK......KKcK' });
  const PUPPY_X = { 6: '..KcKcKccKcKcK..', 7: '..KccKccccKccK..', 9: '...KcRRRRRRcK...' };
  const puppyS1 = rep(PUPPY, PUPPY_X);
  const puppyS2 = rep(puppyB, PUPPY_X);

  /* ───────── 몬스터 탄 ───────── */
  const FIREBALL = [['..YYOO..', '.YWWYOOR', 'YWWWYYOR', '.YWWYOOR', '..YYOO..'], ['...YOO..', '.YWYYOR.', 'YWWWYOOR', '.YWYYOR.', '...YOO..']];
  const PEACH = ['..GG...', '.KPPGK.', 'KPPPPPK', 'KPWPPPK', 'KPPPPRK', '.KPPRK.', '..KKK..'];
  const POOP = ['....K....', '...KBK...', '..KBBBK..', '..KBBBBK.', '.KBWBBWBK', '.KBBKKBBK', 'KBBBBBBBBK'.slice(0, 9)];

  /* ───────── 소품 ───────── */
  const SEED = [
    '..KKKK..',
    '.KggGGK.',
    'KgWgGGDK',
    'KgggGGDK',
    'KGGGGGDK',
    'KGGGGDDK',
    '.KGDDDK.',
    '..KKKK..'
  ];
  const HEART = ['.KK.KK.', 'KRRKRRK', 'KRWRRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'];
  const HEART_EMPTY = HEART.map(r => r.replace(/[RW]/g, 'I'));
  const LEAF = ['.g.', 'gGg', '.G.'];
  const STAR = ['..Y..', '.YYY.', 'YYWYY', '.YYY.', '..Y..'];
  const SPARK = [
    ['.......', '.......', '...W...', '..WWW..', '...W...', '.......', '.......'],
    ['...W...', '...W...', '...W...', 'WWWgWWW', '...W...', '...W...', '...W...'],
    ['W.....W', '.g...g.', '.......', '...g...', '.......', '.g...g.', 'W.....W']
  ];
  const CURSOR = ['K.....', 'KYK...', 'KYYK..', 'KYYYK.', 'KYYK..', 'KYK...', 'K.....'];
  const SPEAKER = [
    '....KK.......',
    '...KYK...K...',
    '..KYYK....K..',
    'KKYYYK.K...K.',
    'KYYYYK..K..K.',
    'KYYYYK..K..K.',
    'KKYYYK.K...K.',
    '..KYYK....K..',
    '...KYK...K...',
    '....KK.......'
  ];
  const DECO = {
    tuft: ['........', '.g...g..', '.gG.gG.g', 'gGGgGGgG'],
    shroom: ['.RRRR.', 'RWRRWR', 'RRRRRR', '..cc..', '..cc..'],
    flower: ['.Y.', 'YOY', '.Y.', '.G.', 'GG.'],
    flower2: ['.P.', 'PWP', '.P.', '.G.', '.GG']
  };

  // 주인공 머리 장식 (아래쪽 정렬로 몸통 위에 붙음)
  const TOPPERS = {
    tuk: null,
    pong: ['.........Q......', '........QqQ.....', '.......QqWqQ....', '.......QqqqQ....', '........QQQ.....'],
    doto: ['........B.......', '......BBBBB.....', '....BBYBBBYBB...', '....BBBBBBBBB...']
  };

  DT.GRIDS = {
    TOPPERS,
    PALETTE,
    tuk: [TUK, tukIdle2, tukBlink, tukRun1, tukRun2, tukJump, tukFall, tukShoot, tukHurt, tukWin, tukPush1, tukPush2, tukKick, tukPunch],
    mush: [MUSH, mushB, mushS1, mushS2],
    gob: [GOB, gobB, gobS1, gobS2],
    thief: [THIEF, thiefB, thiefS1, thiefS2],
    bird: [BIRD, birdB, birdS1, birdS2],
    frog: [FROG, frogB, frogS1, frogS2],
    snail: [SNAIL, snailB, snailS1, snailS2],
    dragon: [DRAGON, dragonB, dragonS1, dragonS2],
    monkey: [MONKEY, monkeyB, monkeyS1, monkeyS2],
    puppy: [PUPPY, puppyB, puppyS1, puppyS2],
    fireball: FIREBALL, peach: [PEACH], poop: [POOP],
    seed: [SEED], heart: [HEART], heartEmpty: [HEART_EMPTY], leaf: [LEAF], star: [STAR],
    spark: SPARK, cursor: [CURSOR], speaker: [SPEAKER], deco: DECO
  };
})();
