import { useEffect, useRef, useState } from 'react';
import { backend } from '../services/backend';

/**
 * 서버 시각과 이 기기 시계의 차이를 잰다.
 *
 * 각 기기의 setInterval 만 믿으면 교사 화면과 학생 화면의 남은 시간이
 * 서로 어긋난다. 그래서 Firestore 서버 시각을 기준으로 삼는다.
 */
export function useClockOffset(uid: string | null): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let active = true;

    backend
      .measureClockOffset(uid)
      .then((value) => {
        if (active && Number.isFinite(value)) setOffset(value);
      })
      .catch(() => {
        // 실패하면 오차 0으로 두고 진행한다.
      });

    return () => {
      active = false;
    };
  }, [uid]);

  return offset;
}

export interface CountdownState {
  /** 남은 시간(초, 올림). 0 이면 종료 */
  remaining: number;
  /** 소수점까지 포함한 남은 시간(초) */
  remainingExact: number;
  /** 0 ~ 1 사이의 진행률 */
  progress: number;
  expired: boolean;
  /** 시작 시각을 아직 받지 못한 상태 */
  pending: boolean;
}

/**
 * Firestore 의 questionStartedAt 과 duration 을 기준으로 남은 시간을 계산한다.
 * 모든 화면이 같은 기준 시각을 쓰기 때문에 서로 거의 같은 숫자를 보여 준다.
 */
export function useCountdown(
  startedAt: number | null,
  duration: number,
  clockOffset: number,
  active: boolean,
): CountdownState {
  const [now, setNow] = useState(() => Date.now());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || startedAt === null) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setNow(Date.now());
      frameRef.current = window.setTimeout(tick, 100);
    };
    tick();

    return () => {
      cancelled = true;
      if (frameRef.current !== null) window.clearTimeout(frameRef.current);
      frameRef.current = null;
    };
  }, [active, startedAt, duration]);

  if (startedAt === null) {
    return {
      remaining: duration,
      remainingExact: duration,
      progress: 0,
      expired: false,
      pending: true,
    };
  }

  const serverNow = now + clockOffset;
  const elapsed = (serverNow - startedAt) / 1000;
  const remainingExact = Math.max(0, duration - elapsed);

  return {
    remaining: Math.ceil(remainingExact),
    remainingExact,
    progress: duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1,
    expired: remainingExact <= 0,
    pending: false,
  };
}
