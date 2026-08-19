import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/utils';

/* ────────────────── 버튼 ────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-beam-500 text-ink-900 font-bold hover:bg-beam-400 active:bg-beam-600 disabled:bg-slate-700 disabled:text-slate-400',
  secondary:
    'bg-white/10 text-slate-100 font-semibold hover:bg-white/15 active:bg-white/20 border border-white/15 disabled:text-slate-500',
  ghost:
    'bg-transparent text-slate-300 font-semibold hover:bg-white/10 active:bg-white/15 disabled:text-slate-600',
  danger:
    'bg-fake-500 text-white font-bold hover:bg-fake-400 active:bg-fake-600 disabled:bg-slate-700 disabled:text-slate-400',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  // 작은 스마트폰에서도 누르기 쉽도록 최소 높이를 충분히 확보한다.
  md: 'min-h-[46px] px-4 text-base rounded-xl',
  lg: 'min-h-[56px] px-6 text-lg rounded-2xl',
  xl: 'min-h-[68px] px-8 text-xl rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 transition-colors duration-150',
        'disabled:cursor-not-allowed',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && 'w-full',
        className,
      )}
    />
  );
}

/* ────────────────── 입력 ────────────────── */

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, error, children, htmlFor }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-300">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-fake-400">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full min-h-[52px] rounded-xl border border-white/15 bg-ink-800/70 px-4 text-base ' +
  'text-slate-100 placeholder:text-slate-500 focus:border-beam-400 focus:outline-none';

/* ────────────────── 선택 버튼 묶음 ────────────────── */

interface OptionGroupProps<T extends number | string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  renderOption?: (value: T) => ReactNode;
}

export function OptionGroup<T extends number | string>({
  label,
  options,
  value,
  onChange,
  renderOption,
}: OptionGroupProps<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 block text-sm font-semibold text-slate-300">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={String(option)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={cx(
                'min-h-[52px] rounded-xl border-2 px-3 text-base font-bold transition-colors',
                selected
                  ? 'border-beam-400 bg-beam-500/20 text-beam-400'
                  : 'border-white/15 bg-ink-800/70 text-slate-300 hover:border-white/30',
              )}
            >
              {selected && <span aria-hidden="true">✓ </span>}
              {renderOption ? renderOption(option) : String(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ────────────────── 안내 상자 ────────────────── */

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
}) {
  const toneClass = {
    info: 'border-beam-500/40 bg-beam-500/10 text-beam-400',
    warn: 'border-spark-400/40 bg-spark-400/10 text-spark-400',
    error: 'border-fake-500/40 bg-fake-500/10 text-fake-400',
  }[tone];

  return (
    <div className={cx('rounded-2xl border px-4 py-3 text-sm font-medium', toneClass)}>
      {children}
    </div>
  );
}

/* ────────────────── 로고 ────────────────── */

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const titleClass = {
    sm: 'text-xl',
    md: 'text-3xl sm:text-4xl',
    lg: 'text-4xl sm:text-6xl',
  }[size];

  const subClass = {
    sm: 'text-[11px]',
    md: 'text-sm',
    lg: 'text-base sm:text-xl',
  }[size];

  return (
    <div className="text-center">
      <p className={cx('font-semibold uppercase tracking-[0.35em] text-beam-400', subClass)}>
        SCIENCE CHALLENGE
      </p>
      <h1 className={cx('mt-1 font-black tracking-tight text-white', titleClass)}>
        과학 <span className="text-real-400">진짜?</span>{' '}
        <span className="text-fake-400">가짜?</span>
      </h1>
      <p className={cx('mt-1 font-semibold text-slate-300', subClass)}>얼마나 확신하나요?</p>
    </div>
  );
}

/* ────────────────── 화면 틀 ────────────────── */

export function Screen({
  children,
  className,
  center = false,
}: {
  children: ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <main
      className={cx(
        'mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-6 sm:px-6',
        center && 'items-center justify-center',
        className,
      )}
    >
      {children}
    </main>
  );
}

export function LoadingScreen({ message = '불러오는 중...' }: { message?: string }) {
  return (
    <Screen center>
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-beam-400"
          role="status"
          aria-label={message}
        />
        <p className="text-sm font-medium text-slate-400">{message}</p>
      </div>
    </Screen>
  );
}

/* ────────────────── 연습 모드 알림 ────────────────── */

export function MockModeBanner() {
  return (
    <div className="mb-4 rounded-2xl border border-spark-400/40 bg-spark-400/10 px-4 py-3">
      <p className="text-sm font-bold text-spark-400">연습 모드로 실행 중입니다</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">
        Firebase 설정(.env)이 없어 <strong className="text-spark-400">이 브라우저 안에서만</strong>{' '}
        게임이 작동합니다. 교사 화면과 학생 화면을 <strong>같은 브라우저에서 같은 주소로</strong>{' '}
        (예: 둘 다 <code className="text-slate-200">localhost:5173</code>) 다른 탭에 열어야 서로
        연결됩니다.
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        휴대전화나 다른 컴퓨터에서 참여하려면 README를 따라 Firebase를 연결해야 합니다.
      </p>
    </div>
  );
}
