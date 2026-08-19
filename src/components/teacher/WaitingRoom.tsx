import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../common/UI';
import { buildPlayUrl, displayUrl, nicknameInitials } from '../../lib/utils';
import type { ParticipantDoc } from '../../types/game';

interface WaitingRoomProps {
  code: string;
  className: string;
  totalRounds: number;
  duration: number;
  participants: ParticipantDoc[];
  onStart: () => void;
  starting: boolean;
}

export function WaitingRoom({
  code,
  className,
  totalRounds,
  duration,
  participants,
  onStart,
  starting,
}: WaitingRoomProps) {
  const playUrl = buildPlayUrl();
  const sorted = [...participants].sort((a, b) => a.joinedAt - b.joinedAt);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* 게임 코드 */}
        <div className="panel-strong flex flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.4em] text-beam-400">게임 코드</p>
          <p className="mt-3 font-black tabular-nums tracking-[0.15em] text-white [font-size:clamp(4rem,14vw,9rem)] [line-height:1]">
            {code}
          </p>
          <p className="mt-6 text-lg font-semibold text-slate-300">
            휴대전화에서 아래 주소로 접속하세요
          </p>
          <p className="mt-2 break-all rounded-xl bg-black/30 px-4 py-2 text-xl font-bold text-beam-400 sm:text-2xl">
            {displayUrl(playUrl)}
          </p>
        </div>

        {/* QR 코드 */}
        <div className="panel-strong flex flex-col items-center justify-center gap-4 px-6 py-10">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={playUrl} size={190} level="M" />
          </div>
          <p className="text-center text-sm font-medium text-slate-300">
            QR 코드를 찍어도 바로 들어올 수 있어요
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold text-slate-400">
            <span className="rounded-full bg-white/10 px-3 py-1">{className}</span>
            <span className="rounded-full bg-white/10 px-3 py-1">{totalRounds}문제</span>
            <span className="rounded-full bg-white/10 px-3 py-1">문제당 {duration}초</span>
          </div>
        </div>
      </div>

      {/* 참가자 */}
      <div className="panel flex flex-1 flex-col px-5 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-black text-white [font-size:clamp(2rem,5vw,3.5rem)]">
            {participants.length}명 참가
          </p>
          <p className="text-sm font-medium text-slate-400">
            학생이 들어오면 실시간으로 나타납니다
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-lg font-semibold text-slate-500">
              아직 들어온 학생이 없어요. 게임 코드를 안내해 주세요.
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {sorted.map((participant) => (
              <li
                key={participant.uid}
                className="animate-pop-in flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-beam-500/20 text-xs font-bold text-beam-400"
                >
                  {nicknameInitials(participant.nickname)}
                </span>
                <span className="truncate text-sm font-bold text-slate-100">
                  {participant.nickname}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 pb-2">
        <Button
          size="xl"
          block
          onClick={onStart}
          disabled={starting || participants.length === 0}
        >
          {participants.length === 0
            ? '학생이 들어오면 시작할 수 있어요'
            : starting
              ? '시작하는 중...'
              : `게임 시작 (${participants.length}명)`}
        </Button>
      </div>
    </div>
  );
}
