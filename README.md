# 보증금 지킴이

> 자취생이 보증금 공제 내역과 입주·퇴실 자료를 AI로 정리하고, 문의할 내용과 상담 조건에 맞는 변호사를 찾는 AI 주거 기록 서비스.

팀 **MOTGA** · KOOKMIN AI BUILDER CHALLENGE 2026(2026-10-03) 출품작 · 주제 "귀찮음 주식회사"

| | |
|---|---|
| 서비스 | https://bojeung.193-123-163-215.sslip.io |
| 발표자료 | https://bojeung.193-123-163-215.sslip.io/slides/ |
| PRD(정본) | [docs/PRD.md](docs/PRD.md) |
| 심사용 테스트 계정 | 아이디 `admin` / 비밀번호 `test` (헤더 [로그인·회원가입] → 로그인 탭. 공용 계정이라 탈퇴할 수 없고, 저장한 사진은 같은 계정 사용자끼리 보여요. 개인 사진은 올리지 마세요) |

## 어떤 문제를 푸나요

퇴실할 때 집주인에게 청소·도배·장판 공제 문자를 받으면, 항목과 금액을 옮겨 적고 근거를 물어보는 첫 문자를 직접 써야 합니다. 상담이 필요하면 변호사의 업무 분야·지역·방식·비용도 직접 비교해야 하고, 개인정보가 담긴 자료를 외부 AI에 그대로 넘기는 것도 부담입니다.

보증금 지킴이는 **기기 안에서 개인정보를 먼저 가린 뒤** AI가 공제 항목·금액·근거 문장만 정리하고, 사용자가 확인한 항목으로 고정 서식의 문의 문자를 만들어 줍니다. **AI는 공제 책임·특약 효력·환급액을 판단하지 않습니다.**

## 핵심 기능

| ID | 우선순위 | 기능 | 한 줄 요약 |
|---|---|---|---|
| FR-01 | 필수 | 기기 내 개인정보 제거·전송 | 전화·계좌·주민번호·이메일은 자동으로, 이름·주소는 직접 지정해 `[전화번호 삭제]`처럼 치환. 사진은 불투명 가림 상자 + 메타데이터 제거. **전송본을 확인해야만** 처리본이 서버로 감 |
| FR-02 | 필수 | AI 공제 정리·문의 준비 | 처리본에서 항목·금액·원문 인용 추출 → 원문 대조·확인 → 물어볼 항목 체크 → "내가 근거를 물어볼 금액" 합계, 출처·범위가 붙은 공개 자료, 고정 문의 문자 복사 |
| FR-03 | 필수 | 변호사 조건 추천 | 상담 주제·방식·지역·예산·시점·언어(꼭 필요/선호/상관없음) → 조건 일치 점수로 후보 최대 3명과 추천 이유. 후보 없음·조건 수정. **데모용 가상 프로필, 소개비·수수료·광고비 없음** |
| FR-04 | 선택 | 방 상태 기록북·상품 체험 | 가린 사진 2장 무료 체험(구역·입주/퇴실·메모, 날짜는 서버 기록 시각), 기록북 미리보기·PDF 저장, 기록북 4,900원 가격 가설과 무료 체험 비교 |
| FR-05 | 선택 | 내용증명 빈칸 서식 | AI가 쓰지 않는 고정 문단·선택 문단, 체크한 공제 항목 자동 입력, 브라우저 PDF 저장(2,900원 가격 가설, 결제 미연결), 발송은 사용자가 직접 |
| FR-06 | 선택 | 30초 현장 설문·구매 의향 | 회원가입 마지막 단계·#/event 설문(이름·연락처 없음), #/pricing 의향 버튼(결제 아님) |
| FR-07 | 선택 | 출시 이벤트 팝업·이벤트 상세 | 첫 방문 레이어 팝업(안내 2장), 설문 응답 시 기록북 체험 범위 확대 |
| FR-08 | 선택 | 무료 상담 기관 안내 | 대한법률구조공단·주택임대차분쟁조정위원회·서울시 마을변호사·국민대 법률상담센터·대한변협 검색, 확인일 표시 |
| FR-09 | 선택 | 개인정보 처리방침·고객 응대 정보 | 처리 표시(라벨링) 6칸·제1~14조, 국외 이전(OpenAI 미국·Oracle 일본) 고지, 바닥글 사업자 정보·준수·점검 표시 |
| FR-10 | 선택 | 회원가입·구글 간편 가입 + 가입 설문 | 이메일 또는 구글로 가입 → 30초 설문 → 내 계정(로그아웃·탈퇴 즉시 삭제). 로그인하면 가린 사진을 내 계정에 보관 |

완료 기준 원문과 세부 동작은 [docs/PRD.md](docs/PRD.md) 5절·5-1절에 있습니다.

## 화면

