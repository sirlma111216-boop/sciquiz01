/**
 * 점수 규칙 검증 스크립트
 *
 *   npm run test:scoring
 *
 * 요구사항 문서의 테스트 4 ~ 11 을 그대로 확인한다.
 */
import { computeRoundScores, clampConfidence } from '../src/lib/scoring';
import { selectQuestions } from '../src/lib/questionSelector';
import { QUESTION_BANK } from '../src/data/questions';
import type { AnswerDoc, ParticipantDoc } from '../src/types/game';

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        기대: ${JSON.stringify(expected)}`);
    console.log(`        실제: ${JSON.stringify(actual)}`);
  }
}

function assert(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

function student(
  uid: string,
  score: number,
  extra: Partial<ParticipantDoc> = {},
): ParticipantDoc {
  return {
    uid,
    nickname: uid,
    score,
    previousRank: null,
    recoveryNeeded: false,
    recoveryRound: null,
    joinedAt: 1000,
    teacherUid: 'teacher',
    lastResult: null,
    ...extra,
  };
}

function answer(uid: string, roundIndex: number, choice: boolean, points: number): AnswerDoc {
  return {
    id: `r${roundIndex}__${uid}`,
    uid,
    roundIndex,
    choice,
    confidencePoints: points,
    submittedAt: 2000,
    teacherUid: 'teacher',
    scoreApplied: false,
  };
}

function runRound(
  roundIndex: number,
  correctAnswer: boolean,
  participants: ParticipantDoc[],
  answers: AnswerDoc[],
) {
  const map = new Map(answers.map((a) => [a.uid, a]));
  return computeRoundScores(roundIndex, correctAnswer, participants, map);
}

/** 채점 결과를 참가자 상태에 반영한다. (교사 클라이언트가 하는 일과 동일) */
function applyUpdates(
  participants: ParticipantDoc[],
  outcome: ReturnType<typeof computeRoundScores>,
): ParticipantDoc[] {
  return participants.map((p) => {
    const update = outcome.updates.find((u) => u.uid === p.uid);
    if (!update) return p;
    return {
      ...p,
      score: update.scoreAfter,
      previousRank: update.previousRank,
      recoveryNeeded: update.recoveryNeeded,
      recoveryRound: update.recoveryRound,
      lastResult: {
        roundIndex: outcome.updates[0] ? 0 : 0,
        result: update.result,
        delta: update.delta,
        scoreAfter: update.scoreAfter,
      },
    };
  });
}

console.log('\n=== 테스트 4: 500P 학생 → 200P 선택 → 정답 → 700P ===');
{
  const people = [student('a', 500)];
  const out = runRound(0, true, people, [answer('a', 0, true, 200)]);
  check('점수', out.updates[0].scoreAfter, 700);
  check('결과', out.updates[0].result, 'correct');
  check('변화량', out.updates[0].delta, 200);
}

console.log('\n=== 테스트 5: 500P 학생 → 200P 선택 → 오답 → 300P ===');
{
  const people = [student('a', 500)];
  const out = runRound(0, false, people, [answer('a', 0, true, 200)]);
  check('점수', out.updates[0].scoreAfter, 300);
  check('결과', out.updates[0].result, 'incorrect');
  check('변화량', out.updates[0].delta, -200);
}

console.log('\n=== 테스트 6: 100P 학생 → 100P 선택 → 오답 → 0P → 한 문제 휴식 → +50P ===');
{
  let people = [student('a', 100)];

  // 3번 문제에서 틀려 0P 가 된다.
  const round3 = runRound(3, false, people, [answer('a', 3, true, 100)]);
  check('오답 후 점수', round3.updates[0].scoreAfter, 0);
  check('충전 필요', round3.updates[0].recoveryNeeded, true);
  check('쉬는 문제 번호', round3.updates[0].recoveryRound, 4);
  people = applyUpdates(people, round3);

  // 4번 문제는 쉰다. 답을 냈더라도 무시되어야 한다.
  const round4 = runRound(4, true, people, [answer('a', 4, true, 200)]);
  check('휴식 처리', round4.updates[0].result, 'rested');
  check('충전량', round4.updates[0].delta, 50);
  check('휴식 후 점수 (0 + 50)', round4.updates[0].scoreAfter, 50);
  check('충전 해제', round4.updates[0].recoveryNeeded, false);
  people = applyUpdates(people, round4);

  // 5번 문제부터 다시 참가한다.
  const round5 = runRound(5, true, people, [answer('a', 5, true, 50)]);
  check('다시 참가 (정답)', round5.updates[0].result, 'correct');
  check('점수 (50 + 50)', round5.updates[0].scoreAfter, 100);
}

console.log('\n=== 테스트 7: 30P 학생 → 한 문제 휴식 → 80P (50P 로 맞추지 않음) ===');
{
  const people = [
    student('a', 30, { recoveryNeeded: true, recoveryRound: 2 }),
    student('b', 40, { recoveryNeeded: true, recoveryRound: 2 }),
    student('c', 0, { recoveryNeeded: true, recoveryRound: 2 }),
  ];
  const out = runRound(2, true, people, []);
  check('30P → 80P', out.updates[0].scoreAfter, 80);
  check('40P → 90P', out.updates[1].scoreAfter, 90);
  check('0P → 50P', out.updates[2].scoreAfter, 50);
  check('모두 휴식 처리', out.updates.map((u) => u.result), ['rested', 'rested', 'rested']);
  check('휴식 인원 통계', out.stats.restedCount, 3);
}

console.log('\n=== 테스트 8: 보유 점수보다 큰 확신 포인트는 고를 수 없다 ===');
{
  check('120P 에서 50P', clampConfidence(50, 120), 50);
  check('120P 에서 100P', clampConfidence(100, 120), 100);
  check('120P 에서 150P → 100P 로 낮춤', clampConfidence(150, 120), 100);
  check('120P 에서 200P → 100P 로 낮춤', clampConfidence(200, 120), 100);
  check('40P 에서는 고를 수 없음', clampConfidence(50, 40), 0);
  check('규칙에 없는 값(9999)도 안전하게 처리', clampConfidence(9999, 120), 100);

  // 조작된 값을 보내도 점수가 음수가 되지 않는다.
  const people = [student('a', 120)];
  const out = runRound(0, false, people, [answer('a', 0, true, 9999)]);
  check('조작된 확신 포인트 반영값', out.updates[0].appliedConfidence, 100);
  check('조작 후 점수', out.updates[0].scoreAfter, 20);
  assert('점수는 음수가 되지 않는다', out.updates[0].scoreAfter >= 0);
}

console.log('\n=== 테스트 14: 미응답은 점수 변화가 없다 ===');
{
  const people = [student('a', 350)];
  const out = runRound(0, true, people, []);
  check('결과', out.updates[0].result, 'none');
  check('변화량', out.updates[0].delta, 0);
  check('점수 유지', out.updates[0].scoreAfter, 350);
  check('제출 인원에 포함되지 않음', out.stats.submittedCount, 0);
}

console.log('\n=== 휴식 중인 학생은 일반 미응답과 구분된다 ===');
{
  const people = [
    student('rest', 20, { recoveryNeeded: true, recoveryRound: 1 }),
    student('idle', 300),
  ];
  const out = runRound(1, true, people, []);
  check('휴식 학생', out.updates[0].result, 'rested');
  check('미응답 학생', out.updates[1].result, 'none');
  check('휴식 인원', out.stats.restedCount, 1);
}

console.log('\n=== 라운드 통계 ===');
{
  const people = [
    student('a', 500),
    student('b', 500),
    student('c', 500),
    student('d', 500),
  ];
  const out = runRound(0, true, people, [
    answer('a', 0, true, 200),
    answer('b', 0, true, 50),
    answer('c', 0, false, 150),
    // d 는 미응답
  ]);
  check('진짜 선택', out.stats.trueCount, 2);
  check('가짜 선택', out.stats.falseCount, 1);
  check('제출 인원', out.stats.submittedCount, 3);
  check('확신 포인트 합계', out.stats.totalConfidence, 400);
  check('200P 선택 인원', out.stats.maxConfidenceCount, 1);
}

console.log('\n=== 순위 계산 (채점 전 순위를 기록) ===');
{
  const people = [
    student('low', 100, {}),
    student('high', 900, {}),
    student('mid', 500, {}),
  ];
  const out = runRound(0, true, people, []);
  const byUid = Object.fromEntries(out.updates.map((u) => [u.uid, u.previousRank]));
  check('1위', byUid.high, 1);
  check('2위', byUid.mid, 2);
  check('3위', byUid.low, 3);
}

console.log('\n=== 문제 은행 ===');
{
  const ids = new Set(QUESTION_BANK.map((q) => q.id));
  check('id 중복 없음', ids.size, QUESTION_BANK.length);
  assert('60문제 이상', QUESTION_BANK.length >= 60, `(${QUESTION_BANK.length}문제)`);

  const bad = QUESTION_BANK.filter(
    (q) =>
      !q.statement.trim() ||
      !q.explanation.trim() ||
      typeof q.answer !== 'boolean' ||
      q.difficulty < 1 ||
      q.difficulty > 5,
  );
  check('형식 오류 문항 수', bad.length, 0);

  const trueCount = QUESTION_BANK.filter((q) => q.answer).length;
  const ratio = trueCount / QUESTION_BANK.length;
  assert(
    '진짜/가짜 비율이 40~60% 안에 있다',
    ratio >= 0.4 && ratio <= 0.6,
    `(진짜 ${trueCount} / 전체 ${QUESTION_BANK.length} = ${(ratio * 100).toFixed(1)}%)`,
  );

  const shortExplanations = QUESTION_BANK.filter((q) => q.explanation.length < 40);
  check('해설이 너무 짧은 문항 수', shortExplanations.length, 0);
}

console.log('\n=== 문제 뽑기 규칙 ===');
{
  for (const count of [10, 15, 20, 25]) {
    let streakProblem = 0;
    let countProblem = 0;
    let dupProblem = 0;
    let easyProblem = 0;
    let balanceProblem = 0;

    for (let trial = 0; trial < 60; trial += 1) {
      const picked = selectQuestions(QUESTION_BANK, count);
      if (picked.length !== count) countProblem += 1;
      if (new Set(picked.map((q) => q.id)).size !== picked.length) dupProblem += 1;
      if (picked.some((q) => q.difficulty < 2)) easyProblem += 1;

      const realCount = picked.filter((q) => q.answer).length;
      if (Math.abs(realCount - count / 2) > count * 0.2) balanceProblem += 1;

      for (let i = 2; i < picked.length; i += 1) {
        if (
          picked[i].answer === picked[i - 1].answer &&
          picked[i].answer === picked[i - 2].answer
        ) {
          streakProblem += 1;
          break;
        }
      }
    }

    check(`${count}문제: 정확히 ${count}개`, countProblem, 0);
    check(`${count}문제: 중복 없음`, dupProblem, 0);
    check(`${count}문제: 난이도 1 미포함`, easyProblem, 0);
    check(`${count}문제: 진짜/가짜 균형`, balanceProblem, 0);
    check(`${count}문제: 같은 정답 3연속 없음`, streakProblem, 0);
  }
}

console.log('\n=== 뽑힌 문제의 난이도 분포 ===');
{
  const trials = 300;
  const count = 20;
  const tally: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
  let sameDifficultyRun = 0;

  for (let i = 0; i < trials; i += 1) {
    const picked = selectQuestions(QUESTION_BANK, count);
    picked.forEach((q) => {
      tally[q.difficulty] = (tally[q.difficulty] ?? 0) + 1;
    });

    let run = 1;
    for (let j = 1; j < picked.length; j += 1) {
      run = picked[j].difficulty === picked[j - 1].difficulty ? run + 1 : 1;
      if (run > 4) {
        sameDifficultyRun += 1;
        break;
      }
    }
  }

  const total = trials * count;
  const pct = (d: number) => (tally[d] / total) * 100;
  console.log(
    `        실제 비율 → ★★ ${pct(2).toFixed(1)}% / ★★★ ${pct(3).toFixed(1)}% / ` +
      `★★★★ ${pct(4).toFixed(1)}% / ★★★★★ ${pct(5).toFixed(1)}%`,
  );

  assert('★★ 비율이 20%에 가깝다 (±7%p)', Math.abs(pct(2) - 20) <= 7);
  assert('★★★ 비율이 40%에 가깝다 (±7%p)', Math.abs(pct(3) - 40) <= 7);
  assert('★★★★ 비율이 30%에 가깝다 (±7%p)', Math.abs(pct(4) - 30) <= 7);
  assert('★★★★★ 비율이 10%에 가깝다 (±7%p)', Math.abs(pct(5) - 10) <= 7);
  check('같은 난이도가 5문제 이상 연속되는 경우', sameDifficultyRun, 0);
}

console.log(`\n────────────────────────────`);
console.log(`  통과 ${passed} / 실패 ${failed}`);
console.log(`────────────────────────────\n`);

if (failed > 0) process.exit(1);
