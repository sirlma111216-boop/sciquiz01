import { CONFIDENCE_OPTIONS, RECOVERY_BONUS, RECOVERY_THRESHOLD } from '../types/game';
import type { AnswerDoc, AnswerResult, ParticipantDoc } from '../types/game';

/**
 * 한 라운드의 점수를 계산하는 규칙을 한곳에 모아 둔다.
 * Firebase 연결 여부와 상관없이 같은 규칙이 적용되도록 순수 함수로 만들었다.
 *
 * 점수 규칙
 *  - 정답  : 선택한 확신 포인트만큼 점수가 오른다.
 *  - 오답  : 선택한 확신 포인트만큼 점수가 내려간다.
 *  - 미응답: 점수 변화가 없다.
 *  - 과학 에너지 충전(휴식): 현재 점수에 +50P 를 더한다.
 *    (50P 로 맞추는 것이 아니라 현재 점수에 더한다.)
 *  - 채점 뒤 점수가 50P 미만이면 바로 다음 문제를 한 번 쉰다.
 */

export interface ParticipantUpdate {
  uid: string;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  result: AnswerResult;
  /** 실제로 반영된 확신 포인트 (보유 점수를 넘으면 낮춰서 반영) */
  appliedConfidence: number;
  previousRank: number;
  recoveryNeeded: boolean;
  recoveryRound: number | null;
  /** 이 학생이 제출한 답안이 있었는지 */
  hasAnswer: boolean;
}

export interface RoundStats {
  trueCount: number;
  falseCount: number;
  submittedCount: number;
  restedCount: number;
  totalConfidence: number;
  maxConfidenceCount: number;
}

export interface ScoringOutcome {
  updates: ParticipantUpdate[];
  stats: RoundStats;
}

/**
 * 학생이 보낸 확신 포인트를 안전한 값으로 다듬는다.
 * 개발자 도구로 값을 고쳐 보내더라도 보유 점수를 넘어설 수 없다.
 */
export function clampConfidence(requested: number, currentScore: number): number {
  const affordable = CONFIDENCE_OPTIONS.filter((points) => points <= currentScore);
  if (affordable.length === 0) return 0;
  const largest = affordable[affordable.length - 1];
  const isKnownOption = (CONFIDENCE_OPTIONS as readonly number[]).includes(requested);
  if (!isKnownOption) return largest;
  return Math.min(requested, largest);
}

/** 점수 순 순위를 매긴다. 점수가 같으면 먼저 들어온 학생이 앞선다. */
export function computeRankMap(participants: readonly ParticipantDoc[]): Map<string, number> {
  const map = new Map<string, number>();
  [...participants]
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.joinedAt - b.joinedAt))
    .forEach((participant, index) => map.set(participant.uid, index + 1));
  return map;
}

export function computeRoundScores(
  roundIndex: number,
  correctAnswer: boolean,
  participants: readonly ParticipantDoc[],
  answersByUid: ReadonlyMap<string, AnswerDoc>,
): ScoringOutcome {
  const rankBefore = computeRankMap(participants);

  const stats: RoundStats = {
    trueCount: 0,
    falseCount: 0,
    submittedCount: 0,
    restedCount: 0,
    totalConfidence: 0,
    maxConfidenceCount: 0,
  };

  const updates = participants.map((participant) => {
    const answer = answersByUid.get(participant.uid);
    const isResting = participant.recoveryNeeded && participant.recoveryRound === roundIndex;

    let delta = 0;
    let result: AnswerResult = 'none';
    let appliedConfidence = 0;

    if (isResting) {
      // 쉬는 문제에서는 답안이 있어도 무시하고 과학 에너지만 충전한다.
      delta = RECOVERY_BONUS;
      result = 'rested';
      stats.restedCount += 1;
    } else if (answer) {
      appliedConfidence = clampConfidence(answer.confidencePoints, participant.score);
      if (appliedConfidence > 0) {
        const isCorrect = answer.choice === correctAnswer;
        delta = isCorrect ? appliedConfidence : -appliedConfidence;
        result = isCorrect ? 'correct' : 'incorrect';

        stats.submittedCount += 1;
        stats.totalConfidence += appliedConfidence;
        if (appliedConfidence === 200) stats.maxConfidenceCount += 1;
        if (answer.choice) stats.trueCount += 1;
        else stats.falseCount += 1;
      }
    }

    const scoreAfter = Math.max(0, participant.score + delta);
    const needsRecovery = scoreAfter < RECOVERY_THRESHOLD;

    return {
      uid: participant.uid,
      scoreBefore: participant.score,
      scoreAfter,
      delta,
      result,
      appliedConfidence,
      previousRank: rankBefore.get(participant.uid) ?? 0,
      recoveryNeeded: needsRecovery,
      recoveryRound: needsRecovery ? roundIndex + 1 : null,
      hasAnswer: Boolean(answer),
    } satisfies ParticipantUpdate;
  });

  return { updates, stats };
}
