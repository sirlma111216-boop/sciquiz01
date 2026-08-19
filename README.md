# 과학 진짜? 가짜? — 확신 포인트 챌린지

중학교 1학년 첫 과학 수업에서 쓰는 **실시간 참여형 과학 판단 게임**입니다.

교사는 노트북(프로젝터)으로, 학생은 자기 스마트폰으로 참여합니다.
Kahoot처럼 **교사 화면과 학생 화면이 완전히 분리**되어 있어서,
문제 문장은 오직 교사 화면에만 나타납니다.

## 이 게임의 핵심

단순한 OX 퀴즈가 아닙니다.

1. 교사 화면에 과학 문장이 나타납니다. (예: `금성에서는 하루가 1년보다 길다.`)
2. 학생은 스마트폰에서 **진짜 / 가짜**를 고릅니다.
3. 이어서 자기 판단에 얼마나 확신하는지 **확신 포인트(50P·100P·150P·200P)** 를 고릅니다.
4. 맞히면 그만큼 오르고, 틀리면 그만큼 내려갑니다.

즉 **"내가 무엇을 알고 무엇을 잘 모르는지 판단하는 능력(메타인지)"** 이 점수에 직접 반영됩니다.
아는 문제에 200P를 걸고, 헷갈리는 문제에 50P만 거는 판단이 이 게임의 교육적 핵심입니다.

---

## 1. 빠르게 실행해 보기 (Firebase 없이)

Firebase 설정이 없어도 **연습 모드**로 화면과 게임 흐름을 확인할 수 있습니다.

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 을 엽니다.

연습 모드에서는 데이터가 브라우저 안에만 저장됩니다.
테스트하는 방법:

1. 탭 1에서 `/teacher` → 아무 이메일 + 4자 이상 비밀번호로 로그인 → 게임방 만들기
2. 탭 2(새 탭)에서 `/play` → 게임 코드 + 닉네임 입력
3. 탭 3, 탭 4를 더 열면 학생을 여러 명 만들 수 있습니다. (탭마다 다른 학생이 됩니다)

> 실제 수업에서는 반드시 아래 순서대로 Firebase를 연결해 주세요.
> 연습 모드는 다른 기기와 연결되지 않습니다.

---

## 2. Firebase 프로젝트 만들기

### 2-1. 프로젝트 생성

