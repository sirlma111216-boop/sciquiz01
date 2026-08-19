import type {
  ApplyScoresInput,
  Backend,
  CreateRoomInput,
  JoinRoomInput,
  SubmitAnswerInput,
  Unsubscribe,
} from './backendTypes';
import { INITIAL_SCORE } from '../types/game';
import type {
  AnswerDoc,
  AppUser,
  LastResult,
  LeaderboardEntry,
  ParticipantDoc,
  RoomDoc,
  RoundSummaryDoc,
} from '../types/game';
import { nicknameKey, sanitizeNickname } from '../lib/utils';
import { computeRoundScores } from '../lib/scoring';

/**
 * Firebase 설정 없이도 화면과 게임 흐름을 확인할 수 있는 연습용 백엔드.
 *
 *  - 데이터는 localStorage 에 저장되어 같은 브라우저의 여러 탭이 함께 본다.
 *    (교사 화면 탭 + 학생 화면 탭을 동시에 열어 테스트할 수 있다.)
 *  - 학생 uid 는 sessionStorage 에 두어 탭마다 다른 학생이 된다.
 *    새 탭이나 새 창을 열면 다른 학생으로 입장할 수 있다.
 *  - 실제 수업에서는 반드시 Firebase 를 연결해 사용한다.
 */

const DB_KEY = 'srf-mock-db-v1';
const UID_KEY = 'srf-mock-uid';
const TEACHER_KEY = 'srf-mock-teacher';

interface MockDb {
  rooms: Record<string, RoomDoc>;
  plans: Record<string, string[]>;
  roomCodes: Record<string, string>;
  participants: Record<string, Record<string, ParticipantDoc>>;
  nicknames: Record<string, Record<string, string>>;
  answers: Record<string, Record<string, AnswerDoc>>;
  rounds: Record<string, Record<number, RoundSummaryDoc>>;
  leaderboards: LeaderboardEntry[];
}

function emptyDb(): MockDb {
  return {
    rooms: {},
    plans: {},
    roomCodes: {},
    participants: {},
    nicknames: {},
    answers: {},
    rounds: {},
    leaderboards: [],
  };
}

function readDb(): MockDb {
  if (typeof window === 'undefined') return emptyDb();
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...(JSON.parse(raw) as MockDb) };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: MockDb): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/* ── 변경 알림 ── */

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // 한 화면의 오류가 다른 화면을 막지 않도록 한다.
    }
  });
}

if (typeof window !== 'undefined') {
  // 다른 탭에서 데이터가 바뀌면 이 탭도 다시 그린다.
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY) notify();
  });
}

function update(mutate: (db: MockDb) => void): void {
  const db = readDb();
  mutate(db);
  writeDb(db);
  notify();
}

/**
 * 구독을 등록한다.
 * 등록하는 순간 한 번, 이후 데이터가 바뀔 때마다 값을 전달한다.
 */
function subscribe<T>(read: (db: MockDb) => T, callback: (value: T) => void): Unsubscribe {
  let lastSerialized = '';

  const run = () => {
    const value = read(readDb());
    const serialized = JSON.stringify(value ?? null);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    callback(value);
  };

  run();
  listeners.add(run);
  return () => {
    listeners.delete(run);
  };
}

/* ── 인증 ── */

const authListeners = new Set<(user: AppUser | null) => void>();

function currentMockUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  const teacher = window.sessionStorage.getItem(TEACHER_KEY);
  if (teacher) {
    return { uid: `teacher-${teacher}`, email: teacher, isAnonymous: false };
  }
  const uid = window.sessionStorage.getItem(UID_KEY);
  return uid ? { uid, email: null, isAnonymous: true } : null;
}

