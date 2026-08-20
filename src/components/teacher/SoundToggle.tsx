import { useState } from 'react';
import { audio } from '../../lib/audio';
import { cx } from '../../lib/utils';

/**
 * 소리 켜기/끄기 (교사 화면 전용)
 * 선택한 값은 브라우저에 저장되어 다음 수업에도 이어진다.
 */
export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(() => audio.isEnabled());

  const toggle = () => {
    const next = !on;
    audio.setEnabled(next);
    if (next) audio.unlock();
    setOn(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? '소리 끄기' : '소리 켜기'}
      className={cx(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors',
        on
          ? 'border-beam-400/40 bg-beam-500/15 text-beam-400'
          : 'border-white/15 bg-white/5 text-slate-400',
        className,
      )}
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
      {on ? '소리 켬' : '소리 끔'}
    </button>
  );
}
