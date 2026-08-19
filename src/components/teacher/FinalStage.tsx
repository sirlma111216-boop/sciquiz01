import { Link } from 'react-router-dom';
import { Button } from '../common/UI';
import { cx, formatPoints } from '../../lib/utils';
import type { RankedParticipant } from '../../types/game';

interface FinalStageProps {
  className: string;
  ranked: RankedParticipant[];
  saving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
}

const PODIUM_STYLE = [
  {
    medal: '🥇',
    label: '1위',
    box: 'border-spark-400/60 bg-spark-400/15',
    text: 'text-spark-400',
    order: 'sm:order-2',
    height: 'sm:pt-4 sm:pb-10',
  },
  {
    medal: '🥈',
    label: '2위',
    box: 'border-slate-300/40 bg-white/10',
    text: 'text-slate-200',
    order: 'sm:order-1',
    height: 'sm:pt-8 sm:pb-6',
  },
  {
    medal: '🥉',
    label: '3위',
    box: 'border-amber-600/40 bg-amber-600/10',
    text: 'text-amber-500',
    order: 'sm:order-3',
    height: 'sm:pt-10 sm:pb-4',
  },
];

export function FinalStage({
  className,
  ranked,
  saving,
  saveError,
  onRetrySave,
}: FinalStageProps) {
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3, 10);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="text-center">
        <p className="animate-fade-up text-sm font-bold uppercase tracking-[0.4em] text-beam-400">
          {className}
        </p>
        <h1 className="animate-pop-in mt-2 font-black text-white [font-size:clamp(1.75rem,5vw,3.5rem)]">
          오늘의 과학 진짜? 가짜? 종료!
        </h1>
      </div>

      {/* TOP 3 */}
      {podium.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          {podium.map((participant, index) => {
            const style = PODIUM_STYLE[index];
            return (
              <div
                key={participant.uid}
                className={cx(
                  'animate-pop-in rounded-3xl border-2 px-4 py-6 text-center',
                  style.box,
                  style.order,
                  style.height,
                )}
                style={{ animationDelay: `${(2 - index) * 260}ms` }}
              >
                <p className="text-5xl sm:text-6xl" aria-hidden="true">
                  {style.medal}
                </p>
                <p className={cx('mt-2 text-sm font-black uppercase tracking-widest', style.text)}>
                  {style.label}
                </p>
                <p className="mt-2 truncate text-2xl font-black text-white sm:text-4xl">
                  {participant.nickname}
                </p>
                <p className="mt-1 text-xl font-black tabular-nums text-beam-400 sm:text-2xl">
                  {formatPoints(participant.score)} P
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* 4위 ~ 10위 */}
      {rest.length > 0 && (
        <div className="panel px-5 py-5">
          <h2 className="mb-3 text-lg font-black text-white">4위 ~ {3 + rest.length}위</h2>
          <ol className="space-y-2">
            {rest.map((participant) => (
              <li
                key={participant.uid}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="w-12 shrink-0 text-center text-base font-black tabular-nums text-slate-400">
                  {participant.rank}위
                </span>
                <span className="min-w-0 flex-1 truncate text-lg font-bold text-white">
                  {participant.nickname}
                </span>
                <span className="shrink-0 text-lg font-black tabular-nums text-beam-400">
                  {formatPoints(participant.score)} P
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 마무리 메시지 */}
      <div className="panel-strong px-6 py-6 text-center">
        <p className="text-lg font-bold leading-relaxed text-slate-100 sm:text-2xl sm:leading-relaxed">
          많이 맞힌 것도 중요하지만,
          <br />
          내가 무엇을 알고 무엇을 잘 모르는지 판단하는 것도
          <br />
          과학자의 중요한 능력입니다.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {saveError ? (
          <>
            <p className="flex-1 self-center text-sm font-semibold text-fake-400">{saveError}</p>
            <Button variant="secondary" size="lg" onClick={onRetrySave}>
              기록 저장 다시 시도
            </Button>
          </>
        ) : (
          <p className="flex-1 self-center text-sm font-medium text-slate-400">
            {saving ? '기록을 저장하는 중...' : '오늘 기록이 명예의 전당에 저장되었습니다.'}
          </p>
        )}
        <Link to="/ranking" className="sm:w-auto">
          <Button variant="secondary" size="lg" block>
            명예의 전당 보기
          </Button>
        </Link>
        <Link to="/teacher" className="sm:w-auto">
          <Button size="lg" block>
            새 게임 만들기
          </Button>
        </Link>
      </div>
    </div>
  );
}
