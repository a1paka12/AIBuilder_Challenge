# 보증금 지킴이 데이터 모델 (ERD)

작성일: 2026-10-03 · 관련 문서: [PRD](PRD.md) · [ARCHITECTURE](ARCHITECTURE.md) · [API](API.md) · [PRIVACY_LEGAL](PRIVACY_LEGAL.md)

이 문서는 **현재(MVP, 해커톤 배포본)** 와 **향후(창업 목표)** 를 나눠 적는다. 현재 구현에 없는 것은 "향후"에만 쓴다.

---

## 1. 현재(MVP) 데이터 모델

### 1-1. 저장 위치 요약

| 데이터 | 어디에 있나 | 얼마나 남나 | 코드 |
|---|---|---|---|
| Receipt (사진 지문 기록) | **서버 파일** `server/data/receipts.jsonl` (한 줄에 JSON 하나, 추가 전용) | 서버 파일에 계속 남음 | `server/server.mjs` `POST /api/receipt` |
| DeductionState, Item | 브라우저 메모리 (React 상태) | 새로고침·탭 닫기 시 사라짐 | `src/state.tsx`, `src/types.ts` |
| RoomPhoto (사진 자체) | 브라우저 메모리 (object URL) | 새로고침·탭 닫기 시 사라짐 | `src/types.ts` `RoomPhoto` |
| ReferenceDoc (참고 자료 5개) | 프론트엔드 코드에 들어 있는 정적 데이터 | 배포본과 함께 | 화면 코드의 정적 목록 |

- **공제 메시지 본문은 서버에 저장하지 않는다.** `POST /api/extract`는 본문을 받아 AI에 넘기고 결과만 돌려준다. 서버 로그에는 항목 수와 처리 시간만 남긴다.
- **사진 파일은 서버로 보내지 않는다.** 브라우저에서 SHA-256 지문을 계산해 지문(64자 16진수)만 보낸다.
- 회원·로그인·DB가 없다. 서버에 남는 것은 Receipt 한 종류뿐이다.

### 1-2. ER 다이어그램 (현재)

```mermaid
erDiagram
    DEDUCTION_STATE ||--o{ ITEM : "items"
    ITEM }o--o{ REFERENCE_DOC : "키워드로 화면에서 매칭(저장 안 함)"
    ROOM_PHOTO }o--o| RECEIPT : "sha256로 연결"

    DEDUCTION_STATE {
        string rawText "붙여 넣은 공제 메시지 (브라우저 메모리만)"
        int statedTotal "메시지에 적힌 총액, 없으면 null"
        string source "ai | cache | manual | null"
        string contractor "self | other | unknown"
        string clauseText "특약 문구 (선택, 브라우저만)"
        string myName "문자·내용증명용 (브라우저만)"
        string place "문자·내용증명용 (브라우저만)"
    }
    ITEM {
        string id PK "item-1 ... 또는 직접 추가 행 id"
        string name "항목명"
        int amount "원 단위 정수, 모르면 null"
        string quote "원문 인용, 직접 추가 행은 빈 문자열"
        boolean quoteFound "원문에서 인용을 찾았는지"
        boolean needsCheck "확인 필요 표시"
        string checkReason "단위 불명확 | 금액 없음 | 원문 확인 필요 | 금액 범위 확인 필요"
        boolean confirmed "사용자가 [확인]을 눌렀는지"
        boolean selected "물어볼 항목 체크 (confirmed일 때만)"
        boolean manual "사용자가 직접 추가한 행"
    }
    ROOM_PHOTO {
        string id PK
        string zone "벽 | 바닥 | 욕실 | 주방 | 창문/문 | 옵션 가전 | 기타"
        string phase "입주 | 퇴실"
        string url "브라우저 object URL (서버로 안 보냄)"
        string fileName
        string sha256 FK "브라우저에서 계산한 파일 지문"
        string memo
        string date "날짜, 없으면 null"
        string dateSource "exif | manual | none"
    }
    RECEIPT {
        string sha256 PK "64자 16진수 (같은 지문 여러 줄 가능)"
        string receivedAt "서버 수신 시각 ISO 8601 (UTC)"
        string sig "HMAC-SHA256(sha256|receivedAt)"
    }
    REFERENCE_DOC {
        string id PK "std-contract-9 등 5개"
        string title
        string quote "원문 인용 또는 판결 요지"
        string scope "범위 태그"
        string url "출처 링크"
        string checkedAt "확인일 2026-10-03"
        string keywords "표시 키워드, 비어 있으면 모든 항목 공통"
    }
```

### 1-3. 규칙 (코드가 지키는 것)

| 규칙 | 위치 |
|---|---|
| 이름·금액을 고치면 `confirmed`·`selected`가 `false`로 돌아간다 | `src/state.tsx` `updateItem` |
| `confirmed`가 아니면 `selected`는 항상 `false` | `src/state.tsx` `updateItem` |
| "내가 근거를 물어볼 금액" = `selected && confirmed && amount가 숫자`인 행의 `amount` 합 | `src/state.tsx` `useSelection().askTotal` |
| 개별 합계 = 금액이 숫자인 모든 행의 합. `statedTotal`(메시지 속 총액)은 항목이 아니며 합계에 더하지 않는다 | `useSelection().itemSum` |
| 서버는 원문에 없는 인용을 `quoteFound=false`, `needsCheck=true`로 바꾼다 | `server/server.mjs` `sanitize` |
| Receipt는 덮어쓰지 않고 줄을 추가만 한다. 조회는 같은 지문의 첫 기록 시각과 횟수를 돌려준다 | `POST/GET /api/receipt` |
| `RoomPhoto.receipt`는 서버가 돌려준 Receipt를 그대로 담는다(없으면 `null`) | `src/types.ts` |

