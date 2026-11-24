/**
 * 디자인 자동 검사 엔진의 판정 회귀 테스트. 임시 폴더에 작은 프로젝트를 만들어 lintDesign 을 돌린다.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { lintDesign } from "./designLint";

const makeProject = (files: Record<string, string>) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jbig-lint-"));
    for (const [rel, body] of Object.entries(files)) {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body);
    }
    return root;
};
const lint = (files: Record<string, string>, rule: string) => {
    const root = makeProject(files);
    try {
        return lintDesign(root).violations.filter(v => v.rule === rule);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
};

describe("designLint 판정", () => {
    test("블록 마지막 선언은 세미콜론이 없어도 검사한다", () => {
        const withSemi = lint({ "src/a.css": ".card { border-radius: 8px; }\n" }, "radius-token");
        const noSemi = lint({ "src/a.css": ".card { border-radius: 8px }\n" }, "radius-token");
        expect(withSemi).toHaveLength(1);
        expect(noSemi).toHaveLength(1);
        expect(lint({ "src/a.css": ".card {\n  color: red;\n  background: #000\n}\n" }, "raw-color")).toHaveLength(1);
    });

    test("윗줄 선언 끝의 허용 주석은 다음 선언을 면제하지 않는다", () => {
        const css = ".a {\n  color: #fff; /* design-lint-allow raw-color: 기존 색상 유지 */\n  background: #000;\n}\n";
        const v = lint({ "src/a.css": css }, "raw-color");
        expect(v.map(x => x.line)).toEqual([3]);
    });

    test("주석만 있는 윗줄의 허용 주석은 바로 아래 선언을 면제한다", () => {
        const css = ".a {\n  /* design-lint-allow raw-color: 브랜드 고정 색 */\n  color: #fff;\n  background: #000;\n}\n";
        expect(lint({ "src/a.css": css }, "raw-color").map(x => x.line)).toEqual([4]);
    });

    test("주석 뒤에 코드가 있는 윗줄의 허용 주석은 다음 선언을 면제하지 않는다", () => {
        const css = ".a {\n  /* design-lint-allow raw-color: 기존 색상 유지 */ color: #fff;\n  background: #000;\n}\n";
        expect(lint({ "src/a.css": css }, "raw-color").map(x => x.line)).toEqual([3]);
        // 여러 줄 주석의 끝줄 뒤에 코드가 붙어도 마찬가지
        const css2 = ".a {\n  /* design-lint-allow raw-color: 기존 색상 유지,\n     다음 개편 때 정리 */ color: #fff;\n  background: #000;\n}\n";
        expect(lint({ "src/a.css": css2 }, "raw-color").map(x => x.line)).toEqual([4]);
        // JSX 주석 뒤에 코드가 있는 줄도
        const tsx = 'export const A = () => (\n  <>\n    {/* design-lint-allow clickable-div: 배경막 보조 클릭 */}<div onClick={() => {}} />\n    <div onClick={() => {}} />\n  </>\n);\n';
        expect(lint({ "src/A.tsx": tsx }, "clickable-div").map(x => x.line)).toEqual([4]);
    });

    test("여러 줄 주석의 가운데, 끝 줄에 있는 허용 주석은 바로 아래 선언을 면제한다", () => {
        const css = ".a {\n  /*\n   * design-lint-allow raw-color: 브랜드 고정 색\n   */\n  color: #fff;\n}\n";
        expect(lint({ "src/a.css": css }, "raw-color")).toHaveLength(0);
    });

    test("JSX 표현식 속 주석, 템플릿 문자열, 안쪽 JSX 글자의 따옴표와 > 를 태그 끝 판단에 쓰지 않는다", () => {
        const commentQuote = [
            "export const A = () => (",
            "  <>",
            "    <img src={url /* user's avatar */} alt=\"\" />",
            "    <img src={other} alt=\"\" loading=\"lazy\" decoding=\"async\" />",
            "  </>",
            ");",
        ].join("\n");
        expect(lint({ "src/A.tsx": commentQuote }, "img-lazy").map(x => x.line)).toEqual([3]);
        const lineComment = [
            "export const B = () => (",
            "  <img",
            "    src={url // user's avatar",
            "    }",
            "    alt=\"\"",
            "  />",
            ");",
            "export const C = () => <img src={x} alt=\"\" loading=\"lazy\" decoding=\"async\" />;",
        ].join("\n");
        expect(lint({ "src/B.tsx": lineComment }, "img-lazy").map(x => x.line)).toEqual([2]);
        const template = 'export const D = () => <img src={`${a > b ? "x" : "y"}.png`} alt="" loading="lazy" decoding="async" />;\n';
        expect(lint({ "src/D.tsx": template }, "img-lazy")).toHaveLength(0);
        const nestedText = 'export const E = () => <div title={ok ? <b>it\'s</b> : null} onClick={f} />;\n';
        expect(lint({ "src/E.tsx": nestedText }, "clickable-div")).toHaveLength(1);
    });

    test("return 등 값을 받는 키워드 뒤의 문자열은 문자열로 건너뛴다 (URL 의 // 를 주석으로 보지 않음)", () => {
        const kw = [
            "export const F = () => (",
            "  <>",
            '    <img src={(() => { return "https://example.com/a.png"; })()} alt="" />',
            '    <img src={other} alt="" loading="lazy" decoding="async" />',
            "  </>",
            ");",
        ].join("\n");
        expect(lint({ "src/F.tsx": kw }, "img-lazy").map(x => x.line)).toEqual([3]);
        for (const word of ["typeof", "case", "await", "throw", "void", "new"]) {
            const t = `export const G = () => <><img src={x(() => { ${word} "https://a.b/c"; })} alt="" /><img src={y} alt="" loading="lazy" decoding="async" /></>;\n`;
            expect(lint({ "src/G.tsx": t }, "img-lazy")).toHaveLength(1);
        }
        // 키워드로 끝나는 식별자(join's), 속성 이름(obj.return)은 키워드가 아니다
        const ident = "export const H = () => <div title={names.join's} onClick={f} />;\n";
        expect(lint({ "src/H.tsx": ident }, "clickable-div")).toHaveLength(1);
    });

    test("여백은 2~48px 직접값만 위반이고 1px 선, 48px 초과, calc, 토큰은 통과한다", () => {
        const css = [
            ".a { padding: 8px 12px; }",
            ".b { margin: 0 1px; gap: var(--space-2); }",
            ".c { margin-top: 56px; padding: calc(var(--space-2) + 2px); }",
            ".d { column-gap: 0.5em; row-gap: 7px }",
        ].join("\n");
        expect(lint({ "src/a.css": css }, "spacing-token").map(x => x.line)).toEqual([1, 4]);
    });

    test("calc() 바깥의 직접값과 음수 직접값도 여백 위반이다", () => {
        const css = [
            ".a { padding: calc(100% - 8px) 12px; }",
            ".b { margin-left: -8px; }",
            ".c { margin-top: calc(-1 * var(--space-2)); margin-left: -1px; }",
        ].join("\n");
        expect(lint({ "src/a.css": css }, "spacing-token").map(x => x.line)).toEqual([1, 2]);
    });

    test("!important 예외는 모든 선택자가 외부 라이브러리이거나 인쇄 전용 미디어일 때만", () => {
        const css = [
            ".w-md-editor, .app-card { padding: 0 !important; }",
            ".w-md-editor .x, .react-datepicker__day { color: inherit !important; }",
            "@media not print { .a { display: none !important; } }",
            "@media screen, print { .b { display: none !important; } }",
            "@media print { .c { display: none !important; } }",
            "@media only print and (min-width: 768px) { .d { display: none !important; } }",
        ].join("\n");
        expect(lint({ "src/a.css": css }, "important").map(x => x.line)).toEqual([1, 3, 4]);
    });

    test("복합 미디어 쿼리의 모든 너비 조건을 검사한다", () => {
        const v = lint({ "src/a.css": "@media (min-width: 600px) and (max-width: 767px) { .a { color: inherit; } }\n" }, "breakpoint");
        expect(v.map(x => x.message)).toEqual(["min-width: 600px"]);
        expect(lint({ "src/a.css": "@media (max-width: 767px) { .a { color: inherit; } }\n@media (min-width: 768px) { .a { color: inherit; } }\n" }, "breakpoint")).toHaveLength(0);
    });

    test("JSX 속성 안의 화살표(=>)를 img 태그 끝으로 보지 않는다", () => {
        const ok = 'export const A = () => <img src={images.find(image => image.id === selectedId)?.url} alt="" loading="lazy" decoding="async" />;\n';
        const bad = 'export const B = () => <img src={images.find(image => image.id === selectedId)?.url} alt="" decoding="async" />;\n';
        expect(lint({ "src/A.tsx": ok }, "img-lazy")).toHaveLength(0);
        expect(lint({ "src/B.tsx": bad }, "img-lazy")).toHaveLength(1);
    });

    test("화살표 속성 뒤의 onClick 도 div 클릭으로 잡는다", () => {
        const tsx = 'export const C = () => <div title={xs.map(x => x).join(",")} onClick={() => {}} />;\n';
        expect(lint({ "src/C.tsx": tsx }, "clickable-div")).toHaveLength(1);
    });
});
