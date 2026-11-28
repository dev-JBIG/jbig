/** 게시글 목록, 인기 글, 사진첩, 검색, 상세, 좋아요, 작성, 수정, 삭제, 권한 첨부 다운로드. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import { isAxiosError } from "axios";
import axios, { authHeaders, currentAccessToken } from "./client";
import { BASE_URL } from "./auth";
import { PostItem } from "../Components/Utils/interfaces";
import { getErrorMessage, PhotoPostItem, extractResults, RawPostItem, mapRawPostToPostItem, extractPostTypes } from "./apiShared";

// 게시판 게시글 리스트 반환 api
export const fetchBoardPosts = async (
    boardId: string | undefined,
    pageSize: number,
    page: number,
    isHome: boolean = false
): Promise<{ posts: PostItem[]; totalPages: number; postPermission: boolean; postTypes?: Map<number, number> }> => {
    const token = currentAccessToken();
    const url = isHome
        ? `${BASE_URL}/api/posts/all/`
        : boardId
            ? `${BASE_URL}/api/boards/${boardId}/posts/`
            : `${BASE_URL}/api/posts/all/`;

    const config: { params?: Record<string, unknown>; headers?: Record<string, string> } = isHome
        ? {}
        : { params: { page, page_size: pageSize } };

    const makeRequest = async (useToken: boolean) => {
        const reqConfig = { ...config };
        if (useToken && token) {
            reqConfig.headers = { ...reqConfig.headers, ...authHeaders() };
        }
        return axios.get(url, reqConfig);
    };

    let res;
    try {
        res = await makeRequest(!!token);
    } catch (err) {
        // 토큰이 만료/무효한 경우 토큰 없이 재시도 (공개 엔드포인트)
        if (isAxiosError(err) && err.response?.status === 401 && token) {
            res = await makeRequest(false);
        } else {
            throw err;
        }
    }

    const rawResults = extractResults<RawPostItem>(res.data);
    const posts = rawResults.map(mapRawPostToPostItem);
    const postTypesMap = extractPostTypes(rawResults);
    const count = typeof res.data?.count === "number" ? res.data.count : posts.length;

    return {
        posts,
        totalPages: isHome ? 1 : Math.ceil(count / pageSize),
        postPermission: Boolean(res.data?.board?.post_permission),
        postTypes: postTypesMap,
    };
};

export type PopularSort = "likes" | "comments" | "views";
/** 대문 인기 글을 모으는 기간(일). 서버 기본값과 같게 둔다 */
export const POPULAR_DAYS = 90;

// 대문 인기 글 (최근 N일 안에서 좋아요/댓글/조회 순). 읽기 권한 없는 글은 서버가 뺀다.
export const fetchPopularPosts = async (
    sort: PopularSort,
    limit: number = 5,
    days: number = POPULAR_DAYS
): Promise<PostItem[]> => {
    const res = await axios.get(`${BASE_URL}/api/posts/popular/`, { params: { sort, limit, days } });
    return extractResults<RawPostItem>(res.data).map(mapRawPostToPostItem);
};

// 사진첩 게시글 조회 (첨부 이미지 포함)
export const fetchPhotoAlbumPosts = async (
    boardId: number,
    limit: number = 20
): Promise<PhotoPostItem[]> => {
    const response = await axios.get(`${BASE_URL}/api/boards/${boardId}/posts/`, {
        params: { page_size: limit, page: 1, view: "photo" },
    });
    const raw = response.data?.results ?? response.data ?? [];
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any) => ({
        id: item.id,
        title: item.title,
        created_at: item.created_at,
        attachment_paths: item.attachment_paths || [],
    }));
};

// 전체 게시판 검색 (전체 카테고리)
export const fetchSearchPosts = async (
    query: string,
    pageSize: number,
    page: number
): Promise<{ posts: PostItem[]; totalPages: number; postTypes?: Map<number, number> }> => {
    const res = await axios.get(`${BASE_URL}/api/posts/all/search/`, {
        params: { page, page_size: pageSize, q: query },
    });

    const rawResults = extractResults<RawPostItem>(res.data);
    const posts = rawResults.map(mapRawPostToPostItem);
    const count = typeof res.data?.count === "number" ? res.data.count : posts.length;

    return {
        posts,
        totalPages: Math.max(1, Math.ceil(count / pageSize)),
        postTypes: extractPostTypes(rawResults),
    };
};

// 특정 게시판 검색
export const fetchBoardSearchPosts = async (
    boardId: number,
    query: string,
    pageSize: number,
    page: number
): Promise<{ posts: PostItem[]; totalPages: number; postTypes?: Map<number, number> }> => {
    const res = await axios.get(`${BASE_URL}/api/boards/${boardId}/search/`, {
        params: { page, page_size: pageSize, q: query },
    });

    const rawResults = extractResults<RawPostItem>(res.data);
    const posts = rawResults.map(mapRawPostToPostItem);
    const count = typeof res.data?.count === "number" ? res.data.count : posts.length;

    return {
        posts,
        totalPages: Math.max(1, Math.ceil(count / pageSize)),
        postTypes: extractPostTypes(rawResults),
    };
};

