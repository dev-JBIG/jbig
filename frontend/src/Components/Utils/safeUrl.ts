/**
 * 사용자 입력 URL, 내부 경로, 샌드박스 HTML srcDoc을 안전하게 정제하는 유틸리티.
 * javascript:, vbscript:, data:, protocol-relative(//) 등 XSS/오픈 리다이렉트 벡터를 차단한다.
 */

const SAFE_HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function hasControlChars(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) return true;
    }
    return false;
}

/**
 * 외부 링크(웹사이트, 프로젝트, 자격증, 논문, 퀴즈 URL 등)를 안전한 http(s) URL로 정제한다.
 * 허용되지 않는 스킴(javascript:, data:, vbscript: 등)이나 유효하지 않은 URL은 null을 반환한다.
 */
export function sanitizeHttpUrl(raw?: string | null): string | null {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed || hasControlChars(trimmed)) return null;
    // protocol-relative URL (//evil.com) 차단
    if (trimmed.startsWith("//")) return null;

    let candidate = trimmed;
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate);
    if (!hasScheme) {
        // 스킴 없는 도메인(예: github.com/jbig)은 https:// 를 부여해 검증한다.
        // 첫 슬래시 이전에 콜론이 포함된 경우(우회 시도)는 차단한다.
        const beforeSlash = candidate.split("/", 1)[0];
        if (beforeSlash.includes(":") || !beforeSlash.includes(".")) {
            return null;
        }
        candidate = `https://${candidate}`;
    }

    try {
        const parsed = new URL(candidate);
        if (!SAFE_HTTP_PROTOCOLS.has(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * 이미지/미디어 src URL을 정제한다.
 * 안전한 http(s) URL 또는 동일 출처의 안전한 상대 경로(/media/, /api/media/)만 허용한다.
 */
export function sanitizeMediaUrl(raw?: string | null): string | null {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed || hasControlChars(trimmed)) return null;
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
    if (trimmed.startsWith("/media/") || trimmed.startsWith("/api/media/")) {
        return trimmed;
    }
    return sanitizeHttpUrl(trimmed);
}

/**
 * mailto: 링크용 이메일 주소를 정제한다.
 */
export function sanitizeMailto(email?: string | null): string | null {
    if (!email || typeof email !== "string") return null;
    const trimmed = email.trim();
    if (!trimmed || hasControlChars(trimmed)) return null;
    // 헤더/쿼리 파라미터 인젝션(?subject=, # 등) 및 스킴 중첩(:) 차단
    if (!/^[^\s@<>:?#]+@[^\s@<>:?#]+\.[^\s@<>:?#]+$/.test(trimmed)) {
        return null;
    }
    return `mailto:${trimmed}`;
}

/**
 * tel: 링크용 전화번호를 정제한다.
 */
export function sanitizeTel(phone?: string | null): string | null {
    if (!phone || typeof phone !== "string") return null;
    const trimmed = phone.trim();
    if (!trimmed || hasControlChars(trimmed)) return null;
    if (!/^[0-9+\-\s()]{3,30}$/.test(trimmed) || !/\d{3,}/.test(trimmed)) {
        return null;
    }
    return `tel:${trimmed.replace(/\s+/g, "")}`;
}

/**
 * 로그인 후 리다이렉트 등에 사용하는 앱 내부 경로를 검증한다.
 * //evil.com, /\evil.com, https://evil.com 같은 오픈 리다이렉트를 차단한다.
 */
export function sanitizeInternalPath(path?: string | null, fallback = "/"): string {
    if (!path || typeof path !== "string") return fallback;
    const trimmed = path.trim();
    if (!trimmed || hasControlChars(trimmed)) return fallback;
    if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
        return fallback;
    }
    try {
        const parsed = new URL(trimmed, "https://jbig.local");
        if (parsed.origin !== "https://jbig.local") return fallback;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return fallback;
    }
}

const PROFILE_IFRAME_CSP_META =
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src https: data:; font-src https: data:; form-action \'none\'; base-uri \'none\';">';

const DANGEROUS_HTML_RE =
    /<\s*(script|iframe|object|embed|applet|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|applet|base)\b[^>]*\/?>|<\s*meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh\b[^>]*>/gi;

/**
 * 사용자 HTML 이력서를 sandbox="" iframe의 srcDoc에 주입하기 전에
 * 위험 태그(script, meta refresh, base, iframe 등)를 제거하고 엄격한 CSP 메타를 선행 삽입한다.
 */
export function buildSandboxedProfileSrcDoc(rawHtml?: string | null): string {
    if (!rawHtml || typeof rawHtml !== "string") return "";
    const cleaned = rawHtml.replace(DANGEROUS_HTML_RE, "");
    if (/<head\b[^>]*>/i.test(cleaned)) {
        return cleaned.replace(/<head\b[^>]*>/i, (match) => `${match}${PROFILE_IFRAME_CSP_META}`);
    }
    return `${PROFILE_IFRAME_CSP_META}${cleaned}`;
}
