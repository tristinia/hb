# 마비노기 경매장 데이터 수집기

마비노기 경매장 API를 활용하여 아이템 데이터를 수집하고, 정령 형상변환 리큐르 등의 특수 아이템을 시각화하는 웹 애플리케이션입니다.

## 프로젝트 구조

```
/
├── src/                   # 소스 코드
│   ├── api-client.js      # API 관련 코드
│   ├── category-manager.js # 카테고리 관리
│   ├── config.js          # 설정 파일
│   ├── data-processor.js  # 데이터 처리
│   ├── storage-manager.js # 저장소 관리
│   └── index.js           # 메인 스크립트
│
├── public/                # 웹 페이지 관련 파일
│   ├── index.html         # 메인 HTML 파일
│   ├── script.js          # 프론트엔드 JavaScript
│   └── styles.css         # CSS 파일
│
├── data/                  # 데이터 파일
│   ├── items/             # 카테고리별 아이템 데이터
│   ├── meta/              # 메타데이터
│   └── web/               # 웹 표시용 데이터
│       ├── effectCard.json # 이펙트 카드 데이터
│       ├── spiritLiqueur.json # 정령 형상변환 리큐르 데이터
│       └── titleEffect.json # 타이틀 이펙트 데이터
│
├── .github/               # GitHub 관련 설정
│   └── workflows/         # GitHub Actions 워크플로우
│       └── collect-data.yml # 데이터 수집 워크플로우
│
└── package.json           # 의존성 및 스크립트 정의
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

## GitHub Actions

매일 자동으로 데이터를 수집하여 저장소를 업데이트합니다.

## 만든이

WF신의컨트롤
