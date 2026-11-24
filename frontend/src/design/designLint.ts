/**
 * DESIGN.md 규칙 자동 검사 엔진.
 *
 * - 규칙 ID는 DESIGN.md "8. 자동 검사" 표와 1:1로 대응한다. 규칙을 바꾸면 두 곳을 함께 고친다.
 * - 검사 대상: frontend/src 의 CSS, TSX/TS(테스트 제외), public/index.html, package.json.
 * - 예외: 위반 줄 바로 위(또는 같은 줄)에 `design-lint-allow <규칙ID>: <사유>` 주석이 있으면 통과.
 *   사유가 비어 있으면 예외로 인정하지 않는다.
 * - 이 파일은 테스트(designLint.test.ts)와 `npm run lint:design`에서만 쓰이고 앱 번들에는 들어가지 않는다.
 */
import fs from "fs";
import path from "path";

export type Severity = "error";
export interface Violation {
    rule: string;
    file: string;
    line: number;
    message: string;
}

export interface RuleInfo {
    id: string;
    section: string;
    summary: string;
}

/** DESIGN.md 8절과 같은 목록. 문서와 엔진이 어긋나지 않도록 테스트가 대조한다. */
export const RULES: RuleInfo[] = [
    { id: "radius-token", section: "2", summary: "border-radius는 --radius-sm/md/lg 토큰, 999px, 50%, 0만 허용" },
    { id: "radius-fallback", section: "2", summary: "radius 토큰에 임의 폴백 금지 (var(--borderRadius-*, 8px) 등)" },
    { id: "radius-lg-overlay", section: "2", summary: "--radius-lg는 모달, 다이얼로그, 드롭다운, 팝업, 오버레이 전용" },
    { id: "raw-color", section: "3.3", summary: "색 속성의 원시 hex/rgb/hsl 금지 (토큰 정의 파일 index.css 제외)" },
    { id: "outline-none", section: "3.3", summary: "outline: none/0으로 포커스 표시 제거 금지" },
    { id: "undefined-var", section: "1", summary: "정의되지 않은 CSS 변수 참조 금지" },
    { id: "accent-left-stripe", section: "4.1", summary: "장식용 좌측 컬러 강조선(border-left 2px 이상 유채색) 금지" },
    { id: "pill-highlight", section: "4.1", summary: "본문 하이라이트용 알약(999px) 금지" },
    { id: "breakpoint", section: "4", summary: "반응형 기준점은 min-width 768px / max-width 767px만" },
    { id: "important", section: "6", summary: "!important 금지" },
    { id: "inline-style-static", section: "6", summary: "정적 값(px, 색)을 넣은 인라인 style={{}} 금지" },
    { id: "clickable-div", section: "6", summary: "<div onClick>, <span onClick> 금지" },
    { id: "img-lazy", section: "5", summary: "<img>에 loading=\"lazy\"와 decoding=\"async\" 필수" },
    { id: "console-log", section: "6", summary: "console.log 커밋 금지" },
    { id: "mdeditor-light", section: "3.1", summary: "MDEditor 등 data-color-mode=\"light\" 하드코딩 금지" },
    { id: "primer-button-inner", section: "3.3", summary: "Primer <Button> 안에 *-inner span 중첩 금지 (leadingVisual 사용)" },
    { id: "english-caps-label", section: "4.1", summary: "영문 대문자 마이크로 라벨(CONTACT, CALENDAR 등) 금지" },
    { id: "forbidden-library", section: "1", summary: "Bootstrap, jQuery 등 전역 CSS 라이브러리 금지" },
    { id: "pretendard", section: "4", summary: "index.html의 Pretendard 로드와 --font-sans 최우선 지정 유지" },
    { id: "hdr-limit", section: "5", summary: "전역 img { dynamic-range-limit: standard } 유지" },
    { id: "font-size-token", section: "4.3", summary: "글자 크기는 --text-* 토큰(또는 em, %, inherit)만, px·rem·pt 직접 지정 금지" },
    { id: "font-weight-scale", section: "4.3", summary: "글자 굵기는 400, 500, 600, 700만 (글자 로고 800은 허용 주석)" },
    { id: "spacing-token", section: "4.4", summary: "padding, margin, gap의 2~48px 값은 --space-* 토큰으로 (1px 선, 48px 초과 배치 치수, calc 제외)" },
];

