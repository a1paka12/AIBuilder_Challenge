# 보증금 지킴이

퇴실 공제 문자를 받은 자취 대학생이 개인정보를 기기에서 먼저 가린 뒤 AI로 공제 항목·금액·원문 인용을 표로 정리하고, 물어볼 항목을 직접 골라 근거를 묻는 문자를 만드는 웹 서비스.

KOOKMIN AI BUILDER CHALLENGE 2026 (주제 "귀찮음 주식회사") 출품작 · 팀 MOTGA

| 항목 | 주소 |
|---|---|
| 배포 | https://bojeung.193-123-163-215.sslip.io |
| 발표자료 | https://bojeung.193-123-163-215.sslip.io/slides/ |
| 저장소 | https://github.com/a1paka12/AIBuilder_Challenge |
| PRD | [docs/PRD.md](docs/PRD.md) |

> 보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다. AI는 공제 내역을 정리만 하고, 공제가 맞는지·특약이 유효한지·얼마를 돌려받을지는 판단하지 않습니다.

## 주요 기능

| FR | 구분 | 기능 | 화면 | 요약 |
|---|---|---|---|---|
| FR-01 | 필수 | 기기 내 개인정보 제거·전송 | `#/deduct`, `#/record` | 텍스트는 브라우저에서 전화번호·계좌·주민등록번호·이메일 패턴과 직접 추가한 단어(이름 / 주소 / 기타)를 "[전화번호 삭제]" 형식으로 바꾸고, "위 전송본을 확인했어요"를 체크해 실제 전송본을 확인한 뒤에만 보냄. 사진(JPEG·PNG)은 불투명 상자로 가리고 Canvas로 다시 인코딩해 메타데이터를 지운 뒤, 처리본의 지문(SHA-256)만 서버에 기록 |
| FR-02 | 필수 | AI 공제 정리·문의 준비 | `#/deduct` | OpenAI 구조화 출력으로 항목명·청구액·원문 인용만 추출. 사용자가 원문과 대조·확인하고 물어볼 항목을 고르면 "내가 근거를 물어볼 금액" 합계, 참고 자료 5종, 고정 서식 문의 문자(복사) 표시 |
| FR-03 | 필수 | 변호사 조건 추천 | `#/lawyer` | 상담 주제·방식·지역·예산·시점·언어를 "꼭 필요 / 선호 / 상관없음"으로 고르면 브라우저 안에서 조건 일치 점수를 계산해 최대 3명과 추천 이유 표시(데모용 가상 변호사 A~H 8명). 0명이면 안내와 [조건 수정] |
| FR-04 | 선택 | 방 상태 기록북·상품 체험 | `#/record` | 가린 사진 2장 무료 체험, 구역·입주/퇴실·날짜·메모, 나란히 보기, 기록북 미리보기·인쇄/PDF 저장. 기록북 4,900원은 가격 가설(결제 미연결) |
| FR-05 | 선택 | 내용증명 빈칸 서식 | `#/cert` | 고정 문단 서식(AI 작성 아님), 브라우저에서 PDF 저장, 2,900원 가격 가설·결제 미연결, 발송은 사용자가 직접 |
| FR-06 | 선택 | 30초 현장 설문·구매 의향 | `#/`, `#/event`, `#/pricing` | 선택지만 받는 설문, 구매 의향 기록(결제 아님), 익명 집계 |
| FR-07 | 선택 | 출시 이벤트 팝업·이벤트 상세 | `#/`, `#/event` | 첫 화면 레이어 팝업 2칸, 설문 응답 시 이 기기에서 기록북 범위(사진 30장)까지 체험 |
| FR-08 | 선택 | 무료 상담 기관 안내 | `#/help` | 무료 상담 기관 5곳과 확인일 |
| FR-09 | 선택 | 개인정보 처리방침 | `#/privacy` | 처리 표시(라벨링) 6칸, 목차, 제1~14조, 국외 이전(OpenAI 미국·Oracle 일본) 고지 |
| FR-10 | 선택 | 회원가입·구글 간편 가입 + 가입 설문 | `#/signup` | 필수 동의 2개 → 구글로 간편 가입 또는 이메일·비밀번호 가입 → 30초 설문(건너뛰기 가능) → 완료. 내 계정에서 로그아웃·탈퇴(즉시 삭제). 이메일과 비밀번호 해시(또는 구글 계정 식별값)만 저장하며 **이메일 인증은 아직 없음**. 가입하지 않아도 모든 기능 사용 가능 |

