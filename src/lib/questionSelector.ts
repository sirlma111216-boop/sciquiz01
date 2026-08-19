import type { Difficulty, Question } from '../types/game';

/**
 * 게임에 사용할 문제를 문제 은행에서 뽑아 순서를 정한다.
 *
 * 규칙
 *  - 난이도 비율을 ★★ 20% / ★★★ 40% / ★★★★ 30% / ★★★★★ 10% 에 맞춘다.
 *  - 너무 쉬운 ★ 문제는 사용하지 않는다.
 *  - 진짜 / 가짜 개수를 최대한 반반으로 맞춘다.
 *  - 같은 정답(진짜 또는 가짜)이 3번 이상 연속되지 않게 한다.
 *  - 난이도가 한쪽으로 몰리지 않도록 앞부분과 뒷부분에 고르게 섞는다.
 */

/** 난이도별 목표 비율 */
const DIFFICULTY_RATIO: Record<number, number> = {
  2: 0.2,
  3: 0.4,
  4: 0.3,
  5: 0.1,
};

const USABLE_DIFFICULTIES: Difficulty[] = [2, 3, 4, 5];

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 난이도별로 몇 문제씩 뽑을지 정한다.
 * 실제 은행에 문제가 모자라면 다른 난이도에서 채운다.
 */
function planDifficultyQuota(total: number, available: Record<number, number>): Record<number, number> {
  const quota: Record<number, number> = {};
  const remainders: Array<{ difficulty: number; remainder: number }> = [];
  let assigned = 0;

  for (const difficulty of USABLE_DIFFICULTIES) {
    const ideal = total * DIFFICULTY_RATIO[difficulty];
    const base = Math.min(Math.floor(ideal), available[difficulty] ?? 0);
    quota[difficulty] = base;
    assigned += base;
    remainders.push({ difficulty, remainder: ideal - Math.floor(ideal) });
  }

  // 내림하면서 남은 자리를 소수점이 큰 난이도부터 채운다.
  remainders.sort((a, b) => b.remainder - a.remainder);
  let index = 0;
  while (assigned < total && index < remainders.length * 4) {
    const { difficulty } = remainders[index % remainders.length];
    if (quota[difficulty] < (available[difficulty] ?? 0)) {
      quota[difficulty] += 1;
      assigned += 1;
    }
    index += 1;
  }

  // 그래도 모자라면 남아 있는 아무 난이도에서 채운다.
  for (const difficulty of USABLE_DIFFICULTIES) {
    if (assigned >= total) break;
    const room = (available[difficulty] ?? 0) - quota[difficulty];
    const take = Math.min(room, total - assigned);
    quota[difficulty] += take;
    assigned += take;
  }

  return quota;
}

/** 같은 정답이 3번 이상 연속되는 자리가 있는지 확인한다. */
function hasAnswerStreak(questions: readonly Question[], maxRun = 2): boolean {
  let run = 1;
  for (let i = 1; i < questions.length; i += 1) {
    run = questions[i].answer === questions[i - 1].answer ? run + 1 : 1;
    if (run > maxRun) return true;
  }
  return false;
}

/**
 * 정답이 3번 이상 연속되지 않도록 순서를 다시 짠다.
 *
 * 진짜 묶음과 가짜 묶음을 각각 순서대로 두고 번갈아 꺼낸다.
 *  - 같은 정답이 이미 2번 이어졌으면 반드시 반대쪽에서 꺼낸다.
 *  - 그렇지 않으면 남은 개수가 많은 쪽에서 꺼내 양쪽이 고르게 줄어들게 한다.
 *
 * 각 묶음은 이미 난이도가 고르게 섞인 순서를 유지하므로
 * 난이도 배치도 크게 흐트러지지 않는다.
 */
function breakAnswerStreaks(questions: Question[]): Question[] {
  if (questions.length < 3 || !hasAnswerStreak(questions)) return questions;

  const real = questions.filter((question) => question.answer);
  const fake = questions.filter((question) => !question.answer);

  const result: Question[] = [];
  let lastAnswer: boolean | null = null;
  let run = 0;

  while (real.length > 0 || fake.length > 0) {
    let takeReal: boolean;

    if (real.length === 0) takeReal = false;
    else if (fake.length === 0) takeReal = true;
    else if (run >= 2 && lastAnswer !== null) takeReal = !lastAnswer;
    else takeReal = real.length >= fake.length;

    const next = (takeReal ? real : fake).shift() as Question;
    run = next.answer === lastAnswer ? run + 1 : 1;
    lastAnswer = next.answer;
    result.push(next);
  }

  return result;
}

/**
 * 난이도가 초반이나 후반에 몰리지 않도록 섞는다.
 * 문제를 세 구간으로 나누고 구간마다 난이도를 골고루 배치한다.
 */
