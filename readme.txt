# 마비노기 경매장 데이터 수집기

마비노기 경매장 API를 활용하여 아이템 데이터를 수집하고, 정령 형상변환 리큐르 등의 특수 아이템을 시각화하는 웹 애플리케이션입니다.

## 프로젝트 구조

```
/
├── index.html                       # 메인 페이지 (두 웹앱으로 연결되는 랜딩 페이지)
├── auction/                         # 경매장 관련 파일
│   ├── index.html                   # 경매장 메인 페이지
│   ├── css/
│   │   └── auction.css              # 경매장 스타일시트
│   ├── js/
│   │   ├── main.js                  # 메인 초기화 및 이벤트 핸들러
│   │   ├── api-client.js            # API 호출 관련 기능
│   │   ├── category-manager.js      # 카테고리 관리
│   │   ├── search-manager.js        # 검색 기능
│   │   ├── filter-manager.js        # 필터링 기능
│   │   ├── item-display.js          # 아이템 표시 관련 기능
│   │   ├── pagination.js            # 페이지네이션
│   │   └── utils.js                 # 유틸리티 함수
│   └── assets/                      # 이미지 등 정적 파일
│
├── spirit/                          # 정령 형상변환 관련 파일
│   ├── index.html                   # 정령 형상변환 메인 페이지
│   ├── css/
│   │   └── styles.css               # 스타일시트
│   ├── js/
│   │   └── script.js                # 자바스크립트 코드
│   └── assets/                      # 이미지 등 정적 파일
│
├── shared/                          # 공유 리소스
│   ├── css/
│   │   └── common.css               # 공통 스타일
│   └── js/
│       └── firebase-config.js       # Firebase 설정
│
├── src/                             # 백엔드 소스 코드
│   ├── api-client.js
│   ├── category-manager.js
│   ├── config.js
│   ├── data-processor.js
│   ├── index.js
│   └── storage-manager.js
│
├── data/                            # 데이터 파일
└── .github/                         # GitHub 관련 설정
    └── workflows/
        └── collect-data.yml
```
# 모듈화된 Auction 코드 구조

## 1. main.js
- 애플리케이션 초기화 및 이벤트 리스너 설정
- 전역 상태 관리
- 모듈 간 통합 조정

## 2. api-client.js
- Firebase Functions 호출
- 데이터 요청 및 응답 처리
- API 오류 처리

## 3. category-manager.js
- 카테고리 데이터 관리
- 카테고리 UI 렌더링
- 카테고리 이벤트 처리 (펼치기/접기, 선택 등)

## 4. search-manager.js
- 검색어 입력 처리
- 자동완성 기능
- 한글 초성 검색 문제 개선 (정확한 검색어 우선)

## 5. filter-manager.js
- 세부 필터 UI 관리
- 필터 적용 및 제거 기능
- 로컬 필터링 처리

## 6. item-display.js
- 아이템 목록 렌더링
- 아이템 상세 정보 표시 (모달, 툴팁)
- 아이템 UI 이벤트 처리

## 7. pagination.js
- 페이지네이션 UI 생성
- 페이지 이동 처리

## 8. utils.js
- 공통 유틸리티 함수 모음
- 한글 초성 처리
- 디바운스, 스로틀 함수
- 날짜 포맷팅 등

## 요약
- 기능별로 모듈을 분리하여 코드 가독성 및 유지보수성 향상
- ES6 모듈 시스템을 사용하여 명확한 의존성 관리
- 문제점 개선을 위한 코드 리팩토링

## 기능

- 마비노기 경매장 API를 통한 아이템 데이터 수집
- 인챈트, 세공, 에코스톤 정보 추출 및 가공
- 정령 형상변환 리큐르, 이펙트 카드, 타이틀 이펙트 시각화
- 색상, 세트, 무한 지속 여부 등 다양한 필터링 기능
- 정기적인 데이터 자동 업데이트 (GitHub Actions)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 데이터 수집 실행
npm start
```

## 환경 변수

- `API_KEY`: 마비노기 API 키 설정 (필수)

## GitHub Pages 호스팅

이 프로젝트는 GitHub Pages를 통해 쉽게 호스팅할 수 있도록 구성되어 있습니다:

1. 웹 파일(HTML, CSS, JS)은 루트 디렉토리에 위치
2. 데이터 파일은 `data/web/` 디렉토리에 저장
3. GitHub Pages 설정에서 `/ (root)` 디렉토리를 소스로 지정

GitHub Pages 설정 방법:
1. 저장소 메뉴에서 Settings > Pages로 이동
2. Source 섹션에서 Branch를 main으로 설정, 폴더는 / (root)로 설정
3. Save 버튼 클릭

## GitHub Actions

매일 자동으로 데이터를 수집하여 저장소를 업데이트합니다.
GitHub Secrets에 `API_KEY`를 설정해야 합니다.

설정 방법:
1. 저장소 메뉴에서 Settings > Secrets and variables > Actions로 이동
2. New repository secret 버튼 클릭
3. Name에 `API_KEY`, Secret에 마비노기 API 키 입력
4. Add secret 버튼 클릭

## 라이선스

개인 및 비상업적 용도로 자유롭게 사용 가능합니다.

## 만든이

WF신의컨트롤
