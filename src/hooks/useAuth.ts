import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface StudentAuthState extends AuthState {
  error: string | null;
  /**
   * 이 브라우저가 교사 계정으로 로그인되어 있는 상태.
   * 이때는 학생용 익명 로그인을 자동으로 하지 않는다.
   */
  teacherSignedIn: boolean;
  /** 교사 로그인을 끝내고 학생으로 입장한다. (사용자가 직접 선택할 때만) */
  continueAsStudent: () => Promise<void>;
}

/**
 * 학생용 익명 로그인을 보장한다. 새로고침해도 같은 사용자로 이어진다.
 *
 * 중요: 교사 계정으로 로그인되어 있으면 절대로 익명 로그인을 하지 않는다.
 * Firebase 로그인 상태는 같은 브라우저의 모든 탭이 공유하기 때문에,
 * 예전에는 학생 화면이 열려 있기만 해도 교사 세션을 익명 로그인으로
 * 덮어써서 교사가 곧바로 로그아웃되는 문제가 있었다.
 */
export function useStudentAuth(): StudentAuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const [error, setError] = useState<string | null>(null);
  const [teacherSignedIn, setTeacherSignedIn] = useState(false);
  const signingInRef = useRef(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = backend.onAuthStateChanged((user) => {
      if (!active) return;

      // 학생(익명)으로 이미 들어와 있다.
      if (user && user.isAnonymous) {
        setTeacherSignedIn(false);
        setState({ user, loading: false });
        return;
      }

      // 교사 계정이 로그인되어 있다. 멋대로 로그아웃시키지 않는다.
      if (user && !user.isAnonymous) {
        setTeacherSignedIn(true);
        setState({ user: null, loading: false });
        return;
      }

      // 로그인된 사용자가 아무도 없을 때만 익명 로그인을 시도한다.
      if (signingInRef.current) return;
      signingInRef.current = true;

      backend
        .studentSignIn()
        .then((signedIn) => {
          if (!active) return;
          setTeacherSignedIn(false);
          setError(null);
          setState({ user: signedIn, loading: false });
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(translateStudentAuthError(cause));
          setState({ user: null, loading: false });
        })
        .finally(() => {
          signingInRef.current = false;
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /**
   * 교사 로그인을 끝내고 학생으로 들어간다.
   * 로그아웃하면 위 리스너가 이어서 익명 로그인을 처리한다.
   */
  const continueAsStudent = useCallback(async () => {
    setError(null);
    setState({ user: null, loading: true });
    try {
      await backend.signOut();
    } catch (cause: unknown) {
      setError(translateStudentAuthError(cause));
      setState({ user: null, loading: false });
    }
  }, []);

  return { ...state, error, teacherSignedIn, continueAsStudent };
}