const RULE_IDS = new Set(RULES.map(r => r.id));

const walk = (dir: string, exts: string[]): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === "node_modules" || e.name === "build" ? [] : walk(p, exts);
        return exts.some(x => e.name.endsWith(x)) ? [p] : [];
    });
};

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

const hasAllow = (text: string, rule: string) => {
    const m = text.match(/design-lint-allow\s+([a-z-]+)\s*:\s*(.*?)\s*(\*\/|$)/);
    return !!m && m[1] === rule && m[2].replace(/\*\/.*/, "").trim().length >= 4;
};
/**
 * 줄 전체가 주석인가. `/* 허용 *\/ color: #fff;` 처럼 주석 뒤에 코드가 있으면 주석만 있는 줄이 아니다.
 * (여러 줄 주석의 가운데 줄 ` * ...`, 끝줄 ` *\/` 도 주석만 있는 줄로 본다)
 */
const isCommentOnlyLine = (text: string) => {
    const t = text.trim();
    if (t.startsWith("//")) return true;
    const closeAfter = (open: string, close: string) => {
        const end = t.indexOf(close, open.length);
        return end < 0 || t.slice(end + close.length).trim() === "";
    };
    if (t.startsWith("{/*")) return closeAfter("{/*", "*/}");
    if (t.startsWith("/*")) return closeAfter("/*", "*/");
    if (t.startsWith("*")) return closeAfter("", "*/");
    return false;
};

/**
 * 위반 줄에 사유가 있는 허용 주석이 있거나, 바로 위(최대 3줄)에 주석만 있는 줄로 허용 주석이 있는가.
 * 윗줄에 코드가 있으면 그 줄의 허용 주석은 그 줄 것이므로 여기에 적용하지 않고 스캔을 멈춘다.
 */
const isAllowed = (lines: string[], line: number, rule: string) => {
    if (hasAllow(lines[line - 1] || "", rule)) return true;
    for (let l = line - 2; l >= Math.max(0, line - 4); l--) {
        const text = lines[l] || "";
        if (!text.trim()) continue;
        if (!isCommentOnlyLine(text)) break;
        if (hasAllow(text, rule)) return true;
    }
    return false;
};

/**
 * JSX 여는 태그의 끝(>) 위치를 찾는다. 속성 문자열, {..} 표현식 안의 문자열·템플릿 문자열(${..} 포함)·
 * 주석(// , /* *\/)·화살표(=>)·안쪽 JSX 의 > 는 태그 끝이 아니다.
 * 표현식 안의 따옴표는 값이 시작될 자리(연산자, 괄호 뒤 등)에 있을 때만 문자열로 본다.
 * 그래서 안쪽 JSX 글자(<b>user's</b>)나 주석 속 따옴표를 문자열 시작으로 오인하지 않는다.
 */
