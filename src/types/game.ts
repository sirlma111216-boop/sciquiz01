/**
 * 과학 진짜? 가짜? — 확신 포인트 챌린지
 * 게임 전반에서 사용하는 타입 정의
 */

/** 게임 진행 단계 */
export type GamePhase =
  | 'waiting' // 학생 입장 대기
  | 'question' // 문제 진행 및 학생 선택 가능
  | 'locked' // 시간 종료, 답변 마감 (정답 공개 직전)
  | 'reveal' // 정답 / 해설 / 점수 공개
  | 'finished'; // 게임 종료 및 최종 순위

/** 문제 난이도 (별 개수) */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** 문제 분야 */
export type Category =
  | '물리'
  | '화학'
  | '생명과학'
  | '지구과학'
  | '우주'
  | '생활과학';

/** 문제 은행 한 문항의 구조 */
export interface Question {
  id: string;
  category: Category;
  difficulty: Difficulty;
  /** 학생에게 판단하게 할 문장 */
  statement: string;
  /** true = 진짜, false = 가짜 */
  answer: boolean;
  /** 중학교 1학년이 이해할 수 있는 2~4문장 해설 */
  explanation: string;
}

/** 학생이 고를 수 있는 확신 포인트 */
export const CONFIDENCE_OPTIONS = [50, 100, 150, 200] as const;
export type ConfidencePoints = (typeof CONFIDENCE_OPTIONS)[number];

/** 시작 점수 */
export const INITIAL_SCORE = 500;
/** 이 점수 미만이면 한 문제를 쉬며 과학 에너지를 충전한다 */
export const RECOVERY_THRESHOLD = 50;
/** 한 문제를 쉰 뒤 현재 점수에 더해 주는 과학 에너지 */
export const RECOVERY_BONUS = 50;

/** 교사가 게임방을 만들 때 고를 수 있는 값 */
export const QUESTION_COUNT_OPTIONS = [10, 15, 20, 25] as const;
export const DURATION_OPTIONS = [10, 15, 20, 30] as const;
export const DEFAULT_QUESTION_COUNT = 20;
export const DEFAULT_DURATION = 15;

/** 라운드 결과 종류 */
export type AnswerResult =
  | 'correct' // 정답
  | 'incorrect' // 오답
  | 'none' // 미응답
  | 'rested'; // 과학 에너지 충전(휴식)

/** 방 문서 (학생도 읽는다 — 문제 문장 / 정답 / 해설을 절대 담지 않는다) */
export interface RoomDoc {
  id: string;
  code: string;
  className: string;
  teacherUid: string;
  status: 'open' | 'finished';
  phase: GamePhase;
  /** 0-based. 아직 시작 전이면 -1 */
  currentRound: number;
  totalRounds: number;
  /** 문제당 제한 시간(초) */
  duration: number;
  /** 현재 문제가 시작된 서버 시각(ms). 시작 전이면 null */
  questionStartedAt: number | null;
  createdAt: number;
  leaderboardSaved?: boolean;
}

/** 참가 학생 문서 */
export interface ParticipantDoc {
  uid: string;
  nickname: string;
  score: number;
  /** 직전 문제 채점 전 순위 (순위 변화 표시에 사용) */
  previousRank: number | null;
  recoveryNeeded: boolean;
  /** 과학 에너지 충전으로 쉬어야 하는 문제 번호(0-based) */
  recoveryRound: number | null;
  joinedAt: number;
  teacherUid: string;
  /** 가장 최근에 채점된 라운드 결과 (학생 결과 화면에서 사용) */
  lastResult: LastResult | null;
}

export interface LastResult {
  roundIndex: number;
  result: AnswerResult;
  delta: number;
  scoreAfter: number;
  /**
   * 채점 후 순위. 교사가 계산해서 함께 기록한다.
   * 학생이 순위를 알려고 전체 참가자를 구독하지 않아도 되게 하기 위한 값이다.
   * (30명이 서로의 문서를 모두 구독하면 채점 순간 통신량이 급증해
   *  화면 전환이 밀리는 문제가 있었다.)
   */
  rank?: number;
  totalParticipants?: number;
}

/** 학생이 제출한 답안 */
export interface AnswerDoc {
  id: string;
  uid: string;
  roundIndex: number;
  /** true = 진짜, false = 가짜 */
  choice: boolean;
  confidencePoints: number;
  submittedAt: number;
  teacherUid: string;
  scoreApplied: boolean;
  result?: AnswerResult | null;
  scoreDelta?: number | null;
  scoreAfter?: number | null;
}

/** 정답 공개 후 라운드 통계 (교사 화면용) */
export interface RoundSummaryDoc {
  roundIndex: number;
  correctAnswer: boolean;
  trueCount: number;
  falseCount: number;
  submittedCount: number;
  restedCount: number;
  totalConfidence: number;
  maxConfidenceCount: number;
  scored: boolean;
  revealedAt: number;
  teacherUid: string;
}

/** 명예의 전당 기록 */
export interface LeaderboardEntry {
  id: string;
  nickname: string;
  className: string;
  score: number;
  playedAt: number;
}

/** 순위가 매겨진 참가자 */
export interface RankedParticipant extends ParticipantDoc {
  rank: number;
  /** 이전 라운드 대비 순위 변화. 양수면 상승 */
  rankChange: number | null;
}

/** 앱 내부에서 쓰는 최소 사용자 정보 */
export interface AppUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}
