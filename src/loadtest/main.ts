/**
 * 브라우저에서 돌리는 동시 접속 부하 테스트
 * ─────────────────────────────────────────────
 * 학생 여러 명을 한 페이지 안에서 각각 독립된 Firebase 앱으로 접속시켜
 * 교사 화면의 진행을 제때 따라오는지 측정한다.
 *
 * 실제 브라우저의 통신 방식(WebChannel)을 그대로 쓰기 때문에
 * 교실에서 학생들이 겪는 상황에 가장 가깝다.
 *
 * 사용법 (개발 서버에서만 동작)
 *   http://localhost:5174/loadtest.html?code=5583&n=20
 *
 * 이 파일은 운영 빌드(dist)에 포함되지 않는다.
 */
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const CONFIDENCE = [50, 100, 150, 200];
const params = new URLSearchParams(location.search);
const roomCode = (params.get('code') ?? '').trim();
const studentCount = Number(params.get('n') ?? 20);

const logEl = document.getElementById('log') as HTMLPreElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

function log(line: string) {
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(text: string) {
  statusEl.textContent = text;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return null;
}

function errorCode(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    return String((cause as { code: unknown }).code);
  }
  return cause instanceof Error ? cause.message : String(cause);
}

function stats(values: number[]): string {
  if (values.length === 0) return '측정값 없음';
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const fmt = (n: number) => `${(n / 1000).toFixed(2)}초`;
  return `최소 ${fmt(sorted[0])} / 중앙값 ${fmt(median)} / 최대 ${fmt(sorted[sorted.length - 1])}`;
}

interface Student {
  index: number;
  nickname: string;
  uid: string;
  app: FirebaseApp;
  db: Firestore;
  score: number;
  recoveryNeeded: boolean;
  recoveryRound: number | null;
  sawQuestion: Map<number, number>;
  sawReveal: Map<number, number>;
  gotResult: Set<number>;
  submitted: Set<number>;
  submitErrors: Map<number, string>;
  submitLatency: number[];
  subscriptionErrors: string[];
}

/**
 * 실행할 때마다 달라지는 꼬리표.
 * 같은 게임방에서 두 번 돌려도 닉네임이 겹치지 않게 한다.
 */
const runTag = Math.random().toString(36).slice(2, 5);

const students: Student[] = [];
const roundStartedAt = new Map<number, number>();
const reported = new Set<number>();
let reportTimer: number | null = null;
let roomId = '';
let teacherUid = '';
let duration = 15;

async function createStudent(index: number): Promise<Student | null> {
  const nickname = `테스트${String(index + 1).padStart(2, '0')}${runTag}`;
  try {
    const app = initializeApp(firebaseConfig, `student-${index}-${Date.now()}`);
    // 학생마다 로그인 상태를 분리한다. (기본 설정이면 서로 덮어쓴다)
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const db = getFirestore(app);
    const credential = await signInAnonymously(auth);
    return {
      index,
      nickname,
      uid: credential.user.uid,
      app,
      db,
      score: 500,
      recoveryNeeded: false,
      recoveryRound: null,
      sawQuestion: new Map(),
      sawReveal: new Map(),
      gotResult: new Set(),
      submitted: new Set(),
      submitErrors: new Map(),
      submitLatency: [],
      subscriptionErrors: [],
    };
  } catch (cause) {
    log(`  ${nickname} 로그인 실패: ${errorCode(cause)}`);
    return null;
  }
}

async function trySubmit(s: Student, round: number) {
  if (s.recoveryNeeded && s.recoveryRound === round) return;
  if (s.submitted.has(round)) return;

  // 사람처럼 제한시간의 20~80% 사이에 흩어져 제출
  await sleep(duration * 1000 * (0.2 + Math.random() * 0.6));

  const affordable = CONFIDENCE.filter((p) => p <= s.score);
  if (affordable.length === 0) return;
  const points = affordable[Math.floor(Math.random() * affordable.length)];

  const at = Date.now();
  try {
    await setDoc(doc(s.db, 'rooms', roomId, 'answers', `r${round}__${s.uid}`), {
      uid: s.uid,
      roundIndex: round,
      choice: Math.random() < 0.5,
      confidencePoints: points,
      teacherUid,
      scoreApplied: false,
      submittedAt: serverTimestamp(),
    });
    s.submitted.add(round);
    s.submitLatency.push(Date.now() - at);
  } catch (cause) {
    s.submitErrors.set(round, errorCode(cause));
  }
}