| 경로 | 화면 |
|---|---|
| `#/` | 첫 화면(메인 비주얼 → 진행 4단계 → 고객센터 안내 → 약속 → 이벤트 띠, 첫 방문 팝업) |
| `#/deduct` | 공제 정리 (`?sample=1` 합성 예시) |
| `#/record` | 방 상태 기록·기록북 |
| `#/lawyer` | 변호사 찾아보기(단계식: 조건 고르기 → 후보 보기) |
| `#/help` | 무료 상담 기관 |
| `#/cert` | 내용증명 빈칸 서식 |
| `#/pricing` | 가격 안내·구매 의향 |
| `#/event` | 출시 기념 이벤트 |
| `#/support` | 고객센터(업무별 안내·이용 안내·문의하기) |
| `#/signup` | 회원가입·로그인·내 계정 |
| `#/privacy` | 개인정보 처리방침 |

헤더 바로 아래 업무 아이콘 줄(공제 · 기록 · 변호사 · 상담 · 내용증명 · 이벤트 · 가격 · 고객센터)에서 모든 화면으로 갈 수 있습니다.

## 개인정보·법적 설계

- **AI는 정리만 합니다.** 공제가 맞는지, 돌려받을 수 있는지는 판단하지 않고, 법률 문서는 고정 서식입니다.
- **원본은 기기 밖으로 나가지 않습니다.** 텍스트는 브라우저에서 치환한 처리본만, 사진은 가리고 메타데이터를 지운 처리본(로그인 후 저장할 때) 또는 해시값만 서버로 갑니다. 서버가 한 번 더 가리고, 메타데이터가 남은 사진은 거절합니다.
- **변호사 소개비·수수료·광고비를 받지 않습니다**(변호사법 제34조·제109조). 후보는 데모용 가상 프로필이고 연락·예약 기능은 없습니다.
- **국외 이전을 알립니다**(개인정보 보호법 제28조의8): OpenAI(미국), Oracle Cloud(일본 도쿄).
- **인증마크·정부 상징·기관 로고를 쓰지 않습니다.** 바닥글의 "준수·점검 표시"와 원칙 마크는 팀이 직접 지키고 점검한 내용이며 인증이 아닙니다.

## 기술 구성

| 구분 | 내용 |
|---|---|
| 화면 | React 19 + TypeScript + Vite 8, 해시 라우팅, Pretendard |
| 서버 | Node.js 22 + Express 4 (`server/server.mjs`) |
| AI | OpenAI API `gpt-5.4-mini`, 구조화 출력(JSON Schema strict) |
| 데이터 | SQLite(`node:sqlite`) `receipts`·`intents`·`survey`·`metrics`·`users`·`photos` + 가린 사진 파일 폴더 |
| 로그인 | 이메일·비밀번호(scrypt) 또는 Google Identity Services(서버에서 ID 토큰 검증), HttpOnly 세션 쿠키 |
| 배포 | Oracle Cloud 도쿄 리전(Ubuntu 22.04) + Caddy(HTTPS) + systemd, `deploy.sh` |

## 로컬 실행

```bash
npm install
cp .env.example .env      # .env를 열어 OPENAI_API_KEY 등을 채운다

# 개발 모드(화면 수정 즉시 반영). API까지 쓰려면 다른 터미널에서 npm start
npm run dev

# 배포와 같은 방식(빌드 후 Express가 화면과 API를 함께 제공)
npm run build && npm start   # http://localhost:8420
```

### 환경 변수

`.env`는 저장소에 올리지 않습니다. 이름은 [.env.example](.env.example)에 있습니다.

| 이름 | 용도 |
|---|---|
| `OPENAI_API_KEY`, `OPENAI_MODEL` | 공제 정리 AI |
| `PORT` | 서버 포트(기본 8420) |
| `RECEIPT_SECRET` | 사진 기록 서명 |
| `SESSION_SECRET` | 로그인 쿠키 서명 |
| `GOOGLE_CLIENT_ID` | 구글 간편 가입(없으면 버튼 대신 "준비 중") |
| `TEST_ACCOUNT_ID`, `TEST_ACCOUNT_PASSWORD` | 심사용 공용 테스트 계정 시드(둘 다 있을 때만 생성) |
| `DATA_DIR`, `PHOTO_PURGE_AT` | (선택) 데이터 폴더, 사진 일괄 삭제 시각 |

구글 Client ID는 Google Cloud Console에서 웹 애플리케이션용 OAuth 클라이언트를 만들고, 승인된 JavaScript 원본에 배포 주소와 `http://localhost:8420`, `http://localhost:5173`을 넣으면 됩니다. 클라이언트 보안 비밀(secret)은 쓰지 않습니다.

## 점검 방법

모든 점검은 실제 Chrome을 휴대폰 크기(390×844)로 띄워 사람처럼 클릭·입력하는 스크립트로 했습니다. 테스트 데이터가 실제 숫자에 섞이지 않게 기능 점검은 로컬 서버에서 했습니다.

