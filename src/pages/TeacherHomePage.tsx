import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  BrandMark,
  Button,
  Field,
  LoadingScreen,
  MockModeBanner,
  Notice,
  OptionGroup,
  Screen,
  inputClass,
} from '../components/common/UI';
import { backend, isMockMode } from '../services/backend';
import { useAuth } from '../hooks/useAuth';
import { loadQuestionBank } from '../services/questionBank';
import { selectQuestions } from '../lib/questionSelector';
import { formatDate } from '../lib/utils';
import {
  DEFAULT_DURATION,
  DEFAULT_QUESTION_COUNT,
  DURATION_OPTIONS,
  QUESTION_COUNT_OPTIONS,
} from '../types/game';
import type { RoomDoc } from '../types/game';

export function TeacherHomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [className, setClassName] = useState('1학년 1반');
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_QUESTION_COUNT);
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankSize, setBankSize] = useState<number | null>(null);
  const [recentRooms, setRecentRooms] = useState<RoomDoc[]>([]);

  // 문제 은행은 교사 화면에서만 불러온다.
  useEffect(() => {
    let active = true;
    loadQuestionBank()
      .then((bank) => {
        if (active) setBankSize(bank.length);
      })
      .catch(() => {
        if (active) setError('문제 은행을 불러오지 못했습니다. 새로고침해 주세요.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let active = true;
    backend
      .listTeacherRooms(user.uid)
      .then((rooms) => {
        if (active) setRecentRooms(rooms.filter((room) => room.status === 'open').slice(0, 3));
      })
      .catch(() => {
        // 목록을 못 불러와도 새 게임은 만들 수 있다.
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return <LoadingScreen message="확인하는 중..." />;
  if (!user || user.isAnonymous) return <Navigate to="/teacher/login" replace />;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedClassName = className.trim();
    if (!trimmedClassName) {
      setError('학급 이름을 입력해 주세요.');
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const bank = await loadQuestionBank();
      const questions = selectQuestions(bank, questionCount);
      if (questions.length === 0) {
        throw new Error('사용할 수 있는 문제가 없습니다.');
      }

      const { roomId } = await backend.createRoom({
        teacherUid: user.uid,
        className: trimmedClassName,
        totalRounds: questions.length,
        duration,
        questionIds: questions.map((question) => question.id),
      });

      navigate(`/teacher/room/${roomId}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '게임방을 만들지 못했습니다.');
      setCreating(false);
    }
  };

  return (
    <Screen>
      {isMockMode && <MockModeBanner />}

      <div className="mb-6 flex items-center justify-between gap-3">
        <BrandMark size="sm" />
        <Button
          variant="ghost"
          onClick={() => {
            void backend.signOut();
          }}
        >
          로그아웃
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-4">
        {recentRooms.length > 0 && (
          <div className="panel px-5 py-4">
            <h2 className="text-sm font-black text-slate-300">진행 중인 게임 이어하기</h2>
            <ul className="mt-3 space-y-2">
              {recentRooms.map((room) => (
                <li key={room.id}>
                  <Link
                    to={`/teacher/room/${room.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-white/25"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-white">
                        {room.className}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {formatDate(room.createdAt)} · {room.totalRounds}문제
                      </span>
                    </span>
                    <span className="shrink-0 text-xl font-black tabular-nums tracking-widest text-beam-400">
                      {room.code}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleCreate} className="panel-strong space-y-6 px-6 py-7">
          <div>
            <h1 className="text-2xl font-black text-white">새 게임 만들기</h1>
            <p className="mt-1 text-sm text-slate-400">
              {bankSize === null
                ? '문제 은행을 불러오는 중...'
                : `문제 은행에 ${bankSize}문제가 준비되어 있습니다.`}
            </p>
          </div>

          <Field label="학급 이름" hint="명예의 전당에서 학급 기록을 묶는 기준이 됩니다." htmlFor="class-name">
            <input
              id="class-name"
              type="text"
              required
              maxLength={20}
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              className={inputClass}
              placeholder="1학년 3반"
            />
          </Field>

          <OptionGroup<number>
            label="문제 수"
            options={QUESTION_COUNT_OPTIONS}
            value={questionCount}
            onChange={setQuestionCount}
            renderOption={(value) => `${value}문제`}
          />

          <OptionGroup<number>
            label="문제당 제한 시간"
            options={DURATION_OPTIONS}
            value={duration}
            onChange={setDuration}
            renderOption={(value) => `${value}초`}
          />

          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" size="xl" block disabled={creating || bankSize === null}>
            {creating ? '게임방을 만드는 중...' : '게임방 만들기'}
          </Button>
        </form>

        <div className="flex gap-3">
          <Link to="/ranking" className="flex-1">
            <Button variant="secondary" block>
              명예의 전당
            </Button>
          </Link>
          <Link to="/" className="flex-1">
            <Button variant="ghost" block>
              처음 화면
            </Button>
          </Link>
        </div>
      </div>
    </Screen>
  );
}
