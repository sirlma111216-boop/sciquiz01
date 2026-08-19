import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BrandMark, Button, MockModeBanner, Notice, Screen } from '../components/common/UI';
import { backend, isMockMode } from '../services/backend';
import { cx, formatDate, formatPoints, rankMedal } from '../lib/utils';
import type { LeaderboardEntry } from '../types/game';

type TabId = 'class' | 'allTime';

export function RankingPage() {
  const [params, setParams] = useSearchParams();
  const selectedClass = params.get('class') ?? '';
  const [tab, setTab] = useState<TabId>(selectedClass ? 'class' : 'allTime');

  const [classNames, setClassNames] = useState<string[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    backend
      .fetchClassNames()
      .then((names) => {
        if (!active) return;
        setClassNames(names);
        if (!selectedClass && names.length > 0) {
          setParams({ class: names[0] }, { replace: true });
        }
      })
      .catch(() => {
        if (active) setError('기록을 불러오지 못했습니다.');
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const request =
      tab === 'allTime'
        ? backend.fetchTopAllTime(10)
        : selectedClass
          ? backend.fetchTopByClass(selectedClass, 10)
          : Promise.resolve<LeaderboardEntry[]>([]);

    request
      .then((list) => {
        if (active) setEntries(list);
      })
      .catch(() => {
        if (active) {
          setError(
            'Firestore 색인이 아직 만들어지지 않았을 수 있습니다. README의 색인 설정을 확인해 주세요.',
          );
          setEntries([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tab, selectedClass]);

  const title = useMemo(
    () =>
      tab === 'allTime'
        ? 'SCIENCE CHALLENGE ALL-TIME TOP 10'
        : `${selectedClass || '학급'} 역대 TOP 10`,
    [tab, selectedClass],
  );

  return (
    <Screen>
      {isMockMode && <MockModeBanner />}

      <div className="mb-6">
        <BrandMark size="sm" />
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-4">
        <h1 className="text-center text-2xl font-black text-white">명예의 전당</h1>

        {/* 탭 */}
        <div className="grid grid-cols-2 gap-2">
          <TabButton active={tab === 'class'} onClick={() => setTab('class')}>
            학급 역대
          </TabButton>
          <TabButton active={tab === 'allTime'} onClick={() => setTab('allTime')}>
            전체 역대
          </TabButton>
        </div>

        {/* 학급 선택 */}
        {tab === 'class' && classNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {classNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setParams({ class: name }, { replace: true })}
                className={cx(
                  'min-h-[40px] rounded-full border px-4 text-sm font-bold transition-colors',
                  name === selectedClass
                    ? 'border-beam-400 bg-beam-500/20 text-beam-400'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30',
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="panel-strong px-5 py-6">
          <p className="mb-4 text-center text-xs font-black uppercase tracking-[0.25em] text-beam-400">
            {title}
          </p>

          {error && <Notice tone="warn">{error}</Notice>}

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">불러오는 중...</p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              아직 저장된 기록이 없습니다. 게임을 한 번 끝내면 기록이 남아요.
            </p>
          ) : (
            <ol className="space-y-2">
              {entries.map((entry, index) => {
                const rank = index + 1;
                const medal = rankMedal(rank);
                return (
                  <li
                    key={entry.id}
                    className={cx(
                      'flex items-center gap-3 rounded-xl border px-3 py-3',
                      rank <= 3
                        ? 'border-spark-400/30 bg-spark-400/10'
                        : 'border-white/10 bg-white/5',
                    )}
                  >
                    <span
                      className={cx(
                        'w-11 shrink-0 text-center text-lg font-black tabular-nums',
                        rank <= 3 ? 'text-spark-400' : 'text-slate-400',
                      )}
                    >
                      {medal || `${rank}위`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-bold text-white">
                        {entry.nickname}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {entry.className} · {formatDate(entry.playedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-lg font-black tabular-nums text-beam-400">
                      {formatPoints(entry.score)} P
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          닉네임 · 학급명 · 점수 · 날짜만 저장합니다. 실명이나 연락처는 저장하지 않습니다.
        </p>

        <div className="flex gap-3">
          <Link to="/" className="flex-1">
            <Button variant="secondary" block>
              처음 화면
            </Button>
          </Link>
          <Link to="/play" className="flex-1">
            <Button block>학생 입장</Button>
          </Link>
        </div>
      </div>
    </Screen>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'min-h-[48px] rounded-xl border-2 text-base font-bold transition-colors',
        active
          ? 'border-beam-400 bg-beam-500/20 text-beam-400'
          : 'border-white/15 bg-ink-800/70 text-slate-300 hover:border-white/30',
      )}
    >
      {children}
    </button>
  );
}
