/** 글 임시저장. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import { isAxiosError } from "axios";
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

// 임시저장 관련 API (계정 단일 버퍼)
export interface DraftData {
    board_id?: number | null;
    board_name?: string | null;
    title: string;
    content_md: string;
    uploaded_paths: string[];
    created_at?: string;
    updated_at?: string;
}

// 임시저장 버퍼 조회
export const fetchDraft = async (): Promise<DraftData | null> => {
    const url = `${BASE_URL}/api/draft/`;
    try {
        const res = await axios.get(url, {
            headers: authHeaders(),
        });
        return res.data;
    } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
            return null; // 임시저장 없음
        }
        throw err;
    }
};

// 임시저장 버퍼 생성/업데이트
export const saveDraft = async (
    data: { board_id?: number | null; title: string; content_md: string; uploaded_paths: string[] }
): Promise<DraftData> => {
    const url = `${BASE_URL}/api/draft/`;
    const res = await axios.post(url, data, {
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
        },
    });
    return res.data;
};

// 임시저장 버퍼 삭제
export const deleteDraft = async (): Promise<void> => {
    const url = `${BASE_URL}/api/draft/delete/`;
    await axios.delete(url, {
        headers: authHeaders(),
    });
};
