import { useEffect, useMemo, useState } from 'react';
import { backend } from '../services/backend';
import { rankParticipants } from '../lib/utils';
import type {
  AnswerDoc,
  ParticipantDoc,
  RankedParticipant,
  RoomDoc,
  RoundSummaryDoc,
} from '../types/game';

/** 게임방 상태를 실시간으로 구독한다. */
export function useRoom(roomId: string | null): { room: RoomDoc | null; loading: boolean } {
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = backend.subscribeRoom(roomId, (value) => {
      setRoom(value);
      setLoading(false);
    });
    return unsubscribe;
  }, [roomId]);

  return { room, loading };
}

/** 참가 학생 목록을 실시간으로 구독하고 순위를 매긴다. */
export function useParticipants(roomId: string | null): {
  participants: ParticipantDoc[];
  ranked: RankedParticipant[];
} {
  const [participants, setParticipants] = useState<ParticipantDoc[]>([]);

  useEffect(() => {
    if (!roomId) {
      setParticipants([]);
      return;
    }
    return backend.subscribeParticipants(roomId, setParticipants);
  }, [roomId]);

  const ranked = useMemo(() => rankParticipants(participants), [participants]);

  return { participants, ranked };
}

/**
 * 내 참가 정보(점수, 충전 상태 등)를 구독한다.
 * loaded 는 서버에서 한 번이라도 응답을 받았는지를 알려 준다.
 * (아직 불러오는 중인 것과 참가자가 아닌 것을 구분하는 데 쓴다.)
 */
export function useMyParticipant(
  roomId: string | null,
  uid: string | null,
): { participant: ParticipantDoc | null; loaded: boolean } {
  const [participant, setParticipant] = useState<ParticipantDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setParticipant(null);
    setLoaded(false);
    if (!roomId || !uid) return;

    return backend.subscribeParticipant(roomId, uid, (value) => {
      setParticipant(value);
      setLoaded(true);
    });
  }, [roomId, uid]);

  return { participant, loaded };
}

/** 내가 이번 문제에 제출한 답안을 구독한다. */
export function useMyAnswer(
  roomId: string | null,
  uid: string | null,
  roundIndex: number,
): AnswerDoc | null {
  const [answer, setAnswer] = useState<AnswerDoc | null>(null);

  useEffect(() => {
    setAnswer(null);
    if (!roomId || !uid || roundIndex < 0) return;
    return backend.subscribeMyAnswer(roomId, uid, roundIndex, setAnswer);
  }, [roomId, uid, roundIndex]);

  return answer;
}

/** 교사 화면 전용: 이번 문제의 제출 현황 */
export function useRoundAnswers(roomId: string | null, roundIndex: number): AnswerDoc[] {
  const [answers, setAnswers] = useState<AnswerDoc[]>([]);

  useEffect(() => {
    setAnswers([]);
    if (!roomId || roundIndex < 0) return;
    return backend.subscribeRoundAnswers(roomId, roundIndex, setAnswers);
  }, [roomId, roundIndex]);

  return answers;
}

/** 정답 공개 후 라운드 통계 */
export function useRoundSummary(
  roomId: string | null,
  roundIndex: number,
): RoundSummaryDoc | null {
  const [summary, setSummary] = useState<RoundSummaryDoc | null>(null);

  useEffect(() => {
    setSummary(null);
    if (!roomId || roundIndex < 0) return;
    return backend.subscribeRoundSummary(roomId, roundIndex, setSummary);
  }, [roomId, roundIndex]);

  return summary;
}