function emitAuth(): void {
  const user = currentMockUser();
  authListeners.forEach((listener) => listener(user));
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function answerKey(roundIndex: number, uid: string): string {
  return `r${roundIndex}__${uid}`;
}

export const mockBackend: Backend = {
  mode: 'mock',

  onAuthStateChanged(callback) {
    authListeners.add(callback);
    // 처음 등록할 때 현재 상태를 바로 알려 준다.
    window.setTimeout(() => callback(currentMockUser()), 0);
    return () => {
      authListeners.delete(callback);
    };
  },

  async teacherSignIn(email, password) {
    if (!email.trim() || password.length < 4) {
      throw new Error('이메일과 비밀번호(4자 이상)를 입력해 주세요.');
    }
    window.sessionStorage.setItem(TEACHER_KEY, email.trim());
    window.sessionStorage.removeItem(UID_KEY);
    emitAuth();
    return currentMockUser() as AppUser;
  },

  async signOut() {
    window.sessionStorage.removeItem(TEACHER_KEY);
    window.sessionStorage.removeItem(UID_KEY);
    emitAuth();
  },

  async studentSignIn() {
    let uid = window.sessionStorage.getItem(UID_KEY);
    if (!uid) {
      uid = randomId('student');
      window.sessionStorage.setItem(UID_KEY, uid);
    }
    window.sessionStorage.removeItem(TEACHER_KEY);
    emitAuth();
    return { uid, email: null, isAnonymous: true };
  },

  async measureClockOffset() {
    // 연습용 모드에서는 모든 화면이 같은 기기이므로 시계 차이가 없다.
    return 0;
  },

  /* ── 방 ── */

  async createRoom({ teacherUid, className, totalRounds, duration, questionIds }: CreateRoomInput) {
    const roomId = randomId('room');
    const db = readDb();

    let code = '';
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = String(Math.floor(1000 + Math.random() * 9000));
      if (!db.roomCodes[candidate]) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error('게임 코드를 만들지 못했습니다.');

    update((next) => {
      next.rooms[roomId] = {
        id: roomId,
        code,
        className,
        teacherUid,
        status: 'open',
        phase: 'waiting',
        currentRound: -1,
        totalRounds,
        duration,
        questionStartedAt: null,
        createdAt: Date.now(),
        leaderboardSaved: false,
      };
      next.plans[roomId] = questionIds;
      next.roomCodes[code] = roomId;
      next.participants[roomId] = {};
      next.nicknames[roomId] = {};
      next.answers[roomId] = {};
      next.rounds[roomId] = {};
    });

    return { roomId, code };
  },

  async loadRoomPlan(roomId) {
    return readDb().plans[roomId] ?? [];
  },

  async findRoomByCode(code) {
    const db = readDb();
    const roomId = db.roomCodes[code];
    if (!roomId) return null;
    return db.rooms[roomId] ?? null;
  },

  async listTeacherRooms(teacherUid) {
    return Object.values(readDb().rooms)
      .filter((room) => room.teacherUid === teacherUid)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  subscribeRoom(roomId, callback) {
    return subscribe((db) => db.rooms[roomId] ?? null, callback);
  },

  /* ── 참가자 ── */

  async joinRoom({ roomId, uid, nickname }: JoinRoomInput) {
    const cleanNickname = sanitizeNickname(nickname);
    const key = nicknameKey(cleanNickname);
    const db = readDb();

    const room = db.rooms[roomId];
    if (!room) throw new Error('게임방을 찾을 수 없습니다.');
    if (room.status !== 'open' || room.phase === 'finished') {
      throw new Error('이미 끝난 게임입니다.');
    }

    const existing = db.participants[roomId]?.[uid];
    if (existing) {
      if (nicknameKey(existing.nickname) !== key) {
        throw new Error('이미 다른 닉네임으로 참여하고 있어요.');
      }
      return;
    }

    const owner = db.nicknames[roomId]?.[key];
    if (owner && owner !== uid) {
      throw new Error('이미 사용 중인 닉네임이에요. 다른 닉네임을 써 주세요.');
    }

    update((next) => {
      next.nicknames[roomId] = { ...(next.nicknames[roomId] ?? {}), [key]: uid };
      next.participants[roomId] = {
        ...(next.participants[roomId] ?? {}),
        [uid]: {
          uid,
          nickname: cleanNickname,
          score: INITIAL_SCORE,
          previousRank: null,
          recoveryNeeded: false,
          recoveryRound: null,
          joinedAt: Date.now(),
          teacherUid: room.teacherUid,
          lastResult: null,
        },
      };
    });
  },

  subscribeParticipants(roomId, callback) {
    return subscribe((db) => Object.values(db.participants[roomId] ?? {}), callback);
  },

  subscribeParticipant(roomId, uid, callback) {
    return subscribe((db) => db.participants[roomId]?.[uid] ?? null, callback);
  },

  /* ── 답안 ── */

  async submitAnswer({
    roomId,
    uid,
    roundIndex,
    choice,
    confidencePoints,
    teacherUid,
  }: SubmitAnswerInput) {
    const db = readDb();
    const room = db.rooms[roomId];
    if (!room) throw new Error('게임방을 찾을 수 없습니다.');
    if (room.phase !== 'question' || room.currentRound !== roundIndex) {
      throw new Error('지금은 답을 제출할 수 없어요.');
    }
    // 제한 시간이 지난 제출은 받지 않는다. (2초 여유)
    if (room.questionStartedAt && Date.now() > room.questionStartedAt + (room.duration + 2) * 1000) {
      throw new Error('제한 시간이 끝났어요.');
    }

    const key = answerKey(roundIndex, uid);
    if (db.answers[roomId]?.[key]) {
      throw new Error('이미 선택을 완료했어요.');
    }

    update((next) => {
      next.answers[roomId] = {
        ...(next.answers[roomId] ?? {}),
        [key]: {
          id: key,
          uid,
          roundIndex,
          choice,
          confidencePoints,
          submittedAt: Date.now(),
          teacherUid,
          scoreApplied: false,
          result: null,
          scoreDelta: null,
          scoreAfter: null,
        },
      };
    });
  },

  subscribeMyAnswer(roomId, uid, roundIndex, callback) {
    if (roundIndex < 0) {
      callback(null);
      return () => undefined;
    }
    return subscribe((db) => db.answers[roomId]?.[answerKey(roundIndex, uid)] ?? null, callback);
  },

  subscribeRoundAnswers(roomId, roundIndex, callback) {
    if (roundIndex < 0) {
      callback([]);
      return () => undefined;
    }
    return subscribe(
      (db) =>
        Object.values(db.answers[roomId] ?? {}).filter(
          (answer) => answer.roundIndex === roundIndex,
        ),
      callback,
    );
  },

  subscribeRoundSummary(roomId, roundIndex, callback) {
    if (roundIndex < 0) {
      callback(null);
      return () => undefined;
    }
    return subscribe((db) => db.rounds[roomId]?.[roundIndex] ?? null, callback);
  },

  /* ── 교사의 게임 진행 ── */

  async startRound(roomId, roundIndex) {
    update((db) => {
      const room = db.rooms[roomId];
      if (!room) return;
      if (room.currentRound === roundIndex && room.phase === 'question') return;
      if (roundIndex !== room.currentRound + 1) return;
      if (room.phase !== 'waiting' && room.phase !== 'reveal') return;
      if (roundIndex >= room.totalRounds) return;

      room.currentRound = roundIndex;
      room.phase = 'question';
      room.questionStartedAt = Date.now();
    });
  },

  async lockRound(roomId, roundIndex) {
    update((db) => {
      const room = db.rooms[roomId];
      if (!room) return;
      if (room.currentRound !== roundIndex || room.phase !== 'question') return;
      room.phase = 'locked';
    });
  },

  async applyRoundScores({ roomId, roundIndex, correctAnswer, teacherUid }: ApplyScoresInput) {
    update((db) => {
      if (db.rounds[roomId]?.[roundIndex]?.scored) return; // 이미 채점한 라운드

      const participants = Object.values(db.participants[roomId] ?? {});
      const answersByUid = new Map<string, AnswerDoc>();
      participants.forEach((participant) => {
        const answer = db.answers[roomId]?.[answerKey(roundIndex, participant.uid)];
        if (answer) answersByUid.set(participant.uid, answer);
      });

      const { updates, stats } = computeRoundScores(
        roundIndex,
        correctAnswer,
        participants,
        answersByUid,
      );

      updates.forEach((entry) => {
        const participant = db.participants[roomId]?.[entry.uid];
        if (!participant) return;
        participant.score = entry.scoreAfter;
        participant.previousRank = entry.previousRank;
        participant.recoveryNeeded = entry.recoveryNeeded;
        participant.recoveryRound = entry.recoveryRound;
        participant.lastResult = {
          roundIndex,
          result: entry.result,
          delta: entry.delta,
          scoreAfter: entry.scoreAfter,
        } satisfies LastResult;

        const answer = db.answers[roomId]?.[answerKey(roundIndex, entry.uid)];
        if (answer) {
          answer.result = entry.result;
          answer.scoreDelta = entry.delta;
          answer.scoreAfter = entry.scoreAfter;
          answer.scoreApplied = true;
        }
      });

      db.rounds[roomId] = {
        ...(db.rounds[roomId] ?? {}),
        [roundIndex]: {
          roundIndex,
          correctAnswer,
          ...stats,
          scored: true,
          teacherUid,
          revealedAt: Date.now(),
        },
      };
    });
  },

  async revealRound(roomId, roundIndex) {
    update((db) => {
      const room = db.rooms[roomId];
      if (!room) return;
      if (room.currentRound !== roundIndex) return;
      if (room.phase === 'reveal' || room.phase === 'finished') return;
      room.phase = 'reveal';
    });
  },

  async finishGame(roomId) {
    update((db) => {
      const room = db.rooms[roomId];
      if (!room) return;
      room.phase = 'finished';
      room.status = 'finished';
      if (room.code) delete db.roomCodes[room.code];
    });
  },

  /* ── 기록 ── */

  async saveLeaderboard(roomId, className) {
    update((db) => {
      const participants = Object.values(db.participants[roomId] ?? {});
      if (participants.length === 0) return;
      const playedAt = Date.now();

      participants.forEach((participant) => {
        const id = `${roomId}__${participant.uid}`;
        const existing = db.leaderboards.findIndex((entry) => entry.id === id);
        const record: LeaderboardEntry = {
          id,
          nickname: participant.nickname,
          className,
          score: participant.score,
          playedAt,
        };
        // 같은 게임을 두 번 저장해도 기록이 늘어나지 않는다.
        if (existing >= 0) db.leaderboards[existing] = record;
        else db.leaderboards.push(record);
      });

      const room = db.rooms[roomId];
      if (room) room.leaderboardSaved = true;
    });
  },

  async fetchTopAllTime(max) {
    return [...readDb().leaderboards].sort((a, b) => b.score - a.score).slice(0, max);
  },

  async fetchTopByClass(className, max) {
    return readDb()
      .leaderboards.filter((entry) => entry.className === className)
      .sort((a, b) => b.score - a.score)
      .slice(0, max);
  },

  async fetchClassNames() {
    const names = new Set<string>();
    readDb().leaderboards.forEach((entry) => {
      if (entry.className) names.add(entry.className);
    });
    return [...names];
  },
};
