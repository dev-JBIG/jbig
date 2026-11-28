/** 댓글 작성, 수정, 삭제. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";
import { Reply, Comment } from "../Components/Utils/interfaces";

// 댓글 삭제
export const deleteComment = async (commentId: number): Promise<void> => {
    const url = `${BASE_URL}/api/comments/${commentId}/`;
    await axios.delete(url, {
        headers: authHeaders(),
        withCredentials: true,
    });
};

// 댓글 등록
export const createComment = async (
    postId: number,
    payload: { content: string; parent: number | null; is_anonymous?: boolean; turnstile_token?: string }
): Promise<Comment | Reply> => {
    const url = `${BASE_URL}/api/posts/${postId}/comments/`;
    const headers: any = {
        Accept: "application/json",
        "Content-Type": "application/json",
    };
    Object.assign(headers, authHeaders());
    const res = await axios.post(url, payload, {
        headers,
        withCredentials: true,
        responseType: "json",
    });

    const d = res.data as {
        id: number;
        user_id: string;
        author_semester: number;
        author: string;
        content: string;
        created_at: string;
        parent: number | null;
        is_owner: boolean;
        is_deleted: boolean;
        likes?: number;
        isLiked?: boolean;
    };

    const date = d.created_at ? d.created_at.slice(0, 16).replace("T", " ") : "";
    const isReply = (payload.parent !== null && payload.parent !== 0) ||
        (d.parent !== null && d.parent !== 0);

    if (isReply) {
        const reply: Reply = {
            id: d.id,
            user_id: d.user_id,
            author_semester: d.author_semester,
            author: d.author,
            content: d.content,
            date,
            is_owner: d.is_owner,
            is_deleted: false,
            likes: d.likes || 0,
            isLiked: d.isLiked || false,
        };
        return reply;
    } else {
        const comment: Comment = {
            id: d.id,
            user_id: d.user_id,
            author_semester: d.author_semester,
            author: d.author,
            content: d.content,
            date,
            is_owner: d.is_owner,
            is_deleted: false,
            replies: [] as Reply[],
            likes: d.likes || 0,
            isLiked: d.isLiked || false,
        };
        return comment;
    }
};

// 댓글 수정
export const updateComment = async (
    commentId: number,
    payload: { content: string; parent: number | null; is_anonymous?: boolean }
): Promise<Comment | Reply> => {
    const url = `${BASE_URL}/api/comments/${commentId}/`;
    const res = await axios.patch(url, payload, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        withCredentials: true,
        responseType: "json",
    });

    const d = res.data as {
        id: number;
        user_id: string;
        author_semester: number;
        author: string;
        content: string;
        created_at: string;
        parent: number | null;
        is_owner: boolean;
        is_deleted?: boolean;
        likes?: number;
        isLiked?: boolean;
    };

    const date = d.created_at ? d.created_at.slice(0, 16).replace("T", " ") : "";
    const isReply = (payload.parent !== null && payload.parent !== 0) ||
        (d.parent !== null && d.parent !== 0);
    const isDeleted = !!d.is_deleted;

    if (isReply) {
        const reply: Reply = {
            id: d.id,
            user_id: d.user_id,
            author_semester: d.author_semester,
            author: d.author,
            content: d.content,
            date,
            is_owner: !!d.is_owner,
            is_deleted: isDeleted,
            likes: d.likes || 0,
            isLiked: d.isLiked || false,
        };
        return reply;
    } else {
        const comment: Comment = {
            id: d.id,
            user_id: d.user_id,
            author_semester: d.author_semester,
            author: d.author,
            content: d.content,
            date,
            is_owner: !!d.is_owner,
            is_deleted: isDeleted,
            replies: [] as Reply[],
            likes: d.likes || 0,
            isLiked: d.isLiked || false,
        };
        return comment;
    }
};