1. [Firebase 콘솔](https://console.firebase.google.com/) 접속
2. **프로젝트 추가** 클릭
3. 프로젝트 이름 입력 (예: `science-quiz`)
4. Google 애널리틱스는 **사용 안 함**으로 두어도 됩니다.

### 2-2. 웹 앱 등록

1. 프로젝트 개요 화면에서 **웹(`</>`) 아이콘** 클릭
2. 앱 닉네임 입력 후 **앱 등록**
3. 화면에 나오는 `firebaseConfig` 값을 복사해 둡니다.

```js
const firebaseConfig = {
  apiKey: "AIza........",
  authDomain: "science-quiz.firebaseapp.com",
  projectId: "science-quiz",
  storageBucket: "science-quiz.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 2-3. Authentication 설정

좌측 메뉴 **빌드 → Authentication → 시작하기**

**Sign-in method** 탭에서 두 가지를 모두 켭니다.

| 항목 | 용도 | 설정 |
|---|---|---|
| **익명** | 학생 (회원가입 없이 입장) | 사용 설정 → 저장 |
| **이메일/비밀번호** | 교사 로그인 | 사용 설정 → 저장 |

> 두 가지를 모두 켜야 합니다.
> 보안 규칙이 이 로그인 방식으로 교사와 학생을 구분합니다.

### 2-4. Firestore 만들기

1. 좌측 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기**
2. 위치는 `asia-northeast3 (서울)` 을 권장합니다.
3. **프로덕션 모드로 시작**을 선택합니다. (규칙은 아래에서 적용합니다)

### 2-5. 교사 계정 만들기

**Authentication → Users → 사용자 추가**

- 이메일: 교사가 쓸 주소 (예: `teacher@school.kr`)
- 비밀번호: 6자 이상

이 계정으로 `/teacher/login` 에서 로그인합니다.
학생은 계정을 만들 필요가 없습니다.

---

## 3. `.env` 설정

프로젝트 루트의 `.env.example` 을 복사해 `.env` 파일을 만듭니다.

```bash
cp .env.example .env
```

Windows PowerShell에서는:

```bash
Copy-Item .env.example .env
```

`.env` 를 열어 2-2에서 복사한 값을 채웁니다.

```env
VITE_FIREBASE_API_KEY=AIza........
VITE_FIREBASE_AUTH_DOMAIN=science-quiz.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=science-quiz
VITE_FIREBASE_STORAGE_BUCKET=science-quiz.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# 학생 접속 주소를 직접 정하고 싶을 때만 입력 (비우면 현재 주소를 자동 사용)
VITE_PLAY_URL=https://g1-quiz.labbitory.com
```

저장한 뒤 개발 서버를 다시 시작하면 연습 모드 안내가 사라집니다.

> `.env` 는 `.gitignore` 에 들어 있어 Git에 올라가지 않습니다.

---

## 4. 보안 규칙 적용

`firestore.rules` 파일에 규칙이 준비되어 있습니다.

### 방법 A — 콘솔에 붙여 넣기 (가장 간단)

1. Firebase 콘솔 → **Firestore Database → 규칙** 탭
2. `firestore.rules` 파일 내용을 **전부 복사해서 붙여 넣기**
3. **게시** 클릭

### 방법 B — Firebase CLI 사용

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

(처음이라면 `firebase use --add` 로 프로젝트를 연결하세요.)

### 이 규칙이 막아 주는 것

- 학생은 **자기 답안만** 만들 수 있습니다.
- 한 번 낸 답안은 **학생이 고치거나 지울 수 없습니다.**
- 같은 문제에 **두 번 제출할 수 없습니다.** (문서 이름이 `r{문제번호}__{학생uid}` 로 고정)
- **제한 시간이 지난 답안은 서버가 거부합니다.** (기기 시계를 조작해도 소용없음)
- 학생은 **점수를 직접 바꿀 수 없습니다.** 점수 계산과 기록은 교사 계정만 가능합니다.
- 학생은 **게임 진행 단계(phase)를 바꿀 수 없습니다.**
- 학생은 **명예의 전당 기록을 만들거나 고칠 수 없습니다.**
- **문제 목록은 교사만 읽을 수 있는 곳**(`rooms/{id}/private/plan`)에 저장됩니다.

### 색인(index) 만들기

학급별 기록 조회에는 복합 색인이 하나 필요합니다.
CLI로 배포했다면 자동으로 만들어집니다.

콘솔에 규칙만 붙여 넣었다면, `/ranking` 의 **학급 역대** 탭을 처음 열 때
브라우저 개발자 도구 콘솔에 나오는 **"Create index" 링크를 한 번 클릭**하면 됩니다.
또는 Firestore → 색인 → 복합 색인 추가에서 직접 만듭니다.

| 컬렉션 | 필드 1 | 필드 2 |
|---|---|---|
| `leaderboards` | `className` (오름차순) | `score` (내림차순) |

---

## 5. 실제 수업에서 쓰는 순서

1. 교사가 노트북에서 `/teacher/login` 으로 로그인합니다.
2. **학급 이름 · 문제 수(10/15/20/25) · 제한 시간(10/15/20/30초)** 을 정하고 게임방을 만듭니다.
3. 프로젝터에 **게임 코드**와 **학생 접속 주소 · QR 코드**가 크게 표시됩니다.
4. 학생이 스마트폰에서 `/play` 로 들어와 **게임 코드 + 닉네임**을 입력합니다.
   - 실명은 필요 없습니다. 같은 방에서 닉네임이 겹치면 다시 정하라고 안내합니다.
5. 참가 인원을 확인하고 **게임 시작**을 누릅니다.
6. 교사 화면에만 문제 문장이 크게 나타납니다. **선생님이 문장을 읽어 주세요.**
7. 학생은 진짜/가짜 → 확신 포인트 → **선택 완료** 순서로 제출합니다.
8. 시간이 끝나면 자동으로 마감되고 정답과 해설이 공개됩니다.
   (모두 제출하면 시간이 남아도 바로 넘어갑니다.)
9. 학생 화면에는 자기 결과(+150P 등)와 현재 순위만 보입니다. **해설은 교사 화면으로 함께 봅니다.**
10. 교사가 **다음 문제** 버튼을 눌러야 다음 문제로 넘어갑니다. 설명할 시간을 충분히 쓰세요.
11. 마지막 문제가 끝나면 TOP 3와 최종 순위가 나오고, 기록이 자동 저장됩니다.

### 과학 에너지 충전 규칙

점수가 **50P 미만**이 되면 다음 한 문제를 쉽니다.

- 학생 화면: `과학 에너지 충전 중! 이번 문제는 잠시 쉬어갑니다.`
- 그 문제가 끝나면 **현재 점수에 +50P** 를 더합니다. (50P로 맞추는 것이 아닙니다)
  - `30P → 한 문제 휴식 → 80P`
  - `0P → 한 문제 휴식 → 50P`
- 그다음 문제부터 다시 참여합니다.

### 새로고침해도 괜찮습니다

- **학생**: 익명 로그인 UID와 브라우저에 저장된 게임방 정보로 자동 복귀합니다.
- **교사**: 게임방 주소(`/teacher/room/...`)가 그대로라 새로고침하면 현재 단계로 돌아옵니다.

---

## 6. 문제 추가하고 고치기

문제는 **`src/data/questions.ts`** 파일 하나에 모여 있습니다.
기본으로 **125문제**가 들어 있습니다.

파일 맨 아래 `];` 바로 위에 이렇게 붙여 넣으면 됩니다.

```ts
{
  id: 'q126',
  category: '우주',
  difficulty: 4,
  statement: '금성에서는 하루가 1년보다 길다.',
  answer: true,
  explanation:
    '금성의 자전 주기는 약 243일이고 공전 주기는 약 225일이다. 따라서 한 번 자전하는 데 걸리는 시간이 태양을 한 바퀴 도는 시간보다 길다.',
},
```

| 항목 | 설명 |
|---|---|
| `id` | 겹치지 않는 값이면 무엇이든 됩니다. |
| `category` | `물리` `화학` `생명과학` `지구과학` `우주` `생활과학` 중 하나 |
| `difficulty` | `1`~`5` (별 개수). 너무 쉬운 `1`은 게임에 거의 뽑히지 않습니다. |
| `statement` | 학생이 판단할 문장 |
| `answer` | `true` = 진짜, `false` = 가짜 |
| `explanation` | 2~4문장. 중1이 이해할 수 있게 |

저장하면 개발 서버가 자동으로 새로고침됩니다.

### 문제가 뽑히는 방식

게임을 시작할 때마다 자동으로 골고루 뽑습니다.

- 난이도 비율 **★★ 20% / ★★★ 40% / ★★★★ 30% / ★★★★★ 10%**
- 진짜 / 가짜 개수를 **최대한 반반**으로
- 같은 정답이 **3번 이상 연속되지 않게**
- 난이도가 초반이나 후반에 몰리지 않게

---

## 7. 빌드와 배포

### 빌드

```bash
npm run build
```

`dist/` 폴더가 만들어집니다. 미리보기는:

```bash
npm run preview
```

### 배포 — Firebase Hosting

```bash
firebase deploy --only hosting
```

`firebase.json` 에 SPA 라우팅(rewrites) 설정이 이미 들어 있습니다.

### 배포 — Cloudflare Pages

**1) 프로젝트 연결**

Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git** → 이 GitHub 저장소 선택

**2) 빌드 설정**

| 항목 | 값 |
|---|---|
| Framework preset | `Vite` (없으면 `None`) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (비워 둠) |

**3) 환경 변수 등록** — 가장 많이 빠뜨리는 부분입니다

같은 화면의 **Environment variables**에 `.env` 에 있는 값을 그대로 넣습니다.
이 값이 없으면 배포된 사이트가 계속 연습 모드로 뜹니다.

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

**4) 배포 후 — Firebase에 도메인 등록** (이걸 안 하면 로그인이 안 됩니다)

배포가 끝나면 `프로젝트이름.pages.dev` 주소가 나옵니다.
Firebase 콘솔 → **Authentication → Settings → 승인된 도메인** →
**도메인 추가**에 그 주소를 넣습니다. (`https://` 없이 도메인만)