function scheduleReport(round: number) {
  if (reported.has(round)) return;
  if (reportTimer !== null) window.clearTimeout(reportTimer);
  reportTimer = window.setTimeout(() => report(round), 2500);
}

function report(round: number) {
  if (reported.has(round)) return;
  reported.add(round);

  const started = roundStartedAt.get(round);
  const qTimes = students
    .map((s) => s.sawQuestion.get(round))
    .filter((v): v is number => v !== undefined);
  const rTimes = students
    .map((s) => s.sawReveal.get(round))
    .filter((v): v is number => v !== undefined);

  log(`\n──────── ${round + 1}번 문제 ────────`);

  if (started !== undefined && qTimes.length > 0) {
    log(`문제 시작 인지 : ${stats(qTimes.map((t) => t - started))}  (${qTimes.length}/${students.length}명)`);
  }
  const missedQ = students.filter((s) => !s.sawQuestion.has(round));
  if (missedQ.length > 0) {
    log(`  !! 문제를 못 받음 ${missedQ.length}명: ${missedQ.map((s) => s.nickname).join(', ')}`);
  }

  if (rTimes.length > 0) {
    const first = Math.min(...rTimes);
    log(`정답 공개 인지 : ${stats(rTimes.map((t) => t - first))} (가장 빠른 학생 기준)  (${rTimes.length}/${students.length}명)`);
  }
  const missedR = students.filter((s) => !s.sawReveal.has(round));
  if (missedR.length > 0) {
    log(`  !! 정답 공개 못 받음 ${missedR.length}명: ${missedR.map((s) => s.nickname).join(', ')}`);
  }

  const submitted = students.filter((s) => s.submitted.has(round));
  const resting = students.filter((s) => s.recoveryNeeded && s.recoveryRound === round);
  const failed = students.filter((s) => s.submitErrors.has(round));
  log(`답안 제출      : 성공 ${submitted.length}명 / 휴식 ${resting.length}명 / 실패 ${failed.length}명`);
  if (failed.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const s of failed) {
      const code = s.submitErrors.get(round) as string;
      grouped.set(code, [...(grouped.get(code) ?? []), s.nickname]);
    }
    for (const [code, names] of grouped) {
      log(`  !! ${code} — ${names.length}명: ${names.join(', ')}`);
    }
  }

  const got = students.filter((s) => s.gotResult.has(round));
  log(`채점 결과 수신 : ${got.length}/${students.length}명`);
  const missing = students.filter((s) => !s.gotResult.has(round));
  if (missing.length > 0) {
    log(`  !! 결과 못 받음: ${missing.map((s) => s.nickname).join(', ')}`);
  }

  if (started !== undefined && qTimes.length > 0) {
    const worst = Math.max(...qTimes.map((t) => t - started));
    if (worst > 3000) log(`  ⚠ 가장 느린 학생이 ${(worst / 1000).toFixed(1)}초 늦게 문제를 받았습니다.`);
  }
}

