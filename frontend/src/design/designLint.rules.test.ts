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
