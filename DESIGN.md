# JBIG Web Platform Design Guidelines (`DESIGN.md`)

> 이 문서는 JBIG 웹 플랫폼(`frontend/`)의 **단일 UI/UX 디자인 기준(Single Source of Truth)**입니다.  
> 사람 기여자 및 모든 AI 에이전트(Claude, Codex, Antigravity, Cursor, CodeRabbit 등)는 UI·CSS·컴포넌트 수정 시 반드시 이 가이드라인을 준수해야 합니다.

---

## 1. 디자인 시스템 기반
- **표준 시스템**: **GitHub Primer** (`@primer/react` + `@primer/primitives`)
- **테마**: `ThemeProvider` + `BaseStyles` 기반 **라이트/다크 모드 자동 대응**
- **전역 토큰 브리지**: [`frontend/src/index.css`](./frontend/src/index.css)
- **금지 라이브러리**: Bootstrap, jQuery UI 등 전역 CSS를 오염시키는 UI 프레임워크·스타일시트 추가 금지

---

## 2. 코너 라운드 (`border-radius`) 규칙 — 엄격 적용

모든 요소의 모서리는 [`frontend/src/index.css`](./frontend/src/index.css)에 정의된 **Primer 3단계 토큰**만 사용합니다.  
**임의 픽셀 값(`2px`, `3px`, `4px`, `6px`, `8px`, `12px` 등) 하드코딩을 금지**합니다.

| 토큰 / 값 | 실제 크기 | 허용 대상 |
|---|---|---|
| `var(--radius-md)` | `6px` (`--borderRadius-medium`) | **기본 표준.** 모든 페이지 카드, 배너, 사이드바, 게시판 목록/상세/글쓰기, 댓글 박스, 프로필 섹션, 검색·관리자·인증 컨테이너, 버튼, 입력창, 탭, 코드 블록, 본문 이미지 |
| `var(--radius-sm)` | `3px` (`--borderRadius-small`) | 작은 인라인 코드, 검색 `/` 단축키 칩, 캘린더 이벤트 바, 작은 강조선·스켈레톤 바 |
| `var(--radius-lg)` | `12px` (`--borderRadius-large`) | **플로팅 모달·다이얼로그·드롭다운 오버레이·팝업 전용** (`--overlay-bgColor`와 함께 사용) |
| `999px` | Pill | 상태 배지, 필터 칩, 태그, 스크롤바 썸, 좌측 액티브 인디케이터 |
| `50%` | 원형 | 아바타, 원형 아이콘 버튼, 상태 도트 |
| `0` | 직각 | 테이블 셀, 풀-블리드 구분 영역 |

### 주의사항
- 일반 페이지 카드(배너, 사이드바, 게시판 컨테이너, 폼 카드 등)에 `var(--radius-lg)` 또는 `12px`를 사용하지 않습니다.
- `var(--borderRadius-medium, 8px)`처럼 임의 폴백을 섞지 않고 `var(--radius-md)`로 통일합니다.
- 카드 내부 헤더처럼 상단 모서리만 둥글어야 하는 경우 `var(--radius-md) var(--radius-md) 0 0`을 사용하거나 부모 카드에 `overflow: hidden`을 적용합니다.

---

## 3. 색상 및 다크모드 규칙
- **하드코딩 색상 금지**: `#ffffff`, `#000000`, `#333333` 등 원시 hex를 단독으로 쓰지 말고, 반드시 Primer 시맨틱 토큰(또는 `index.css` 브리지 변수)을 사용합니다.
  - 텍스트: `var(--fgColor-default)`, `var(--fgColor-muted)`, `var(--fgColor-accent)`, `var(--fgColor-danger)`, `var(--fgColor-success)`, `var(--fgColor-attention)`, `var(--fgColor-onEmphasis)`
  - 배경: `var(--bgColor-default)`, `var(--bgColor-muted)`, `var(--bgColor-inset)`, `var(--bgColor-neutral-muted)`, `var(--bgColor-accent-muted)`, `var(--bgColor-accent-emphasis)`, `var(--overlay-bgColor)`
  - 보더: `var(--borderColor-default)`, `var(--borderColor-muted)`, `var(--borderColor-emphasis)`