등록하지 않으면 학생 입장과 교사 로그인이 모두 `auth/unauthorized-domain` 으로 막힙니다.

**5) 확인**

배포 주소로 들어가 상단에 노란 "연습 모드" 안내가 **없으면** 정상입니다.
안내가 보이면 3번 환경 변수를 다시 확인하세요.

> SPA 라우팅(`/play`, `/teacher` 같은 주소 직접 접속)은 `public/_redirects` 가 처리하므로
> 따로 설정할 것이 없습니다.
> Node 버전은 `.nvmrc` 에 `20` 으로 지정되어 있습니다.

### 배포 — Netlify

- `netlify.toml` 이 이미 준비되어 있습니다.
- 환경 변수에 `VITE_FIREBASE_*` 값을 등록합니다.

> **중요**: `VITE_` 로 시작하는 값은 브라우저에 그대로 노출됩니다.
> Firebase 웹 API 키는 원래 공개되는 값이라 문제없습니다.
> 실제 보안은 **Firestore 보안 규칙**이 담당합니다. (4번 항목을 꼭 적용하세요)

---

## 8. 화면 구성

| 주소 | 화면 |
|---|---|
| `/` | 게임 소개 |
| `/teacher/login` | 교사 로그인 |
| `/teacher` | 교사용 홈 (게임방 만들기) |
| `/teacher/room/:roomId` | 교사용 대기실 및 게임 진행 |
| `/play` | 학생 입장 (게임 코드 + 닉네임) |
| `/play/:roomId` | 학생 게임 화면 |
| `/ranking` | 명예의 전당 |

