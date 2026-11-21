# JBIG Web Platform (Monorepo)

전북대학교 빅데이터·AI 학회 **JBIG (JBNU Big Data & AI Group)** 웹 플랫폼의 프론트엔드(`frontend/`)와 백엔드(`backend/`) 통합 모노레포입니다.
기존 `dev-JBIG/jbig_frontend`와 `dev-JBIG/jbig_backend`의 전체 커밋 히스토리를 `git subtree`로 보존해 통합했습니다.

## 디렉터리 구조

```text
.
├── frontend/                  # React 18 + TypeScript + GitHub Primer (@primer/react)
├── backend/                   # Django 5.2 + DRF + SimpleJWT + Arena Worker
├── .github/workflows/
│   ├── frontend.yml           # frontend/** 변경 시 테스트·빌드·배포
│   └── backend.yml            # backend/** 변경 시 테스트·배포
└── .coderabbit.yaml           # 통합 CodeRabbit v2 리뷰 설정
```

## 로컬 개발 실행

### Frontend (`frontend/`)
- Node.js 버전은 `frontend/.nvmrc` 기준
```bash
cd frontend
npm ci
npm start
```
- 테스트 및 빌드:
```bash
cd frontend
npx tsc --noEmit
npm test -- --watchAll=false
npm run build
```

### Backend (`backend/`)
- Python 3.11+ (CI 기준 Python 3.12)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 3001
```
- 테스트:
```bash
cd backend
source .venv/bin/activate
python manage.py test
```

## GitHub Actions Secrets 설정 (운영 배포 전환 전 필수)

기존 두 저장소가 모두 `DEPLOY_PATH`라는 동일한 시크릿 이름을 사용하고 있었으므로, 모노레포에서는 경로 충돌 방지를 위해 **`FRONTEND_DEPLOY_PATH`** 와 **`BACKEND_DEPLOY_PATH`** 로 분리했습니다.

`Settings → Secrets and variables → Actions`에 아래 시크릿을 등록해야 `main` 머지 시 서버 배포가 동작합니다.

| 구분 | Secret 이름 | 설명 |
|---|---|---|
| 공통 (SSH) | `DEPLOY_HOST` | 운영 서버 호스트 |
| 공통 (SSH) | `DEPLOY_USER` | SSH 사용자명 |
| 공통 (SSH) | `SSH_PRIVATE_KEY` | SSH 개인키 |
| Frontend 배포 | `FRONTEND_DEPLOY_PATH` | 기존 `jbig_frontend`의 `DEPLOY_PATH` 값 |
| Frontend 빌드 | `REACT_APP_API_BASE_URL` | API 베이스 URL |
| Frontend 빌드 | `REACT_APP_DEFAULT_NOTION_PAGE_ID` | 기본 Notion 교안 페이지 ID |
| Frontend 빌드 | `REACT_APP_SERVER_HOST` | 서버 호스트 |
| Frontend 빌드 | `REACT_APP_SERVER_PORT` | 서버 포트 |
| Frontend 빌드 | `REACT_APP_USERID_SECRET` | 사용자 ID 시크릿 |
| Frontend 빌드 | `REACT_APP_TURNSTILE_SITE_KEY` | Cloudflare Turnstile 사이트 키 |
| Backend 배포 | `BACKEND_DEPLOY_PATH` | 기존 `jbig_backend`의 `DEPLOY_PATH` 값 |

## 기존 저장소 전환 체크리스트

1. 위 GitHub Actions Secrets 등록 완료
2. `dev-JBIG/jbig`에서 프론트·백엔드 배포 워크플로 정상 동작 확인
3. 기존 `jbig_frontend` PR #59 / `jbig_backend` PR #32 등 미머지 작업 필요 시 이관
4. 기존 `dev-JBIG/jbig_frontend`, `dev-JBIG/jbig_backend` 저장소 Archive 처리(읽기 전용 보존)