- 라이트/다크 양쪽에서 텍스트 대비 **WCAG AA(4.5:1 이상)** 를 유지합니다.
- 포커스 스타일은 전역 `:focus-visible` (`var(--focus-outlineColor, #0969da)`)를 유지하며 `outline: none`으로 제거하지 않습니다.

---

## 4. 레이아웃·타이포그래피·반응형
- **모바일 퍼스트**: 기본 스타일은 모바일, `@media (min-width: 768px)` 이상에서 데스크톱 확장
- **핵심 레이아웃 토큰**:
  - `--max-content-width: 1280px`
  - `--header-height`: 모바일 `56px`, 데스크톱 `60px`
  - `--sidebar-width`: 데스크톱 `248px`
- **그림자**: 기본 카드 `var(--shadow-sm)`, 드롭다운/모달 등 플로팅 오버레이 `var(--shadow-md)` ~ `var(--shadow-lg)`
- **숫자 정렬**: 카운터·날짜·순위·통계·페이지 번호에는 `font-variant-numeric: tabular-nums` 적용
- **긴 텍스트 보호**: 닉네임·제목·URL 등은 `min-width: 0`, `overflow-wrap: anywhere` 또는 `text-overflow: ellipsis`로 모바일 가로 넘침 방지

---

## 5. 이미지 및 미디어 최적화 규칙
- **HDR 배경 감광 방지**: [`frontend/src/index.css`](./frontend/src/index.css)의 전역 `img { dynamic-range-limit: standard; }` 규칙을 반드시 유지합니다. (맥북 XDR/EDR·모바일 HDR 화면에서 사진 바깥 웹페이지가 회색으로 어두워지는 현상 방지)
- **업로드 최적화 경로 유지**: 모든 이미지 업로드는 `uploadAttachment` → [`optimizeImageForUpload`](./frontend/src/Utils/imageOptimize.ts)를 거칩니다.
  - 긴 변 최대 `2560px`, sRGB 2D 캔버스, 고화질 WebP(`quality: 0.92`) 변환으로 화질을 유지하면서 HDR Gain Map 및 EXIF(GPS)를 자동 제거
  - GIF·애니메이션 WebP·APNG·SVG는 원본 유지, WebP 미지원 시 알파 가능 포맷은 PNG 폴백
- **렌더링 최적화**: 본문·목록·사진첩 `<img>`에는 `loading="lazy"`와 `decoding="async"`를 적용합니다.

---

## 6. 시맨틱 HTML·접근성·스타일 작성 규칙
- 페이지 이동은 `<Link>`/`<a>`, 동작 트리거는 `<button type="button">`을 사용합니다. (`<div onClick>` / `<span onClick>` 금지)
- 아이콘 전용 버튼에는 명확한 `aria-label`, 장식용 아이콘에는 `aria-hidden="true"`를 지정합니다.
- 모달/다이얼로그는 `role="dialog"`, `aria-modal="true"`, `ESC` 닫기, 닫힘 시 트리거 요소로 포커스 복원을 지킵니다.
- 스타일은 전용 CSS 파일에 작성하고, 런타임 동적 계산값(예: 진행률 바 너비, 이벤트 색상 변수 등)을 제외한 정적 인라인 `style={{}}` 작성을 지양합니다.
- `console.log` 디버그 코드를 커밋하지 않습니다.

---

## 7. PR 전 UI 셀프 체크리스트
- [ ] 신규/수정 CSS에 하드코딩 `border-radius` px가 없는가? (일반 카드 `var(--radius-md)`, 모달/오버레이만 `var(--radius-lg)`)
- [ ] 라이트 모드와 다크 모드 모두 텍스트·보더·배경 대비가 자연스러운가?
- [ ] 모바일(`375px`)과 데스크톱(`1280px+`)에서 가로 스크롤이나 요소 겹침이 없는가?
- [ ] 새로 추가한 이미지 렌더링에 `loading="lazy" decoding="async"`가 적용되었는가?
- [ ] `npx tsc --noEmit`, `npm test -- --watchAll=false`, `CI=true npm run build`가 모두 통과하는가?
