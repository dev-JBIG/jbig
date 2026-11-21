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
├── .coderabbit.yaml           # 통합 CodeRabbit v2 리뷰 설정 (DESIGN.md 규칙 연동)
├── DESIGN.md                  # UI/UX 디자인 가이드라인 (GitHub Primer 표준)
├── AGENTS.md                  # AI 에이전트 공통 작업·보안 지침 (Codex/Antigravity 등)
└── CLAUDE.md                  # Claude Code 엔트리포인트 (@AGENTS.md, @DESIGN.md 참조)
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

## GitHub Actions Secrets 설정

기존 `dev-JBIG/jbig_frontend` 저장소를 `dev-JBIG/jbig`으로 Rename하여 기존 시크릿을 그대로 유지합니다.

| 구분 | Secret 이름 | 필수 여부 | 설명 |
|---|---|---|---|
| 공통 (SSH) | `DEPLOY_HOST` | 필수 | 운영 서버 호스트 |
| 공통 (SSH) | `DEPLOY_USER` | 필수 | SSH 사용자명 |
| 공통 (SSH) | `SSH_PRIVATE_KEY` | 필수 | SSH 개인키 |
| Frontend 배포 | `FRONTEND_DEPLOY_PATH` 또는 `DEPLOY_PATH` | 필수 | 프론트엔드 배포 경로 (`FRONTEND_DEPLOY_PATH` 우선, 없으면 `DEPLOY_PATH` 사용) |
| Frontend 빌드 | `REACT_APP_API_BASE_URL` | 필수 | API 베이스 URL |
| Frontend 빌드 | `REACT_APP_TURNSTILE_SITE_KEY` | 필수 | Cloudflare Turnstile 사이트 키 |
| Backend 배포 | `BACKEND_DEPLOY_PATH` | 선택 | 미설정 시 서버의 `gunicorn-jbig` systemd `WorkingDirectory`에서 `shared/`·`releases/` 구조를 검증해 자동 감지 |

