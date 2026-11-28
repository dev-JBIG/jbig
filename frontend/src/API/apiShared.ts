/** API 모듈 공통: 오류 문구 추출, 목록 응답 풀기, 게시글 항목 변환. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import { isAxiosError } from "axios";
import { PostItem, AttachmentData } from "../Components/Utils/interfaces";

// API 에러 응답 타입
export interface ApiErrorResponse {
    detail?: string;
    message?: string;
    error?: string;
    [key: string]: string | string[] | undefined;
}

// Axios 에러에서 메시지 추출
export function getErrorMessage(error: unknown, defaultMsg: string): string {
    if (!isAxiosError(error)) return defaultMsg;
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (!data) return defaultMsg;
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
    const keys = Object.keys(data);
    if (keys.length > 0) {
        const firstVal = data[keys[0]];
        if (Array.isArray(firstVal) && firstVal.length > 0) return firstVal[0];
    }
    return defaultMsg;
}

// API 응답에서 results 배열 추출
export interface PaginatedResponse<T> {
    results?: T[];
    count?: number;
    next?: string | null;
}

export interface PhotoPostItem {
    id: number;
    title: string;
    created_at?: string;
    attachment_paths?: AttachmentData[];
}

export function extractResults<T>(data: PaginatedResponse<T> | T[]): T[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

// API 응답 아이템을 PostItem으로 변환
export interface RawPostItem {
    id: number;
    board_post_id?: number;
    title: string;
    author: string;
    user_id: string;
    author_semester: number;
    created_at?: string;
    views: number;
    likes_count: number;
    comment_count?: number;
    post_type?: number;
    board_id?: number;
    board_name?: string;
    tag?: string;
    recruitment_info?: PostItem["recruitment_info"];
}

export function mapRawPostToPostItem(item: RawPostItem): PostItem {
    return {
        id: item.id,
        board_post_id: item.board_post_id ?? item.id,
        title: item.title,
        author: item.author,
        user_id: item.user_id,
        author_semester: item.author_semester,
        date: (item.created_at || "").slice(2, 10).replace(/-/g, "/"),
        views: item.views,
        likes: item.likes_count,
        comment_count: item.comment_count ?? 0,
        board_id: item.board_id,
        board_name: item.board_name,
        tag: item.tag,
        recruitment_info: item.recruitment_info ?? null,
    };
}

// post_type Map 추출
export function extractPostTypes(rawResults: RawPostItem[]): Map<number, number> {
    const map = new Map<number, number>();
    rawResults.forEach((item) => {
        if (item.id && item.post_type !== undefined) {
            map.set(item.id, item.post_type);
        }
    });
    return map;
}
