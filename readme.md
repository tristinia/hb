# mabidb

v1.1

NEXON OPEN API를 활용한 마비노기 경매장 실시간 웹 검색 서비스
정적 호스팅과 Cloudflare 서버리스 생태계(Workers, D1, KV)를 결합
세부 옵션 필터링 및 과거 실거래 완료 내역 기반의 통계 데이터 제공

## 구조

```
mabidb/
├── index.html    # 메인 페이지 (경매장 검색)
├── pages/        # 정령 형상변환 등 서브 페이지
├── assets/       # 프론트엔드 정적 자산 (CSS/JS)
├── workers/      # Cloudflare Workers (백엔드)
├── data/         # 정적 카테고리 데이터
└── docs/         # 기획/설계 문서
```

## 주요 기능

### 경매장 검색
- 카테고리/키워드 검색, 한글 초성 검색 지원 자동완성
- 실시간 검색 및 거래완료 내역을 통한 검색 인덱스 자동 반영
- 아이템 옵션(세공, 인챈트 등) 기반 세부 필터링
- 시간별/일별/월별 가격 추이 통계 (개발중)

### 메타데이터 제공
- 인챈트 접두/접미 효과, 세공 옵션, 세트 효과, 에코스톤 정보

## 기술 스택

- **프론트엔드**: Vanilla JavaScript(모듈 구조), GitHub Pages 정적 호스팅
- **백엔드**: Cloudflare Workers, D1(SQLite 기반), KV(캐시/검색 인덱스)
- **외부 API**: NEXON Open API(마비노기 경매장)

## 아키텍처 (워커 구성)

4개의 Cloudflare Worker로 역할을 나눠 처리

**`mabinogi-auction-list`** (요청 기반)
사용자 요청을 받는 API 게이트웨이(`api.mabidb.com`)
실시간 검색·목록 조회 처리
신규 아이템 발견 시 metadata-processor에 전달, 검색 인덱스에 반영

**`mabinogi-auction-history`** (5분마다 cron)
거래완료 내역 수집
D1 월별 파티션 테이블(`price_history_*`, `history_options_*`)에 저장
시간/일/월별 통계 집계

**`mabinogi-metadata-processor`** (Service Binding 호출 + 시간당 cron)
D1 `items` 테이블과 KV 검색 인덱스
메타데이터 캐시 쓰기 전담 중앙 처리소
아이템 대표 이름 판단, 인챈트/세공/세트효과/에코스톤 메타데이터 가공

**`mabinogi-auction-cleanup`** (매월 1일 cron)
오래된 월별 파티션 테이블 정리

거래완료 데이터: history → metadata-processor → D1 순으로 흐르고, 
실시간 검색: auction-list, NEXON Open API, metadata-processor 처리
프론트엔드: KV에 캐시된 검색 인덱스 주기적으로 갱신 → 자동완성에 반영

## 참고

일부 레거시 코드(`src/`, `.github/workflows/collect-data.yml`)정리 예정(#10)
