import {
  createUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { getDb, getFirebaseAuth } from './firebase';
import type { Backend } from './backendTypes';
import { INITIAL_SCORE } from '../types/game';
import type {
  AnswerDoc,
  AppUser,
  GamePhase,
  LastResult,
  LeaderboardEntry,
  ParticipantDoc,
  RoomDoc,
  RoundSummaryDoc,
} from '../types/game';
import { nicknameKey, sanitizeNickname } from '../lib/utils';
import { computeRoundScores } from '../lib/scoring';

/* ────────────────────────── 경로 도우미 ────────────────────────── */

const roomsCol = () => collection(getDb(), 'rooms');
const roomRef = (roomId: string) => doc(getDb(), 'rooms', roomId);
const planRef = (roomId: string) => doc(getDb(), 'rooms', roomId, 'private', 'plan');
const participantsCol = (roomId: string) => collection(getDb(), 'rooms', roomId, 'participants');
const participantRef = (roomId: string, uid: string) =>
  doc(getDb(), 'rooms', roomId, 'participants', uid);
const nicknameRef = (roomId: string, key: string) =>
  doc(getDb(), 'rooms', roomId, 'nicknames', key);
const answersCol = (roomId: string) => collection(getDb(), 'rooms', roomId, 'answers');
const answerRef = (roomId: string, roundIndex: number, uid: string) =>
  doc(getDb(), 'rooms', roomId, 'answers', answerId(roundIndex, uid));
const roundRef = (roomId: string, roundIndex: number) =>
  doc(getDb(), 'rooms', roomId, 'rounds', String(roundIndex));
const roomCodeRef = (code: string) => doc(getDb(), 'roomCodes', code);
const leaderboardCol = () => collection(getDb(), 'leaderboards');
const clockSyncRef = (uid: string) => doc(getDb(), 'clockSync', uid);

/** 답안 문서 이름. 보안 규칙에서도 이 형식을 그대로 검사한다. */
export function answerId(roundIndex: number, uid: string): string {
  return `r${roundIndex}__${uid}`;
}

/* ────────────────────────── 변환 도우미 ────────────────────────── */

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return null;
}

function mapUser(user: User | null): AppUser | null {
  if (!user) return null;
  return { uid: user.uid, email: user.email, isAnonymous: user.isAnonymous };
}

function mapRoom(id: string, data: Record<string, unknown>): RoomDoc {
  return {
    id,
    code: String(data.code ?? ''),
    className: String(data.className ?? ''),
    teacherUid: String(data.teacherUid ?? ''),
    status: (data.status as RoomDoc['status']) ?? 'open',
    phase: (data.phase as GamePhase) ?? 'waiting',
    currentRound: typeof data.currentRound === 'number' ? data.currentRound : -1,
    totalRounds: typeof data.totalRounds === 'number' ? data.totalRounds : 0,
    duration: typeof data.duration === 'number' ? data.duration : 15,
    questionStartedAt: toMillis(data.questionStartedAt),
    createdAt: toMillis(data.createdAt) ?? Date.now(),
    leaderboardSaved: Boolean(data.leaderboardSaved),
  };
}

function mapParticipant(uid: string, data: Record<string, unknown>): ParticipantDoc {
  const rawLast = data.lastResult as Record<string, unknown> | null | undefined;
  const lastResult: LastResult | null =
    rawLast && typeof rawLast.roundIndex === 'number'
      ? {
          roundIndex: rawLast.roundIndex,
          result: rawLast.result as LastResult['result'],
          delta: Number(rawLast.delta ?? 0),
          scoreAfter: Number(rawLast.scoreAfter ?? 0),
          rank: typeof rawLast.rank === 'number' ? rawLast.rank : undefined,
          totalParticipants:
            typeof rawLast.totalParticipants === 'number'
              ? rawLast.totalParticipants
              : undefined,
        }
      : null;

  return {
    uid,
    nickname: String(data.nickname ?? ''),
    score: typeof data.score === 'number' ? data.score : INITIAL_SCORE,
    previousRank: typeof data.previousRank === 'number' ? data.previousRank : null,
    recoveryNeeded: Boolean(data.recoveryNeeded),
    recoveryRound: typeof data.recoveryRound === 'number' ? data.recoveryRound : null,
    joinedAt: toMillis(data.joinedAt) ?? Date.now(),
    teacherUid: String(data.teacherUid ?? ''),
    lastResult,
  };
}

