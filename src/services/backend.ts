import { isFirebaseConfigured } from './firebase';
import { firebaseBackend } from './firebaseBackend';
import { mockBackend } from './mockBackend';
import type { Backend } from './backendTypes';

/**
 * .env 에 Firebase 설정이 있으면 실제 Firebase 를,
 * 없으면 화면 확인용 연습 모드를 사용한다.
 */
export const backend: Backend = isFirebaseConfigured ? firebaseBackend : mockBackend;

export const isMockMode = backend.mode === 'mock';

export type { Backend } from './backendTypes';
