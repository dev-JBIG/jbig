import React from "react";
import { render, screen } from "@testing-library/react";
import {
    buildSandboxedProfileSrcDoc,
    sanitizeHttpUrl,
    sanitizeInternalPath,
    sanitizeMailto,
    sanitizeMediaUrl,
    sanitizeTel,
} from "./safeUrl";
import LinksBlockView from "../Profile/ProfileBlockRenderer/views/LinksBlockView";
import ContactBlockView from "../Profile/ProfileBlockRenderer/views/ContactBlockView";
import ProjectBlockView from "../Profile/ProfileBlockRenderer/views/ProjectBlockView";
import CertificationBlockView from "../Profile/ProfileBlockRenderer/views/CertificationBlockView";
import PublicationBlockView from "../Profile/ProfileBlockRenderer/views/PublicationBlockView";
import client from "../../API/client";
import { SESSION_KEY, signOutLocal } from "../../API/auth";

describe("safeUrl sanitization utilities", () => {
    test("sanitizeHttpUrl blocks dangerous schemes and protocol-relative URLs", () => {
        expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
        expect(sanitizeHttpUrl("  JaVaScRiPt:alert(1)")).toBeNull();
        expect(sanitizeHttpUrl("vbscript:msgbox(1)")).toBeNull();
        expect(sanitizeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
        expect(sanitizeHttpUrl("//evil.example/phish")).toBeNull();
        expect(sanitizeHttpUrl("https://evil.example/\x00foo")).toBeNull();
    });

    test("sanitizeHttpUrl accepts valid http(s) and bare domains", () => {
        expect(sanitizeHttpUrl("https://jbig.co.kr/path?a=1")).toBe("https://jbig.co.kr/path?a=1");
        expect(sanitizeHttpUrl("http://example.com")).toBe("http://example.com/");
        expect(sanitizeHttpUrl("github.com/dev-JBIG")).toBe("https://github.com/dev-JBIG");
    });

    test("sanitizeMediaUrl allows safe media paths and rejects XSS schemes", () => {
        expect(sanitizeMediaUrl("/media/uploads/2026/01/01/1/a.png")).toBe("/media/uploads/2026/01/01/1/a.png");
        expect(sanitizeMediaUrl("/api/media/stream/?token=abc")).toBe("/api/media/stream/?token=abc");
        expect(sanitizeMediaUrl("https://cdn.jbig.co.kr/a.webp")).toBe("https://cdn.jbig.co.kr/a.webp");
        expect(sanitizeMediaUrl("javascript:alert(1)")).toBeNull();
        expect(sanitizeMediaUrl("//evil.example/img.png")).toBeNull();
    });

    test("sanitizeMailto and sanitizeTel prevent injection", () => {
        expect(sanitizeMailto("alice@jbnu.ac.kr")).toBe("mailto:alice@jbnu.ac.kr");
        expect(sanitizeMailto("alice@jbnu.ac.kr?subject=phish")).toBeNull();
        expect(sanitizeMailto("javascript:alert(1)")).toBeNull();
        expect(sanitizeTel("+82 10-1234-5678")).toBe("tel:+8210-1234-5678");
        expect(sanitizeTel("+33 6 12 34 56 78")).toBe("tel:+33612345678");
        expect(sanitizeTel("12")).toBeNull();
        expect(sanitizeTel("javascript:alert(1)")).toBeNull();
    });

    test("sanitizeInternalPath blocks open redirects", () => {
        expect(sanitizeInternalPath("/board/1?page=2")).toBe("/board/1?page=2");
        expect(sanitizeInternalPath("//evil.example/phish")).toBe("/");
        expect(sanitizeInternalPath("/\\evil.example/phish")).toBe("/");
        expect(sanitizeInternalPath("https://evil.example")).toBe("/");
        expect(sanitizeInternalPath("javascript:alert(1)")).toBe("/");
    });

    test("buildSandboxedProfileSrcDoc strips active tags, defeats HTML comment CSP bypass, and prepends strict CSP", () => {
        const html = '<!-- <head> --><html><head><title>CV</title><meta http-equiv="Content-Security-Policy" content="default-src *"><meta http-equiv="refresh" content="0;url=https://evil.example"></head><body><h1>Hi</h1><script>alert(1)</script><scr<script>x</script>ipt>alert(2)</script><iframe src="https://evil.example"></iframe></body></html>';
        const out = buildSandboxedProfileSrcDoc(html);
        expect(out).toContain('http-equiv="Content-Security-Policy"');
        expect(out).toContain("form-action 'none'");
        expect(out).not.toContain("default-src *");
        expect(out).not.toContain("alert(1)");
        expect(out.toLowerCase()).not.toContain("<iframe");
        expect(out.toLowerCase()).not.toContain('http-equiv="refresh"');
        // CSP 메타는 주석이 아니라 실제 <head> 첫 자식으로 삽입되고, DOM에 위험 요소가 없어야 한다.
        const parsed = new DOMParser().parseFromString(out, "text/html");
        expect(parsed.querySelectorAll("script, iframe, object, embed, applet, base")).toHaveLength(0);
        expect(parsed.querySelectorAll('meta[http-equiv="refresh"]')).toHaveLength(0);
        const firstHeadMeta = parsed.head.querySelector('meta[http-equiv="Content-Security-Policy"]');
        expect(firstHeadMeta).not.toBeNull();
        expect(firstHeadMeta?.getAttribute("content")).toContain("default-src 'none'");
    });
});

describe("Profile block XSS defenses", () => {
    test("blocks javascript: URLs across all profile block view components", () => {
        const { container } = render(
            <>
                <LinksBlockView
                    block={{
                        id: "1",
                        type: "links",
                        data: { items: [{ label: "Evil", url: "javascript:alert(1)", icon: "globe" }] },
                        style: {},
                    }}
                />
                <ContactBlockView
                    block={{
                        id: "2",
                        type: "contact",
                        data: { email: "bad?x=1", phone: "javascript:1", location: "Jeonju", website: "javascript:alert(2)" },
                        style: {},
                    }}
                />
                <ProjectBlockView
                    block={{
                        id: "3",
                        type: "project",
                        data: { title: "Proj", description: "Desc", tags: [], url: "javascript:alert(3)", imagePath: "", imageUrl: "javascript:alert(4)" },
                        style: {},
                    }}
                />
                <CertificationBlockView
                    block={{
                        id: "4",
                        type: "certification",
                        data: { name: "Cert", issuer: "Org", date: "2026", credentialId: "", url: "javascript:alert(5)" },
                        style: {},
                    }}
                />
                <PublicationBlockView
                    block={{
                        id: "5",
                        type: "publication",
                        data: { title: "Paper", venue: "Conf", authors: "Alice", date: "2026", url: "javascript:alert(6)", description: "" },
                        style: {},
                    }}
                />
            </>
        );

        expect(screen.getByText("Evil")).toBeInTheDocument();
        expect(container.querySelectorAll("a")).toHaveLength(0);
        expect(container.querySelectorAll("img")).toHaveLength(0);
    });
});

describe("API auth & session cache security", () => {
    test("axios client strips Authorization header (case-insensitive) for non-/api/ external URLs", async () => {
        let seenAuth: unknown = "unset";
        let seenLowerAuth: unknown = "unset";
        await client.get("https://storage.example.com/presigned-object", {
            headers: { authorization: "Bearer secret-jwt" },
            adapter: async (config) => {
                seenAuth = config.headers?.Authorization;
                seenLowerAuth = config.headers?.authorization;
                return { data: "ok", status: 200, statusText: "OK", headers: {}, config };
            },
        });
        expect(seenAuth).toBeUndefined();
        expect(seenLowerAuth).toBeUndefined();
    });

    test("axios client preserves Authorization when baseURL targets /api/", async () => {
        localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
                session: {
                    id: "test-session",
                    user: { username: "alice", semester: "1", email: "alice@jbnu.ac.kr" },
                    accessToken: "valid-jwt",
                    refreshToken: "valid-refresh",
                },
                expired: false,
            })
        );
        try {
            let seenAuth: unknown = "unset";
            await client.get("/users/profile/", {
                baseURL: "/api",
                headers: { Authorization: "Bearer valid-jwt" },
                adapter: async (config) => {
                    seenAuth = config.headers?.Authorization;
                    return { data: "ok", status: 200, statusText: "OK", headers: {}, config };
                },
            });
            expect(seenAuth).toBe("Bearer valid-jwt");
        } finally {
            localStorage.removeItem(SESSION_KEY);
        }
    });

    test("signOutLocal clears all jbig sessionStorage caches", () => {
        sessionStorage.setItem("jbig_cache_/board/1_", "{}");
        sessionStorage.setItem("jbig_anno_cache_/board/1", "[]");
        sessionStorage.setItem("jbig-arena-pending:alice@jbnu.ac.kr", "uuid");
        sessionStorage.setItem("unrelated_key", "keep");

        signOutLocal();

        expect(sessionStorage.getItem("jbig_cache_/board/1_")).toBeNull();
        expect(sessionStorage.getItem("jbig_anno_cache_/board/1")).toBeNull();
        expect(sessionStorage.getItem("jbig-arena-pending:alice@jbnu.ac.kr")).toBeNull();
        expect(sessionStorage.getItem("unrelated_key")).toBe("keep");
        sessionStorage.clear();
    });
});