function mapAnswer(id: string, data: Record<string, unknown>): AnswerDoc {
  return {
    id,
    uid: String(data.uid ?? ''),
    roundIndex: typeof data.roundIndex === 'number' ? data.roundIndex : -1,
    choice: Boolean(data.choice),
    confidencePoints: Number(data.confidencePoints ?? 0),
    submittedAt: toMillis(data.submittedAt) ?? Date.now(),
    teacherUid: String(data.teacherUid ?? ''),
    scoreApplied: Boolean(data.scoreApplied),
    result: (data.result as AnswerDoc['result']) ?? null,
    scoreDelta: typeof data.scoreDelta === 'number' ? data.scoreDelta : null,
    scoreAfter: typeof data.scoreAfter === 'number' ? data.scoreAfter : null,
  };
}

function mapRoundSummary(data: Record<string, unknown>): RoundSummaryDoc {
  return {
    roundIndex: Number(data.roundIndex ?? 0),
    correctAnswer: Boolean(data.correctAnswer),
    trueCount: Number(data.trueCount ?? 0),
    falseCount: Number(data.falseCount ?? 0),
    submittedCount: Number(data.submittedCount ?? 0),
    restedCount: Number(data.restedCount ?? 0),
    totalConfidence: Number(data.totalConfidence ?? 0),
    maxConfidenceCount: Number(data.maxConfidenceCount ?? 0),
    scored: Boolean(data.scored),
    revealedAt: toMillis(data.revealedAt) ?? Date.now(),
    teacherUid: String(data.teacherUid ?? ''),
  };
}

/* ────────────────────────── 구현 ────────────────────────── */