const jsxTagEnd = (text: string, start: number) => {
    const stack: ("expr" | "tpl")[] = [];
    // 따옴표 앞 토큰이 값이 시작될 자리인가: 연산자·괄호 뒤, 또는 값을 받는 키워드(return, typeof 등) 뒤.
    // 키워드는 단어 전체로 비교한다(join's 처럼 키워드로 끝나는 식별자는 아님).
    const VALUE_KEYWORDS = new Set(["return", "typeof", "case", "yield", "await", "throw", "void", "in", "of", "instanceof", "new", "delete", "else", "do"]);
    const isValueStart = (k: number) => {
        let j = k - 1;
        while (j > start && /\s/.test(text[j])) j--;
        if (j <= start) return true;
        const c = text[j];
        if (/[(,=:[{?+\-*%!&|;>}]/.test(c)) return true;
        if (!/[A-Za-z0-9_$]/.test(c)) return false;
        let w = j;
        while (w > start && /[A-Za-z0-9_$]/.test(text[w - 1])) w--;
        if (w > start && text[w - 1] === ".") return false; // obj.return 같은 속성 이름
        return VALUE_KEYWORDS.has(text.slice(w, j + 1));
    };
    const skipString = (i: number, q: string) => {
        for (let j = i + 1; j < text.length; j++) {
            if (text[j] === "\\") { j++; continue; }
            if (text[j] === q || text[j] === "\n") return j + 1;
        }
        return text.length;
    };
    let i = start + 1;
    while (i < text.length) {
        const ch = text[i];
        const top = stack[stack.length - 1];
        if (top === "tpl") {
            if (ch === "\\") i += 2;
            else if (ch === "`") { stack.pop(); i++; }
            else if (ch === "$" && text[i + 1] === "{") { stack.push("expr"); i += 2; }
            else i++;
            continue;
        }
        if (top === "expr") {
            if (ch === "/" && text[i + 1] === "/") { const nl = text.indexOf("\n", i); i = nl < 0 ? text.length : nl; continue; }
            if (ch === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; continue; }
            if (ch === "`") { stack.push("tpl"); i++; continue; }
            if ((ch === '"' || ch === "'") && isValueStart(i)) { i = skipString(i, ch); continue; }
            if (ch === "{") stack.push("expr");
            else if (ch === "}") stack.pop();
            i++;
            continue;
        }
        // 태그의 속성 자리
        if (ch === '"' || ch === "'") { const e = text.indexOf(ch, i + 1); i = e < 0 ? text.length : e + 1; continue; }
        if (ch === "{") { stack.push("expr"); i++; continue; }
        if (ch === ">") return i;
        i++;
    }
    return text.length - 1;
};

/** CSS에서 주석을 같은 길이의 공백으로 바꿔 줄 번호를 유지한다 */
const blankComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));

const COLOR_PROP = /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|caret-color|text-decoration-color|box-shadow|column-rule(-color)?)$/;
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/;
const OVERLAY_SELECTOR = /modal|dialog|overlay|dropdown|popup|popover|menu|toast|sheet|tooltip|lightbox|backdrop/i;
/** name(...) 호출을 괄호 짝을 맞춰 통째로 지운다 (예: calc(100% - 8px)) */
const stripCalls = (v: string, name: string) => {
    let out = "", i = 0;
    while (i < v.length) {
        const at = v.indexOf(name + "(", i);
        if (at < 0 || /[\w-]/.test(v[at - 1] || "")) { out += v.slice(i); break; }
        out += v.slice(i, at) + " ";
        let depth = 0, j = at + name.length;
        for (; j < v.length; j++) {
            if (v[j] === "(") depth++;
            else if (v[j] === ")" && --depth === 0) break;
        }
        i = j + 1;
    }
    return out;
};

/** 규칙을 감싼 @media 중 하나라도 인쇄 전용(모든 쿼리가 print, not print 아님)인가 */
const isPrintOnly = (stack: string[]) =>
    stack.filter(s => /^@media\b/.test(s)).some(m =>
        m.replace(/^@media\s*/, "").split(",").every(q => /^\s*(only\s+)?print\b/i.test(q)));

/** 자체 스타일(인라인 포함)을 넣어 !important 없이는 덮을 수 없는 외부 라이브러리 요소 */
const THIRD_PARTY_SELECTOR = /\.(w-md-editor|wmde-markdown|react-datepicker|notion)/;
const RADIUS_OK =/^(var\(--radius-(sm|md|lg)\)|999px|50%|0)$/;

export interface LintResult {
    violations: Violation[];
    filesScanned: number;
}

