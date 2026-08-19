import type {
  AppUser,
  LeaderboardEntry,
  ParticipantDoc,
  RoomDoc,
  RoundSummaryDoc,
  AnswerDoc,
} from '../types/game';

export type Unsubscribe = () => void;

export interface CreateRoomInput {
  teacherUid: string;
  className: string;
  totalRounds: number;
  duration: number;
  /** 이 게임에서 사용할 문제 id 목록. 교사만 읽을 수 있는 곳에 저장된다. */
  questionIds: string[];
}

export interface JoinRoomInput {
  roomId: string;
  uid: string;
  nickname: string;
}

export interface SubmitAnswerInput {
  roomId: string;
  uid: string;
  roundIndex: number;
  choice: boolean;
  confidencePoints: number;
  teacherUid: string;
}

export interface ApplyScoresInput {
  roomId: string;
  roundIndex: number;
  correctAnswer: boolean;
  teacherUid: string;
}

/** 게임 진행에 필요한 모든 데이터 작업을 모아 둔 계약 */
export interface Backend {
  readonly mode: 'firebase' | 'mock';

  /* ── 인증 ── */
  onAuthStateChanged(callback: (user: AppUser | null) => void): Unsubscribe;
  teacherSignIn(email: string, password: string): Promise<AppUser>;
  signOut(): Promise<void>;
  studentSignIn(): Promise<AppUser>;

  /** 서버 시각과 이 기기 시계의 차이(ms). 타이머를 맞추는 데 쓴다. */
  measureClockOffset(uid: string): Promise<number>;

  /* ── 방 ── */
  createRoom(input: CreateRoomInput): Promise<{ roomId: string; code: string }>;
  /** 교사만 읽을 수 있는 문제 목록 */
  loadRoomPlan(roomId: string): Promise<string[]>;
  findRoomByCode(code: string): Promise<RoomDoc | null>;
  listTeacherRooms(teacherUid: string): Promise<RoomDoc[]>;
  subscribeRoom(roomId: string, callback: (room: RoomDoc | null) => void): Unsubscribe;

  /* ── 참가자 ── */
  joinRoom(input: JoinRoomInput): Promise<void>;
  subscribeParticipants(roomId: string, callback: (list: ParticipantDoc[]) => void): Unsubscribe;
  subscribeParticipant(
    roomId: string,
    uid: string,
    callback: (participant: ParticipantDoc | null) => void,
  ): Unsubscribe;

  /* ── 답안 ── */
  submitAnswer(input: SubmitAnswerInput): Promise<void>;
  subscribeMyAnswer(
    roomId: string,
    uid: string,
    roundIndex: number,
    callback: (answer: AnswerDoc | null) => void,
  ): Unsubscribe;
  /** 교사 화면 전용: 제출 인원 확인 */
  subscribeRoundAnswers(
    roomId: string,
    roundIndex: number,
    callback: (answers: AnswerDoc[]) => void,
  ): Unsubscribe;
  subscribeRoundSummary(
    roomId: string,
    roundIndex: number,
    callback: (summary: RoundSummaryDoc | null) => void,
  ): Unsubscribe;

  /* ── 교사의 게임 진행 ── */
  startRound(roomId: string, roundIndex: number): Promise<void>;
  lockRound(roomId: string, roundIndex: number): Promise<void>;
  /** 점수 계산. 한 라운드에 정확히 한 번만 적용된다. */
  applyRoundScores(input: ApplyScoresInput): Promise<void>;
  revealRound(roomId: string, roundIndex: number): Promise<void>;
  finishGame(roomId: string): Promise<void>;

  /* ── 기록 ── */
  saveLeaderboard(roomId: string, className: string): Promise<void>;
  fetchTopAllTime(max: number): Promise<LeaderboardEntry[]>;
  fetchTopByClass(className: string, max: number): Promise<LeaderboardEntry[]>;
  fetchClassNames(): Promise<string[]>;
}
