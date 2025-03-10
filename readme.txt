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
