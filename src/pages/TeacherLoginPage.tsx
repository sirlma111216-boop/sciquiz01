import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  BrandMark,
  Button,
  Field,
  LoadingScreen,
  MockModeBanner,
  Notice,
  Screen,
  inputClass,
} from '../components/common/UI';
import { backend, isMockMode } from '../services/backend';
import { translateAuthError } from '../lib/authErrors';
import { useAuth } from '../hooks/useAuth';

export function TeacherLoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingScreen message="확인하는 중..." />;
  if (user && !user.isAnonymous) return <Navigate to="/teacher" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await backend.teacherSignIn(email.trim(), password);
      navigate('/teacher', { replace: true });
    } catch (cause: unknown) {
      setError(translateAuthError(cause));
      setSubmitting(false);
    }
  };

  return (
    <Screen center>
      <div className="w-full max-w-md">
        {isMockMode && <MockModeBanner />}

        <div className="mb-8">
          <BrandMark />
        </div>

        <form onSubmit={handleSubmit} className="panel-strong space-y-5 px-6 py-7">
          <div>
            <h1 className="text-2xl font-black text-white">교사 로그인</h1>
            <p className="mt-1 text-sm text-slate-400">
              {isMockMode
                ? '연습 모드입니다. 아무 이메일과 4자 이상의 비밀번호로 들어올 수 있어요.'
                : 'Firebase 콘솔에서 만든 교사 계정으로 로그인하세요.'}
            </p>
          </div>

          <Field label="이메일" htmlFor="teacher-email">
            <input
              id="teacher-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="teacher@school.kr"
            />
          </Field>

          <Field label="비밀번호" htmlFor="teacher-password">
            <input
              id="teacher-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>

          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" size="lg" block disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </Button>

          <Link
            to="/"
            className="block text-center text-sm font-semibold text-slate-400 hover:text-slate-200"
          >
            처음 화면으로
          </Link>
        </form>
      </div>
    </Screen>
  );
}

