import { CONFIDENCE_OPTIONS } from '../types/game';
import type { ParticipantDoc, RankedParticipant } from '../types/game';

/** 1,350 P 처럼 천 단위 쉼표를 넣어 보여 준다. */
export function formatPoints(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

/** +150 / -200 처럼 부호를 붙여 보여 준다. */
export function formatDelta(value: number): string {
  if (value > 0) return `+${formatPoints(value)}`;
  if (value < 0) return `-${formatPoints(Math.abs(value))}`;
  return '0';
}

/** 난이도를 별로 표시한다. */
export function difficultyStars(difficulty: number): string {
  return '★'.repeat(Math.max(1, Math.min(5, difficulty)));
}

/** 닉네임에서 앞 두 글자를 뽑아 아바타 대신 쓴다. */
export function nicknameInitials(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
}

/**
 * 닉네임을 정리한다.
 * 공백을 하나로 줄이고 앞뒤 공백을 없앤 뒤 12자로 자른다.
 */
export function sanitizeNickname(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 12);
}

/** 닉네임이 쓸 수 있는 형태인지 확인한다. */
export function validateNickname(raw: string): string | null {
  const nickname = sanitizeNickname(raw);
  if (nickname.length === 0) return '닉네임을 입력해 주세요.';
  if (nickname.length > 12) return '닉네임은 12자까지 쓸 수 있어요.';
  // Firestore 문서 이름으로 쓸 수 없는 글자를 막는다.
  if (/[/\\.[\]*`~#$?%]/.test(nickname)) {
    return '닉네임에 쓸 수 없는 기호가 들어 있어요.';
  }
  if (/^__.*__$/.test(nickname)) return '닉네임에 쓸 수 없는 형태예요.';
  return null;
}

/** 닉네임 중복 확인에 쓰는 열쇠 값 (대소문자와 공백 무시) */
export function nicknameKey(nickname: string): string {
  return sanitizeNickname(nickname).toLowerCase().replace(/\s/g, '');
}

/** 게임 코드를 정리한다. (숫자만 남기고 6자리까지) */
export function sanitizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/**
 * 점수 순으로 순위를 매긴다.
 * 점수가 같으면 먼저 들어온 학생이 앞 순위가 된다. (공동 순위)
 */
export function rankParticipants(participants: readonly ParticipantDoc[]): RankedParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinedAt - b.joinedAt;
  });

  const ranked: RankedParticipant[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;

  sorted.forEach((participant, index) => {
    const rank = participant.score === lastScore ? lastRank : index + 1;
    lastScore = participant.score;
    lastRank = rank;
    ranked.push({
      ...participant,
      rank,
      rankChange:
        participant.previousRank === null || participant.previousRank === undefined
          ? null
          : participant.previousRank - rank,
    });
  });

  return ranked;
}

/**
 * 현재 점수로 고를 수 있는 확신 포인트인지 확인한다.
 * 보유 포인트보다 큰 값은 고를 수 없다.
 */
export function canSelectConfidence(currentScore: number, points: number): boolean {
  return points <= currentScore;
}

/**
 * 보유 점수로 고를 수 있는 가장 큰 확신 포인트를 돌려준다.
 * 하나도 없으면 null. (과학 에너지 충전 대상)
 */
export function largestAffordableConfidence(currentScore: number): number | null {
  const affordable = CONFIDENCE_OPTIONS.filter((points) => points <= currentScore);
  return affordable.length > 0 ? affordable[affordable.length - 1] : null;
}

/** 2026. 3. 4. 형태로 날짜를 보여 준다. */
export function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(timestamp));
}

/** 순위에 어울리는 메달을 돌려준다. */
export function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

/** className 을 조건부로 이어 붙인다. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** 학생 접속 주소를 만든다. */
export function buildPlayUrl(): string {
  const configured = import.meta.env.VITE_PLAY_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '') + '/play';
  }
  if (typeof window === 'undefined') return '/play';
  return `${window.location.origin}/play`;
}

/** 사람이 읽기 좋은 주소 (프로토콜 제거) */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