---

## 9. 폴더 구조

```
src/
 ├─ components/
 │   ├─ common/      UI 공통 요소 (버튼, 입력, 화면 틀)
 │   ├─ game/        교사·학생이 함께 쓰는 요소 (타이머)
 │   ├─ teacher/     교사 화면 전용
 │   └─ student/     학생 화면 전용
 │
 ├─ pages/           주소별 화면
 ├─ hooks/           실시간 구독 / 타이머 / 로그인
 ├─ services/
 │   ├─ firebase.ts        Firebase 초기화
 │   ├─ backendTypes.ts    데이터 작업 계약(인터페이스)
 │   ├─ firebaseBackend.ts 실제 Firebase 구현
 │   ├─ mockBackend.ts     연습 모드 구현
 │   ├─ backend.ts         둘 중 하나를 고름
 │   └─ questionBank.ts    문제 은행 동적 로딩 (교사 전용)
 │
 ├─ lib/
 │   ├─ scoring.ts         점수 계산 규칙 (순수 함수)
 │   ├─ questionSelector.ts 문제 뽑기 / 순서 정하기
 │   ├─ session.ts         새로고침 복구용 저장
 │   └─ utils.ts           숫자 표시, 순위 계산 등
 │
 ├─ data/questions.ts  문제 은행 (여기만 고치면 됩니다)
 └─ types/game.ts      타입 정의
```

---

## 10. 자주 묻는 질문

**Q. 학생이 개발자 도구로 정답을 미리 볼 수 있나요?**
어렵게 만들어 두었습니다.

- 문제 문장·정답·해설은 **교사 화면에서만 동적으로 불러오는 별도 파일**로 분리됩니다.
  학생 화면 번들에는 들어가지 않습니다.
- 학생이 구독하는 Firestore 데이터에는 문제 문장도, 정답도 없습니다.
  방 문서에는 문제 **번호**만 있고, 어떤 문제인지는 교사만 읽을 수 있는 곳에 있습니다.
- 정답 정보는 시간이 끝나 채점이 끝난 뒤에야 학생 쪽에 나타납니다.

**Q. 점수가 두 번 계산되지 않나요?**
라운드 문서에 `scored: true` 표시를 두고, 이 확인과 점수 반영을 **하나의 Firestore 트랜잭션**에서 처리합니다.
교사가 새로고침하거나 버튼을 여러 번 눌러도 한 번만 반영됩니다.

**Q. 학생이 확신 포인트를 조작하면요?**
확신 포인트는 `50/100/150/200` 중 하나만 서버가 받아들이고,
채점할 때 **보유 점수보다 큰 값은 자동으로 낮춰서** 계산합니다.

**Q. 학생 20~30명이 동시에 눌러도 괜찮나요?**
학생은 각자 자기 답안 문서 하나만 만들고, 점수 계산은 교사 쪽에서 트랜잭션으로 한 번에 처리합니다.
같은 문서에 여러 명이 몰려 쓰는 구조가 아니라서 충돌이 생기지 않습니다.

**Q. 효과음은 없나요?**
초기 버전에서는 넣지 않았습니다. 나중에 쉽게 추가할 수 있도록 화면 전환 지점을 나눠 두었습니다.

**Q. 학생 개인정보가 저장되나요?**
저장하지 않습니다. 남는 것은 **닉네임 · 학급명 · 점수 · 날짜**뿐입니다.
실명, 이메일, 전화번호는 어디에도 저장되지 않습니다.

---

## 11. 기술 스택

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Firebase 10 (Authentication + Cloud Firestore)

별도의 서버가 필요 없습니다. 정적 호스팅 + Firebase만으로 작동합니다.