키보드만으로 모든 기능을 쓸 수 있게 만들었고, 배포본 9개 화면에서 axe(WCAG 2 A·AA) 심각·치명 0건을 자체 점검했습니다(인증 아님). 점검 스크립트는 `scripts/`에 있습니다. 화면별 설계는 [docs/SCREENS.md](docs/SCREENS.md)에 있습니다.

> **변호사 프로필은 데모용 가상 데이터입니다.** 실제 변호사가 아니며 연락처·예약·후기·승소 실적이 없습니다. 서비스는 소개비·수수료·광고비를 받지 않고, 돈으로 순위를 바꾸지 않습니다. 실제 변호사는 대한변호사협회 공식 변호사 검색에서 확인하세요.

## 로컬 실행

Node.js 22 이상이 필요합니다(서버가 내장 `node:sqlite`를 씁니다).

```bash
npm install
cp .env.example .env      # .env를 열어 OPENAI_API_KEY 등을 채운다

# 개발 모드 (화면 수정 즉시 반영)
npm run dev

# 배포와 같은 방식 (빌드 후 Express가 화면과 API를 함께 제공)
npm run build && npm start   # http://localhost:8420
```

- `OPENAI_API_KEY`가 비어 있어도 서버는 뜹니다. 이때 AI 정리는 "AI 연결이 준비되지 않았어요" 안내를 띄우고, 직접 입력과 합성 예시(`#/deduct?sample=1`)는 그대로 쓸 수 있습니다.
- 개발 모드에서 API까지 쓰려면 다른 터미널에서 `npm start`로 서버도 띄웁니다.

### 환경 변수

`.env`는 저장소에 올리지 않습니다. 이름과 기본값은 [.env.example](.env.example)에 있습니다.

| 이름 | 용도 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 (서버에서만 사용) |
| `OPENAI_MODEL` | 사용할 모델 (기본 `gpt-5.4-mini`) |
| `PORT` | 서버 포트 (기본 `8420`) |
| `RECEIPT_SECRET` | 사진 지문 기록의 HMAC 서명 키 |
| `GOOGLE_CLIENT_ID` | 구글 간편 가입용 OAuth 웹 클라이언트 ID(공개값). 비우면 구글 버튼 대신 "구글 간편 가입 준비 중"이 보이고 이메일 가입만 됨 |
| `SESSION_SECRET` | 로그인 세션 쿠키(`bj_session`) HMAC 서명 키. 비우면 `RECEIPT_SECRET`을 씀. 바꾸면 기존 로그인이 모두 풀림 |

### 구글 Client ID 설정 (선택)

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → **OAuth 동의 화면**을 만든다(외부, 앱 이름·지원 이메일만). 범위는 기본(`openid`·`email`·`profile`)만 쓰고 추가 범위는 요청하지 않는다.
2. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 웹 애플리케이션**.
3. **승인된 JavaScript 원본**에 아래 세 주소를 넣는다(리디렉션 URI는 필요 없음 — 버튼이 ID 토큰을 바로 돌려준다).
   - 배포 주소 `https://bojeung.193-123-163-215.sslip.io`
   - `http://localhost:8420` (빌드 후 `npm start`)
   - `http://localhost:5173` (`npm run dev`)
