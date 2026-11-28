/** 사이드바 게시판 목록을 세션 저장소에 잠깐 담아 두는 캐시. 로그인 상태(비회원, 회원, 운영진)별로 따로 둔다 */
import { Section } from "../Utils/interfaces";

const BOARDS_CACHE_PREFIX = "jbig_boards_cache";

export type BoardsPayload = {
    categories: Section[];
    total_post_count: number;
};

export const normalizeBoardsPayload = (res: any): BoardsPayload => ({
    categories: Array.isArray(res?.categories) ? res.categories : [],
    total_post_count: typeof res?.total_post_count === "number" ? res.total_post_count : 0,
});

export const getBoardsCacheKey = (
    accessToken: string | null,
    userIdentity: string,
    isStaff?: boolean
): string | null => {
    if (!accessToken) return `${BOARDS_CACHE_PREFIX}_anonymous`;
    if (!userIdentity) return null;
    return `${BOARDS_CACHE_PREFIX}_${isStaff ? "staff" : "member"}_${encodeURIComponent(userIdentity)}`;
};

export const readBoardsCache = (cacheKey: string | null): BoardsPayload | null => {
    if (!cacheKey) return null;
    try {
        const raw = sessionStorage.getItem(cacheKey);
        if (!raw) return null;
        return normalizeBoardsPayload(JSON.parse(raw));
    } catch {
        return null;
    }
};

export const writeBoardsCache = (cacheKey: string | null, payload: BoardsPayload) => {
    if (!cacheKey) return;
    try {
        sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {}
};
