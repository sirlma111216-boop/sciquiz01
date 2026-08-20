/**
 * 교사 화면 전용 음악 / 효과음
 * ─────────────────────────────────────────────
 * 음원 파일 없이 Web Audio API 로 그때그때 소리를 만들어 낸다.
 *  - 내려받을 파일이 없어 오프라인에서도 작동한다
 *  - 남의 음원을 쓰지 않으므로 저작권 문제가 없다
 *
 * 소리는 교사 화면(프로젝터)에서만 난다.
 * 학생 휴대전화 20~30대에서 동시에 소리가 나면 수업이 불가능하다.
 */

/** 음이름 → 주파수 (A4 = 440Hz) */
const NOTE: Record<string, number> = {
  D1: 36.71, A1: 55.0,
  D2: 73.42, F2: 87.31, A2: 110.0,
  D3: 146.83, F3: 174.61, G3: 196.0, A3: 220.0, Bb3: 233.08, C4: 261.63,
  D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, Bb4: 466.16,
  C5: 523.25, D5: 587.33, F5: 698.46, A5: 880.0,
};

const STORAGE_KEY = 'srf-sound-on';

type Voice = 'pad' | 'pluck' | 'thud' | 'tick' | 'noise';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  /** 현재 재생 중인 배경 음악을 멈추는 함수 */
  private stopCurrent: (() => void) | null = null;
  private currentTrack: 'lobby' | 'timer' | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      this.enabled = saved === null ? true : saved === '1';
    }
  }

  /* ── 기본 ── */

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    }
    if (!on) this.stopMusic();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * 브라우저는 사용자가 화면을 한 번 누르기 전에는 소리를 내지 못하게 막는다.
   * 교사가 버튼을 누를 때 이 함수를 불러 준비시킨다.
   */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /* ── 소리 한 알 ── */

  /**
   * 한 음을 낸다.
   * @param at   재생 시각 (AudioContext 기준, 초)
   * @param freq 주파수
   * @param dur  길이(초)
   * @param gain 크기 (0~1)
   */
  private note(
    voice: Voice,
    at: number,
    freq: number,
    dur: number,
    gain: number,
    detune = 0,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const amp = ctx.createGain();
    amp.connect(master);

    if (voice === 'noise') {
      // 짧은 잡음: 심벌 비슷한 소리
      const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      src.connect(hp);
      hp.connect(amp);
      amp.gain.setValueAtTime(gain, at);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.start(at);
      src.stop(at + dur);
      return;
    }

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    switch (voice) {
      case 'pad':
        osc.type = 'sawtooth';
        filter.frequency.value = 700;
        filter.Q.value = 0.7;
        break;
      case 'pluck':
        osc.type = 'triangle';
        filter.frequency.setValueAtTime(4000, at);
        filter.frequency.exponentialRampToValueAtTime(600, at + dur);
        break;
      case 'thud':
        osc.type = 'sine';
        filter.frequency.value = 200;
        // 낮게 떨어지며 북 같은 느낌을 낸다
        osc.frequency.setValueAtTime(freq * 2.6, at);
        osc.frequency.exponentialRampToValueAtTime(freq, at + dur * 0.7);
        break;
      case 'tick':
        osc.type = 'square';
        filter.frequency.value = 2600;
        break;
    }

    if (voice !== 'thud') osc.frequency.setValueAtTime(freq, at);
    osc.detune.value = detune;

    // 딸깍 소리가 나지 않도록 부드럽게 켜고 끈다
    const attack = voice === 'pad' ? 0.25 : 0.005;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), at + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(filter);
    filter.connect(amp);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /* ── 배경 음악 ── */

  private stopMusic(): void {
    if (this.stopCurrent) this.stopCurrent();
    this.stopCurrent = null;
    this.currentTrack = null;
  }

  /**
   * 대기실 음악 — 비장하고 묵직한 분위기.
   * D 단조. 낮은 드론 위로 북소리와 짧은 상행 동기가 반복된다.
   */
  startLobby(): void {
    if (!this.enabled) return;
    if (this.currentTrack === 'lobby') return;
    this.stopMusic();

    const ctx = this.ensureContext();
    if (!ctx) return;
    this.unlock();
    this.currentTrack = 'lobby';

    const beat = 60 / 72; // 72 BPM
    const barLength = beat * 4;
    let nextBar = ctx.currentTime + 0.1;
    let bar = 0;

    const scheduleBar = () => {
      const t = nextBar;

      // 낮은 드론 (두 마디마다 새로)
      if (bar % 2 === 0) {
        this.note('pad', t, NOTE.D2, barLength * 2 + 0.5, 0.10);
        this.note('pad', t, NOTE.A2, barLength * 2 + 0.5, 0.05, 4);
      }

      // 화음: Dm → Bb → F → A
      const chords = [
        [NOTE.D3, NOTE.F3, NOTE.A3],
        [NOTE.Bb3, NOTE.D4, NOTE.F4],
        [NOTE.F3, NOTE.A3, NOTE.C4],
        [NOTE.A3, NOTE.C4, NOTE.E4],
      ];
      for (const f of chords[bar % 4]) {
        this.note('pad', t, f, barLength * 0.95, 0.045);
      }

      // 북: 첫 박과 셋째 박
      this.note('thud', t, NOTE.D1, 0.5, 0.5);
      this.note('thud', t + beat * 2, NOTE.D1, 0.4, 0.28);

      // 상행 동기 (네 마디마다)
      if (bar % 4 === 3) {
        this.note('pluck', t + beat * 2, NOTE.A3, 0.4, 0.18);
        this.note('pluck', t + beat * 2.5, NOTE.D4, 0.4, 0.18);
        this.note('pluck', t + beat * 3, NOTE.F4, 0.7, 0.20);
      }

      bar += 1;
      nextBar += barLength;
    };

    // 앞부분을 미리 예약해 두고, 주기적으로 이어서 예약한다
    scheduleBar();
    const timer = window.setInterval(() => {
      if (!this.ctx) return;
      while (nextBar < this.ctx.currentTime + 2) scheduleBar();
    }, 400);

    this.stopCurrent = () => window.clearInterval(timer);
  }

  /**
   * 문제 진행 음악 — 시간이 갈수록 급해진다.
   *
   * @param getProgress 0(시작) ~ 1(종료) 사이의 진행률을 알려 주는 함수
   */
  startTimer(getProgress: () => number): void {
    if (!this.enabled) return;
    if (this.currentTrack === 'timer') return;
    this.stopMusic();

    const ctx = this.ensureContext();
    if (!ctx) return;
    this.unlock();
    this.currentTrack = 'timer';

    // 진행될수록 음이 올라간다
    const ladder = [NOTE.D4, NOTE.E4, NOTE.F4, NOTE.G4, NOTE.A4, NOTE.Bb4, NOTE.D5];
    let nextAt = ctx.currentTime + 0.05;
    let step = 0;

    const scheduleTick = () => {
      const p = Math.min(1, Math.max(0, getProgress()));
      const t = nextAt;

      // 간격: 0.60초 → 0.14초 로 점점 빨라진다
      const interval = 0.6 - 0.46 * p * p;
      const noteIndex = Math.min(ladder.length - 1, Math.floor(p * ladder.length));
      const urgent = p > 0.75;

      this.note('tick', t, ladder[noteIndex], 0.09, urgent ? 0.22 : 0.14);
      // 박마다 낮은 맥박을 함께 낸다
      this.note('thud', t, NOTE.D2, 0.18, 0.12 + 0.22 * p);

      // 마지막 구간에는 긴장을 더한다
      if (urgent && step % 2 === 0) {
        this.note('pad', t, NOTE.A4, interval * 1.6, 0.05);
        this.note('pad', t, NOTE.Bb4, interval * 1.6, 0.035, 8);
      }

      step += 1;
      nextAt += interval;
    };

    scheduleTick();
    const timer = window.setInterval(() => {
      if (!this.ctx) return;
      while (nextAt < this.ctx.currentTime + 0.4) scheduleTick();
    }, 60);

    this.stopCurrent = () => window.clearInterval(timer);
  }

  /** 배경 음악을 멈춘다. */
  stop(): void {
    this.stopMusic();
  }

  /* ── 짧은 효과음 ── */

  /** 시간 종료 직후 정답 공개 직전의 긴장 */
  playSuspense(): void {
    if (!this.enabled) return;
    this.stopMusic();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    this.note('thud', t, NOTE.D1, 0.9, 0.55);
    this.note('pad', t, NOTE.D3, 1.1, 0.08);
    this.note('pad', t, NOTE.G3, 1.1, 0.06, 6);
  }

  /** 정답 공개 */
  playReveal(): void {
    if (!this.enabled) return;
    this.stopMusic();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    this.note('noise', t, 0, 0.5, 0.16);
    this.note('pluck', t, NOTE.D4, 0.8, 0.20);
    this.note('pluck', t + 0.06, NOTE.A4, 0.8, 0.18);
    this.note('pluck', t + 0.12, NOTE.D5, 1.0, 0.16);
    this.note('thud', t, NOTE.D2, 0.5, 0.4);
  }

  /** 게임 종료 팡파르 */
  playFinish(): void {
    if (!this.enabled) return;
    this.stopMusic();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const melody = [NOTE.D4, NOTE.F4, NOTE.A4, NOTE.D5];
    melody.forEach((f, i) => {
      this.note('pluck', t + i * 0.16, f, 0.9, 0.20);
    });
    this.note('pad', t, NOTE.D3, 2.2, 0.07);
    this.note('pad', t, NOTE.A3, 2.2, 0.05, 5);
    this.note('thud', t, NOTE.D2, 0.8, 0.45);
    this.note('noise', t + 0.48, 0, 0.8, 0.12);
  }
}

export const audio = new AudioEngine();
