# 마비노기 경매장 데이터 수집기

마비노기 경매장 API를 활용하여 아이템 데이터를 수집하고, 정령 형상변환 리큐르 등의 특수 아이템을 시각화하는 웹 애플리케이션입니다.

## 프로젝트 구조

```
/
├── index.html             # 웹사이트 메인 페이지
├── styles.css             # 스타일시트
├── script.js              # 프론트엔드 JS
├── auction.html           # 경매장 웹사이트 Html
├── auction.js             # 경매장 구현 JS
├── auction.css            # 경매장 스타일시트
├── src/                   # 소스 코드
│   ├── api-client.js      # API 관련 코드
│   ├── category-manager.js # 카테고리 관리
│   ├── config.js          # 설정 파일
│   ├── data-processor.js  # 데이터 처리
│   ├── storage-manager.js # 저장소 관리
│   └── index.js           # 메인 스크립트
│
├── data/                  # 데이터 파일
│   ├── database/          # 수집한 전체 아이템 데이터
│   ├── items/             # 카테고리별 아이템 데이터
│   ├── meta/              # 메타데이터
│   └── web/               # 웹 표시용 데이터
│       ├── spiritLiqueur.json # 정령 형상변환 리큐르 데이터
│
├── image/                 # 이미지 리소스 (옵션)
│   ├── spiritLiqueur/     # 정령 형상변환 리큐르 이미지
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
