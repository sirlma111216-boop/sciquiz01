import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, LoadingScreen, Notice, Screen } from '../components/common/UI';
import { StudentHeader } from '../components/student/StudentHeader';
import { ChoicePanel } from '../components/student/ChoicePanel';
import {
  FinalPanel,
  RecoveryPanel,
  ResultPanel,
  SubmittedPanel,
  TimeUpPanel,
  WaitingPanel,
} from '../components/student/StudentPanels';
import { backend } from '../services/backend';
import { useStudentAuth } from '../hooks/useAuth';
import { useClockOffset, useCountdown } from '../hooks/useCountdown';
import { useMyAnswer, useMyParticipant, useParticipants, useRoom } from '../hooks/useRoom';
import { clearLastRoom, readLastRoom, saveLastRoom } from '../lib/session';

export function StudentGamePage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const { user, loading: authLoading } = useStudentAuth();
  const { room, loading: roomLoading } = useRoom(roomId || null);
  const { participant, loaded: participantLoaded } = useMyParticipant(
    roomId || null,
    user?.uid ?? null,
  );
  const { ranked } = useParticipants(roomId || null);

  const currentRound = room?.currentRound ?? -1;
  const myAnswer = useMyAnswer(roomId || null, user?.uid ?? null, currentRound);

  const clockOffset = useClockOffset(user?.uid ?? null);
  const countdown = useCountdown(
    room?.questionStartedAt ?? null,
    room?.duration ?? 15,
    clockOffset,
    room?.phase === 'question',
  );

  const [selectedChoice, setSelectedChoice] = useState<boolean | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rejoinRef = useRef(false);

  /* 문제가 바뀌면 선택 상태를 초기화한다. */
  useEffect(() => {
    setSelectedChoice(null);
    setSelectedPoints(null);
    setError(null);
  }, [currentRound]);

  /* 새로고침으로 참가 정보가 없으면 저장해 둔 닉네임으로 다시 들어간다. */
  useEffect(() => {
    if (!room || !user || !participantLoaded || participant || rejoinRef.current) return;
    if (room.status !== 'open' || room.phase === 'finished') return;

    const last = readLastRoom();
    const nickname = last && last.roomId === roomId ? last.nickname : null;
    if (!nickname) {
      navigate('/play', { replace: true });
      return;
    }

    rejoinRef.current = true;
    backend
      .joinRoom({ roomId, uid: user.uid, nickname })
      .then(() => saveLastRoom({ roomId, nickname }))
      .catch(() => {
        clearLastRoom();
        navigate('/play', { replace: true });
      });
  }, [room, user, participant, participantLoaded, roomId, navigate]);

  /* 보유 점수보다 큰 확신 포인트가 남아 있으면 자동으로 해제한다. */
  useEffect(() => {
    if (!participant || selectedPoints === null) return;
    if (selectedPoints > participant.score) setSelectedPoints(null);
  }, [participant, selectedPoints]);

  const myRank = useMemo(() => {
    if (!user) return null;
    const found = ranked.find((entry) => entry.uid === user.uid);
    return found ? found.rank : null;
  }, [ranked, user]);

  const isResting = Boolean(
    participant?.recoveryNeeded && participant.recoveryRound === currentRound,
  );

  const handleSubmit = useCallback(async () => {
    if (!room || !user || selectedChoice === null || selectedPoints === null) return;
    if (countdown.expired) {
      setError('제한 시간이 끝났어요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await backend.submitAnswer({
        roomId: room.id,
        uid: user.uid,
        roundIndex: room.currentRound,
        choice: selectedChoice,
        confidencePoints: selectedPoints,
        teacherUid: room.teacherUid,
      });
    } catch (cause: unknown) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : '전송에 실패했어요. 다시 눌러 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [room, user, selectedChoice, selectedPoints, countdown.expired]);

  /* ── 화면 ── */

  if (authLoading || roomLoading) return <LoadingScreen message="게임에 연결하는 중..." />;

  if (!room) {
    return (
      <Screen center>
        <div className="w-full max-w-xs space-y-4 text-center">
          <p className="text-xl font-black text-white">게임방을 찾을 수 없어요.</p>
          <Button block onClick={() => navigate('/play', { replace: true })}>
            다시 입장하기
          </Button>
        </div>
      </Screen>
    );
  }

  if (!participant) {
    return <LoadingScreen message="입장 정보를 확인하는 중..." />;
  }

  const roundNumber = currentRound >= 0 ? currentRound + 1 : null;
  const lastResult = participant.lastResult;
  const hasResultForThisRound =
    lastResult !== null && lastResult.roundIndex === currentRound;

  // 채점은 끝났지만 아직 정답을 공개하기 전(locked)에는
  // 상단 포인트를 미리 바꾸지 않아 결과가 새어 나가지 않게 한다.
  const headerScore =
    room.phase === 'locked' && hasResultForThisRound && lastResult
      ? participant.score - lastResult.delta
      : participant.score;

  return (
    <Screen className="max-w-md">
      <StudentHeader
        nickname={participant.nickname}
        score={headerScore}
        roundNumber={roundNumber}
        totalRounds={room.totalRounds}
      />

      {error && (
        <div className="mb-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {room.phase === 'waiting' && (
        <WaitingPanel nickname={participant.nickname} score={participant.score} />
      )}

      {room.phase === 'question' &&
        (isResting ? (
          <RecoveryPanel score={participant.score} />
        ) : myAnswer ? (
          <SubmittedPanel choice={myAnswer.choice} confidencePoints={myAnswer.confidencePoints} />
        ) : countdown.expired ? (
          <TimeUpPanel submitted={false} />
        ) : (
          <ChoicePanel
            remaining={countdown.remaining}
            duration={room.duration}
            progress={countdown.progress}
            currentScore={participant.score}
            selectedChoice={selectedChoice}
            selectedPoints={selectedPoints}
            onSelectChoice={setSelectedChoice}
            onSelectPoints={setSelectedPoints}
            onSubmit={handleSubmit}
            submitting={submitting}
            timeUp={countdown.expired}
            error={null}
          />
        ))}

      {room.phase === 'locked' &&
        (isResting ? (
          <RecoveryPanel score={participant.score} />
        ) : myAnswer ? (
          <SubmittedPanel choice={myAnswer.choice} confidencePoints={myAnswer.confidencePoints} />
        ) : (
          <TimeUpPanel submitted={false} />
        ))}

      {room.phase === 'reveal' &&
        (hasResultForThisRound && lastResult ? (
          <ResultPanel result={lastResult} rank={myRank} totalStudents={ranked.length} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-base font-semibold text-slate-400">결과를 기다리는 중...</p>
          </div>
        ))}

      {room.phase === 'finished' && (
        <FinalPanel
          nickname={participant.nickname}
          score={participant.score}
          rank={myRank}
          totalStudents={ranked.length}
        />
      )}
    </Screen>
  );
}
