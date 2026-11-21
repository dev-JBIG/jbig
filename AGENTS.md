# JBIG Monorepo Agent Instructions (`AGENTS.md`)

> 이 파일은 **OpenAI Codex, Antigravity, Claude Code, Cursor 등 모든 AI 코딩 에이전트**가 이 저장소에서 작업할 때 반드시 따라야 하는 공통 지침입니다.

## 1. 저장소 구조
- `frontend/`: React 18 + TypeScript + GitHub Primer (`@primer/react`, `@primer/primitives`)
- `backend/`: Django 5.2 + DRF + SimpleJWT + Arena 채점 워커
- `.github/workflows/frontend.yml`: `frontend/**` 변경 시 테스트·빌드·운영 배포
- `.github/workflows/backend.yml`: `backend/**` 변경 시 테스트·운영 배포
- `.coderabbit.yaml`: 프론트·백엔드 통합 CodeRabbit v2 리뷰 규칙

---

## 2. 디자인 가이드라인 (UI/CSS 작업 시 필수)
- **모든 UI·컴포넌트·CSS 변경 전에 반드시 [`DESIGN.md`](./DESIGN.md)를 먼저 읽고 준수하세요.**
- 핵심 요약:
  - **GitHub Primer** 토큰 기반(라이트/다크 자동 대응), Bootstrap/jQuery 등 전역 CSS 오염 라이브러리 추가 금지
  - **`border-radius` 엄격 통일 (하드코딩 px 금지)**: 일반 카드·배너·사이드바·버튼·인풋은 `var(--radius-md)`(`6px`), 작은 칩/배지는 `var(--radius-sm)`(`3px`), 플로팅 모달/오버레이만 `var(--radius-lg)`(`12px`)
  - 전역 `img { dynamic-range-limit: standard; }`, `uploadAttachment` 이미지 최적화(`optimizeImageForUpload`), 본문 `loading="lazy" decoding="async"` 유지

---

## 3. 절대 깨뜨리지 말아야 할 핵심 보안·아키텍처 불변식

### Frontend (`frontend/`)
- `frontend/src/API/auth.ts`: Web Locks(`navigator.locks`) 기반 단일 토큰 갱신, `jbig-session` 원자적 저장, `SessionChangedError` 처리 유지
- `frontend/src/API/client.ts`: `BASE_URL/api/` 경로에 한정해 Bearer 토큰 주입, 401 재시도 1회 제한 (외부 URL·Presigned URL로 Authorization 헤더 유출 금지)
- `frontend/src/API/arena.ts`: `Idempotency-Key` 헤더 및 `AbortSignal` 전달 유지
- `frontend/src/Components/Posts/`: 마크다운 렌더링 시 `rehype-sanitize` XSS 방어, 비로그인 댓글 Cloudflare Turnstile, 권한 게이트 첨부파일 다운로드(`downloadGatedAttachment`), `extractKeyFromUrl` 유지
- `frontend/src/Components/Profile/`: 사용자 HTML 프로필 `<iframe>`의 `sandbox=""` 격리 유지
- Django API 호출 시 trailing slash(`/`) 일관성 유지

### Backend (`backend/`)
- `backend/boards/`: 3축 권한 매트릭스(`read_permission`, `post_permission`, `comment_permission`), `visible_for_user` / `readable_for_user`, 비공개/제한 게시글의 `is_post_media_gated()` 미디어 게이팅, 업로드 경로 소유권·참조 검증 유지
- `backend/recruitments/`: 운영 DB는 PostgreSQL이므로 nullable FK와 `select_related()`를 함께 쓸 때 `select_for_update(of=('self',))` 필수
- `backend/competitions/`: HTTP 뷰(`views.py`, `services.py`)에서 `scoring.py`/`data_setup.py` import 금지, `FINALIZED` 이전 `private_rmse` 노출 금지, 일일 할당량(KST)·워커 리스 펜싱 유지
- `backend/users/`: 계정 열거 방지(anti-enumeration), 스로틀링, Refresh 토큰 회전·블랙리스트 트랜잭션 정합성 유지

---

## 4. 필수 검증 명령어

### Frontend 변경 시 (`frontend/`)
```bash
npx tsc --noEmit
npm test -- --watchAll=false
CI=true npm run build
```

### Backend 변경 시 (`backend/`)
```bash
python manage.py test
```

---

## 5. Git·PR·배포 정책
- `main` 브랜치는 **Organization Owner 전용 머지 Ruleset**으로 보호됩니다. 항상 피처 브랜치에서 작업 후 PR을 생성하세요.
- `frontend/**`만 수정하면 `Frontend CI/CD`만, `backend/**`만 수정하면 `Backend CI/CD`만 실행됩니다.
- 프로덕션 배포는 `main` 브랜치 푸시(머지) 또는 `main` 수동 실행(`workflow_dispatch`)에서만 수행되며, PR 이벤트에서는 절대 배포하지 않습니다.
- 비밀키·토큰·환경변수 값을 코드, 로그, 커밋에 절대 노출하지 마세요.