async function main() {
  if (!/^\d{4,6}$/.test(roomCode)) {
    setStatus('주소에 ?code=게임코드 를 넣어 주세요. 예) /loadtest.html?code=5583&n=20');
    return;
  }
  if (!firebaseConfig.apiKey) {
    setStatus('.env 에 Firebase 설정이 없습니다. 연습 모드에서는 부하 테스트를 할 수 없습니다.');
    return;
  }

  log(`프로젝트: ${firebaseConfig.projectId}`);
  log(`게임 코드: ${roomCode} / 인원: ${studentCount}명\n`);

  setStatus('익명 로그인 중...');
  log('[1/3] 익명 로그인...');
  const created = await Promise.all(
    Array.from({ length: studentCount }, (_, i) => createStudent(i)),
  );
  for (const s of created) if (s) students.push(s);
  log(`      성공 ${students.length}명 / 실패 ${studentCount - students.length}명\n`);
  if (students.length === 0) {
    setStatus('로그인에 모두 실패했습니다.');
    return;
  }

  // 게임방 찾기
  const codeSnap = await getDoc(doc(students[0].db, 'roomCodes', roomCode));
  if (!codeSnap.exists()) {
    setStatus(`게임 코드 ${roomCode} 를 찾을 수 없습니다.`);
    log(`게임 코드 ${roomCode} 를 찾을 수 없습니다.`);
    return;
  }
  roomId = String(codeSnap.data().roomId);
  const roomSnap = await getDoc(doc(students[0].db, 'rooms', roomId));
  if (!roomSnap.exists()) {
    setStatus('게임방 문서를 찾을 수 없습니다.');
    return;
  }
  teacherUid = String(roomSnap.data().teacherUid);
  duration = Number(roomSnap.data().duration ?? 15);
  log(`      게임방 확인 (문제당 ${duration}초)\n`);

  setStatus('입장 중...');
  log('[2/3] 입장...');
  let joinFail = 0;
  const joinStart = Date.now();
  await Promise.all(
    students.map(async (s) => {
      try {
        await runTransaction(s.db, async (tx) => {
          const key = s.nickname.toLowerCase();
          const nickRef = doc(s.db, 'rooms', roomId, 'nicknames', key);
          const partRef = doc(s.db, 'rooms', roomId, 'participants', s.uid);
          const mine = await tx.get(partRef);
          const nick = await tx.get(nickRef);
          if (mine.exists()) return;
          if (nick.exists() && nick.data().uid !== s.uid) throw new Error('닉네임 중복');
          tx.set(nickRef, { uid: s.uid, nickname: s.nickname });
          tx.set(partRef, {
            uid: s.uid,
            nickname: s.nickname,
            score: 500,
            previousRank: null,
            recoveryNeeded: false,
            recoveryRound: null,
            lastResult: null,
            teacherUid,
            joinedAt: serverTimestamp(),
          });
        });
      } catch (cause) {
        joinFail += 1;
        log(`      ${s.nickname} 입장 실패: ${errorCode(cause)}`);
      }
    }),
  );
  log(`      입장 ${students.length - joinFail}명 / 실패 ${joinFail}명 (${((Date.now() - joinStart) / 1000).toFixed(1)}초)\n`);

  log('[3/3] 구독 시작. 이제 교사 화면에서 게임을 진행하세요.\n');
  setStatus(`${students.length - joinFail}명 접속 완료 — 교사 화면에서 게임을 시작하세요`);

  for (const s of students) {
    onSnapshot(
      doc(s.db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const phase = String(data.phase);
        const round = Number(data.currentRound);
        const startedAt = toMillis(data.questionStartedAt);
        const now = Date.now();

        if (phase === 'question' && round >= 0 && !s.sawQuestion.has(round)) {
          s.sawQuestion.set(round, now);
          if (startedAt !== null && !roundStartedAt.has(round)) roundStartedAt.set(round, startedAt);
          void trySubmit(s, round);
        }
        if (phase === 'reveal' && round >= 0 && !s.sawReveal.has(round)) {
          s.sawReveal.set(round, now);
          scheduleReport(round);
        }
        if (phase === 'finished') setStatus('게임 종료');
      },
      (error) => {
        s.subscriptionErrors.push(errorCode(error));
        log(`  !! ${s.nickname} 방 구독 끊김: ${errorCode(error)}`);
      },
    );

    onSnapshot(
      doc(s.db, 'rooms', roomId, 'participants', s.uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        s.score = Number(data.score ?? 500);
        s.recoveryNeeded = Boolean(data.recoveryNeeded);
        s.recoveryRound = typeof data.recoveryRound === 'number' ? data.recoveryRound : null;
        const last = data.lastResult as { roundIndex?: number } | null | undefined;
        if (last && typeof last.roundIndex === 'number') s.gotResult.add(last.roundIndex);
      },
      (error) => {
        s.subscriptionErrors.push(errorCode(error));
        log(`  !! ${s.nickname} 참가 정보 구독 끊김: ${errorCode(error)}`);
      },
    );
  }

  // 바깥(도구)에서 결과를 읽어갈 수 있게 열어 둔다.
  (window as unknown as Record<string, unknown>).__loadTest = {
    summary: () => ({
      students: students.length,
      rounds: [...reported].sort((a, b) => a - b),
      submitFailures: students.reduce((n, s) => n + s.submitErrors.size, 0),
      subscriptionErrors: students.reduce((n, s) => n + s.subscriptionErrors.length, 0),
      log: logEl.textContent,
    }),
    cleanup: async () => {
      await Promise.all(students.map((s) => deleteApp(s.app).catch(() => undefined)));
    },
  };
}

void main();
