---
version: alpha
name: JBIG Web Platform
description: >-
  JBIG(전북대학교 빅데이터·AI 학회) 커뮤니티 웹(frontend/)의 디자인 기준.
  GitHub Primer 토큰 위에 frontend/src/index.css 브리지를 얹은 구조이며,
  2026-11-23 main(771bbd19e, #81) 화면을 실측한 값을 "초기 디자인 기준선"으로 고정했다.
colors:
  # 라이트 테마 값. 다크 딤드, 다크 값은 3.1절 표 참고. 실제 코드는 아래 이름의 Primer 토큰을 쓴다.
  primary: "#0969da"          # --fgColor-accent / --bgColor-accent-emphasis
  primary-subtle: "#ddf4ff"   # --bgColor-accent-muted
  cta: "#1f883d"              # --button-primary-bgColor-rest (글쓰기, 등록, 로그인)
  text: "#1f2328"             # --fgColor-default
  text-muted: "#59636e"       # --fgColor-muted
  canvas: "#f6f8fa"           # --bgColor-inset (페이지 바탕)
  surface: "#ffffff"          # --bgColor-default (카드, 사이드바, 헤더)
  surface-muted: "#f6f8fa"    # --bgColor-muted (카드 헤더 바, 보조 영역, 입력 배경)
  border: "#d1d9e0"           # --borderColor-default
  danger: "#d1242f"           # --fgColor-danger
  success: "#1a7f37"          # --fgColor-success
  attention: "#9a6700"        # --fgColor-attention
  attention-subtle: "#fff8c5" # --bgColor-attention-muted (공지 행)
typography:
  body:
    fontFamily: Pretendard Variable
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  body-mobile:
    fontFamily: Pretendard Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  page-title:
    fontFamily: Pretendard Variable
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
  label:
    fontFamily: Pretendard Variable
    fontSize: 13px
    fontWeight: 500
  caption:
    fontFamily: Pretendard Variable
    fontSize: 12px
    fontWeight: 400
rounded:
  sm: 3px    # --radius-sm
  md: 6px    # --radius-md (기본)
  lg: 12px   # --radius-lg (플로팅 오버레이 전용)
  full: 999px
spacing:
  xs: 4px          # --space-xs
  sm: 8px          # --space-sm
  md-mobile: 12px  # --space-md (모바일)
  md: 16px         # --space-md (데스크톱)
  lg-mobile: 16px
  lg: 24px
  xl-mobile: 24px
  xl: 32px
  page-gutter-mobile: 12px
  column-gap-desktop: 24px
  header-height-mobile: 56px
  header-height: 60px
  sidebar-width: 248px
  max-content-width: 1280px
motion:
  fast:
    duration: 120ms
    timingFunction: cubic-bezier(0.3, 0, 0.5, 1)
  base:
    duration: 180ms
    timingFunction: cubic-bezier(0.3, 0, 0.5, 1)
  slow:
    duration: 260ms
    timingFunction: cubic-bezier(0.3, 0, 0.5, 1)
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  badge:
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
---

# JBIG Web Platform Design Guidelines (`DESIGN.md`)

> 이 문서는 JBIG 웹 플랫폼(`frontend/`)의 **단일 UI/UX 디자인 기준(Single Source of Truth)**입니다.
> 사람 기여자 및 모든 AI 에이전트(Claude, Codex, Antigravity, Cursor, CodeRabbit 등)는 UI·CSS·컴포넌트 수정 시 반드시 이 가이드라인을 준수해야 합니다.
>
> **기준선**: 2026-11-23 `main`(`771bbd19e`, #81) 화면을 **초기 디자인**으로 지정했습니다. 9절에 그 실측값(배치, 여백, 채색, 채도, 밀도, 대비)을 남겼고, 이후 변경은 이 기준선과 비교해 판단합니다.
> **자동 검사**: 8절 규칙은 `frontend/src/design/designLint.ts`가 코드로 판정하고 `npm test`에서 실행됩니다. 문서의 규칙을 바꾸면 엔진과 8절 표를 함께 고칩니다.

---

## 1. 디자인 시스템 기반
- **표준 시스템**: **GitHub Primer** (`@primer/react` + `@primer/primitives`)
- **테마**: `ThemeProvider` + `BaseStyles` 기반 **라이트/다크 모드 자동 대응**
- **전역 토큰 브리지**: [`frontend/src/index.css`](./frontend/src/index.css)
  - 원시 색값(hex, rgba)은 이 파일의 토큰 정의(그림자, 다크 오버레이 보정)에서만 씁니다.
  - 컴포넌트 CSS는 Primer 기능 토큰(`--fgColor-*`, `--bgColor-*`, `--borderColor-*`)이나 이 파일의 브리지 변수만 참조합니다.
- **정의된 변수만 참조**: 존재하지 않는 CSS 변수를 참조하면 선언 전체가 무시되므로 금지합니다. (`undefined-var`)
- **금지 라이브러리**: Bootstrap, jQuery UI 등 전역 CSS를 오염시키는 UI 프레임워크·스타일시트 추가 금지 (`forbidden-library`)

---

## 2. 코너 라운드 (`border-radius`) 규칙 — 엄격 적용

모든 요소의 모서리는 [`frontend/src/index.css`](./frontend/src/index.css)에 정의된 **Primer 3단계 토큰**만 사용합니다.
**임의 픽셀 값(`2px`, `3px`, `4px`, `6px`, `8px`, `12px` 등) 하드코딩을 금지**합니다. (`radius-token`)

| 토큰 / 값 | 실제 크기 | 허용 대상 |
|---|---|---|
| `var(--radius-md)` | `6px` (`--borderRadius-medium`) | **기본 표준.** 모든 페이지 카드, 배너, 사이드바, 게시판 목록/상세/글쓰기, 댓글 박스, 프로필 섹션, 검색·관리자·인증 컨테이너, 버튼, 입력창, 탭, 코드 블록, 본문 이미지 |
| `var(--radius-sm)` | `3px` (`--borderRadius-small`) | 작은 인라인 코드, 검색 `/` 단축키 칩, 캘린더 이벤트 바, 작은 강조선·스켈레톤 바 |
| `var(--radius-lg)` | `12px` (`--borderRadius-large`) | **플로팅 모달·다이얼로그·드롭다운 오버레이·팝업 전용** (`--overlay-bgColor`와 함께 사용) (`radius-lg-overlay`) |
| `999px` | Pill | 상태 배지, 필터 칩, 태그, 스크롤바 썸, 좌측 액티브 인디케이터 |
| `50%` | 원형 | 아바타, 원형 아이콘 버튼, 상태 도트 |
| `0` | 직각 | 테이블 셀, 풀-블리드 구분 영역 |

### 주의사항
- 일반 페이지 카드(배너, 사이드바, 게시판 컨테이너, 폼 카드 등)에 `var(--radius-lg)` 또는 `12px`를 사용하지 않습니다.
- `var(--borderRadius-medium, 8px)`처럼 임의 폴백을 섞지 않고 `var(--radius-md)`로 통일합니다. (`radius-fallback`)
- 카드 내부 헤더처럼 상단 모서리만 둥글어야 하는 경우 `var(--radius-md) var(--radius-md) 0 0`을 사용하거나 부모 카드에 `overflow: hidden`을 적용합니다.
- **기준선 실측**: 화면에 실제로 그려진 라운드는 6px, 3px, 50%, 999px가 대부분입니다. Primer 컴포넌트 내부에서 20px(CounterLabel 등), 9999px(Label), 마크다운 에디터 툴바 2px가 나오며, 이는 외부 컴포넌트 값이라 8절 검사 대상(우리 CSS)에서 제외됩니다.

---

## 3. 색상 및 테마 아키텍처 (GitHub Primer · Vercel Geist · Radix 원칙)

### 3.1 지원 테마 (4단계, `jbig-color-mode` 저장)
| 테마 값 | Primer 매핑 | 용도 및 특징 | 브라우저 `theme-color` |
|---|---|---|---|
| `auto` *(기본값)* | `data-color-mode="auto"` (`light` / `dark_dimmed`) | OS `prefers-color-scheme` 자동 추적 | `#ffffff` / `#212830` |
| `light` | `data-color-mode="light"` | Crisp Primer Light (`#f6f8fa` 캔버스 · `#ffffff` 카드) | `#ffffff` |
| `dark_dimmed` | `data-color-mode="dark"` + `data-dark-theme="dark_dimmed"` | 장시간 독서에 최적화된 슬레이트 다크 (`#151b23` → `#212830` → `#2a313c`, `#000` 번짐 방지) | `#212830` |
| `dark` | `data-color-mode="dark"` + `data-dark-theme="dark"` | 깊은 미드나잇 다크 (`#010409` → `#0d1117` → `#161b22` 오버레이 보정) | `#0d1117` |

**테마별 핵심 토큰 값** (Primer primitives 기준)

| 역할 | 토큰 | light | dark_dimmed | dark |
|---|---|---|---|---|
| 본문 글자 | `--fgColor-default` | #1f2328 | #d1d7e0 | #f0f6fc |
| 보조 글자 | `--fgColor-muted` | #59636e | #9198a1 | #9198a1 |
| 링크, 강조 | `--fgColor-accent` | #0969da | #478be6 | #4493f8 |
| 페이지 캔버스 | `--bgColor-inset` | #f6f8fa | #151b23 | #010409 |
| 카드 | `--bgColor-default` | #ffffff | #212830 | #0d1117 |
| 보조 면 | `--bgColor-muted` | #f6f8fa | #262c36 | #151b23 |
| 테두리 | `--borderColor-default` | #d1d9e0 | #3d444d | #3d444d |
| 핵심 CTA | `--button-primary-bgColor-rest` | #1f883d (success emphasis) | 같음 | 같음 |
| 공지 행 | `--bgColor-attention-muted` | #fff8c5 | #ae7c1426 | #bb800926 |

- **Zero-FOUC & 브라우저 크롬 동기화**: [`frontend/public/index.html`](./frontend/public/index.html)의 초기 인라인 스크립트와 [`ThemeContext.tsx`](./frontend/src/Components/Utils/ThemeContext.tsx)가 첫 페인트 전 `data-color-mode`, `data-dark-theme`, `color-scheme`, `<meta name="theme-color">`를 동기화합니다.
- **서드파티 에디터 동기화**: `MDEditor` 등 자체 테마 속성을 가진 컴포넌트는 `"light"`를 하드코딩하지 않고 반드시 `useColorMode().resolvedColorMode`를 연결합니다. (`mdeditor-light`)

### 3.2 4단계 공간 계층 (Surface Elevation)
다크 모드에서는 그림자만으로는 깊이가 구분되지 않으므로 **위로 올라올수록 한 단계 밝아지는 서피스 계층**과 미세한 상단 하이라이트 보더를 유지합니다.
1. **페이지 캔버스(최하단)**: `var(--bgColor-inset)`
2. **기본 카드·사이드바·헤더**: `var(--bgColor-default)`
3. **카드 헤더 바·보조 영역·입력 배경**: `var(--bgColor-muted)`
4. **플로팅 모달·드롭다운·팝오버(최상단)**: `var(--overlay-bgColor)` + `var(--shadow-lg)`

### 3.3 60-30-10 색상 절제 원칙 및 토큰 규칙
- **중립색 90% · 포인트색 10%**: 채도가 높은 강조색(`--bgColor-accent-emphasis`, `--button-primary-bgColor-rest`)은 핵심 CTA(글쓰기·제출·저장)와 현재 활성 상태에만 제한합니다. 장식 배지·보조 퀵링크에는 중립 서피스 + 컬러 아이콘 또는 부드러운 틴트(`--bgColor-accent-muted` / `color-mix`)를 사용합니다.
  - **기준선 실측(9.3절)**: 유채색 배경 면적은 화면의 0~4%, 유채색 글자는 전체 글자 요소의 0~17%입니다. 이 범위를 넘는 변경은 리뷰에서 근거를 설명합니다.
- **하드코딩 색상 금지**: `#ffffff`, `#000000`, `#333333` 등 원시 hex를 단독으로 쓰지 말고, 반드시 Primer 시맨틱 토큰(또는 `index.css` 브리지 변수)을 사용합니다. (`raw-color`)
  - 텍스트: `var(--fgColor-default)`, `var(--fgColor-muted)`, `var(--fgColor-accent)`, `var(--fgColor-danger)`, `var(--fgColor-success)`, `var(--fgColor-attention)`, `var(--fgColor-onEmphasis)`
  - 배경: `var(--bgColor-default)`, `var(--bgColor-muted)`, `var(--bgColor-inset)`, `var(--bgColor-neutral-muted)`, `var(--bgColor-accent-muted)`, `var(--bgColor-accent-emphasis)`, `var(--overlay-bgColor)`
  - 보더: `var(--borderColor-default)`, `var(--borderColor-muted)`, `var(--borderColor-emphasis)`
- 라이트/다크 양쪽에서 텍스트 대비 **WCAG AA(4.5:1 이상, 큰 글자 3:1 이상)** 를 유지합니다.
  - 다크 딤드에서는 Primer 기본값이 카드, 공지 행, 선택 행 위에서 4.5에 못 미쳐 `index.css`에서 세 토큰의 밝기만 올립니다(색상 유지): `--fgColor-accent`/`--fgColor-link` #478be6 → #5ea2f6, `--fgColor-danger` #e5534b → #f67d74, `--fgColor-muted` #9198a1 → #9da5ae. 자동 모드는 Primer 선택자와 같은 강도(`[data-color-mode][data-color-mode="auto"]...`)로 덮어씁니다.
- 포커스 스타일은 전역 `:focus-visible` (`var(--focus-outlineColor, #0969da)`)를 유지하며 `outline: none`으로 제거하지 않습니다. (`outline-none`)
  - 예외: 바깥 상자가 `:focus-within`으로 같은 2px 포커스 링을 그리는 복합 입력(예: `JbnuEmailInput`)의 안쪽 input만, 줄 위에 사유 주석을 달고 허용합니다.
- **Primer `<Button>` 아이콘 정렬**: 아이콘이 포함된 `@primer/react` `<Button>`은 내부에 `<span className="*-inner">`를 중첩하지 말고 반드시 Primer 네이티브 **`leadingVisual`** prop을 사용합니다. (`primer-button-inner`)

---

## 4. 레이아웃·타이포그래피·반응형
- **웹폰트**: [`frontend/public/index.html`](./frontend/public/index.html)에서 **`Pretendard Variable`** (dynamic subset)을 로드하고 [`frontend/src/index.css`](./frontend/src/index.css)의 `--font-sans` 최우선 순위로 지정해 Windows/macOS/Linux 전역에서 일관된 한글 에디토리얼 가독성을 유지합니다. (`pretendard`)
  - Primer `BaseStyles`가 앱 전체에 `font-family: var(--fontStack-system)`을 직접 지정하므로, `index.css`의 `:root`에서 Primer 글꼴 토큰(`--fontStack-system`, `--fontStack-sansSerif`, `--fontStack-sansSerifDisplay`) 맨 앞에 Pretendard를 둡니다. 컴포넌트 CSS에서 `font-family`를 새로 지정하지 않고 상속을 따릅니다. 자체 글꼴을 지정하는 외부 라이브러리(마크다운 에디터 `@uiw/react-md-editor` 등)는 `shared.css`에서 같은 토큰(`var(--fontStack-system)`)으로 맞춥니다.
- **브랜드 마크**: 헤더·인증·관리자 영역의 로고는 임의 검정 사각형 `J` 모노그램을 만들지 않고 실제 JBIG 마스코트(`/JBIG-logo-192.png`)를 사용합니다.
- **모바일 퍼스트**: 기본 스타일은 모바일, `@media (min-width: 768px)` 이상에서 데스크톱 확장. 모바일 전용 보정이 필요하면 `@media (max-width: 767px)`만 씁니다. 다른 기준점(600, 768, 960px 등)을 새로 만들지 않습니다. (`breakpoint`)
- **핵심 레이아웃 토큰**:
  - `--max-content-width: 1280px`
  - `--header-height`: 모바일 `56px`, 데스크톱 `60px`
  - `--sidebar-width`: 데스크톱 `248px`
- **그림자**: 기본 카드 `var(--shadow-sm)`, 드롭다운/모달 등 플로팅 오버레이 `var(--shadow-md)` ~ `var(--shadow-lg)`
- **숫자 정렬**: 카운터·날짜·순위·통계·페이지 번호에는 `font-variant-numeric: tabular-nums` 적용
- **긴 텍스트 보호**: 닉네임·제목·URL 등은 `min-width: 0`, `overflow-wrap: anywhere` 또는 `text-overflow: ellipsis`로 모바일 가로 넘침 방지
- **우선순위 싸움 금지**: `!important`로 스타일을 덮지 않습니다. 선택자 구조로 해결하고, `prefers-reduced-motion` 전역 리셋만 예외입니다. (`important`)

### 4.1 안티-슬롭(Anti-Slop) 및 에디토리얼 절제 원칙
전형적인 AI 생성 SaaS 템플릿 느낌을 피하기 위해 다음 패턴을 금지합니다.
- **중첩 박스(Card-in-Card) 금지**: 카드 내부에 또 다른 회색 테두리 미니 카드(약어 타일, 운영진 박스, 이중 테두리 캘린더 등)를 쌓지 않고, 1px 헤어라인 구분선(`--borderColor-muted`)과 타이포그래피 위계로 정보를 정리합니다.
- **장식용 좌측 컬러 강조선·문장 내 필 하이라이트 금지**: 소개 문단이나 공지 행에 `border-left: 3px solid accent` 강조선이나 본문 중간의 파란 둥근 알약(`border-radius: 999px`) 강조를 남발하지 않습니다. (`accent-left-stripe`, `pill-highlight`)
- **아이콘·영문 대문자 라벨 남발 금지**: `Sparkles` 등 AI 클리셰 아이콘이나 한국어 인터페이스 사이에 어색하게 섞인 영문 대문자 마이크로 라벨(`CONTACT`, `CALENDAR` 등)을 지양하고, 한국어 중심의 담백한 라벨을 사용합니다. (`english-caps-label`)
- **배지 색채 절제**: 일반 게시판 구분 배지는 중립(`secondary`) 톤을 기본으로 두고, 유채색(`danger`/`success`/`accent`)은 공지·모집 상태·핵심 CTA 등 실제 의미가 있는 신호에만 제한합니다.

### 4.2 전북대 메일 입력
- 로그인, 로그인 모달, 회원가입, 비밀번호 찾기의 아이디 칸은 [`JbnuEmailInput`](./frontend/src/Components/Utils/JbnuEmailInput.tsx)만 씁니다.
- 사용자는 아이디만 입력하고 `@jbnu.ac.kr`은 지울 수도 선택할 수도 없는 고정 접미사입니다. placeholder는 `학교메일`로 두어 빈 칸이 `학교메일@jbnu.ac.kr`로 읽히게 합니다.
- 사용자가 `@jbnu.ac.kr`을 직접 치면 친 글자가 접미사와 겹쳐 채워지고, 도메인과 다른 글자는 받지 않습니다. 서버로는 항상 `아이디@jbnu.ac.kr` 한 번만 보냅니다.

---

### 4.3 글자 크기와 굵기 단계
컴포넌트 CSS의 `font-size`는 아래 토큰만 씁니다(`frontend/src/index.css`). 한 화면에서는 보통 4~5단계, 많아도 7단계까지만 쓰고 소수점 크기는 만들지 않습니다. (`font-size-token`)

| 토큰 | 크기 | 쓰는 곳 |
|---|---|---|
| `--text-micro` | 11px | 알림 숫자 배지, 모바일 달력 칸 일정 |
| `--text-caption` | 12px | 날짜, 조회수, 보조 설명, 배지 |
| `--text-label` | 13px | 라벨, 작은 버튼, 메타 정보, 크기를 정하지 않은 기본 버튼과 입력창 |
| `--text-ui` | 14px | 메뉴, 입력창, 목록 본문 |
| `--text-body` | 15px | 읽는 본문 |
| `--text-lead` | 16px | 카드 제목, 강조 문장 |
| `--text-title-s` | 18px | 작은 섹션 제목, 게시글 본문 h3 |
| `--text-title` | 20px | 화면 제목, 게시글 본문 h2 |
| `--text-title-l` | 24px | 큰 제목, 숫자 강조, 게시글 본문 h1 |
| `--text-display` | 32px | 프로필 이름 등 가장 큰 글자 |

- 본문 기본 크기는 `--font-size-base`(모바일 14px, 데스크톱 15px)를 그대로 씁니다.
- 굵기는 400, 500, 600, 700 네 단계입니다. "JBIG" 글자 로고만 800을 씁니다. (`font-weight-scale`)
- 예외(사유 주석 필수): 첫 화면 큰 제목의 화면 폭 비례 크기(`clamp`), 이력서 인쇄용 pt, 노션 문서 보기의 원본 비율, 이력서 전용 `--resume-fs-*` 크기, 본문 안 코드처럼 부모 기준 `em`/`%`.
- 참고 근거(2026-11-23 실측): 당근 13·14·16·20px, velog 12·14·16·18px, Apple WWDC 12·14·17·21·28px. 모두 정수 크기이고 화면당 4~6단계입니다.

## 5. 이미지 및 미디어 최적화 규칙
- **HDR 배경 감광 방지**: [`frontend/src/index.css`](./frontend/src/index.css)의 전역 `img { dynamic-range-limit: standard; }` 규칙을 반드시 유지합니다. (`hdr-limit`)
- **업로드 최적화 경로 유지**: 모든 이미지 업로드는 `uploadAttachment` → [`optimizeImageForUpload`](./frontend/src/Utils/imageOptimize.ts)를 거칩니다.
  - 긴 변 최대 `2560px`, sRGB 2D 캔버스, 고화질 WebP(`quality: 0.92`) 변환으로 화질을 유지하면서 HDR Gain Map 및 EXIF(GPS)를 자동 제거
  - GIF·애니메이션 WebP·APNG·SVG는 원본 유지, WebP 미지원 시 알파 가능 포맷은 PNG 폴백
- **렌더링 최적화**: 본문·목록·사진첩 `<img>`에는 `loading="lazy"`와 `decoding="async"`를 적용합니다. 첫 화면 로고처럼 즉시 보여야 하는 이미지는 사유 주석과 함께 예외로 둡니다. (`img-lazy`)

---

## 6. 시맨틱 HTML·접근성·스타일 작성 규칙
- 페이지 이동은 `<Link>`/`<a>`, 동작 트리거는 `<button type="button">`을 사용합니다. (`<div onClick>` / `<span onClick>` 금지) (`clickable-div`)
- 아이콘 전용 버튼에는 명확한 `aria-label`, 장식용 아이콘에는 `aria-hidden="true"`를 지정합니다.
- 모바일에서 누르는 버튼, 링크는 높이(또는 폭) 24px 이상입니다(WCAG 2.2 2.5.8). 문장 속 링크는 예외입니다. 작은 글자 버튼은 모양을 바꾸지 않고 `min-height`만 줍니다(`shared.css` 7절).
- 모달/다이얼로그는 `role="dialog"`, `aria-modal="true"`, `ESC` 닫기, 닫힘 시 트리거 요소로 포커스 복원을 지킵니다.
- 스타일은 전용 CSS 파일에 작성하고, 런타임 동적 계산값(예: 진행률 바 너비, 이벤트 색상 변수 등)을 제외한 정적 인라인 `style={{}}` 작성을 지양합니다. (`inline-style-static`)
- `console.log` 디버그 코드를 커밋하지 않습니다. (`console-log`)

---

## 7. PR 전 UI 셀프 체크리스트
- [ ] 신규/수정 CSS에 하드코딩 `border-radius` px가 없는가? (일반 카드 `var(--radius-md)`, 모달/오버레이만 `var(--radius-lg)`)
- [ ] 중첩 카드(Card-in-Card), 좌측 컬러 강조선, 문장 내 알약 배지, 불필요한 장식 아이콘이 없는가?
- [ ] 라이트 모드와 다크 모드 모두 텍스트·보더·배경 대비가 자연스러운가?
- [ ] 모바일(`375px`)과 데스크톱(`1280px+`)에서 가로 스크롤이나 요소 겹침이 없는가?
- [ ] 새로 추가한 이미지 렌더링에 `loading="lazy" decoding="async"`가 적용되었는가?
- [ ] `npx tsc --noEmit`, `npm test -- --watchAll=false`, `CI=true npm run build`가 모두 통과하는가? (`npm test`에 8절 자동 검사가 포함됩니다)

---

## 8. 자동 검사 (`frontend/src/design/designLint.ts`)

아래 규칙은 `npm test`(또는 `npm run lint:design`)에서 코드로 판정합니다. 대상은 `frontend/src`의 CSS, TSX/TS(테스트 제외), `public/index.html`, `package.json`입니다.

- **기준선 래칫**: 2026-11-23 기준으로 이미 있던 위반은 `frontend/src/design/design-lint-baseline.json`에 규칙별, 파일별 개수로 고정했습니다. 어느 파일이든 위반 개수가 늘거나 새 위반이 생기면 테스트가 실패합니다. 고쳐서 줄면 기준선을 낮춥니다(`UPDATE_DESIGN_BASELINE=1 npm run lint:design`).
- **예외**: 위반 줄 바로 위(또는 같은 줄)에 `design-lint-allow <규칙ID>: <사유>` 주석을 달면 그 줄만 통과합니다. 사유가 없거나 너무 짧으면 인정하지 않습니다.
- 이 표의 규칙 ID 목록과 엔진의 규칙 목록은 테스트가 서로 대조합니다.

| 규칙 ID | 절 | 판정 |
|---|---|---|
| `radius-token` | 2 | `border-radius`가 `var(--radius-sm/md/lg)`, `999px`, `50%`, `0`(과 그 조합)이 아니면 위반 |
| `radius-fallback` | 2 | `var(--borderRadius-*, 값)`, `var(--radius-*, 값)`처럼 폴백을 붙이면 위반 |
| `radius-lg-overlay` | 2 | `--radius-lg`를 modal, dialog, overlay, dropdown, popup, popover, menu, toast, sheet, tooltip, lightbox, backdrop 이 아닌 선택자에 쓰면 위반 |
| `raw-color` | 3.3 | 색 속성(color, background, border, outline, fill, stroke, box-shadow 등)에 원시 hex/rgb/hsl이 있으면 위반. `var(--토큰, 폴백)`의 폴백은 제외, `src/index.css`는 제외 |
| `outline-none` | 3.3 | `outline: none` 또는 `outline: 0` |
| `undefined-var` | 1 | Primer 테마, 앱 CSS, 코드 어디에도 정의되지 않은 `var(--x)` 참조 |
| `accent-left-stripe` | 4.1 | `border-left: 2px 이상 solid var(--…-accent/success/danger/attention…)` |
| `pill-highlight` | 4.1 | `highlight`, `topic` 선택자에 `999px` |
| `breakpoint` | 4 | `@media (min-width: 768px)`, `(max-width: 767px)` 외의 너비 기준점 |
| `important` | 4 | `!important` (`prefers-reduced-motion` 블록 제외) |
| `inline-style-static` | 6 | `style={{}}` 안의 정적 px, 숫자, 색 리터럴 |
| `clickable-div` | 6 | `<div onClick>`, `<span onClick>` |
| `img-lazy` | 5 | `<img>`에 `loading="lazy"`와 `decoding="async"` 중 하나라도 없음 |
| `console-log` | 6 | 테스트가 아닌 코드의 `console.log(` |
| `mdeditor-light` | 3.1 | `data-color-mode="light"` 하드코딩 |
| `primer-button-inner` | 3.3 | `<Button>` 바로 안에 `className="*-inner"` span |
| `english-caps-label` | 4.1 | JSX 텍스트로 4자 이상 영문 대문자 단어(JBIG, JBNU, HTML, API, RMSE 등 고유명사 제외) |
| `forbidden-library` | 1 | `package.json`에 bootstrap, jquery 계열 의존성 |
| `pretendard` | 4 | `index.html`의 Pretendard 로드, `--font-sans` 첫 글꼴, `:root`의 Primer `--fontStack-system` 첫 글꼴 지정 중 하나라도 사라짐 |
| `hdr-limit` | 5 | `index.css`의 `img { dynamic-range-limit: standard }`가 사라짐 |
| `font-size-token` | 4.3 | 컴포넌트 CSS의 `font-size`에 px, rem, pt 숫자를 직접 씀 (`var(--text-*)`, `var(--font-size-*)`, `em`, `%`, `inherit`만 허용) |
| `font-weight-scale` | 4.3 | `font-weight`가 400, 500, 600, 700이 아님 |

---

## 9. 초기 디자인 기준선 (2026-11-23 실측)

`main`(`771bbd19e`)을 로컬 시드 데이터로 띄워 헤드리스 브라우저로 측정했습니다. 화면 7개(홈, 게시판 목록, 게시글 상세, 글쓰기, 프로필, 검색, 관리자) × 너비 2개(1440px, 375px) × 테마 3개(light, dark_dimmed, dark) = 42개 측정입니다.

### 9.1 배치와 영역 (데스크톱 1440px)
| 영역 | 위치·크기 | 면 | 테두리·라운드 |
|---|---|---|---|
| 헤더 | 전체 폭, 높이 60px | `--bgColor-default` | 하단 1px |
| 홈 배너 | x 104, 폭 1232, 높이 186 (홈에서만) | 배너 이미지 | 1px, 6px |
| 사이드바 | x 104, 폭 248 | `--bgColor-default` | 1px, 6px |
| 본문 열 | x 376, 폭 960 (사이드바와 간격 24px) | 투명(캔버스 위) | 없음 |
| 홈 소개 카드 | 본문 열 전체 폭, 높이 약 408 | `--bgColor-default` | 1px, 6px |
| 게시글 목록 카드 | 본문 열 전체 폭 | `--bgColor-default` | 1px, 6px |
| 푸터 | 전체 폭 | 캔버스 | 상단 1px muted |

- 페이지 바탕은 `--bgColor-inset`(라이트 #f6f8fa), 그 위 카드는 흰색입니다. 바탕 면적의 약 94%가 흰 카드, 6%가 회색 보조 면입니다.
- 콘텐츠 폭은 `--max-content-width` 1280px 안에서 좌우 24px 여백을 둔 1232px입니다.

### 9.2 배치와 영역 (모바일 375px)
- 헤더 54~56px, 사이드바 대신 햄버거 메뉴(`MobileNav`).
- 좌우 여백 12px, 배너 높이 126px, 카드는 화면 폭 351px.
- 게시글 목록은 표 대신 행마다 카드형으로 바뀝니다.

### 9.3 채색과 채도
| 지표 | 범위(42개 측정) | 의미 |
|---|---|---|
| 유채색 배경 면적 | 0 ~ 4.2% | 공지 행 노랑, 오늘 날짜 원, 버튼만 유채색 면 |
| 유채색 글자 비율 | 0 ~ 17% | 링크, 작성자, 캘린더 주말, 상태 글자 |
| 화면당 배경색 종류 | 4 ~ 9 | 다크 테마에서 1~3종 늘어남(오버레이 보정) |

### 9.4 밀도와 타이포그래피
- 본문 행간 비율은 화면 평균 1.34 ~ 1.45입니다.
- 텍스트가 차지하는 면적은 데스크톱 2 ~ 9%, 모바일 4 ~ 19%입니다.
- **화면당 글자 크기 종류가 6 ~ 12개**입니다(11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 17, 19, 20, 22, 28, 32, 36px). 소수점 크기(11.5, 12.5, 13.5, 14.5px)와 중간 굵기(450, 800)가 섞여 있어 정리 대상입니다(9.6).
- 굵기: 400, 500, 600, 700이 주로 쓰이고 450, 800이 일부 있습니다.

### 9.5 대비 (WCAG AA)
- light, dark: 화면당 1~2건이며 모두 의도된 요소입니다(푸터 구분점 `·`, 비활성 버튼).
- **dark_dimmed: 홈 29건, 목록·상세 4건** — 캘린더 일·토요일 색, 작성자 링크(`--fgColor-accent` #478be6), 문의 이메일이 #212830 위에서 4.0 ~ 4.33으로 4.5에 못 미칩니다. → 2026-11-23 보정 후 0건(3.3절).

### 9.6 기준선에서 확인된 정리 대상
아래는 이 기준선을 시작점으로 순서대로 정리합니다. 정리할 때마다 8절 기준선 숫자가 줄어야 합니다.
1. **같은 기능의 중복 CSS 통합**: 인증 화면 4종(로그인, 회원가입, 비밀번호 찾기, 비밀번호 변경)의 래퍼, 입력창, 비밀번호 보기 토글, 로고, 링크 / 모달 닫기 버튼 3벌과 배경막 2벌 / 스켈레톤 반짝임 애니메이션 3~4벌 / 말줄임 텍스트 유틸.
2. **포커스 표시**: 입력창 18곳의 `outline: none`을 토큰 기반 포커스 링으로 교체.
3. ~~**글자 크기와 굵기 스케일**~~: 2026-11-23 완료(4.3절). 화면당 글자 크기 8~11종 → 5~7종.
4. ~~**dark_dimmed 대비**~~: 2026-11-23 완료(3.3절). 기준 미달 91건 → 0건.
5. **`!important` 124곳, 기준점 밖 미디어 쿼리 12곳, 원시 색 16곳, `<div onClick>` 19곳, lazy 누락 `<img>` 14곳, 정의 안 된 변수 1곳** 축소.

---

## 10. 변경 이력
- 2026-11-23: ego lite로 화면 106개(테마 3종, 데스크톱/모바일, 로그인/로그아웃, 모달과 메뉴 동작) 요소 전수 점검. 모바일 터치 대상 24px 미만 12곳과 프로필 편집 소수점 글자 크기 1곳을 고쳐 문제 0건.
- 2026-11-23: 다크 딤드 글자 대비 보정(링크, 위험, 보조 글자 토큰 밝기). 테마 3종 x 화면 9개 x 너비 2개 실측 기준 미달 91건 → 0건, 라이트와 다크는 변화 없음.
- 2026-11-23: 글자 크기 10단계 토큰(`--text-*`)과 굵기 4단계 도입(4.3절), 소수점 크기 42곳과 450 굵기 정리, `font-size-token`, `font-weight-scale` 검사 추가.
- 2026-11-23: Primer BaseStyles 때문에 앱 본문에 Pretendard가 적용되지 않던 문제(한글이 맑은 고딕으로 표시)를 Primer 글꼴 토큰 덮어쓰기로 해결하고 `pretendard` 검사에 추가.
- 2026-11-23: #81 화면을 초기 디자인 기준선으로 지정. YAML 토큰 머리말, 테마별 토큰 표, 8절 자동 검사, 9절 실측 기준선, 4.2절 전북대 메일 입력 추가. 기존 1~7절 규칙은 그대로 유지하고 각 규칙에 검사 ID를 표시.
