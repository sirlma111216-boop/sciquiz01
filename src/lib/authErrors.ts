/**
 * Firebase 오류 코드를 교사와 학생이 이해할 수 있는 문장으로 바꾼다.
 * 무엇을 해야 하는지까지 알려 주는 것을 목표로 한다.
 */

function codeOf(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause) {
    return String((cause as { code: unknown }).code);
  }
  return '';
}

/** 교사 로그인 화면용 */
export function translateAuthError(cause: unknown): string {
  switch (codeOf(cause)) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해 주세요.';
    case 'auth/configuration-not-found':
      return (
        'Firebase 콘솔에서 Authentication 이 아직 준비되지 않았습니다. ' +
        'Firebase 콘솔 > 빌드 > Authentication > 시작하기 를 누른 뒤, ' +
        'Sign-in method 탭에서 "이메일/비밀번호"를 사용 설정해 주세요.'
      );
    case 'auth/operation-not-allowed':
      return (
        'Firebase 콘솔 > Authentication > Sign-in method 에서 ' +
        '"이메일/비밀번호" 로그인을 사용 설정해 주세요.'
      );
    default:
      return cause instanceof Error ? cause.message : '로그인에 실패했습니다.';
  }
}

/** 학생 입장 화면용 (익명 로그인) */
export function translateStudentAuthError(cause: unknown): string {
  switch (codeOf(cause)) {
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
    // 익명 로그인이 꺼져 있을 때 Firebase 가 돌려주는 코드
    case 'auth/admin-restricted-operation':
      return (
        '아직 게임 준비가 끝나지 않았어요. 선생님께 알려 주세요. ' +
        '(Firebase 콘솔 > Authentication > Sign-in method 에서 "익명"을 사용 설정해야 합니다.)'
      );
    case 'auth/network-request-failed':
      return '인터넷 연결을 확인해 주세요.';
    case 'auth/too-many-requests':
      return '접속 시도가 너무 많아요. 잠시 뒤에 다시 해 주세요.';
    default:
      return '접속에 실패했어요. 새로고침 후 다시 시도해 주세요.';
  }
}

/** Firestore 오류 (권한 / 데이터베이스 미생성 등) */
export function translateFirestoreError(cause: unknown): string {
  switch (codeOf(cause)) {
    case 'permission-denied':
      return (
        'Firestore 보안 규칙에 막혔습니다. README 4번을 따라 firestore.rules 내용을 ' +
        'Firebase 콘솔 > Firestore Database > 규칙 에 붙여 넣고 게시해 주세요.'
      );
    case 'unavailable':
      return '네트워크 연결을 확인해 주세요.';
    case 'failed-precondition':
      return (
        'Firestore 색인이 필요합니다. 브라우저 개발자 도구 콘솔에 나오는 ' +
        '"Create index" 링크를 한 번 눌러 주세요.'
      );
    case 'not-found':
      return (
        'Firestore 데이터베이스가 아직 없습니다. ' +
        'Firebase 콘솔 > 빌드 > Firestore Database > 데이터베이스 만들기 를 먼저 해 주세요.'
      );
    default:
      return cause instanceof Error ? cause.message : '데이터를 불러오지 못했습니다.';
  }
}