4. 만든 클라이언트 ID(`…apps.googleusercontent.com`)를 서버 `.env`의 `GOOGLE_CLIENT_ID`에 넣고 서버를 다시 시작한다. 화면은 `GET /api/config`로 이 값을 받아 구글 공식 버튼을 그린다. 클라이언트 보안 비밀(secret)은 쓰지 않는다.
5. 서버는 받은 ID 토큰을 `https://oauth2.googleapis.com/tokeninfo`로 검증(aud·iss·exp·email_verified)한 뒤에만 가입·로그인시킨다. 흐름은 [ARCHITECTURE 4-1](docs/ARCHITECTURE.md)에 있다.

- OAuth 동의 화면이 "테스트" 상태면 테스트 사용자로 등록한 구글 계정만 로그인할 수 있다.

## 폴더 구조

```text
src/
  screens/      화면 (Home, Deduct, Record, Lawyers, Help, Cert, Pricing, Event, Privacy, Signup)
  components/   화면 부품 (공제 정리·첫 화면·기록 부품, 팝업, 설문, 바닥글 준수 표시)
  lib/          순수 로직 (mask.ts 텍스트 가림, imageMask.ts 사진 가림, lawyerMatch.ts 조건 일치 계산 등)
  data/         고정 데이터 (참고 자료, 가상 변호사 프로필, 무료 상담 기관, 운영 정보)
  styles/       화면별 CSS
server/
  server.mjs    Express API(/api/*) + 빌드된 화면 제공, SQLite(server/data/, 저장소 제외)
public/         공공누리·개인정보 처리 표시 아이콘, 발표자료(/slides/)
docs/           PRD와 설계 문서
scripts/        점검 스크립트 (a11y-check.cjs 접근성·금지 문구, keyboard-check.cjs 키보드·알림, lawyer-check.mjs 변호사 검산)
deploy.sh       배포 스크립트 (빌드 → rsync → systemd 재시작)
```

## 문서

| 문서 | 내용 |
|---|---|
| [PRD](docs/PRD.md) | 문제·타깃·요구사항(FR)·범위·부록(AI·오픈소스 사용 내역) |
| [아키텍처](docs/ARCHITECTURE.md) | 구성도, 데이터 흐름, 배포, 보안, 개발 방식 |
| [화면 설계](docs/SCREENS.md) | 화면별 구성·상태·오류·접근성 |
| [API](docs/API.md) | `/api/*` 요청·응답 |
| [ERD](docs/ERD.md) | SQLite 표와 브라우저 저장소 |
| [개인정보·법적 설계](docs/PRIVACY_LEGAL.md) | 처리 항목, 보유, 국외 이전, 법적 경계 |
| [참고 자료](docs/REFERENCES.md) | 화면에 쓰는 공개 자료의 출처·범위 |
| [테스트 시나리오](docs/TEST_SCENARIOS.md) | FR별 확인 절차 |

## 라이선스·크레딧

| 구분 | 내용 |
|---|---|
| 오픈소스 | React · Vite · Express (MIT), TypeScript (Apache-2.0) |
| 글꼴 | Pretendard (SIL Open Font License 1.1) |
| 점검 도구 | Playwright, axe-core |
| 자료 표시 | 공공누리 제4유형 마크(표준계약서 조항 출처 표시), 개인정보보호위원회 개인정보 처리 표시(라벨링) 아이콘 |
| 템플릿 | 대회 PRD 템플릿 |
| 개발 도구 | Claude Code(Claude Opus 5.5 구현·통합, Claude Fable 5.1 화면 디자인·기능 구현), Claude Code 멀티 에이전트 워크플로, Claude 디자인 캔버스(Artifact), Codex(요구사항·PRD 작성·검토), Opus 5.5 Max(조사) |

자세한 사용 내역은 [PRD 부록](docs/PRD.md)에 있습니다. 보증금 지킴이는 국민대학교 학생 팀의 프로젝트이며 국민대학교 공식 서비스가 아닙니다. 문의는 [GitHub 이슈](https://github.com/a1paka12/AIBuilder_Challenge/issues)로 받습니다(공개 게시판이라 개인정보는 적지 마세요).
