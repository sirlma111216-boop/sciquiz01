import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button, LoadingScreen, Notice, Screen } from '../components/common/UI';
import { WaitingRoom } from '../components/teacher/WaitingRoom';
import { QuestionStage, SuspenseStage } from '../components/teacher/QuestionStage';
import { RevealStage } from '../components/teacher/RevealStage';
import { FinalStage } from '../components/teacher/FinalStage';
import { backend } from '../services/backend';
import { loadQuestionsByIds } from '../services/questionBank';
import { useAuth } from '../hooks/useAuth';
import { useClockOffset, useCountdown } from '../hooks/useCountdown';
import {
  useParticipants,
  useRoom,
  useRoundAnswers,
  useRoundSummary,
} from '../hooks/useRoom';
import type { Question } from '../types/game';

/**
 * 문제가 시작된 뒤 이 시간이 지나기 전에는 마감하지 않는다.
 * 화면이 바뀌는 순간의 일시적인 상태 때문에 문제가 건너뛰어지는 것을 막는다.
 */
const MIN_QUESTION_SECONDS = 1.5;

export function TeacherRoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { room, loading: roomLoading } = useRoom(roomId || null);
  const { participants, ranked } = useParticipants(roomId || null);

  const currentRound = room?.currentRound ?? -1;
  const answers = useRoundAnswers(roomId || null, currentRound);
  const summary = useRoundSummary(roomId || null, currentRound);

  const clockOffset = useClockOffset(user?.uid ?? null);
  const countdown = useCountdown(
    room?.questionStartedAt ?? null,
    room?.duration ?? 15,
    clockOffset,
    room?.phase === 'question',
  );

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** 같은 라운드를 두 번 채점하지 않도록 하는 표시 */
  const scoringRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  /* 새로고침해도 이 게임의 문제 목록을 다시 불러온다. */
  useEffect(() => {
    if (!roomId || !room) return;
    let active = true;

    backend
      .loadRoomPlan(roomId)
      .then((ids) => loadQuestionsByIds(ids))
      .then((list) => {
        if (active) setQuestions(list);
      })
      .catch(() => {
        if (active) setError('문제 목록을 불러오지 못했습니다. 새로고침해 주세요.');
      });

    return () => {
      active = false;
    };
    // room 이 처음 로드되었을 때 한 번만 불러오면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, room?.id]);

  const currentQuestion =
    questions && currentRound >= 0 && currentRound < questions.length
      ? questions[currentRound]
      : null;

  const restingCount = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.recoveryNeeded && participant.recoveryRound === currentRound,
      ).length,
    [participants, currentRound],
  );

  // 반드시 현재 문제의 답안만 센다.
  // 다음 문제로 넘어간 직후에는 이전 문제의 답안이 잠깐 남아 있어서,
  // 그대로 세면 새 문제가 시작하자마자 "전원 제출"로 오해해 바로 마감된다.
  const submittedCount = useMemo(() => {
    const uids = new Set(
      answers
        .filter((answer) => answer.roundIndex === currentRound)
        .map((answer) => answer.uid),
    );
    return uids.size;
  }, [answers, currentRound]);

  /* 제한 시간이 끝나면 답안을 마감한다. */
  useEffect(() => {
    if (!room || room.phase !== 'question') return;
    if (!countdown.expired || countdown.pending) return;
    // 서버가 시작 시각을 확정하기 전에는 남은 시간을 믿지 않는다.
    if (room.questionStartedAt === null) return;
    void backend.lockRound(room.id, room.currentRound).catch(() => {
      setError('답안 마감에 실패했습니다. 네트워크를 확인해 주세요.');
    });
  }, [countdown.expired, countdown.pending, room]);

  /**
   * 문제가 실제로 시작한 뒤 얼마나 지났는지(초).
   * 서버가 questionStartedAt 을 아직 확정하지 않았으면 null 이다.
   */
  const elapsedSeconds =
    room && room.questionStartedAt !== null && !countdown.pending
      ? room.duration - countdown.remainingExact
      : null;

  /* 모두 제출했으면 기다리지 않고 바로 마감한다. */
  useEffect(() => {
    if (!room || room.phase !== 'question') return;
    // 문제가 제대로 시작되기 전에는 절대 마감하지 않는다.
    // (서버 시작 시각이 확정되고 최소 1.5초가 지난 뒤에만 허용)
    if (elapsedSeconds === null || elapsedSeconds < MIN_QUESTION_SECONDS) return;

    const expected = Math.max(0, participants.length - restingCount);
    if (expected === 0 || submittedCount < expected) return;
    void backend.lockRound(room.id, room.currentRound).catch(() => undefined);
  }, [room, participants.length, restingCount, submittedCount, elapsedSeconds]);

  /* 마감되면 점수를 계산하고 정답을 공개한다. (한 라운드에 정확히 한 번) */
  useEffect(() => {
    if (!room || !user || room.phase !== 'locked' || !currentQuestion) return;

    const key = `${room.id}:${room.currentRound}`;
    if (scoringRef.current === key) return;
    scoringRef.current = key;

    const run = async () => {
      try {
        await backend.applyRoundScores({
          roomId: room.id,
          roundIndex: room.currentRound,
          correctAnswer: currentQuestion.answer,
          teacherUid: user.uid,
        });
        // 짧은 긴장감을 준 뒤 정답을 공개한다.
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        await backend.revealRound(room.id, room.currentRound);
        setError(null);
      } catch {
        scoringRef.current = null; // 실패하면 다시 시도할 수 있게 한다.
        setError('점수 계산에 실패했습니다. 잠시 후 자동으로 다시 시도합니다.');
      }
    };

    void run();
  }, [room, user, currentQuestion]);

  /* 게임이 끝나면 기록을 저장한다. (문서 이름이 고정되어 중복 저장되지 않는다) */
  useEffect(() => {
    if (!room || room.phase !== 'finished') return;
    if (room.leaderboardSaved || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    backend
      .saveLeaderboard(room.id, room.className)
      .then(() => setSaveError(null))
      .catch(() => {
        savingRef.current = false;
        setSaveError('기록 저장에 실패했습니다.');
      })
      .finally(() => setSaving(false));
  }, [room]);

  const handleStart = useCallback(async () => {
    if (!room) return;
    setStarting(true);
    setError(null);
    try {
      await backend.startRound(room.id, 0);
    } catch {
      setError('게임을 시작하지 못했습니다.');
    } finally {
      setStarting(false);
    }
  }, [room]);

  const handleNext = useCallback(async () => {
    if (!room || !questions || advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      const isLast = room.currentRound >= questions.length - 1;
      if (isLast) {
        await backend.finishGame(room.id);
      } else {
        await backend.startRound(room.id, room.currentRound + 1);
      }
      // 여기서 버튼을 바로 풀지 않는다.
      // 다음 문제가 실제로 화면에 나타난 뒤에 아래 effect 가 풀어 준다.
    } catch {
      setError('다음 문제로 넘어가지 못했습니다.');
      setAdvancing(false);
    }
  }, [room, questions, advancing]);

  /* 다음 문제가 실제로 시작되면 그때 버튼을 다시 쓸 수 있게 한다. */
  useEffect(() => {
    setAdvancing(false);
  }, [room?.currentRound, room?.phase]);

  /* 화면 전환이 오지 않는 경우를 대비한 안전장치 */
  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(() => setAdvancing(false), 6000);
    return () => window.clearTimeout(timer);
  }, [advancing]);

  const handleLockNow = useCallback(() => {
    if (!room) return;
    void backend.lockRound(room.id, room.currentRound).catch(() => undefined);
  }, [room]);

  const handleRetrySave = useCallback(() => {
    if (!room) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    backend
      .saveLeaderboard(room.id, room.className)
      .catch(() => {
        savingRef.current = false;
        setSaveError('기록 저장에 실패했습니다.');
      })
      .finally(() => setSaving(false));
  }, [room]);

  /* ── 화면 ── */

  if (authLoading || roomLoading) return <LoadingScreen message="게임방을 여는 중..." />;
  if (!user || user.isAnonymous) return <Navigate to="/teacher/login" replace />;

  if (!room) {
    return (
      <Screen center>
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-2xl font-black text-white">게임방을 찾을 수 없습니다.</p>
          <p className="text-sm text-slate-400">주소가 올바른지 확인해 주세요.</p>
          <Link to="/teacher">
            <Button block>교사용 홈으로</Button>
          </Link>
        </div>
      </Screen>
    );
  }

  if (room.teacherUid !== user.uid) {
    return (
      <Screen center>
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="text-2xl font-black text-white">이 게임방의 진행자가 아닙니다.</p>
          <Link to="/teacher">
            <Button block>교사용 홈으로</Button>
          </Link>
        </div>
      </Screen>
    );
  }

  const isLastRound = questions ? room.currentRound >= questions.length - 1 : false;

  return (
    <Screen className="gap-3">
      {/* 진행 중에는 설정 메뉴를 숨기고 최소한의 정보만 보여 준다. */}
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
        <span className="truncate">
          {room.className} · 코드 <span className="text-beam-400">{room.code}</span> ·{' '}
          {participants.length}명
        </span>
        {room.phase === 'waiting' && (
          <Link to="/teacher" className="shrink-0 hover:text-slate-300">
            나가기
          </Link>
        )}
      </div>

      {error && <Notice tone="warn">{error}</Notice>}

      {room.phase === 'waiting' && (
        <WaitingRoom
          code={room.code}
          className={room.className}
          totalRounds={room.totalRounds}
          duration={room.duration}
          participants={participants}
          onStart={handleStart}
          starting={starting}
        />
      )}

      {room.phase === 'question' &&
        (currentQuestion ? (
          <QuestionStage
            question={currentQuestion}
            roundNumber={room.currentRound + 1}
            totalRounds={room.totalRounds}
            remaining={countdown.remaining}
            duration={room.duration}
            progress={countdown.progress}
            submittedCount={submittedCount}
            totalStudents={participants.length}
            restingCount={restingCount}
            locked={false}
            onLockNow={handleLockNow}
          />
        ) : (
          <LoadingScreen message="문제를 불러오는 중..." />
        ))}

      {room.phase === 'locked' && <SuspenseStage />}

      {room.phase === 'reveal' &&
        (currentQuestion ? (
          <RevealStage
            question={currentQuestion}
            roundNumber={room.currentRound + 1}
            totalRounds={room.totalRounds}
            summary={summary}
            ranked={ranked}
            isLastRound={isLastRound}
            onNext={handleNext}
            advancing={advancing}
          />
        ) : (
          <LoadingScreen message="결과를 정리하는 중..." />
        ))}

      {room.phase === 'finished' && (
        <FinalStage
          className={room.className}
          ranked={ranked}
          saving={saving}
          saveError={saveError}
          onRetrySave={handleRetrySave}
        />
      )}
    </Screen>
  );
}
