import { Link } from 'react-router-dom';
import { BrandMark, Button, Screen } from '../common/UI';

/**
 * 이 브라우저가 교사 계정으로 로그인되어 있을 때 학생 화면에 보여 준다.
 *
 * 예전에는 학생 화면이 교사 세션을 익명 로그인으로 덮어써서
 * 교사가 저절로 로그아웃되었다. 이제는 사용자가 직접 고르게 한다.
 */
export function TeacherSessionNotice({
  onContinueAsStudent,
}: {
  onContinueAsStudent: () => void;
}) {
  return (
    <Screen center>
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <BrandMark />
        </div>

        <div className="panel-strong space-y-5 px-5 py-6">
          <div>
            <h1 className="text-xl font-black text-white">교사 계정으로 로그인되어 있어요</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              이 브라우저는 지금 교사 계정으로 로그인된 상태입니다. 한 브라우저에서 교사와 학생을
              동시에 사용할 수는 없어요.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-bold text-slate-300">학생 화면을 보고 싶다면</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              시크릿 창(새 개인정보 보호 창)에서 열면 교사 로그인을 유지한 채 확인할 수 있어요.
            </p>
          </div>

          <Button block size="lg" variant="secondary" onClick={onContinueAsStudent}>
            교사 로그아웃하고 학생으로 입장
          </Button>

          <Link to="/teacher" className="block">
            <Button block size="lg">
              교사 화면으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </Screen>
  );
}
