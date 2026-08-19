/**
 * 20명 동시 접속 부하 테스트
 * ─────────────────────────────────────────────
 * 실제 Firebase 프로젝트에 학생 여러 명을 동시에 접속시켜
 * 교사 화면의 진행을 학생들이 제때 따라오는지 측정한다.
 *
 * 사용법
 *   1) 교사 화면에서 게임방을 만든다 (문제 수 / 제한시간 자유)
 *   2) 터미널에서 실행:  npm run load-test -- <게임코드> [인원수]
 *      예)             npm run load-test -- 3817 20
 *   3) 학생들이 다 들어오면 교사 화면에서 게임을 시작한다
 *   4) 평소처럼 문제를 진행하면 매 문제마다 측정 결과가 출력된다
 *
 * 측정 항목
 *   - 입장 성공/실패
 *   - 문제 시작을 학생이 인지하기까지 걸린 시간
 *   - 답안 제출 성공/실패 (실패 시 오류 코드)
 *   - 정답 공개를 학생이 인지하기까지 걸린 시간
 *   - 채점 결과(lastResult)를 받은 인원
 *
 * 주의
 *   - 익명 계정과 참가 기록이 실제 프로젝트에 만들어진다.
 *   - 교사 화면에서 "최종 결과 보기"를 누르면 테스트 닉네임이
 *     명예의 전당에 저장되므로, 테스트할 때는 누르지 않는 것을 권한다.
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

/* ───────────────── 설정 읽기 ───────────────── */

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    try {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (match) env[match[1]] = match[2].trim();
      }
    } catch {
      // 파일이 없으면 넘어간다
    }
  }
  return env;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('.env 에서 Firebase 설정을 찾지 못했습니다.');
  process.exit(1);
}

const roomCode = (process.argv[2] ?? '').trim();
const studentCount = Number(process.argv[3] ?? 20);

if (!/^\d{4,6}$/.test(roomCode)) {
  console.error('사용법: npm run load-test -- <게임코드> [인원수]');
  console.error('예)     npm run load-test -- 3817 20');
  process.exit(1);
}

/* ───────────────── 도우미 ───────────────── */

const CONFIDENCE = [50, 100, 150, 200];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return null;
}

function stats(values: number[]): string {
  if (values.length === 0) return '측정값 없음';
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const fmt = (n: number) => `${(n / 1000).toFixed(2)}초`;
  return `최소 ${fmt(sorted[0])} / 중앙값 ${fmt(median)} / 최대 ${fmt(sorted[sorted.length - 1])}`;
}

function errorCode(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    return String((cause as { code: unknown }).code);
  }
  return cause instanceof Error ? cause.message : String(cause);
}

/* ───────────────── 학생 한 명 ───────────────── */

interface Student {
  index: number;
  nickname: string;
  uid: string;
  db: ReturnType<typeof getFirestore>;
  score: number;
  recoveryRound: number | null;
  recoveryNeeded: boolean;
  /** 이 학생이 각 라운드의 phase 를 인지한 시각 */
  sawQuestion: Map<number, number>;
  sawReveal: Map<number, number>;
  gotResult: Set<number>;
  submitted: Set<number>;
  submitErrors: Map<number, string>;
  submitLatency: number[];
  currentRound: number;
  phase: string;
}

const students: Student[] = [];
const roundStartedAt = new Map<number, number>();

