import { useEffect, useState } from 'react';
import { backend } from '../services/backend';
import { translateStudentAuthError } from '../lib/authErrors';
import type { AppUser } from '../types/game';

export interface AuthState {
  user: AppUser | null;
  loading: boolean;
}

/** 현재 로그인 상태를 구독한다. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsubscribe = backend.onAuthStateChanged((user) => {
      setState({ user, loading: false });
    });
    return unsubscribe;
  }, []);

  return state;
}

/**
 * 학생용 익명 로그인을 보장한다.
 * 새로고침해도 같은 사용자로 이어진다.
 */
export function useStudentAuth(): AuthState & { error: string | null } {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = backend.onAuthStateChanged((user) => {
      if (!active) return;
      if (user && user.isAnonymous) {
        setState({ user, loading: false });
        return;
      }
      // 아직 로그인되지 않았다면 익명 로그인을 시도한다.
      backend
        .studentSignIn()
        .then((signedIn) => {
          if (!active) return;
          setState({ user: signedIn, loading: false });
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(translateStudentAuthError(cause));
          setState({ user: null, loading: false });
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { ...state, error };
}