export const firebaseBackend: Backend = {
  mode: 'firebase',

  /* ── 인증 ── */

  onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(getFirebaseAuth(), (user) => callback(mapUser(user)));
  },

  async teacherSignIn(email, password) {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return mapUser(credential.user) as AppUser;
  },

  async signOut() {
    await firebaseSignOut(getFirebaseAuth());
  },

  async studentSignIn() {
    const auth = getFirebaseAuth();
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      return mapUser(auth.currentUser) as AppUser;
    }
    const credential = await signInAnonymously(auth);
    return mapUser(credential.user) as AppUser;
  },

  /**
   * 서버 시각과 기기 시계의 차이를 잰다.
   * 왕복 시간이 가장 짧았던 측정값을 사용해 오차를 줄인다.
   */
  async measureClockOffset(uid) {
    let best: { offset: number; roundTrip: number } | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const ref = clockSyncRef(uid);
        const sentAt = Date.now();
        await setDoc(ref, { ts: serverTimestamp() });
        const snapshot = await getDoc(ref);
        const receivedAt = Date.now();
        const serverMs = toMillis(snapshot.data()?.ts);
        if (serverMs === null) continue;

        const roundTrip = receivedAt - sentAt;
        const offset = serverMs - (sentAt + receivedAt) / 2;
        if (!best || roundTrip < best.roundTrip) best = { offset, roundTrip };
      } catch {
        // 시계 맞추기에 실패해도 게임은 진행되어야 한다. (오차 0으로 처리)
      }
    }

    return best ? best.offset : 0;
  },

  /* ── 방 ── */

  async createRoom({ teacherUid, className, totalRounds, duration, questionIds }) {
    const db = getDb();
    const newRoomRef = doc(roomsCol());

    // 겹치지 않는 4자리 게임 코드를 찾는다.
    let code = '';
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = String(Math.floor(1000 + Math.random() * 9000));
      const claimed = await runTransaction(db, async (tx) => {
        const codeSnapshot = await tx.get(roomCodeRef(candidate));
        if (codeSnapshot.exists()) return false;
        tx.set(roomCodeRef(candidate), {
          roomId: newRoomRef.id,
          teacherUid,
          createdAt: serverTimestamp(),
        });
        return true;
      });
      if (claimed) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new Error('게임 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }

    await setDoc(newRoomRef, {
      code,
      className,
      teacherUid,
      status: 'open',
      phase: 'waiting' satisfies GamePhase,
      currentRound: -1,
      totalRounds,
      duration,
      questionStartedAt: null,
      leaderboardSaved: false,
      createdAt: serverTimestamp(),
    });

    // 문제 목록은 교사만 읽을 수 있는 곳에 따로 저장한다.
    await setDoc(planRef(newRoomRef.id), { questionIds, teacherUid });

    return { roomId: newRoomRef.id, code };
  },

  async loadRoomPlan(roomId) {
    const snapshot = await getDoc(planRef(roomId));
    if (!snapshot.exists()) return [];
    const ids = snapshot.data().questionIds;
    return Array.isArray(ids) ? (ids as string[]) : [];
  },

  async findRoomByCode(code) {
    const codeSnapshot = await getDoc(roomCodeRef(code));
    if (!codeSnapshot.exists()) return null;
    const roomId = String(codeSnapshot.data().roomId ?? '');
    if (!roomId) return null;

    const snapshot = await getDoc(roomRef(roomId));
    if (!snapshot.exists()) return null;
    return mapRoom(snapshot.id, snapshot.data());
  },

  async listTeacherRooms(teacherUid) {
    const snapshot = await getDocs(
      query(roomsCol(), where('teacherUid', '==', teacherUid), fsLimit(30)),
    );
    return snapshot.docs
      .map((entry) => mapRoom(entry.id, entry.data()))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  subscribeRoom(roomId, callback) {
    return onSnapshot(
      roomRef(roomId),
      (snapshot) => {
        callback(snapshot.exists() ? mapRoom(snapshot.id, snapshot.data()) : null);
      },
      () => callback(null),
    );
  },

  /* ── 참가자 ── */

  async joinRoom({ roomId, uid, nickname }) {
    const db = getDb();
    const cleanNickname = sanitizeNickname(nickname);
    const key = nicknameKey(cleanNickname);

    await runTransaction(db, async (tx) => {
      const roomSnapshot = await tx.get(roomRef(roomId));
      if (!roomSnapshot.exists()) {
        throw new Error('게임방을 찾을 수 없습니다.');
      }
      const room = mapRoom(roomSnapshot.id, roomSnapshot.data());
      if (room.status !== 'open' || room.phase === 'finished') {
        throw new Error('이미 끝난 게임입니다.');
      }

      const myParticipant = await tx.get(participantRef(roomId, uid));
      const nicknameSnapshot = await tx.get(nicknameRef(roomId, key));

      // 이미 들어와 있던 학생이 새로고침한 경우 그대로 통과시킨다.
      if (myParticipant.exists()) {
        const existing = mapParticipant(uid, myParticipant.data());
        if (nicknameKey(existing.nickname) === key) return;
        throw new Error('이미 다른 닉네임으로 참여하고 있어요.');
      }

      if (nicknameSnapshot.exists() && nicknameSnapshot.data().uid !== uid) {
        throw new Error('이미 사용 중인 닉네임이에요. 다른 닉네임을 써 주세요.');
      }

      tx.set(nicknameRef(roomId, key), { uid, nickname: cleanNickname });
      tx.set(participantRef(roomId, uid), {
        uid,
        nickname: cleanNickname,
        score: INITIAL_SCORE,
        previousRank: null,
        recoveryNeeded: false,
        recoveryRound: null,
        lastResult: null,
        teacherUid: room.teacherUid,
        joinedAt: serverTimestamp(),
      });
    });
  },

  subscribeParticipants(roomId, callback) {
    return onSnapshot(
      participantsCol(roomId),
      (snapshot) => {
        callback(snapshot.docs.map((entry) => mapParticipant(entry.id, entry.data())));
      },
      () => callback([]),
    );
  },

  subscribeParticipant(roomId, uid, callback) {
    return onSnapshot(
      participantRef(roomId, uid),
      (snapshot) => {
        callback(snapshot.exists() ? mapParticipant(snapshot.id, snapshot.data()) : null);
      },
      () => callback(null),
    );
  },

  /* ── 답안 ── */

  async submitAnswer({ roomId, uid, roundIndex, choice, confidencePoints, teacherUid }) {
    // 문서 이름이 라운드 + uid 로 고정되어 있어 같은 문제에 두 번 제출할 수 없다.
    // 보안 규칙에서도 create 만 허용하므로 제출 후 수정도 불가능하다.
    await setDoc(answerRef(roomId, roundIndex, uid), {
      uid,
      roundIndex,
      choice,
      confidencePoints,
      teacherUid,
      scoreApplied: false,
      submittedAt: serverTimestamp(),
    });
  },

  subscribeMyAnswer(roomId, uid, roundIndex, callback) {
    if (roundIndex < 0) {
      callback(null);
      return () => undefined;
    }
    return onSnapshot(
      answerRef(roomId, roundIndex, uid),
      (snapshot) => {
        callback(snapshot.exists() ? mapAnswer(snapshot.id, snapshot.data()) : null);
      },
      () => callback(null),
    );
  },

  subscribeRoundAnswers(roomId, roundIndex, callback) {
    if (roundIndex < 0) {
      callback([]);
      return () => undefined;
    }
    return onSnapshot(
      query(answersCol(roomId), where('roundIndex', '==', roundIndex)),
      (snapshot) => {
        callback(snapshot.docs.map((entry) => mapAnswer(entry.id, entry.data())));
      },
      () => callback([]),
    );
  },

  subscribeRoundSummary(roomId, roundIndex, callback) {
    if (roundIndex < 0) {
      callback(null);
      return () => undefined;
    }
    return onSnapshot(
      roundRef(roomId, roundIndex),
      (snapshot) => {
        callback(snapshot.exists() ? mapRoundSummary(snapshot.data()) : null);
      },
      () => callback(null),
    );
  },

  /* ── 교사의 게임 진행 ── */

  /**
   * 다음 문제를 시작한다.
   * 교사가 버튼을 여러 번 눌러도 트랜잭션 안에서 현재 상태를 확인하므로
   * 문제를 건너뛰지 않는다.
   */
  async startRound(roomId, roundIndex) {
    const db = getDb();
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(roomRef(roomId));
      if (!snapshot.exists()) throw new Error('게임방을 찾을 수 없습니다.');
      const room = mapRoom(snapshot.id, snapshot.data());

      // 이미 그 문제가 진행 중이면 아무것도 하지 않는다.
      if (room.currentRound === roundIndex && room.phase === 'question') return;
      // 순서를 건너뛰는 요청은 무시한다.
      if (roundIndex !== room.currentRound + 1) return;
      if (room.phase !== 'waiting' && room.phase !== 'reveal') return;
      if (roundIndex >= room.totalRounds) return;

      tx.update(roomRef(roomId), {
        currentRound: roundIndex,
        phase: 'question' satisfies GamePhase,
        questionStartedAt: serverTimestamp(),
      });
    });
  },

  async lockRound(roomId, roundIndex) {
    const db = getDb();
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(roomRef(roomId));
      if (!snapshot.exists()) return;
      const room = mapRoom(snapshot.id, snapshot.data());
      if (room.currentRound !== roundIndex) return;
      if (room.phase !== 'question') return;
      tx.update(roomRef(roomId), { phase: 'locked' satisfies GamePhase });
    });
  },

  /**
   * 한 라운드의 점수를 계산해 반영한다.
   *
   * 보장하는 것
   *  - rounds/{roundIndex}.scored 를 트랜잭션 안에서 확인하므로
   *    여러 번 호출해도 점수가 두 번 적용되지 않는다.
   *  - 참가자 점수, 답안 결과, 라운드 통계가 모두 한 번에 반영된다.
   *  - 학생이 보낸 확신 포인트가 보유 점수를 넘으면 안전한 값으로 낮춘다.
   */
  async applyRoundScores({ roomId, roundIndex, correctAnswer, teacherUid }) {
    const db = getDb();

    // 트랜잭션 안에서는 쿼리를 쓸 수 없으므로 참가자 목록을 먼저 읽는다.
    // 이 시점에는 이미 phase 가 locked 이라 새 답안이 들어오지 않는다.
    const participantSnapshot = await getDocs(participantsCol(roomId));
    const uids = participantSnapshot.docs.map((entry) => entry.id);

    await runTransaction(db, async (tx) => {
      const roundSnapshot = await tx.get(roundRef(roomId, roundIndex));
      if (roundSnapshot.exists() && roundSnapshot.data().scored === true) {
        return; // 이미 채점이 끝난 라운드
      }

      const participantRefs = uids.map((uid) => participantRef(roomId, uid));
      const answerRefs = uids.map((uid) => answerRef(roomId, roundIndex, uid));
      const participantSnapshots = await Promise.all(participantRefs.map((ref) => tx.get(ref)));
      const answerSnapshots = await Promise.all(answerRefs.map((ref) => tx.get(ref)));

      const indexByUid = new Map<string, number>();
      const participants: ParticipantDoc[] = [];
      const answersByUid = new Map<string, AnswerDoc>();

      participantSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists()) return;
        const uid = uids[index];
        indexByUid.set(uid, index);
        participants.push(mapParticipant(uid, snapshot.data()));

        const answerSnapshot = answerSnapshots[index];
        if (answerSnapshot.exists()) {
          answersByUid.set(uid, mapAnswer(answerSnapshot.id, answerSnapshot.data()));
        }
      });

      const { updates, stats } = computeRoundScores(
        roundIndex,
        correctAnswer,
        participants,
        answersByUid,
      );

      updates.forEach((update) => {
        const index = indexByUid.get(update.uid);
        if (index === undefined) return;

        tx.update(participantRefs[index], {
          score: update.scoreAfter,
          previousRank: update.previousRank,
          recoveryNeeded: update.recoveryNeeded,
          recoveryRound: update.recoveryRound,
          lastResult: {
            roundIndex,
            result: update.result,
            delta: update.delta,
            scoreAfter: update.scoreAfter,
            rank: update.rankAfter,
            totalParticipants: update.totalParticipants,
          } satisfies LastResult,
        });

        // 학생이 낸 답안에도 결과를 남겨 둔다. (같은 점수가 두 번 반영되지 않도록)
        if (update.hasAnswer) {
          tx.update(answerRefs[index], {
            result: update.result,
            scoreDelta: update.delta,
            scoreAfter: update.scoreAfter,
            scoreApplied: true,
          });
        }
      });

      tx.set(roundRef(roomId, roundIndex), {
        roundIndex,
        correctAnswer,
        ...stats,
        scored: true,
        teacherUid,
        revealedAt: serverTimestamp(),
      });
    });
  },

  async revealRound(roomId, roundIndex) {
    const db = getDb();
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(roomRef(roomId));
      if (!snapshot.exists()) return;
      const room = mapRoom(snapshot.id, snapshot.data());
      if (room.currentRound !== roundIndex) return;
      if (room.phase === 'reveal' || room.phase === 'finished') return;
      tx.update(roomRef(roomId), { phase: 'reveal' satisfies GamePhase });
    });
  },

  async finishGame(roomId) {
    const db = getDb();
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(roomRef(roomId));
      if (!snapshot.exists()) return;
      tx.update(roomRef(roomId), {
        phase: 'finished' satisfies GamePhase,
        status: 'finished',
      });
    });

    // 게임이 끝나면 코드를 반납해 다른 수업에서 다시 쓸 수 있게 한다.
    try {
      const room = await getDoc(roomRef(roomId));
      const code = room.data()?.code;
      if (typeof code === 'string' && code) {
        const codeSnapshot = await getDoc(roomCodeRef(code));
        if (codeSnapshot.exists() && codeSnapshot.data().roomId === roomId) {
          const batch = writeBatch(getDb());
          batch.delete(roomCodeRef(code));
          await batch.commit();
        }
      }
    } catch {
      // 코드 반납에 실패해도 게임 종료 자체에는 영향이 없다.
    }
  },

  /* ── 기록 ── */

  /**
   * 학급 기록과 전체 기록을 남긴다.
   * 문서 이름을 roomId__uid 로 고정해 같은 게임을 두 번 저장해도 기록이 늘어나지 않는다.
   */
  async saveLeaderboard(roomId, className) {
    const snapshot = await getDocs(participantsCol(roomId));
    if (snapshot.empty) return;

    const playedAt = serverTimestamp();
    const batch = writeBatch(getDb());

    snapshot.docs.forEach((entry) => {
      const participant = mapParticipant(entry.id, entry.data());
      batch.set(doc(leaderboardCol(), `${roomId}__${participant.uid}`), {
        nickname: participant.nickname,
        className,
        score: participant.score,
        roomId,
        playedAt,
      });
    });

    await batch.commit();
    await setDoc(roomRef(roomId), { leaderboardSaved: true }, { merge: true });
  },

  async fetchTopAllTime(max) {
    const snapshot = await getDocs(
      query(leaderboardCol(), orderBy('score', 'desc'), fsLimit(max)),
    );
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        nickname: String(data.nickname ?? ''),
        className: String(data.className ?? ''),
        score: Number(data.score ?? 0),
        playedAt: toMillis(data.playedAt) ?? 0,
      } satisfies LeaderboardEntry;
    });
  },

  async fetchTopByClass(className, max) {
    const snapshot = await getDocs(
      query(
        leaderboardCol(),
        where('className', '==', className),
        orderBy('score', 'desc'),
        fsLimit(max),
      ),
    );
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        nickname: String(data.nickname ?? ''),
        className: String(data.className ?? ''),
        score: Number(data.score ?? 0),
        playedAt: toMillis(data.playedAt) ?? 0,
      } satisfies LeaderboardEntry;
    });
  },

  async fetchClassNames() {
    const snapshot = await getDocs(
      query(leaderboardCol(), orderBy('playedAt', 'desc'), fsLimit(300)),
    );
    const names = new Set<string>();
    snapshot.docs.forEach((entry) => {
      const name = String(entry.data().className ?? '').trim();
      if (name) names.add(name);
    });
    return [...names];
  },
};

/** 교사 계정을 코드로 만들고 싶을 때 쓸 수 있는 도우미 (기본은 Firebase 콘솔 사용) */
export async function createTeacherAccount(email: string, password: string): Promise<AppUser> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return mapUser(credential.user) as AppUser;
}