// 게시글 세부 정보 조회
export const fetchPostDetail = async (postId: number) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/posts/${postId}/`, {
            headers: authHeaders(),
        });
        return response.data;
    } catch (error) {
        if (isAxiosError(error)) {
            if (error.response?.status === 401) return { loginRequired: true };
            if (error.response?.status === 403) return { unauthorized: true };
            if (error.response?.status === 404) return { notFound: true };
        }
        throw error;
    }
};

// 게시글 좋아요 토글
export const togglePostLike = async (postId: number) => {
    const url = `${BASE_URL}/api/posts/${postId}/like/`;
    const res = await axios.post(
        url,
        {},
        {
            headers: authHeaders(),
        }
    );
    return res.data;
};

// 댓글 좋아요 토글
export const toggleCommentLike = async (commentId: number) => {
    const url = `${BASE_URL}/api/comments/${commentId}/like/`;
    const res = await axios.post(
        url,
        {},
        {
            headers: authHeaders(),
        }
    );
    return res.data;
};

// 사용자의 내 게시글 목록 api
export const fetchUserPosts = async (
    userId: string,
    pageSize: number,
    page: number
): Promise<{ posts: PostItem[]; totalPages: number; postTypes?: Map<number, number> }> => {
    const headers: any = {
        Accept: "application/json",
    };
    
    Object.assign(headers, authHeaders());

    const res = await axios.get(`${BASE_URL}/api/users/${encodeURIComponent(userId)}/posts/`, {
        params: { page, page_size: pageSize },
        headers,
        withCredentials: true,
    });

    const rawResults = extractResults<RawPostItem>(res.data);
    const posts = rawResults.map(mapRawPostToPostItem);
    const count = typeof res.data?.count === "number" ? res.data.count : posts.length;

    return {
        posts,
        totalPages: Math.ceil(count / pageSize),
        postTypes: extractPostTypes(rawResults),
    };
};

// 권한 게이트된 첨부파일 다운로드
// 회원전용/스태프 게시판의 첨부는 공개 URL이 아니라 인증이 필요한 백엔드 엔드포인트로
// 내려오므로, Authorization 헤더를 실은 요청으로 blob을 받아 브라우저 저장을 트리거한다.
export const downloadGatedAttachment = async (
    url: string,
    fileName: string
): Promise<{ success: boolean; message?: string }> => {
    try {
        const apiRoot = `${BASE_URL.replace(/\/$/, "")}/api/`;
        const resolved = new URL(url, BASE_URL).href;
        if (!resolved.startsWith(apiRoot)) {
            return { success: false, message: "허용되지 않는 다운로드 경로입니다." };
        }
        const response = await axios.get(resolved, {
            headers: authHeaders(),
            responseType: "blob",
        });
        const blobUrl = window.URL.createObjectURL(response.data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        return { success: true };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "파일 다운로드에 실패했습니다.") };
    }
};

// 게시글 생성 api
export const createPost = async (
    boardId: number,
    postData: {
        title: string;
        content_md: string;
        attachment_paths: { path: string; name: string; }[];
        is_anonymous?: boolean;
    }
) => {
    const response = await axios.post(`${BASE_URL}/api/boards/${boardId}/posts/`, postData, {
        headers: authHeaders(),
    });
    return response.data;
};

// 게시글 삭제
interface DeletePostResponse {
    deleted?: boolean;
    message?: string;
}

export const deletePost = async (
    postId: number
): Promise<{ deleted?: boolean; status?: number; notFound?: boolean; message?: string }> => {
    try {
        const res = await axios.delete<DeletePostResponse>(`${BASE_URL}/api/posts/${postId}/`, {
            headers: { Accept: "application/json", ...authHeaders() },
            withCredentials: true,
        });

        const data = res.data;
        if (data && typeof data.deleted === "boolean") {
            return { deleted: data.deleted, status: res.status, message: data.message };
        }
        return { deleted: true, status: res.status };
    } catch (err: unknown) {
        if (isAxiosError(err)) {
            const status = err.response?.status;
            if (status === 401) return { status: 401, message: "권한이 없습니다." };
            if (status === 404) return { status: 404, notFound: true, message: "게시글을 찾을 수 없습니다." };
        }
        throw err;
    }
};

// 게시글 수정
export const modifyPost = async (
    postId: number,
    payload: {
        title: string;
        content_md: string;
        attachment_paths: { path: string; name: string; }[];
        board_id?: number;
        is_anonymous?: boolean;
        tag?: string;
    }
) => {
    const url = `${BASE_URL}/api/posts/${postId}/`;
    const res = await axios.patch(url, payload, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        withCredentials: true,
        responseType: "json",
    });

    return res.data;
};