| 스크립트 | 확인하는 것 | 결과 |
|---|---|---|
| `scripts/a11y-check.cjs` | 화면 11개의 접근성(axe-core, WCAG A·AA 심각·치명), 콘솔 오류, 금지 문구 | 위반 0 · 오류 0 · 금지 문구 0 |
| `scripts/keyboard-check.cjs` | Tab만으로 전 화면 도달, 공제 흐름 키보드 완료, 팝업 포커스 가둠·Esc, 화면 이동 시 제목 포커스, 스크린리더 알림 | 통과 |
| `scripts/lawyer-check.mjs` | 07 명세 검산(가상 A 100·B 75·C 65), 꼭 필요 제외, 전화만 선택 시 지역 제외(A 100·B 88·C 59), 0명·1명, 동점 | 통과 |
| `scripts/score-props.mjs` | 조건 일치 점수식 성질 검사(무작위 조건 2,000개 × 후보 8명 = 16,000쌍): 0~100 정수, 독립 계산과 일치, 상관없음 무영향, 모두 맞으면 100 | 통과 |

```bash
node scripts/lawyer-check.mjs
node scripts/score-props.mjs
# 화면 점검은 playwright·axe-core 설치 후: node scripts/a11y-check.cjs http://localhost:8420
```

그 밖에 실제 공제 문자(가상의 이름·전화·계좌·이메일·주민번호·주소)로 전송본 확인 전 서버 요청 0회, 보낸 요청 본문에 원래 개인정보가 없는 것을 확인했습니다. 실제 스크린리더 음성과 기록북 PDF 내용은 사람이 직접 확인해야 합니다.

## 범위 밖(이번에 만들지 않은 것)

실결제·기관 대시보드, 이미지 공제 내용 자동 추출·전체 계약서 분석·로컬 OCR 자동 가림, 공제 책임·환급액·적정 수리비 판단, 사진 촬영 시점·법적 효력 인증, AI 법률문서 작성·자동 발송, 변호사 예약 확정·자료 자동 전달·유료 추천 순위, 원본 서버 보관·장기 보관·공개 공유 링크.

## 폴더 구조

```
src/
  screens/      화면(Home, Deduct, Record, Lawyers, Help, Cert, Pricing, Event, Support, Signup, Privacy)
  components/   공통 부품(deduct/*, record/*, home/*, PromoPopup, FooterCompliance, ServiceMarks 등)
  lib/          브라우저 로직(mask.ts 개인정보 치환, imageMask.ts 사진 가림, lawyerMatch.ts 점수, auth.ts, photos.ts)
  data/         참고 자료·상담 기관·가상 프로필·회사 정보
server/server.mjs   API·AI 호출·인증·사진 보관·SQLite
scripts/        점검 스크립트
docs/           PRD와 설계 문서
public/marks/   공공누리 제4유형 마크, 개인정보 처리 표시 아이콘
```

## 문서

| 문서 | 내용 |
|---|---|
| [PRD.md](docs/PRD.md) | 제품 요구사항(정본) |
| [FUNCTIONAL_SPEC.md](docs/FUNCTIONAL_SPEC.md) | 기능정의서 |
| [SCREENS.md](docs/SCREENS.md) | 화면 구성 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 시스템 구조·데이터 흐름 |
| [API.md](docs/API.md) | API 명세 |
| [ERD.md](docs/ERD.md) | 데이터 구조 |
| [PRIVACY_LEGAL.md](docs/PRIVACY_LEGAL.md) | 개인정보·법적 설계, 예상 질문 |
| [REFERENCES.md](docs/REFERENCES.md) | 참고 자료 출처 |
| [TEST_SCENARIOS.md](docs/TEST_SCENARIOS.md) | 검증 시나리오와 결과 |

## 부록. AI 도구 · 템플릿 · 오픈소스 사용 내역

- **AI 도구(개발):** Claude Code(Claude Opus 5.5: 구현·통합, Claude Fable 5.1: 화면 디자인·기능 구현), Claude Code 멀티 에이전트 워크플로(파일 소유권을 나눠 병렬 작업), Claude 디자인 캔버스(Artifact) 시안, Codex(팀원: 요구사항·PRD 작성·검토), Gemini 3.1 Pro(팀원: 대회 안내 사진 전사), Claude Opus 5.5 Max(팀원: 문제·시장·경쟁·규제 조사).
- **AI(서비스 안):** OpenAI API `gpt-5.4-mini`(공제 항목 정리만).
- **템플릿:** 대회 제공 PRD 템플릿과 PRD 작성 가이드.
- **오픈소스·라이브러리:** React, React DOM, Vite, TypeScript, Express, Playwright·axe-core(점검), Google Identity Services(구글 간편 가입).
- **글꼴·자료:** Pretendard(SIL Open Font License 1.1), 공공누리 제4유형 마크(법무부 주택임대차표준계약서 인용 카드), 개인정보보호위원회 「개인정보 처리방침 작성지침」 처리 표시(라벨링) 아이콘.

## 고지

- 변호사 프로필은 **데모용 가상 데이터**입니다. 실제 변호사가 아니며 연락·예약할 수 없습니다.
- 국민대학교 학생 팀 프로젝트이며 국민대학교·정부·공공기관의 공식 서비스가 아닙니다. 어떤 정보보호·접근성 인증도 받지 않았습니다.
- 가격(기록북 4,900원, 내용증명 서식 2,900원)은 검증 중인 가설이며 결제는 연결하지 않았습니다.
