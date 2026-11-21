import React, { useEffect, useState, useCallback, useRef } from "react";
import { NotionRenderer } from "react-notion-x";
import { ExtendedRecordMap } from "notion-types";
import { useNavigate } from "react-router-dom";
import { Button, Spinner } from "@primer/react";
import { useUser } from "../Utils/UserContext";
import { useAlert } from "../Utils/AlertContext";
import { useColorMode } from "../Utils/ThemeContext";
import { fetchSiteSettings, fetchNotionPage as fetchNotionPageAPI } from "../../API/req";
import { Code } from 'react-notion-x/build/third-party/code';
import { Collection } from 'react-notion-x/build/third-party/collection';
import { Equation } from 'react-notion-x/build/third-party/equation';

import "react-notion-x/src/styles.css";
import "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";

import "./Note.css";

function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
    if (!recordMap?.block) return recordMap;
    const cleanBlock: typeof recordMap.block = {};
    for (const [key, value] of Object.entries(recordMap.block)) {
        if (key && value?.value?.id) {
            cleanBlock[key] = value;
        }
    }
    return { ...recordMap, block: cleanBlock };
}

async function fetchNotionPage(pageId: string, accessToken: string): Promise<ExtendedRecordMap> {
    const data = await fetchNotionPageAPI(pageId, accessToken);
    return sanitizeRecordMap(data as ExtendedRecordMap);
}

const NOTION_PAGE_ID_RE = /^[0-9a-f-]{32,36}$/i;

function normalizeNotionPageId(raw?: string | null): string | null {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!NOTION_PAGE_ID_RE.test(trimmed)) return null;
    const hex = trimmed.replace(/-/g, "");
    return hex.length === 32 ? hex : null;
}

const Note: React.FC = () => {
    const { user, authReady, accessToken } = useUser();
    const { showAlert } = useAlert();
    const { resolvedColorMode } = useColorMode();
    const navigate = useNavigate();
    const [recordMap, setRecordMap] = useState<ExtendedRecordMap | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, setCurrentPageId] = useState<string>("");
    const defaultPageIdRef = useRef<string>("");

    const loadPage = useCallback(async (pageId: string, replace = false) => {
        const normalizedId = normalizeNotionPageId(pageId);
        if (!normalizedId) {
            setError("유효한 Notion 페이지 ID가 아닙니다.");
            setLoading(false);
            return;
        }
        if (!accessToken) {
            setError("로그인이 필요합니다.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await fetchNotionPage(normalizedId, accessToken);
            setRecordMap(data);
            setCurrentPageId(normalizedId);
            const defaultId = normalizeNotionPageId(defaultPageIdRef.current);
            const query = new URLSearchParams();
            if (normalizedId !== defaultId) {
                query.set("page", normalizedId);
            }
            const qs = query.toString();
            const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
            if (replace) {
                window.history.replaceState({ page: normalizedId }, "", newUrl);
            } else {
                window.history.pushState({ page: normalizedId }, "", newUrl);
            }
        } catch {
            setError("페이지를 불러올 수 없습니다.");
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        if (!authReady) return;
        if (!user || !accessToken) {
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'warning',
                onClose: () => {
                    navigate("/signin");
                }
            });
            return;
        }

        const init = async () => {
            try {
                const settings = await fetchSiteSettings();
                const defaultPageId = settings.notion_page_id || "";
                defaultPageIdRef.current = defaultPageId;
                const params = new URLSearchParams(window.location.search);
                const pageId = params.get("page") || defaultPageId;
                loadPage(pageId, true);
            } catch {
                setError("설정을 불러올 수 없습니다.");
                setLoading(false);
            }
        };
        init();
    }, [authReady, user, accessToken, navigate, loadPage, showAlert]);

    useEffect(() => {
        const onPopState = (e: PopStateEvent) => {
            const pageId = e.state?.page || defaultPageIdRef.current;
            loadPage(pageId, true);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [loadPage]);

    const mapPageUrl = useCallback((pageId: string) => {
        const cleanId = normalizeNotionPageId(pageId) || "";
        return cleanId ? `${window.location.pathname}?page=${encodeURIComponent(cleanId)}` : window.location.pathname;
    }, []);

    const handleContentClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (!anchor) return;

        const href = (anchor.getAttribute("href") || "").trim();
        if (!href) return;

        let parsed: URL;
        try {
            parsed = new URL(href, window.location.origin);
        } catch {
            e.preventDefault();
            return;
        }

        // javascript:, vbscript:, data: 등 비-HTTP(S) 스킴 링크 실행 차단
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            e.preventDefault();
            return;
        }

        const pageParam = parsed.searchParams.get("page");
        const normalizedParam = normalizeNotionPageId(pageParam);
        if (parsed.origin === window.location.origin && normalizedParam) {
            e.preventDefault();
            loadPage(normalizedParam);
            return;
        }

        const notionIdMatch = parsed.pathname.match(/\/([a-f0-9]{32})$/i);
        if (
            notionIdMatch &&
            (parsed.origin === window.location.origin || parsed.hostname.endsWith("notion.so") || parsed.hostname.endsWith("notion.site"))
        ) {
            e.preventDefault();
            loadPage(notionIdMatch[1]);
            return;
        }

        if (parsed.origin !== window.location.origin) {
            e.preventDefault();
            window.open(parsed.href, "_blank", "noopener,noreferrer");
        }
    }, [loadPage]);

    if (loading) {
        return (
            <div className="note-wrapper">
                <div className="note-header">
                    <a href="/" className="note-logo">JBIG</a>
                </div>
                <div className="note-loading" role="status">
                    <Spinner size="medium" />
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="note-wrapper">
                <div className="note-header">
                    <a href="/" className="note-logo">JBIG</a>
                    <Button variant="primary" size="small" onClick={() => window.location.reload()}>
                        다시 시도
                    </Button>
                </div>
                <div className="note-error" role="alert">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="note-wrapper">
            <div className="note-header">
                <a href="/" className="note-logo">JBIG</a>
                <Button
                    variant="default"
                    size="small"
                    onClick={() => loadPage(defaultPageIdRef.current, true)}
                >
                    홈으로
                </Button>
            </div>
            <div className="note-content" onClick={handleContentClick}>
                {recordMap && (
                    <NotionRenderer
                        recordMap={recordMap}
                        fullPage={true}
                        darkMode={resolvedColorMode === "dark"}
                        mapPageUrl={mapPageUrl}
                        components={{
                            Code,
                            Collection,
                            Equation
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default Note;