function spreadDifficulty(questions: Question[]): Question[] {
  const buckets = new Map<number, Question[]>();
  for (const question of questions) {
    const list = buckets.get(question.difficulty) ?? [];
    list.push(question);
    buckets.set(question.difficulty, list);
  }
  for (const [difficulty, list] of buckets) {
    buckets.set(difficulty, shuffle(list));
  }

  // 난이도가 낮은 쪽부터 한 문제씩 번갈아 꺼내면
  // ★★ → ★★★ → ★★★★ → ★★★★★ → ★★ ... 순서로 완만하게 오르내린다.
  const order = [...buckets.keys()].sort((a, b) => a - b);
  const result: Question[] = [];
  let remaining = questions.length;
  let cursor = 0;

  while (remaining > 0) {
    const difficulty = order[cursor % order.length];
    const list = buckets.get(difficulty);
    if (list && list.length > 0) {
      result.push(list.shift() as Question);
      remaining -= 1;
    }
    cursor += 1;
    if (cursor > questions.length * (order.length + 2)) break;
  }

  return result;
}

/**
 * 진짜 / 가짜 개수를 반반에 가깝게 맞춰 원하는 개수만큼 고른다.
 */
function pickBalancedByAnswer(pool: Question[], count: number): Question[] {
  const real = shuffle(pool.filter((q) => q.answer));
  const fake = shuffle(pool.filter((q) => !q.answer));

  const wantReal = Math.round(count / 2);
  const takenReal = real.slice(0, Math.min(wantReal, real.length));
  const takenFake = fake.slice(0, Math.min(count - takenReal.length, fake.length));
  const picked = [...takenReal, ...takenFake];

  // 한쪽이 모자라면 남은 문제로 채운다.
  if (picked.length < count) {
    const pickedIds = new Set(picked.map((q) => q.id));
    const rest = shuffle(pool.filter((q) => !pickedIds.has(q.id)));
    picked.push(...rest.slice(0, count - picked.length));
  }

  return picked;
}

/** 같은 난이도가 이어지는 가장 긴 길이 */
function longestDifficultyRun(questions: readonly Question[]): number {
  let longest = questions.length > 0 ? 1 : 0;
  let run = 1;
  for (let i = 1; i < questions.length; i += 1) {
    run = questions[i].difficulty === questions[i - 1].difficulty ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

/**
 * 같은 난이도가 너무 길게 이어지지 않도록 자리를 바꾼다.
 *
 * 정답(진짜/가짜)이 같은 문제끼리만 맞바꾸기 때문에
 * 앞에서 맞춰 둔 정답 순서는 그대로 유지된다.
 */
function breakDifficultyRuns(questions: Question[], maxRun = 3): Question[] {
  const result = [...questions];

  for (let pass = 0; pass < 4; pass += 1) {
    let current = longestDifficultyRun(result);
    if (current <= maxRun) break;

    let improved = false;
    for (let i = 0; i < result.length && current > maxRun; i += 1) {
      for (let j = 0; j < result.length; j += 1) {
        if (i === j) continue;
        if (result[i].answer !== result[j].answer) continue;
        if (result[i].difficulty === result[j].difficulty) continue;

        [result[i], result[j]] = [result[j], result[i]];
        const next = longestDifficultyRun(result);
        if (next < current) {
          current = next;
          improved = true;
          break;
        }
        [result[i], result[j]] = [result[j], result[i]]; // 나아지지 않으면 되돌린다
      }
    }

    if (!improved) break;
  }

  return result;
}

/**
 * 게임에 사용할 문제 목록을 만든다.
 *
 * @param bank  전체 문제 은행
 * @param count 뽑을 문제 수
 */
export function selectQuestions(bank: readonly Question[], count: number): Question[] {
  const usable = bank.filter((q) => USABLE_DIFFICULTIES.includes(q.difficulty));
  const pool = usable.length >= count ? usable : [...bank];

  if (pool.length <= count) {
    return breakDifficultyRuns(breakAnswerStreaks(shuffle(pool)));
  }

  const byDifficulty = new Map<number, Question[]>();
  for (const question of pool) {
    const list = byDifficulty.get(question.difficulty) ?? [];
    list.push(question);
    byDifficulty.set(question.difficulty, list);
  }

  const available: Record<number, number> = {};
  for (const difficulty of USABLE_DIFFICULTIES) {
    available[difficulty] = byDifficulty.get(difficulty)?.length ?? 0;
  }

  const quota = planDifficultyQuota(count, available);

  const selected: Question[] = [];
  for (const difficulty of USABLE_DIFFICULTIES) {
    const list = byDifficulty.get(difficulty) ?? [];
    const need = quota[difficulty] ?? 0;
    if (need <= 0) continue;
    selected.push(...pickBalancedByAnswer(list, Math.min(need, list.length)));
  }

  // 혹시 모자라면 남은 문제로 채운다.
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const rest = shuffle(pool.filter((q) => !selectedIds.has(q.id)));
    selected.push(...rest.slice(0, count - selected.length));
  }

  const ordered = spreadDifficulty(selected.slice(0, count));
  return breakDifficultyRuns(breakAnswerStreaks(ordered));
}

/** 문제 은행에서 id로 문제를 빠르게 찾기 위한 Map */
export function indexQuestions(questions: readonly Question[]): Map<string, Question> {
  return new Map(questions.map((q) => [q.id, q]));
}
