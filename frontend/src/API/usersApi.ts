/** 회원 정보, 회원 글과 댓글, 비밀번호 변경, 공개 프로필과 이력서. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";
import { UserProfile, UserComment } from "../Components/Utils/interfaces";
import { getErrorMessage, extractResults } from "./apiShared";

// 사용자 정보 조회
export const fetchUserInfo = async (
    userId: string
): Promise<UserProfile> => {
    const url = `${BASE_URL}/api/users/${encodeURIComponent(userId)}/`;
    const res = await axios.get(url, {
        headers: {
            Accept: "application/json",
            ...authHeaders(),
        },
        withCredentials: true,
        responseType: "json",
    });

    const data = res.data as {
        username: string;
        email: string;
        semester: number;
        is_staff: boolean;
        date_joined: string;
        is_self: boolean;
        post_count: number;
        comment_count: number;
    };

    return {
        username: data.username,
        email: data.email,
        semester: data.semester,
        date_joined: data.date_joined,
        is_self: data.is_self,
        role: data.is_staff ? "관리자" : "멤버",
        post_count: data.post_count,
        comment_count: data.comment_count,
    };
};

// 사용자 댓글 목록 조회
export const fetchUserComments = async (
    userId: string,
    pageSize: number,
    page: number
): Promise<{ comments: UserComment[]; totalPages: number }> => {
    const url = `${BASE_URL}/api/users/${encodeURIComponent(userId)}/comments/`;

    const headers: any = {
        Accept: "application/json",
    };
    
    Object.assign(headers, authHeaders());

    const res = await axios.get(url, {
        params: { page, page_size: pageSize },
        headers,
        withCredentials: true,
        responseType: "json",
    });

    interface RawComment {
        id: number;
        post_id: number;
        user_id: string;
        board_id: number | null;
        author: string;
        content: string;
        post_title: string;
        created_at: string;
        parent: number | null;
        children: unknown[];
        is_owner: boolean;
        is_deleted: boolean;
    }

    const rawResults = extractResults<RawComment>(res.data);

    const comments: UserComment[] = rawResults
        .filter((c) => !c.is_deleted)
        .map((c) => ({
            id: c.id,
            post_id: c.post_id,
            user_id: c.user_id,
            board_id: c.board_id,
            author: c.author,
            content: c.content,
            post_title: c.post_title,
            created_at: c.created_at.replace("T", " ").slice(0, 19),
            parent: c.parent,
            children: c.children,
            is_owner: c.is_owner,
        }));

    const count = typeof res.data?.count === "number" ? res.data.count : comments.length;

    return {
        comments,
        totalPages: Math.ceil(count / pageSize),
    };
};

// 비밀번호 변경
export async function changePassword(
    oldPassword: string,
    newPassword1: string,
    newPassword2: string
): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await axios.post<{ detail?: string }>(
            `${BASE_URL}/api/users/password/change/`,
            { old_password: oldPassword, new_password1: newPassword1, new_password2: newPassword2 },
            { headers: { ...authHeaders(), "Content-Type": "application/json" } }
        );
        return { success: true, message: res.data?.detail || "비밀번호 변경 성공" };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "비밀번호 변경에 실패했습니다.") };
    }
}

// 공개 프로필
export interface ProfileBlockData {
    id: string;
    type: string;
    data: Record<string, any>;
    style: Record<string, any>;
}

export interface PublicProfile {
    username: string;
    email_id: string;
    semester: number;
    resume: string;
    profile_blocks: ProfileBlockData[];
    profile_type: 'blocks' | 'html';
    profile_html: string;
    date_joined: string;
    last_login: string | null;
    is_self: boolean;
    posts: {
        id: number;
        board_id: number;
        board_post_id: number;
        title: string;
        created_at: string;
        views: number;
    }[];
    comments: {
        id: number;
        content: string;
        post_id: number;
        board_id: number | null;
        board_post_id: number | null;
        post_title: string;
        created_at: string;
    }[];
}

export const fetchPublicProfile = async (
    username: string,
    includeActivity: boolean = false
): Promise<PublicProfile> => {
    const url = `${BASE_URL}/api/users/profile/${encodeURIComponent(username)}/`;
    const res = await axios.get(url, {
        headers: authHeaders(),
        params: includeActivity ? { include_activity: "1" } : undefined,
    });
    return res.data;
};

export const fetchPublicProfileActivity = async (
    username: string
): Promise<Pick<PublicProfile, "posts" | "comments">> => {
    const data = await fetchPublicProfile(username, true);
    return {
        posts: Array.isArray(data.posts) ? data.posts : [],
        comments: Array.isArray(data.comments) ? data.comments : [],
    };
};

export const updateResume = async (resume: string): Promise<{ resume: string }> => {
    const url = `${BASE_URL}/api/users/profile/`;
    const res = await axios.patch(url, { resume }, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
    });
    return res.data;
};

export const updateProfileBlocks = async (blocks: ProfileBlockData[]): Promise<{ profile_blocks: ProfileBlockData[] }> => {
    const url = `${BASE_URL}/api/users/profile/blocks/`;
    const res = await axios.patch(url, { profile_blocks: blocks }, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
    });
    return res.data;
};

export const updateProfileHtml = async (
    payload: { profile_type: 'blocks' | 'html'; profile_html?: string }
): Promise<{ profile_type: 'blocks' | 'html'; profile_html: string }> => {
    const url = `${BASE_URL}/api/users/profile/html/`;
    const res = await axios.patch(url, payload, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
    });
    return res.data;
};