export function lintDesign(frontendRoot: string): LintResult {
    const src = path.join(frontendRoot, "src");
    const rel = (f: string) => path.relative(frontendRoot, f).replace(/\\/g, "/");
    const violations: Violation[] = [];
    const push = (rule: string, file: string, line: number, message: string, lines: string[]) => {
        if (!RULE_IDS.has(rule)) throw new Error(`unknown rule ${rule}`);
        if (isAllowed(lines, line, rule)) return;
        violations.push({ rule, file: rel(file), line, message });
    };

    const cssFiles = walk(src, [".css"]);
    const codeFiles = walk(src, [".tsx", ".ts"]).filter(f => !/\.test\.tsx?$/.test(f) && !f.includes(`${path.sep}design${path.sep}`) && !f.endsWith("setupTests.ts"));

    // 정의된 CSS 변수: Primer 테마 + 앱 CSS + 런타임에 JS가 넣는 변수
    const defined = new Set<string>();
    const primerDir = path.join(frontendRoot, "node_modules", "@primer", "primitives", "dist", "css");
    for (const f of [...walk(primerDir, [".css"]), ...cssFiles])
        for (const m of Array.from(fs.readFileSync(f, "utf8").matchAll(/(--[A-Za-z0-9_-]+)\s*:/g))) defined.add(m[1]);
    for (const f of codeFiles)
        for (const m of Array.from(fs.readFileSync(f, "utf8").matchAll(/['"`](--[A-Za-z0-9_-]+)['"`]/g))) defined.add(m[1]);

    // ---------- CSS ----------
    for (const file of cssFiles) {
        const raw = fs.readFileSync(file, "utf8");
        const lines = raw.split(/\r?\n/);
        const css = blankComments(raw);
        const isTokenBridge = rel(file) === "src/index.css";

        // 선언 단위로 순회하면서 현재 선택자를 기억한다
        // 블록의 마지막 선언은 세미콜론 없이 } 로 끝날 수 있다
        const re = /([^{};]+)\{|\}|([a-zA-Z-]+)\s*:\s*([^;{}]+?)\s*(?:;|(?=\}))/g;
        const selectorStack: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(css))) {
            if (m[1] !== undefined) { selectorStack.push(m[1].trim()); continue; }
            if (m[0] === "}") { selectorStack.pop(); continue; }
            const prop = m[2].toLowerCase();
            const value = m[3].trim();
            const line = lineOf(css, m.index + m[0].indexOf(m[2]));
            const selector = selectorStack.filter(s => !s.startsWith("@")).join(" ");
            const atRules = selectorStack.filter(s => s.startsWith("@")).join(" ");
            if (prop.startsWith("--")) continue;

            // 예외: 동작 줄이기 전역 리셋, 인쇄 전용 스타일, 인라인 스타일을 넣는 외부 라이브러리 덮어쓰기
            // (선택자 목록은 모든 항목이 외부 라이브러리일 때만, 미디어는 인쇄 전용일 때만 예외)
            const ownSelector = selectorStack.filter(s => !s.startsWith("@")).slice(-1)[0] || "";
            // :not(...) 안의 클래스는 대상을 정하지 않으므로 빼고 본다
            const thirdPartyOnly = ownSelector.split(",").every(part => THIRD_PARTY_SELECTOR.test(part.replace(/:not\([^()]*(\([^()]*\))*[^()]*\)/g, "")));
            if (/important/.test(value) && !/prefers-reduced-motion/.test(atRules) && !isPrintOnly(selectorStack) && !thirdPartyOnly)
                push("important", file, line, `${prop}: ${value}`, lines);

            const v = value.replace(/\s*!important\s*$/, "");
            if (/radius$/.test(prop) || prop === "border-radius") {
                if (/var\(--(borderRadius|radius)-[a-z]+\s*,/.test(v)) push("radius-fallback", file, line, `${prop}: ${v}`, lines);
                const parts = v.split(/\s+/).filter(Boolean);
                if (!parts.every(p => RADIUS_OK.test(p))) push("radius-token", file, line, `${prop}: ${v}`, lines);
                if (/var\(--radius-lg\)/.test(v) && !OVERLAY_SELECTOR.test(selector))
                    push("radius-lg-overlay", file, line, `${selector} → ${v}`, lines);
                if (/^999px$/.test(v) && /highlight|topic|emphasis-inline/i.test(selector))
                    push("pill-highlight", file, line, `${selector}`, lines);
            }
            if (!isTokenBridge && COLOR_PROP.test(prop)) {
                const stripped = v.replace(/var\([^()]*(\([^()]*\))*[^()]*\)/g, "TOKEN");
                if (RAW_COLOR.test(stripped)) push("raw-color", file, line, `${prop}: ${v}`, lines);
            }
            if (/^outline$/.test(prop) && /^(none|0)\b/.test(v)) push("outline-none", file, line, `${selector}`, lines);
            if (!isTokenBridge && prop === "font-size") {
                const sizeStripped = v.replace(/var\([^()]*(\([^()]*\))*[^()]*\)/g, "TOKEN");
                if (/\d(px|rem|pt)\b/.test(sizeStripped)) push("font-size-token", file, line, `${selector} → ${v}`, lines);
            }
            if (!isTokenBridge && /^(padding|margin|gap|row-gap|column-gap)(-[a-z-]+)?$/.test(prop)) {
                // calc() 식과 var() 는 빼고 남은 직접값만 본다. 음수도 절댓값으로 범위를 판단한다.
                const spaceStripped = stripCalls(stripCalls(v, "calc"), "var");
                const raw = Array.from(spaceStripped.matchAll(/(?<![\w.])(-?\d+(?:\.\d+)?)px\b/g)).map(x => Math.abs(parseFloat(x[1])));
                if (raw.some(n => n > 1 && n <= 48)) push("spacing-token", file, line, `${selector} → ${prop}: ${v}`, lines);
            }
            if (prop === "font-weight" && /^\d+$/.test(v) && !["400", "500", "600", "700"].includes(v))
                push("font-weight-scale", file, line, `${selector} → ${v}`, lines);
            if (/^border-left$/.test(prop) && /^[2-9]px\s+solid\s+var\(--(fgColor|bgColor|borderColor)-(accent|success|danger|attention|done|severe)/.test(v))
                push("accent-left-stripe", file, line, `${selector}`, lines);
        }

        for (const mm of Array.from(css.matchAll(/var\((--[A-Za-z0-9_-]+)/g)))
            if (!defined.has(mm[1])) push("undefined-var", file, lineOf(css, mm.index!), mm[1], lines);

        // 복합 조건(@media (min-width: 600px) and (max-width: 767px))도 모든 너비 조건을 각각 검사한다
        for (const media of Array.from(css.matchAll(/@media([^{]*)\{/g))) {
            for (const mm of Array.from(media[1].matchAll(/\((min|max)-width:\s*(\d+)px\)/g))) {
                const [, kind, px] = mm;
                const ok = (kind === "min" && px === "768") || (kind === "max" && px === "767");
                if (!ok) push("breakpoint", file, lineOf(css, media.index!), `${kind}-width: ${px}px`, lines);
            }
        }

        if (isTokenBridge && !/img\s*\{[^}]*dynamic-range-limit:\s*standard/.test(css))
            push("hdr-limit", file, 1, "img { dynamic-range-limit: standard } 없음", lines);
        if (isTokenBridge && !/--font-sans:\s*'Pretendard Variable'/.test(css))
            push("pretendard", file, 1, "--font-sans 첫 글꼴이 Pretendard Variable이 아님", lines);
        // Primer BaseStyles가 앱 전체에 var(--fontStack-system)을 직접 지정하므로 토큰 자체가 Pretendard로 시작해야 한다
        if (isTokenBridge && !/:root\s*\{[^}]*--fontStack-system:\s*['"]Pretendard Variable['"]/.test(css))
            push("pretendard", file, 1, "Primer --fontStack-system 첫 글꼴이 Pretendard Variable이 아님 (앱 본문이 다른 글꼴로 표시됨)", lines);
    }

    // ---------- TSX/TS ----------
    for (const file of codeFiles) {
        const text = fs.readFileSync(file, "utf8");
        const lines = text.split(/\r?\n/);
        const at = (i: number) => lineOf(text, i);

        for (const mm of Array.from(text.matchAll(/style=\{\{([^{}]*)\}\}/g))) {
            const body = mm[1];
            // 런타임 값(변수, 함수 호출, 템플릿 문자열)은 허용, 정적 px·색 리터럴만 위반
            if (/['"][^'"]*(\d+px|#[0-9a-fA-F]{3,8}|rgba?\()[^'"]*['"]|:\s*\d+\s*[,}]/.test(body))
                push("inline-style-static", file, at(mm.index!), body.trim().slice(0, 80), lines);
        }
        for (const mm of Array.from(text.matchAll(/<(div|span)\b/g))) {
            const tag = text.slice(mm.index!, jsxTagEnd(text, mm.index!) + 1);
            if (/\bonClick=/.test(tag)) push("clickable-div", file, at(mm.index!), `<${mm[1]} onClick>`, lines);
        }
        for (const mm of Array.from(text.matchAll(/<img\b/g))) {
            const tag = text.slice(mm.index!, jsxTagEnd(text, mm.index!) + 1);
            if (!/loading=["{']?\s*["']?lazy/.test(tag) || !/decoding=["{']?\s*["']?async/.test(tag))
                push("img-lazy", file, at(mm.index!), tag.replace(/\s+/g, " ").slice(0, 80), lines);
        }
        for (const mm of Array.from(text.matchAll(/console\.log\(/g)))
            push("console-log", file, at(mm.index!), "console.log", lines);
        for (const mm of Array.from(text.matchAll(/data-color-mode=["']light["']/g)))
            push("mdeditor-light", file, at(mm.index!), 'data-color-mode="light"', lines);
        for (const mm of Array.from(text.matchAll(/<Button\b[^>]*>\s*<span[^>]*className=["'{][^"'}]*-inner/g)))
            push("primer-button-inner", file, at(mm.index!), "Button > span.*-inner", lines);
        if (file.endsWith(".tsx"))
            for (const mm of Array.from(text.matchAll(/>\s*([A-Z]{4,}(?:\s[A-Z]{2,})*)\s*</g)))
                if (!/^(JBIG|JBNU|HTML|CSS|API|URL|PDF|RMSE|ADR|CSV|UTF|KST|GPT|AWS|SQL|ID|TRAIN|TEST)$/.test(mm[1]))
                    push("english-caps-label", file, at(mm.index!), mm[1], lines);
    }

    // ---------- index.html, package.json ----------
    const html = path.join(frontendRoot, "public", "index.html");
    if (fs.existsSync(html)) {
        const t = fs.readFileSync(html, "utf8");
        if (!/pretendard/i.test(t)) push("pretendard", html, 1, "index.html에서 Pretendard를 로드하지 않음", t.split(/\r?\n/));
    }
    const pkg = path.join(frontendRoot, "package.json");
    if (fs.existsSync(pkg)) {
        const p = JSON.parse(fs.readFileSync(pkg, "utf8"));
        const deps = { ...(p.dependencies || {}), ...(p.devDependencies || {}) };
        for (const name of Object.keys(deps))
            if (/^(bootstrap|jquery|jquery-ui|react-bootstrap|bulma|foundation-sites|semantic-ui-css)$/.test(name))
                violations.push({ rule: "forbidden-library", file: "package.json", line: 1, message: name });
    }

    violations.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
    return { violations, filesScanned: cssFiles.length + codeFiles.length };
}

/** 규칙별, 파일별 위반 수. 기준선(baseline) 비교에 쓴다. */
export function countByRuleAndFile(violations: Violation[]) {
    const out: Record<string, Record<string, number>> = {};
    for (const v of violations) {
        (out[v.rule] ||= {})[v.file] = ((out[v.rule] || {})[v.file] || 0) + 1;
    }
    return out;
}
