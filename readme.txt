마비노기 경매장 & 정령 데이터 프로젝트
마비노기 경매장 API를 활용하여 아이템 데이터를 수집하고, 사용자 친화적인 웹 인터페이스로 제공하는 프로젝트입니다. 경매장 아이템 검색뿐만 아니라 정령 형상변환 리큐르, 이펙트 카드, 타이틀 이펙트도 시각화합니다.
주요 기능
경매장 데이터 수집 및 표시

자동 데이터 수집: GitHub Actions를 통한 정기적인 데이터 수집
카테고리 기반 탐색: 대분류-소분류 구조로 아이템 탐색
고급 검색: 자동완성, 한글 초성 검색, 오타 보정 기능
세부 필터링: 아이템 옵션별 고급 필터링 지원
가격 추적: 최저가 정보 표시 및 업데이트

정령 형상변환 시각화

다양한 필터링: 색상, 세트, 무한 지속 여부 등 필터링
이미지 프리뷰: 형상변환 이미지 표시
상세 정보: 출시 시기, 속성 정보 제공

구조
Copy/
├── index.html                # 메인 페이지
├── auction/                  # 경매장 관련 파일
│   ├── js/                   # JS 모듈
│   │   ├── main.js           # 메인 로직
│   │   ├── api-client.js     # API 호출 관리
│   │   ├── category-manager.js # 카테고리 관리
│   │   ├── search-manager.js # 검색 기능
│   │   ├── filter-manager.js # 필터링 기능
│   │   ├── item-display.js   # 아이템 표시
│   │   ├── pagination.js     # 페이지네이션
│   │   └── utils.js          # 유틸리티 함수
│   └── styles.css            # 스타일시트
├── spirit/                   # 정령 형상변환 관련 파일
│   ├── index.html            # 정령 변환 페이지
│   ├── script.js             # 정령 변환 로직
│   └── styles.css            # 스타일시트
├── src/                      # 백엔드 (데이터 수집)
│   ├── index.js              # 메인 스크립트
│   ├── api-client.js         # API 호출 클라이언트
│   ├── category-manager.js   # 카테고리 관리
│   ├── data-processor.js     # 데이터 가공
│   ├── storage-manager.js    # 데이터 저장
│   └── config.js             # 설정 파일
├── data/                     # 수집된 데이터 저장소 (용량 문제로 저장소에 미포함)
│   ├── items/                # 카테고리별 아이템 데이터
│   ├── meta/                 # 메타데이터
│   ├── option_structure/     # 아이템 옵션 구조 정보
│   ├── web/                  # 웹 표시용 가공 데이터
│   └── categories.json       # 카테고리 정보
└── .github/workflows/        # GitHub Actions
    └── collect-data.yml      # 자동 데이터 수집 워크플로우
데이터 디렉토리 구조
저장소의 용량 제한으로 인해 data 디렉토리는 포함되어 있지 않습니다. 아래는 데이터 디렉토리의 구조와 역할입니다:

data/items/: 카테고리별 원본 아이템 데이터가 저장됩니다. 각 파일은 카테고리 ID를 이름으로 가집니다.
data/meta/: 전체 데이터 수집 상태 및 통계 정보가 저장됩니다.
data/option_structure/: 각 카테고리별 아이템 옵션 구조 분석 결과가 저장됩니다 (필터링 기능에 사용).
data/web/: 웹 클라이언트에서 사용할 수 있도록 가공된 데이터가 저장됩니다 (정령 형상변환 등).
data/categories.json: 모든 카테고리의 계층 구조 정보를 포함합니다.

첫 실행 시 데이터 디렉토리와 필요한 하위 디렉토리가 자동으로 생성됩니다.
기술 스택

프론트엔드: HTML, CSS, 순수 JavaScript (모듈 패턴)
백엔드: Node.js
데이터 저장: JSON 파일 (정적 호스팅 가능)
API: 마비노기 공식 API
CI/CD: GitHub Actions
호스팅: GitHub Pages

설치 및 실행
사전 요구사항

Node.js 14 이상
마비노기 API 키 (Nexon Open API 페이지에서 발급)

로컬 설정

저장소 클론하기

bashCopygit clone https://github.com/your-username/mabinogi-auction-data.git
cd mabinogi-auction-data

의존성 설치

bashCopynpm install

환경 변수 설정

bashCopy# .env 파일 생성
echo "API_KEY=your_api_key_here" > .env

데이터 수집 실행

bashCopynpm start

웹 서버 실행 (별도 서버 필요)

bashCopy# 예: http-server 패키지 사용
npx http-server .
GitHub Pages 설정
이 프로젝트는 GitHub Pages에 쉽게 배포할 수 있도록 구성되어 있습니다:

GitHub 저장소 설정에서 Pages 기능 활성화
소스 위치를 main 브랜치의 / (루트) 디렉토리로 설정
GitHub Actions 시크릿에 API_KEY 추가

GitHub Actions 자동화
매일 마비노기 경매장 데이터를 자동으로 수집하여 저장소를 업데이트합니다:

저장소 메뉴에서 Settings > Secrets and variables > Actions로 이동
New repository secret 버튼 클릭
Name에 API_KEY, Secret에 마비노기 API 키 입력
Add secret 버튼 클릭

개발자 가이드
모듈 추가 방법
모듈 패턴을 따라 새로운 기능을 추가할 수 있습니다:

auction/js/ 또는 spirit/ 디렉토리에 새 JS 파일 생성
IIFE 패턴으로 모듈 작성
index.html에 스크립트 포함
필요한 경우 main.js에서 모듈 초기화

데이터 구조 수정
데이터 구조를 변경하려면:

src/data-processor.js 파일의 처리 로직 수정
src/storage-manager.js 파일의 저장 로직 수정
필요한 경우 프론트엔드 코드도 함께 수정

카테고리 추가
새로운 카테고리를 추가하려면:

src/category-manager.js 파일에 카테고리 정보 추가
필요한 경우 auction/js/category-manager.js 파일도 수정

기여 방법

이슈 생성 또는 기존 이슈 선택
브랜치 생성 (git checkout -b feature/your-feature-name)
변경사항 커밋 (git commit -m 'Add some feature')
브랜치 푸시 (git push origin feature/your-feature-name)
Pull Request 생성
