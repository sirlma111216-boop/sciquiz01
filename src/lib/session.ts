/**
 * 학생이 새로고침하거나 잠시 접속이 끊겨도
 * 같은 게임으로 돌아올 수 있도록 최근 게임방을 기억한다.
 *
 * 저장하는 것은 게임방 id 와 닉네임뿐이며 개인정보는 담지 않는다.
 */

const LAST_ROOM_KEY = 'srf-last-room';

export interface LastRoom {
  roomId: string;
  nickname: string;
  savedAt: number;
}

/** 하루가 지난 기록은 쓰지 않는다. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveLastRoom(value: { roomId: string; nickname: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const record: LastRoom = { ...value, savedAt: Date.now() };
    window.localStorage.setItem(LAST_ROOM_KEY, JSON.stringify(record));
  } catch {
    // 저장 공간을 쓸 수 없어도 게임 진행에는 문제가 없다.
  }
}

export function readLastRoom(): LastRoom | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastRoom;
    if (!parsed.roomId || !parsed.nickname) return null;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      clearLastRoom();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastRoom(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAST_ROOM_KEY);
  } catch {
    // 무시
  }
}
