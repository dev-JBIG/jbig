/**
 * DESIGN.md 규칙 준수 테스트 (기준선 래칫 방식).
 *
 * - 지금 남아 있는 위반은 design-lint-baseline.json에 규칙별, 파일별 개수로 고정되어 있다.
 * - 어떤 규칙이든 파일의 위반 개수가 기준보다 늘거나, 기준에 없던 파일/규칙에서 위반이 생기면 실패한다.
 * - 위반을 고쳐 개수가 줄면 통과하고, 기준선을 줄인 값으로 갱신하라고 안내한다.
 * - 기준선 갱신: UPDATE_DESIGN_BASELINE=1 npm run lint:design  (늘어나는 갱신은 리뷰에서 사유를 설명해야 한다)
 */
import fs from "fs";
import path from "path";
import { countByRuleAndFile, lintDesign, RULES } from "./designLint";

const frontendRoot = path.resolve(__dirname, "..", "..");
const baselinePath = path.join(__dirname, "design-lint-baseline.json");
const designDocPath = path.resolve(frontendRoot, "..", "DESIGN.md");

const result = lintDesign(frontendRoot);
const current = countByRuleAndFile(result.violations);

if (process.env.UPDATE_DESIGN_BASELINE === "1") {
    fs.writeFileSync(baselinePath, JSON.stringify(current, null, 2) + "\n");
}

const baseline: Record<string, Record<string, number>> = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
    : {};

describe("DESIGN.md 자동 검사", () => {
    test("검사 대상 파일을 찾았다", () => {
        expect(result.filesScanned).toBeGreaterThan(50);
    });

    test("DESIGN.md 8절 표와 엔진 규칙 목록이 같다", () => {
        const doc = fs.readFileSync(designDocPath, "utf8");
        const section = doc.split(/^## 8\./m)[1] || "";
        const ids = Array.from(section.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)).map(m => m[1]);
        expect(ids.sort()).toEqual(RULES.map(r => r.id).sort());
    });

    test.each(RULES.map(r => [r.id, r.summary]))("%s: 기준선보다 늘지 않는다 (%s)", (rule) => {
        const now = current[rule] || {};
        const base = baseline[rule] || {};
        const increased = Object.entries(now)
            .filter(([file, n]) => n > (base[file] || 0))
            .map(([file, n]) => {
                const where = result.violations.filter(v => v.rule === rule && v.file === file).slice(0, 5)
                    .map(v => `    ${file}:${v.line} ${v.message}`).join("\n");
                return `${file}: ${base[file] || 0} → ${n}\n${where}`;
            });
        if (increased.length) {
            throw new Error(`[${rule}] DESIGN.md 위반이 늘었어요. 고치거나, 꼭 필요한 예외면 위반 줄 위에 ` +
                `"design-lint-allow ${rule}: 사유" 주석을 다세요.\n${increased.join("\n")}`);
        }
    });

    test("기준선에 이미 해결된 위반이 남아 있지 않다 (줄어든 값은 기준선에 반영)", () => {
        const stale: string[] = [];
        for (const [rule, files] of Object.entries(baseline))
            for (const [file, n] of Object.entries(files)) {
                const now = (current[rule] || {})[file] || 0;
                if (now < n) stale.push(`${rule} ${file}: ${n} → ${now}`);
            }
        if (stale.length) {
            throw new Error(`위반이 줄었어요. UPDATE_DESIGN_BASELINE=1 npm run lint:design 으로 기준선을 낮춰 주세요.\n${stale.join("\n")}`);
        }
    });
});
