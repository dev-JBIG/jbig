/** 글쓰기 규칙과 도우미: 막는 확장자, 첨부 개수, 글쓰기 금지 게시판, 양식 종류 판단, 공개범위 안내, 저장소 파일 키 추출 */
import { Board, FormType } from "../Utils/interfaces";

export const BLOCKED_EXTENSIONS = ["jsp", "php", "asp", "cgi"];
export const MAX_FILES = 3;
export const MAX_PHOTO_FILES = 12;
export const BLOCKED_BOARD_KEYWORDS = ["공지사항", "admin", "어드민", "운영진", "관리자"];
export const BRAG_BOARD_NAME = "자랑게시판";
export const STUDY_BOARD_NAME_KEYWORDS = ["스터디", "소모임"];


// CDN/Presigned/권한 게이트 URL에서 스토리지 파일 키를 손상 없이 추출
export const extractKeyFromUrl = (url: string, fallback: string, explicitPath?: string): string => {
    if (typeof explicitPath === "string" && explicitPath.trim()) {
        return explicitPath.trim();
    }
    if (!url || typeof url !== "string") {
        return fallback;
    }
    const trimmed = url.trim();
    if (!trimmed) {
        return fallback;
    }
    if (trimmed.startsWith("media-key://")) {
        return trimmed.slice("media-key://".length) || fallback;
    }
    try {
        const base = typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : "http://localhost";
        const urlObj = new URL(trimmed, base);
        const queryKey = urlObj.searchParams.get("path") || urlObj.searchParams.get("key");
        if (queryKey && queryKey.trim()) {
            return queryKey.trim();
        }
        const pathname = urlObj.pathname;
        // CDN(https://cdn.jbig.co.kr/uploads/...)과 오브젝트 스토리지(/bucket/uploads/...) 모두 uploads/ 접두사 보존
        const uploadsMatch = pathname.match(/(uploads\/.+)$/);
        if (uploadsMatch) {
            return uploadsMatch[1];
        }
        // 권한 게이트 백엔드 다운로드 URL(/api/...)은 첫 세그먼트를 자르지 않고 원형 유지
        if (pathname.startsWith("/api/")) {
            return trimmed;
        }
        const normalized = pathname.replace(/^\/+/, "");
        return normalized || fallback;
    } catch {
        return fallback;
    }
};

export const isImageByName = (name: string) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);

// 게시판이 사용하는 본문 입력 폼 종류. (모집 태그 차원은 무시 — 태그는 게시판 변경 시 별도로 초기화됨)
export type FormKind = 'photo' | 'absence' | 'feedback' | 'study' | 'generic';
export const formKindOf = (board?: Board | null): FormKind => {
    if (!board) return 'generic';
    if (board.board_type === 4 || board.name === "사진첩") return 'photo';
    if (board.form_type === FormType.ABSENCE) return 'absence';
    if (board.form_type === FormType.FEEDBACK) return 'feedback';
    if (!!board.name && STUDY_BOARD_NAME_KEYWORDS.every((kw) => board.name.includes(kw))) return 'study';
    return 'generic';
};

// 선택한 게시판의 공개범위 안내 문구
// board_type===3(사유서·에러/피드백 제보)은 서버가 read_permission='author'로 관리하지만,
// 구버전 캐시 데이터에 read_permission이 없을 수 있어 board_type도 함께 분기한다.
export const getBoardVisibilityNotice = (
    perm?: 'all' | 'member' | 'author' | 'staff',
    boardType?: number
): string | null => {
    if (perm === 'author' || boardType === 3) {
        return "🔒 제출한 글은 본인과 스태프만 볼 수 있어요";
    }
    switch (perm) {
        case 'all':
            return "🌐 전체공개 게시판 — 로그인하지 않은 방문자도 글과 첨부파일을 볼 수 있어요";
        case 'member':
            return "🔒 회원전용 게시판 — 로그인한 회원만 글과 첨부파일을 볼 수 있어요";
        case 'staff':
            return "🔒 스태프전용 게시판 — 스태프만 글을 볼 수 있어요";
        default:
            return null;
    }
};
