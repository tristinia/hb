# 마비노기 경매장 & 정령 데이터 프로젝트

마비노기 경매장 API를 활용하여 아이템 데이터를 수집하고, 사용자 친화적인 웹 인터페이스로 제공하는 프로젝트입니다. 경매장 아이템 검색뿐만 아니라 정령 형상변환 리큐르, 이펙트 카드, 타이틀 이펙트도 시각화합니다.

## 주요 기능

### 경매장 데이터 수집 및 표시
- **자동 데이터 수집**: GitHub Actions를 통한 정기적인 데이터 수집
- **카테고리 기반 탐색**: 대분류-소분류 구조로 아이템 탐색
- **고급 검색**: 자동완성, 한글 초성 검색, 오타 보정 기능
- **세부 필터링**: 아이템 옵션별 고급 필터링 지원
- **가격 추적**: 최저가 정보 표시 및 업데이트

### 정령 형상변환 시각화
- **다양한 필터링**: 색상, 세트, 무한 지속 여부 등 필터링
- **이미지 프리뷰**: 형상변환 이미지 표시
- **상세 정보**: 출시 시기, 속성 정보 제공

## 구조

```
/
├── index.html                # 메인 페이지 (리디렉션용)
├── pages/                    # 모든 페이지 컨테이너
│   ├── auction/              # 경매장 페이지
│   │   └── index.html
│   └── spirit/               # 정령 형상 페이지
│       └── index.html
├── assets/                   # 공통 정적 자산
│   ├── css/                  # 스타일시트
│   │   ├── auction.css       # 경매장 페이지 스타일
│   │   └── spirit.css        # 정령 페이지 스타일
│   ├── js/                   # 자바스크립트
│   │   ├── common/           # 공통 모듈
│   │   │   ├── utils.js      # 유틸리티 함수
│   │   │   └── firebase.config.js # Firebase 설정 (gitignore)
│   │   ├── auction/          # 경매장 관련 모듈
│   │   │   ├── api-client.js # API 호출 관리
│   │   │   ├── category-manager.js # 카테고리 관리
│   │   │   ├── search-manager.js # 검색 기능
│   │   │   ├── filter-manager.js # 필터링 기능
│   │   │   ├── item-display.js # 아이템 표시
│   │   │   ├── pagination.js # 페이지네이션
│   │   │   ├── main.js       # 메인 로직
│   │   │   └── enhancements.js # 추가 개선 기능
│   │   └── spirit/           # 정령 형상 관련 모듈
│   │       └── script.js     # 정령 페이지 스크립트
│   └── images/               # 이미지 데이터
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
```

## 데이터 수집 및 처리 과정

이 프로젝트는 두 가지 주요 데이터 흐름이 있습니다:

1. **GitHub Actions 자동 데이터 수집**
   - 정기적으로 마비노기 경매장 API를 호출하여 최신 데이터 수집
   - 카테고리별 데이터 처리 및 가공
   - 처리된 데이터를 `data/` 디렉토리에 저장
   - 변경사항을 저장소에 커밋하여 웹 서비스에 반영

2. **실시간 데이터 조회 (경매장 페이지)**
   - `firebase.config.js`에 저장된 설정으로 Firebase 연결
   - 사용자 검색 요청 시 Firebase Functions를 통해 실시간 API 호출
   - 결과를 클라이언트 측에서 캐싱하여 성능 최적화

## 설치 및 실행

### 사전 요구사항
- Node.js 14 이상
- 마비노기 API 키 (Nexon Open API 페이지에서 발급)
- Firebase 프로젝트 (실시간 검색 기능용)

### Firebase 설정
1. Firebase 프로젝트 생성
2. `assets/js/common/firebase.config.js` 파일 생성:
   ```javascript
   // firebase.config.js
   window.FIREBASE_CONFIG = {
     projectId: "YOUR_FIREBASE_PROJECT_ID"
   };
   ```
3. `.gitignore`에 이 파일 추가:
   ```
   /assets/js/common/firebase.config.js
   ```

### 로컬 설정

1. 저장소 클론하기
```bash
git clone https://github.com/your-username/mabinogi-auction-data.git
cd mabinogi-auction-data
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
```bash
# .env 파일 생성
echo "API_KEY=your_api_key_here" > .env
```

4. 데이터 수집 실행
```bash
npm start
```

5. 웹 서버 실행 (별도 서버 필요)
```bash
# 예: http-server 패키지 사용
npx http-server .
```

### GitHub Pages 설정

이 프로젝트는 GitHub Pages에 쉽게 배포할 수 있도록 구성되어 있습니다:
1. GitHub 저장소 설정에서 Pages 기능 활성화
2. 소스 위치를 `main` 브랜치의 `/` (루트) 디렉토리로 설정
3. GitHub Actions 시크릿에 `API_KEY` 추가

## GitHub Actions 자동화

매일 마비노기 경매장 데이터를 자동으로 수집하여 저장소를 업데이트합니다:

1. 저장소 메뉴에서 Settings > Secrets and variables > Actions로 이동
2. New repository secret 버튼 클릭
3. Name에 `API_KEY`, Secret에 마비노기 API 키 입력
4. Add secret 버튼 클릭

## 개발자 가이드

### 새 페이지 추가 방법
```
1. `pages/` 디렉토리에 새 폴더 생성 (예: `pages/new-feature/`)
2. `index.html` 파일 생성 및 기본 템플릿 구성
3. 관련 CSS를 `assets/css/` 디렉토리에 추가
4. 관련 JS를 `assets/js/new-feature/` 디렉토리에 추가
5. 내비게이션 링크 업데이트
```

### 데이터 구조 수정
데이터 구조를 변경하려면:

1. `src/data-processor.js` 파일의 처리 로직 수정
2. `src/storage-manager.js` 파일의 저장 로직 수정
3. 필요한 경우 프론트엔드 코드도 함께 수정

### 카테고리 추가
새로운 카테고리를 추가하려면:

1. `src/category-manager.js` 파일에 카테고리 정보 추가
2. 필요한 경우 `assets/js/auction/category-manager.js` 파일도 수정

## 기술적 최적화

- **가상 스크롤링**: 대량의 아이템 표시 시 성능 최적화
- **캐싱 시스템**: LocalStorage를 활용한 검색 결과 및 자동완성 데이터 캐싱
- **지연 로딩**: 필요한 데이터만 순차적으로 로드
- **이벤트 위임**: DOM 이벤트 처리 최적화
- **디바운싱/스로틀링**: 연속적인 이벤트 제어를 통한 성능 개선

## 기여 방법

1. 이슈 생성 또는 기존 이슈 선택
2. 브랜치 생성 (`git checkout -b feature/your-feature-name`)
3. 변경사항 커밋 (`git commit -m 'Add some feature'`)
4. 브랜치 푸시 (`git push origin feature/your-feature-name`)
5. Pull Request 생성

## 참고 사항

- `data/` 디렉토리의 파일들은 용량 문제로 GitHub 저장소에 포함되어 있지 않습니다.
- 첫 실행 시 자동으로 필요한 데이터 구조가 생성됩니다.

## 라이센스

개인 및 비상업적 용도로 자유롭게 사용 가능합니다.

## 작성자

WF신의컨트롤