### 1-4. 참고 자료 5개 (정적 데이터)

| id | 범위 태그 | 표시 조건 |
|---|---|---|
| `std-contract-9` | 표준계약서 사용 시 | 키워드: 도배, 벽지, 장판, 바닥, 노후, 파손, 원상복구, 원상회복, 청소, 시트지, 싱크대 |
| `sc-2005da8323` | 대법원 판결 | 모든 항목 공통 |
| `sc-91da22605` | 대법원 판결 · 세입자에게 불리할 수 있음 | 모든 항목 공통 |
| `sc-2002da52657` | 대법원 판결 | 키워드: 도배, 벽지, 장판, 바닥, 원상복구, 원상회복, 청소, 시트지, 싱크대, 수리 |
| `hldcc` | 공공 절차 안내 | 모든 항목 공통 |

전체 내용과 출처는 [REFERENCES.md](REFERENCES.md).

---

## 2. 향후(창업 목표) 데이터 모델

로그인, 이사 건 단위 보관, 기록북 재다운로드, 결제를 붙일 때의 모델이다. **아직 구현하지 않았다.**

### 2-1. ER 다이어그램 (향후)

```mermaid
erDiagram
    USER ||--o{ MOVE : "이사 건"
    USER ||--o{ ORDER : "결제"
    MOVE ||--o{ DEDUCTION_ITEM : "공제 항목"
    MOVE ||--o{ PHOTO : "방 사진"
    MOVE ||--o| BOOK : "기록북"
    MOVE ||--o{ INQUIRY : "문의 기록"
    PHOTO ||--o{ RECEIPT : "지문 기록"
    BOOK }o--o{ PHOTO : "포함 사진"
    ORDER }o--o| BOOK : "기록북 구매"
    INQUIRY }o--o{ DEDUCTION_ITEM : "물어본 항목"
    DEDUCTION_ITEM }o--o{ REFERENCE_DOC : "보여 준 자료"

    USER {
        uuid id PK
        string auth_provider "소셜 로그인 제공사"
        string auth_subject "제공사 사용자 식별자"
        string email "재다운로드·영수증용, 선택"
        datetime created_at
        datetime deleted_at "탈퇴 시 파기 예약"
    }
    MOVE {
        uuid id PK
        uuid user_id FK
        string room_nickname "방 별칭 예: 정릉 원룸 (상세 주소 아님)"
        date move_in_date
        date move_out_date
        string status "기록중 | 퇴실통보받음 | 문의함 | 정리끝"
        string contractor "self | other | unknown"
        datetime created_at
    }
    DEDUCTION_ITEM {
        uuid id PK
        uuid move_id FK
        string name
        int amount "원 단위, null 가능"
        string quote "원문 인용 (본문 전체는 저장 안 함)"
        boolean needs_check
        string check_reason
        boolean confirmed
        boolean selected
        string source "ai | manual"
    }
    PHOTO {
        uuid id PK
        uuid move_id FK
        string zone
        string phase "입주 | 퇴실"
        string storage_key "위치정보 제거한 이미지, 유료 보관 시에만"
        string sha256 "원본 파일 지문"
        string memo
        date taken_date
        string date_source "exif | manual | none"
    }
    RECEIPT {
        uuid id PK
        string sha256 "지문"
        datetime received_at
        string sig "HMAC 서명"
        string key_id "서명 키 버전"
    }
    BOOK {
        uuid id PK
        uuid move_id FK
        int photo_limit "30"
        string pdf_key "생성된 PDF 위치"
        int download_count
        datetime generated_at
    }
    ORDER {
        uuid id PK
        uuid user_id FK
        string product "record_book | cert_template | org_plan"
        int price "4900 | 2900 (가설)"
        string pg_payment_id "PG사 결제 번호 (카드 정보 저장 안 함)"
        string status "ready | paid | refunded | canceled"
        datetime paid_at
    }
    INQUIRY {
        uuid id PK
        uuid move_id FK
        string kind "문의 문자 | 내용증명 서식"
        json item_ids "포함한 항목"
        int ask_total "물어본 금액 합"
        date sent_date "사용자가 직접 보낸 날짜 (자동 발송 없음)"
        string memo
    }
    REFERENCE_DOC {
        string id PK
        string title
        string quote
        string scope
        string url
        date checked_at
        json keywords
        int version "자료 개정 이력"
    }
```

### 2-2. 최소 수집 원칙 (향후 모델에도 적용)

| 받지 않는 것 (필수 아님) | 대신 쓰는 것 |
|---|---|
| 상세 주소(동·호수) | `room_nickname` 방 별칭 |
| 집주인 실명·전화번호·계좌번호 | 받지 않음. 문의 문자는 사용자가 직접 복사해 보낸다 |
| 주민등록번호 | 어떤 기능에도 필요 없음. 입력란을 두지 않는다 |
| 공제 메시지 본문 전체 | 항목명·금액·짧은 원문 인용만 (사용자가 저장을 고를 때만) |
| 카드 번호 | PG사 결제 번호만 |
| 사진 위치정보(EXIF GPS) | 브라우저에서 지운 뒤 보관(유료 기록북 보관을 고를 때만) |

- 사진 원본은 기본적으로 서버에 올리지 않는다(현재와 같음). 유료 기록북 재다운로드를 고른 사용자만, 위치정보를 지운 이미지를 올린다.
- `INQUIRY`는 문의 진행 상태를 사용자가 직접 적는 기록이다. 서비스가 상대방에게 연락하거나 자동 발송하지 않는다.
- 보관 기간·파기 절차는 [PRIVACY_LEGAL.md](PRIVACY_LEGAL.md) 참고.
