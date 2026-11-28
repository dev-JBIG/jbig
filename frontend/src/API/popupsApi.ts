/** 팝업. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

// 팝업 관련 API
export interface PopupItem {
    id: number;
    title: string;
    content: string;
    image_url?: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by: number | null;
    created_by_username: string;
    order: number;
    source_post_id?: number | null;
    source_board_id?: number | null;
    auto_generated?: boolean;
}

export interface PopupCreate {
    title: string;
    content: string;
    image_path?: string;  // 생성/수정 시 스토리지 key 경로 전송
    start_date: string;
    end_date: string;
    is_active?: boolean;
    order?: number;
}

// 활성 팝업 조회 (사용자용 — 토큰 전달 시 dismiss 필터링 적용)
export const fetchActivePopups = async (): Promise<PopupItem[]> => {
    const url = `${BASE_URL}/api/popups/`;
    const headers: any = {};
    Object.assign(headers, authHeaders());
    const res = await axios.get(url, { headers });
    return res.data;
};

// 팝업 dismiss (다시 보지 않기)
export const dismissPopup = async (popupId: number): Promise<void> => {
    await axios.post(`${BASE_URL}/api/popups/${popupId}/dismiss/`, {}, {
        headers: authHeaders(),
    });
};

// 모든 팝업 조회 (관리자용)
export const fetchAllPopups = async (): Promise<PopupItem[]> => {
    const url = `${BASE_URL}/api/popups/`;
    const res = await axios.get(url, {
        headers: authHeaders(),
    });
    return res.data;
};

// 팝업 생성
export const createPopup = async (data: PopupCreate): Promise<PopupItem> => {
    const url = `${BASE_URL}/api/popups/`;
    const res = await axios.post(url, data, {
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
        }
    });
    return res.data;
};

// 팝업 수정
export const updatePopup = async (id: number, data: Partial<PopupCreate>): Promise<PopupItem> => {
    const url = `${BASE_URL}/api/popups/${id}/`;
    const res = await axios.patch(url, data, {
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
        }
    });
    return res.data;
};

// 팝업 삭제
export const deletePopup = async (id: number): Promise<void> => {
    const url = `${BASE_URL}/api/popups/${id}/`;
    await axios.delete(url, {
        headers: authHeaders()
    });
};
