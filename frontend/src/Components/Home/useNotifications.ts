import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    markNotificationRead,
    NotificationItem,
} from "../../API/req";
import { useUser } from "../Utils/UserContext";
import { useAlert } from "../Utils/AlertContext";
import scheduleIdleTask from "../Utils/scheduleIdleTask";

/**
 * 헤더 알림: 안 읽은 개수(첫 화면이 한가할 때 한 번, 그 뒤 30초마다), 드롭다운 열기와 목록 조회,
 * 알림 눌러 글로 이동하며 읽음 처리, 모두 읽음.
 */
export const useNotifications = (isLogin: boolean) => {
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { accessToken } = useUser();
    const { showAlert } = useAlert();
    const navigate = useNavigate();

    // 알림 개수 주기적으로 조회 (30초마다)
    useEffect(() => {
        if (!accessToken || !isLogin) {
            setUnreadCount(0);
            return;
        }

        let cancelled = false;

        const loadUnreadCount = async () => {
            try {
                const count = await fetchUnreadNotificationCount();
                if (cancelled) return;
                setUnreadCount(count);
            } catch (err) {
                console.error('[Notification] Failed to fetch unread count:', err);
            }
        };

        const cancelFirstLoad = scheduleIdleTask(loadUnreadCount, { timeout: 2500, fallbackDelayMs: 1500 });

        // 30초마다 알림 개수 갱신
        const interval = setInterval(loadUnreadCount, 30000);

        return () => {
            cancelled = true;
            cancelFirstLoad();
            clearInterval(interval);
        };
    }, [accessToken, isLogin]);

    // 알림 드롭다운 열 때 알림 목록 조회
    const handleOpenNotifications = async () => {
        if (!accessToken) {
            showAlert({ message: "로그인이 필요합니다.", type: 'warning' });
            navigate("/signin");
            return;
        }
        
        const wasOpen = notificationOpen;
        setNotificationOpen(prev => !prev);
        
        if (!wasOpen) {
            try {
                const data = await fetchNotifications();
                setNotifications(data);
                
                // 빈 배열이지만 unreadCount가 있다면 재조회 시도
                if (data.length === 0 && unreadCount > 0) {
                    console.warn('[Notification] Empty notifications but unreadCount > 0, rechecking...');
                    // 알림 개수 다시 확인
                    const newCount = await fetchUnreadNotificationCount();
                    setUnreadCount(newCount);
                }
            } catch (err) {
                console.error('[Notification] Failed to fetch notifications:', err);
                // 토큰 갱신 실패로 로그아웃된 경우는 이미 interceptor에서 처리됨
                setNotificationOpen(false);
            }
        }
    };

    // 알림 클릭 시 해당 게시글로 이동
    const handleNotificationClick = async (notification: NotificationItem) => {
        if (!accessToken) return;
        
        setNotificationOpen(false);
        
        // 게시글이나 게시판이 삭제된 경우 처리
        if (!notification.board_id || !notification.post_id) {
            showAlert({ 
                message: "삭제된 게시글입니다.", 
                type: 'warning' 
            });
            
            // 읽음 처리만 진행
            try {
                await markNotificationRead(notification.id);
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
                );
            } catch (err) {
                console.error('[Notification] Failed to mark as read:', err);
            }
            return;
        }
        
        // 페이지 이동
        navigate(`/board/${notification.board_id}/${notification.post_id}`);
        
        // 읽음 처리는 백그라운드에서
        try {
            await markNotificationRead(notification.id);
            setUnreadCount(prev => Math.max(0, prev - 1));
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
            );
        } catch (err) {
            console.error('[Notification] Failed to mark as read:', err);
        }
    };

    // 전체 읽음 처리
    const handleMarkAllRead = async () => {
        if (!accessToken) return;
        try {
            await markNotificationRead();
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('[Notification] Failed to mark all as read:', err);
        }
    };

    return {
        notificationOpen,
        setNotificationOpen,
        notifications,
        unreadCount,
        handleOpenNotifications,
        handleNotificationClick,
        handleMarkAllRead,
    };
};
