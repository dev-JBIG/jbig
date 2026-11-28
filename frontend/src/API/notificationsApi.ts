/** 알림. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

// 알림 관련 API
export interface NotificationItem {
    id: number;
    notification_type: number;
    notification_type_display: string;
    actor_name: string;
    actor_semester: number;
    post_id: number | null;
    post_title: string | null;
    board_id: number | null;
    comment_content: string | null;
    is_read: boolean;
    created_at: string;
}

export const fetchNotifications = async (): Promise<NotificationItem[]> => {
    const url = `${BASE_URL}/api/notifications/`;
    const res = await axios.get(url, {
        headers: authHeaders(),
    });
    // 페이지네이션 응답일 경우 results 배열 반환, 아니면 그대로 반환
    if (Array.isArray(res.data)) {
        return res.data;
    }
    return res.data.results || [];
};

export const fetchUnreadNotificationCount = async (): Promise<number> => {
    const url = `${BASE_URL}/api/notifications/unread-count/`;
    const res = await axios.get(url, {
        headers: authHeaders(),
    });
    return res.data.unread_count;
};

export const markNotificationRead = async (notificationId?: number): Promise<void> => {
    const url = notificationId
        ? `${BASE_URL}/api/notifications/${notificationId}/mark-read/`
        : `${BASE_URL}/api/notifications/mark-read/`;
    await axios.post(url, {}, {
        headers: authHeaders(),
    });
};
