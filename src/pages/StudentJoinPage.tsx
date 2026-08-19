import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BrandMark,
  Button,
  Field,
  LoadingScreen,
  MockModeBanner,
  Notice,
  Screen,
  inputClass,
} from '../components/common/UI';
import { backend, isMockMode } from '../services/backend';
import { useStudentAuth } from '../hooks/useAuth';
import { TeacherSessionNotice } from '../components/student/TeacherSessionNotice';
import { sanitizeNickname, sanitizeRoomCode, validateNickname } from '../lib/utils';
import { clearLastRoom, readLastRoom, saveLastRoom } from '../lib/session';

const NICKNAME_IDEAS = ['초코우유', '화성인', '감자박사', '과학천재', '슬라임', '뉴턴사과'];

export function StudentJoinPage() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    error: authError,
    teacherSignedIn,
    continueAsStudent,
  } = useStudentAuth();

  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [rejoin, setRejoin] = useState<{ roomId: string; nickname: string } | null>(null);

  /* 새로고침이나 네트워크 끊김 뒤에 바로 돌아갈 수 있게 한다. */
  useEffect(() => {
    const last = readLastRoom();
    if (!last) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;
    let finished = false;

    const stop = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    unsubscribe = backend.subscribeRoom(last.roomId, (room) => {
      if (!active) return;
      if (room && room.status === 'open' && room.phase !== 'finished') {
        setRejoin({ roomId: last.roomId, nickname: last.nickname });
      } else {
        clearLastRoom();
        setRejoin(null);
      }
      // 한 번 확인했으면 구독을 끊는다.
      finished = true;
      stop();
    });

    // 응답이 곧바로 돌아온 경우에는 위에서 아직 구독을 끊지 못했으므로 여기서 끊는다.
    if (finished) stop();

    return () => {
      active = false;
      stop();
    };
  }, []);

  if (loading) return <LoadingScreen message="접속하는 중..." />;

  // 교사 계정으로 로그인된 브라우저에서는 교사 세션을 함부로 끊지 않는다.
  if (teacherSignedIn) {
    return (
      <TeacherSessionNotice
        onContinueAsStudent={() => {
          void continueAsStudent();
        }}
      />
    );
  }

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      setError('접속에 실패했어요. 새로고침 후 다시 시도해 주세요.');
      return;
    }

    const cleanCode = sanitizeRoomCode(code);
    if (cleanCode.length < 4) {
      setError('게임 코드를 정확히 입력해 주세요.');
      return;
    }

    const nicknameError = validateNickname(nickname);
    if (nicknameError) {
      setError(nicknameError);
      return;
    }

    setError(null);
    setJoining(true);
    try {
      const room = await backend.findRoomByCode(cleanCode);
      if (!room) {
        setError(
          isMockMode
            ? `그런 게임 코드가 없어요. 연습 모드는 교사 화면과 같은 브라우저·같은 주소에서만 통합니다. 지금 이 화면의 주소는 ${window.location.host} 입니다. 교사 화면도 똑같은 주소인지 확인해 주세요. 휴대전화나 다른 기기로 참여하려면 Firebase 연결이 필요합니다.`
            : '그런 게임 코드가 없어요. 교사 화면의 코드를 확인해 주세요.',
        );
        setJoining(false);
        return;
      }
      if (room.status !== 'open' || room.phase === 'finished') {
        setError('이미 끝난 게임이에요.');
        setJoining(false);
        return;
      }

      const cleanNickname = sanitizeNickname(nickname);
      await backend.joinRoom({ roomId: room.id, uid: user.uid, nickname: cleanNickname });
      saveLastRoom({ roomId: room.id, nickname: cleanNickname });
      navigate(`/play/${room.id}`, { replace: true });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '입장하지 못했어요.');
      setJoining(false);
    }
  };

  return (
    <Screen center>
      <div className="w-full max-w-sm">
        {isMockMode && <MockModeBanner />}

        <div className="mb-6">
          <BrandMark />
        </div>

        {rejoin && (
          <div className="mb-4 rounded-2xl border border-beam-500/40 bg-beam-500/10 px-4 py-4">
            <p className="text-sm font-bold text-beam-400">진행 중이던 게임이 있어요</p>
            <p className="mt-1 text-xs text-slate-300">
              닉네임 <span className="font-bold text-white">{rejoin.nickname}</span> 로 다시 들어갈
              수 있어요.
            </p>
            <Button
              size="md"
              block
              className="mt-3"
              onClick={() => navigate(`/play/${rejoin.roomId}`, { replace: true })}
            >
              게임으로 돌아가기
            </Button>
          </div>
        )}

        <form onSubmit={handleJoin} className="panel-strong space-y-5 px-5 py-6">
          <Field label="게임 코드" hint="교사 화면에 표시된 숫자를 입력하세요." htmlFor="room-code">
            <input
              id="room-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              value={code}
              onChange={(event) => setCode(sanitizeRoomCode(event.target.value))}
              className={`${inputClass} text-center text-3xl font-black tracking-[0.3em]`}
              placeholder="0000"
            />
          </Field>

          <Field
            label="닉네임"
            hint="실명 대신 자유롭게 별명을 쓰세요. (12자까지)"
            htmlFor="nickname"
          >
            <input
              id="nickname"
              type="text"
              autoComplete="off"
              required
              maxLength={12}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className={`${inputClass} text-center text-xl font-bold`}
              placeholder="감자박사"
            />
          </Field>

          <div className="flex flex-wrap justify-center gap-1.5">
            {NICKNAME_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setNickname(idea)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/30"
              >
                {idea}
              </button>
            ))}
          </div>

          {(error || authError) && <Notice tone="error">{error ?? authError}</Notice>}

          <Button type="submit" size="xl" block disabled={joining}>
            {joining ? '입장하는 중...' : '입장하기'}
          </Button>
        </form>

        <Link
          to="/"
          className="mt-4 block text-center text-sm font-semibold text-slate-500 hover:text-slate-300"
        >
          처음 화면으로
        </Link>
      </div>
    </Screen>
  );
}
