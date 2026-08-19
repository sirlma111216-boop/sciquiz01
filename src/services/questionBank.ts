import type { Question } from '../types/game';

/**
 * 문제 은행은 교사 화면에서만 필요하다.
 * 여기서 동적 import 를 사용하기 때문에 문제 문장 / 정답 / 해설이
 * 학생 화면 번들에 포함되지 않는다.
 *
 * 학생이 개발자 도구를 열어도 학생 화면이 내려받은 파일 안에서는
 * 정답을 찾을 수 없다.
 */

let cache: Question[] | null = null;
let loading: Promise<Question[]> | null = null;

export async function loadQuestionBank(): Promise<Question[]> {
  if (cache) return cache;
  if (loading) return loading;

  loading = import('../data/questions').then((module) => {
    cache = module.QUESTION_BANK;
    loading = null;
    return cache;
  });

  return loading;
}

/** 이미 불러온 문제 은행이 있으면 돌려준다. (없으면 null) */
export function peekQuestionBank(): Question[] | null {
  return cache;
}

/** id 목록에 해당하는 문제를 순서대로 돌려준다. */
export async function loadQuestionsByIds(ids: readonly string[]): Promise<Question[]> {
  const bank = await loadQuestionBank();
  const byId = new Map(bank.map((question) => [question.id, question]));
  return ids
    .map((id) => byId.get(id))
    .filter((question): question is Question => question !== undefined);
}
