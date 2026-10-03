# 보증금 지킴이

퇴실 공제 통보를 받은 자취 대학생이 공제 메시지를 붙여 넣으면, AI가 항목·금액을 원문 근거와 함께 표로 정리하고, 사용자가 고른 항목으로 근거를 묻는 문자를 만들어 주는 서비스. 방 사진은 구역별 기록북으로 정리한다.

- 배포: https://bojeung.193-123-163-215.sslip.io
- PRD: [docs/PRD.md](docs/PRD.md)

## 실행
```bash
npm install
cp .env.example .env   # OPENAI_API_KEY 입력
npm run build && npm start   # http://localhost:8420
# 개발: 터미널 1) npm start  터미널 2) npm run dev
```

## 구조
- `src/` React 19 + TypeScript (Vite) — 화면
- `server/server.mjs` Express — `/api/extract`(AI 정리), `/api/receipt`(사진 지문 기록)
- `docs/` PRD와 설계 문서

보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다.