async function createStudent(index: number): Promise<Student | null> {
  const nickname = `테스트${String(index + 1).padStart(2, '0')}`;
  try {
    // 학생마다 독립된 앱 인스턴스를 써서 로그인 상태를 분리한다.
    const app = initializeApp(firebaseConfig, `student-${index}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const credential = await signInAnonymously(auth);

    return {
      index,
      nickname,
      uid: credential.user.uid,
      db,
      score: 500,
      recoveryRound: null,
      recoveryNeeded: false,
      sawQuestion: new Map(),
      sawReveal: new Map(),
      gotResult: new Set(),
      submitted: new Set(),
      submitErrors: new Map(),
      submitLatency: [],
      currentRound: -1,
      phase: 'waiting',
    };
  } catch (cause) {
    console.error(`  ${nickname} 로그인 실패: ${errorCode(cause)}`);
    return null;
  }
}

/* ───────────────── 실행 ───────────────── */

async function main() {
  console.log(`\n프로젝트: ${firebaseConfig.projectId}`);
  console.log(`게임 코드: ${roomCode} / 인원: ${studentCount}명\n`);

  console.log('[1/3] 익명 로그인...');
  const created = await Promise.all(
    Array.from({ length: studentCount }, (_, i) => createStudent(i)),
  );
  for (const s of created) if (s) students.push(s);
  console.log(`      성공 ${students.length}명 / 실패 ${studentCount - students.length}명\n`);
  if (students.length === 0) process.exit(1);

  // 게임방 찾기
  const lookupDb = students[0].db;
  const codeSnap = await getDoc(doc(lookupDb, 'roomCodes', roomCode));
  if (!codeSnap.exists()) {
    console.error(`게임 코드 ${roomCode} 를 찾을 수 없습니다. 교사 화면의 코드를 확인해 주세요.`);
    process.exit(1);
  }
  const roomId = String(codeSnap.data().roomId);
  const roomSnap = await getDoc(doc(lookupDb, 'rooms', roomId));
  if (!roomSnap.exists()) {
    console.error('게임방 문서를 찾을 수 없습니다.');
    process.exit(1);
  }
  const teacherUid = String(roomSnap.data().teacherUid);
  const duration = Number(roomSnap.data().duration ?? 15);
  console.log(`      게임방 확인 (문제당 ${duration}초)\n`);

  console.log('[2/3] 입장...');
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
          if (nick.exists() && nick.data().uid !== s.uid) {
            throw new Error('닉네임 중복');
          }
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
        console.error(`      ${s.nickname} 입장 실패: ${errorCode(cause)}`);
      }
    }),
  );
  console.log(
    `      입장 완료 ${students.length - joinFail}명 / 실패 ${joinFail}명 (${(
      (Date.now() - joinStart) / 1000
    ).toFixed(1)}초)\n`,
  );

  console.log('[3/3] 구독 시작. 이제 교사 화면에서 게임을 진행하세요.');
  console.log('      (종료하려면 Ctrl+C)\n');

  // 앱과 똑같이 구독한다: 방 문서 + 내 참가자 문서
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
          if (startedAt !== null && !roundStartedAt.has(round)) {
            roundStartedAt.set(round, startedAt);
          }
          void trySubmit(s, roomId, round, teacherUid, duration);
        }
        if (phase === 'reveal' && round >= 0 && !s.sawReveal.has(round)) {
          s.sawReveal.set(round, now);
          if (round === s.currentRound) scheduleReport(round);
        }
        if (phase === 'finished') scheduleFinalReport();

        s.phase = phase;
        s.currentRound = round;
      },
      (err) => console.error(`  ${s.nickname} 방 구독 오류: ${errorCode(err)}`),
    );

    onSnapshot(
      doc(s.db, 'rooms', roomId, 'participants', s.uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        s.score = Number(data.score ?? 500);
        s.recoveryNeeded = Boolean(data.recoveryNeeded);
        s.recoveryRound =
          typeof data.recoveryRound === 'number' ? data.recoveryRound : null;
        const last = data.lastResult as { roundIndex?: number } | null | undefined;
        if (last && typeof last.roundIndex === 'number') s.gotResult.add(last.roundIndex);
      },
      (err) => console.error(`  ${s.nickname} 참가자 구독 오류: ${errorCode(err)}`),
    );
  }
}

/** 학생이 실제 앱처럼 답을 낸다. (사람처럼 조금씩 다른 시점에) */
async function trySubmit(
  s: Student,
  roomId: string,
  round: number,
  teacherUid: string,
  duration: number,
) {
  if (s.recoveryNeeded && s.recoveryRound === round) return; // 과학 에너지 충전 중
  if (s.submitted.has(round)) return;

  // 제한시간의 20~80% 사이에 흩어져서 제출
  const delay = duration * 1000 * (0.2 + Math.random() * 0.6);
  await sleep(delay);

  const affordable = CONFIDENCE.filter((p) => p <= s.score);
  if (affordable.length === 0) return;
  const points = affordable[Math.floor(Math.random() * affordable.length)];
  const choice = Math.random() < 0.5;

  const at = Date.now();
  try {
    await setDoc(doc(s.db, 'rooms', roomId, 'answers', `r${round}__${s.uid}`), {
      uid: s.uid,
      roundIndex: round,
      choice,
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

/* ───────────────── 결과 출력 ───────────────── */

const reported = new Set<number>();
let reportTimer: NodeJS.Timeout | null = null;

function scheduleReport(round: number) {
  if (reported.has(round)) return;
  if (reportTimer) clearTimeout(reportTimer);
  // 모든 학생의 스냅샷이 도착할 시간을 조금 준다.
  reportTimer = setTimeout(() => report(round), 2500);
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

  console.log(`\n──────── ${round + 1}번 문제 결과 ────────`);

  // 문제 시작 인지
  if (started !== undefined && qTimes.length > 0) {
    console.log(`문제 시작 인지  : ${stats(qTimes.map((t) => t - started))}  (${qTimes.length}/${students.length}명)`);
  }
  const missedQuestion = students.filter((s) => !s.sawQuestion.has(round));
  if (missedQuestion.length > 0) {
    console.log(`  !! 문제를 못 받은 학생 ${missedQuestion.length}명: ${missedQuestion.map((s) => s.nickname).join(', ')}`);
  }

  // 정답 공개 인지 (첫 학생 기준 편차)
  if (rTimes.length > 0) {
    const first = Math.min(...rTimes);
    console.log(`정답 공개 인지  : ${stats(rTimes.map((t) => t - first))} (가장 빠른 학생 기준)  (${rTimes.length}/${students.length}명)`);
  }
  const missedReveal = students.filter((s) => !s.sawReveal.has(round));
  if (missedReveal.length > 0) {
    console.log(`  !! 정답 공개를 못 받은 학생 ${missedReveal.length}명: ${missedReveal.map((s) => s.nickname).join(', ')}`);
  }

  // 제출
  const submitted = students.filter((s) => s.submitted.has(round));
  const resting = students.filter((s) => s.recoveryNeeded && s.recoveryRound === round);
  const failed = students.filter((s) => s.submitErrors.has(round));
  console.log(`답안 제출       : 성공 ${submitted.length}명 / 휴식 ${resting.length}명 / 실패 ${failed.length}명`);
  if (failed.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const s of failed) {
      const code = s.submitErrors.get(round) as string;
      grouped.set(code, [...(grouped.get(code) ?? []), s.nickname]);
    }
    for (const [code, names] of grouped) {
      console.log(`  !! ${code} — ${names.length}명: ${names.join(', ')}`);
    }
  }

  // 채점 결과 수신
  const got = students.filter((s) => s.gotResult.has(round));
  console.log(`채점 결과 수신  : ${got.length}/${students.length}명`);
  const missing = students.filter((s) => !s.gotResult.has(round));
  if (missing.length > 0) {
    console.log(`  !! 결과를 못 받은 학생: ${missing.map((s) => s.nickname).join(', ')}`);
  }

  const worst = Math.max(...qTimes.map((t) => (started ? t - started : 0)), 0);
  if (worst > 3000) {
    console.log(`  ⚠ 가장 느린 학생이 ${(worst / 1000).toFixed(1)}초 늦게 문제를 받았습니다.`);
  }
}

let finalDone = false;
function scheduleFinalReport() {
  if (finalDone) return;
  finalDone = true;
  setTimeout(() => {
    console.log('\n════════ 전체 요약 ════════');
    const allSubmit = students.flatMap((s) => s.submitLatency);
    console.log(`답안 제출 응답 : ${stats(allSubmit)}`);
    const totalErrors = students.reduce((n, s) => n + s.submitErrors.size, 0);
    console.log(`제출 실패 합계 : ${totalErrors}건`);
    console.log(`최종 점수 예시 : ${students.slice(0, 5).map((s) => `${s.nickname} ${s.score}P`).join(', ')}`);
    console.log('\n테스트를 마치려면 Ctrl+C 를 누르세요.\n');
  }, 3000);
}

process.on('SIGINT', () => {
  console.log('\n\n종료합니다.');
  process.exit(0);
});

void main();
