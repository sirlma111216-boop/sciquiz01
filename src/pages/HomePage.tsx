import { Link } from 'react-router-dom';
import { BrandMark, Button, MockModeBanner, Screen } from '../components/common/UI';
import { isMockMode } from '../services/backend';

const STEPS = [
  {
    title: '교사 화면에 문제가 나옵니다',
    body: '문제 문장은 교실 앞 화면에만 나타납니다. 휴대전화에는 보이지 않아요.',
  },
  {
    title: '진짜인지 가짜인지 고릅니다',
    body: '문장을 읽고 과학적으로 판단해 진짜 또는 가짜를 선택합니다.',
  },
  {
    title: '얼마나 확신하는지 정합니다',
    body: '50P부터 200P까지, 자신 있는 만큼 확신 포인트를 겁니다.',
  },
  {
    title: '맞히면 올라가고 틀리면 내려갑니다',
    body: '내가 무엇을 알고 무엇을 모르는지 판단하는 것이 이 게임의 핵심입니다.',
  },
];

export function HomePage() {
  return (
    <Screen>
      {isMockMode && <MockModeBanner />}

      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-8">
        <div className="animate-fade-up">
          <BrandMark size="lg" />
          <p className="mt-4 text-center text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            확신 포인트 챌린지
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <div key={step.title} className="panel px-5 py-4">
              <p className="text-xs font-black uppercase tracking-widest text-beam-400">
                STEP {index + 1}
              </p>
              <p className="mt-1.5 text-base font-bold text-white">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="flex w-full max-w-md flex-col gap-3">
          <Link to="/play">
            <Button size="xl" block>
              학생 입장하기
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/teacher">
              <Button variant="secondary" size="lg" block>
                교사용 화면
              </Button>
            </Link>
            <Link to="/ranking">
              <Button variant="secondary" size="lg" block>
                명예의 전당
              </Button>
            </Link>
          </div>
        </div>

        <p className="max-w-md text-center text-xs leading-relaxed text-slate-500">
          닉네임만으로 참여합니다. 실명·이메일·전화번호 같은 개인정보는 저장하지 않습니다.
        </p>
      </div>
    </Screen>
  );
}
