import React, {Suspense, lazy, useEffect, useRef, useState} from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import "./Home.css"
import "./Home-mobile.css"
import MainLayout from "../Utils/MainLayout";
import MobileNav from "../Utils/MobileNav";
import PostList from "../Posts/PostList";
import {
    createCalendarEvent,
    fetchQuizUrl,
    getBoards,
    signout,
    updateCalendarEvent,
} from "../../API/req";
import {
    Bell,
    Sun,
    Moon,
    Monitor,
    Contrast,
    Check,
    Search as SearchIcon,
    ChevronDown,
    User as UserIcon,
    Shield,
    LogOut,
    Plus,
} from "lucide-react";
import { Button } from "@primer/react";
import {CalendarEventCreate, Section} from "../Utils/interfaces";
import { useUser } from "../Utils/UserContext";
import { ThemePreference, useColorMode } from "../Utils/ThemeContext";
import Calendar from "../Utils/Calendar/Calendar";
import LoginModal from "../Utils/LoginModal";
import {useStaffAuth} from "../Utils/StaffAuthContext";
import {useAlert} from "../Utils/AlertContext";
import JbigInfo from "./JbigInfo";
import { useNotifications } from "./useNotifications";
import { getBoardsCacheKey, normalizeBoardsPayload, readBoardsCache, writeBoardsCache } from "./boardsCache";
import PhotoAlbumSlider from "./PhotoAlbumSlider";
import scheduleIdleTask from "../Utils/scheduleIdleTask";
import BrandMark from "../Utils/BrandMark";
import Skeleton from "../Utils/Skeleton";
import EmptyState from "../Utils/EmptyState";

const PostDetail = lazy(() => import("../Posts/PostDetail"));
const PostWrite = lazy(() => import("../Posts/PostWrite"));
const Search = lazy(() => import("../Posts/Search"));
const Profile = lazy(() => import("../Profile/Profile"));
const Arena = lazy(() => import("../Competitions/Arena"));
// 첫 화면 JS 를 줄이려고 필요할 때 불러온다: 일정 편집 창은 날짜 선택기(약 140KB)를 담고 운영진만 열며,
// 팝업은 마크다운 해석기(약 60KB)를 담고 활성 팝업이 있을 때만 보인다
const EventModal = lazy(() => import("../Utils/Calendar/EventModal"));
const PopupSlider = lazy(() => import("../Utils/PopupSlider"));
const routeFallback = (
    <div className="route-loading-fallback">
        <span className="sr-only" role="status">페이지를 불러오는 중입니다.</span>
        <Skeleton className="route-loading-bar route-loading-bar-lg" />
        <Skeleton className="route-loading-bar route-loading-bar-md" />
        <Skeleton className="route-loading-bar route-loading-bar-sm" />
    </div>
);

// 미디어(CDN) 베이스 URL. 운영은 REACT_APP_MEDIA_BASE_URL 로 주입(R2 + Cloudflare CDN).
// 미설정 시 CDN 커스텀 도메인으로 폴백.
const MEDIA_BASE_URL = (process.env.REACT_APP_MEDIA_BASE_URL || "https://cdn.jbig.co.kr").replace(/\/$/, "");
const BANNER_IMAGE_URL = `${MEDIA_BASE_URL}/static/banner.jpg`;
const DEFERRED_BOARDS_DELAY_MS = 1500;

const removeWidgetBot = () => {
    const crateElement = document.querySelector('widgetbot-crate');
    if (crateElement) {
        crateElement.remove();
    }
};

const Home: React.FC = () => {
    const [boards, setBoards] = useState<Section[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [quizURL, setQuizURL] = useState<string>("");
    const [userName, setUserName] = useState<string>("");
    const [userSemester, setUserSemester] = useState<number | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLogin, setLogin] = useState(false);
    const [isModalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create'|'edit'>('create');
    const [initialEvent, setInitialEvent] = useState<any>(null);
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const {
        notificationOpen, setNotificationOpen, notifications, unreadCount,
        handleOpenNotifications, handleNotificationClick, handleMarkAllRead,
    } = useNotifications(isLogin);

    const [headerSearch, setHeaderSearch] = useState("");
    const { user, signOutLocal, authReady, accessToken, refreshToken } = useUser();
    const { staffAuth } = useStaffAuth();
    const { showAlert } = useAlert();
    const { resolvedTheme, themePreference, setThemePreference } = useColorMode();

    const dropdownRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const themeMenuRef = useRef<HTMLDivElement>(null);
    const userMenuBtnRef = useRef<HTMLButtonElement>(null);
    const notificationBtnRef = useRef<HTMLButtonElement>(null);
    const themeBtnRef = useRef<HTMLButtonElement>(null);
    const headerSearchRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const isHomePage = location.pathname === '/';
    const isProfilePage = decodeURIComponent(location.pathname).startsWith('/@');
    const isArenaPage = location.pathname === '/arena' || location.pathname.startsWith('/arena/');
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const isPostWorkRoute = pathSegments[0] === 'search' || (
        pathSegments[0] === 'board' && (
            pathSegments[2] === 'write' ||
            pathSegments[3] === 'modify' ||
            (pathSegments.length === 3 && pathSegments[2] !== 'write')
        )
    );
    const shouldDeferBoards =
        pathSegments[0] === 'board' &&
        (
            pathSegments.length === 2 ||
            (pathSegments.length === 3 && pathSegments[2] !== 'write')
        );

    // WidgetBot 채팅 위젯 제거 (모바일/PC 공통)
    useEffect(() => {
        removeWidgetBot();
        return () => {
            removeWidgetBot();
        };
    }, []);

    useEffect(() => {
        const openHandler = (e: any) => {
            const { mode, event } = e.detail || {};
            setModalMode(mode || 'create');
            setInitialEvent(event || null);
            setModalOpen(true);
        };
        window.addEventListener('OPEN_EVENT_MODAL', openHandler);
        return () => {
            window.removeEventListener('OPEN_EVENT_MODAL', openHandler);
        }
    }, []);

    // 모달이 열린 동안 뒤 화면 스크롤 잠금은 Dialog 가 맡는다 (겹친 모달도 개수로 관리)

    useEffect(() => {
        if (!authReady) return;
        let cancelled = false;
        let cancelQuizTask: (() => void) | undefined;

        const nextUserName = user?.username ?? "";
        const semRaw = user?.semester;
        const sem = semRaw !== undefined && semRaw !== null ? Number(semRaw) : NaN;
        const hasSession = Boolean(nextUserName && Number.isFinite(sem) && sem > 0 && accessToken);

        if (!hasSession || !accessToken) {
            setUserName("");
            setUserSemester(null);
            setLogin(false);
            setQuizURL("");
        } else {
            setUserName(nextUserName);
            setUserSemester(sem);
            setLogin(true);

            cancelQuizTask = scheduleIdleTask(async () => {
                try {
                    const url = await fetchQuizUrl();
                    if (cancelled) return;
                    setQuizURL(url || "");
                } catch {
                    if (cancelled) return;
                    setQuizURL("");
                }
            }, { timeout: 2000, fallbackDelayMs: 1200 });
        }

        return () => {
            cancelled = true;
            cancelQuizTask?.();
        };
    }, [authReady, user, accessToken]);

    useEffect(() => {
        if (!authReady) return;

        let cancelled = false;
        let delayId: number | undefined;
        let cancelIdleTask: (() => void) | undefined;

        const userIdentity = user?.email || user?.username || "";
        const cacheKey = getBoardsCacheKey(accessToken, userIdentity, user?.is_staff);
        const cached = readBoardsCache(cacheKey);

        if (shouldDeferBoards && cached) {
            setBoards(cached.categories);
            setTotalCount(cached.total_post_count);
        }

        const loadBoards = async () => {
            try {
                const nextBoards = normalizeBoardsPayload(await getBoards());
                if (cancelled) return;
                setBoards(nextBoards.categories);
                setTotalCount(nextBoards.total_post_count);
                writeBoardsCache(cacheKey, nextBoards);
            } catch {
                if (cancelled || (shouldDeferBoards && cached)) return;
                setBoards([]);
            }
        };

        if (shouldDeferBoards) {
            delayId = window.setTimeout(() => {
                cancelIdleTask = scheduleIdleTask(loadBoards, { timeout: 2500, fallbackDelayMs: 1200 });
            }, DEFERRED_BOARDS_DELAY_MS);
        } else {
            loadBoards();
        }

        return () => {
            cancelled = true;
            if (delayId) window.clearTimeout(delayId);
            cancelIdleTask?.();
        };
    }, [
        authReady,
        accessToken,
        user?.email,
        user?.username,
        user?.is_staff,
        shouldDeferBoards,
    ]);

    // 외부 클릭 및 Escape로 드롭다운 닫기, '/'로 헤더 검색 포커스
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
                setNotificationOpen(false);
            }
            if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
                setThemeMenuOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                const activeEl = document.activeElement;
                const focusInUserMenu = Boolean(activeEl && dropdownRef.current?.contains(activeEl));
                const focusInNotification = Boolean(activeEl && notificationRef.current?.contains(activeEl));
                const focusInThemeMenu = Boolean(activeEl && themeMenuRef.current?.contains(activeEl));
                if (menuOpen) {
                    setMenuOpen(false);
                    if (focusInUserMenu) {
                        userMenuBtnRef.current?.focus();
                    }
                }
                if (notificationOpen) {
                    setNotificationOpen(false);
                    if (focusInNotification) {
                        notificationBtnRef.current?.focus();
                    }
                }
                if (themeMenuOpen) {
                    setThemeMenuOpen(false);
                    if (focusInThemeMenu) {
                        themeBtnRef.current?.focus();
                    }
                }
                return;
            }
            if (
                e.key === "/" &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.altKey &&
                !isModalOpen &&
                !isLoginModalOpen &&
                headerSearchRef.current
            ) {
                const target = e.target as HTMLElement | null;
                const tag = target?.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
                    return;
                }
                const formEl = headerSearchRef.current.closest("form");
                const formStyle = formEl ? window.getComputedStyle(formEl) : null;
                const inputStyle = window.getComputedStyle(headerSearchRef.current);
                if (
                    (!formStyle || formStyle.display !== "none") &&
                    inputStyle.display !== "none" &&
                    inputStyle.visibility !== "hidden"
                ) {
                    e.preventDefault();
                    headerSearchRef.current.focus();
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isModalOpen, isLoginModalOpen, menuOpen, notificationOpen, themeMenuOpen, setNotificationOpen]);

    const handleLogout = async () => {
        navigate("/");
        if (accessToken && refreshToken) {
            await signout();
        }
        signOutLocal();
        window.location.reload();
    };

    const handleAddEvent = () => {
        if(!authReady || !accessToken) {
            showAlert({ message: "로그인이 필요합니다.", type: 'warning' });
            signOutLocal();
            navigate("/signin");
            return;
        }
        setModalMode('create');
        setInitialEvent(null);
        setModalOpen(true);
    };

    const handleSaveEvent = async (newEvent: CalendarEventCreate, id?: string) => {
        try {
            if (!accessToken) {
                showAlert({ message: "로그인이 필요합니다.", type: 'warning' });
                signOutLocal();
                navigate("/signin");
                return;
            }

            if (modalMode === "edit" && id) {
                const updated = await updateCalendarEvent(id, newEvent);
                window.dispatchEvent(new CustomEvent("CALENDAR_EVENT_SAVED", {
                    detail: { mode: "edit", event: updated },
                }));
            } else {
                const created = await createCalendarEvent(newEvent);
                window.dispatchEvent(new CustomEvent("CALENDAR_EVENT_SAVED", {
                    detail: { mode: "create", event: created },
                }));
            }

            setModalOpen(false);
        } catch (err: any) {
            let message = "이벤트 저장 중 오류가 발생했습니다.";
            if (err?.response?.data) {
                const d = err.response.data;
                if (typeof d === 'string') message = d;
                else if (typeof d?.detail === 'string') message = d.detail;
                else if (typeof d?.message === 'string') message = d.message;
                else if (typeof d === 'object') {
                    const firstKey = Object.keys(d)[0];
                    const firstVal = d[firstKey];
                    if (Array.isArray(firstVal) && firstVal.length > 0) message = firstVal[0];
                }
            }
            showAlert({ message, type: 'error' });
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const handleHeaderSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = headerSearch.trim();
        if (!trimmed) return;
        setHeaderSearch("");
        navigate(`/search/all?q=${encodeURIComponent(trimmed)}&page_size=10`);
    };

    const userInitial = userName ? userName.trim().charAt(0).toUpperCase() : "J";
    const sidebarProps = { boards, isLogin, quizURL, totalCount, navigate };

    return (
        <div className={`home-wrapper${isArenaPage ? ' arena-home' : ''}`}>
            <header className="home-header">
                <div className="home-header-inner">
                    <div className="home-header-left">
                        <MobileNav
                            boards={boards}
                            isLogin={isLogin}
                            quizURL={quizURL}
                            totalCount={totalCount}
                            navigate={navigate}
                            staffAuth={staffAuth}
                        />
                        <button type="button" className="logo" onClick={() => navigate('/')}>
                            <BrandMark className="logo-mark" />
                            <span className="logo-text">JBIG</span>
                        </button>
                    </div>

                    <form className="header-search-form" onSubmit={handleHeaderSearchSubmit} role="search">
                        <SearchIcon size={15} className="header-search-icon" aria-hidden="true" />
                        <input
                            ref={headerSearchRef}
                            type="text"
                            className="header-search-input"
                            placeholder="게시글 검색..."
                            aria-label="전체 게시글 검색"
                            value={headerSearch}
                            onChange={(e) => setHeaderSearch(e.target.value)}
                        />
                        <kbd className="header-search-kbd" aria-hidden="true">/</kbd>
                    </form>

                    <div className="header-right-section">
                        <div className="theme-menu-wrapper" ref={themeMenuRef}>
                            <button
                                ref={themeBtnRef}
                                type="button"
                                className="theme-toggle-btn"
                                onClick={() => {
                                    setThemeMenuOpen((prev) => !prev);
                                    setMenuOpen(false);
                                    setNotificationOpen(false);
                                }}
                                aria-label="테마 선택"
                                aria-haspopup="menu"
                                aria-expanded={themeMenuOpen}
                                title="테마 선택 (시스템 / 라이트 / 다크 딤드 / 다크)"
                            >
                                {themePreference === "auto" ? (
                                    <Monitor size={17} aria-hidden="true" />
                                ) : resolvedTheme === "light" ? (
                                    <Sun size={17} aria-hidden="true" />
                                ) : resolvedTheme === "dark_dimmed" ? (
                                    <Contrast size={17} aria-hidden="true" />
                                ) : (
                                    <Moon size={17} aria-hidden="true" />
                                )}
                            </button>
                            {themeMenuOpen && (
                                <div className="theme-dropdown" role="menu" aria-label="테마 선택">
                                    <div className="theme-dropdown-header">화면 테마</div>
                                    {(
                                        [
                                            { id: "auto", label: "시스템 설정", desc: "OS 설정 자동 추적", Icon: Monitor },
                                            { id: "light", label: "라이트", desc: "밝은 화이트 톤", Icon: Sun },
                                            { id: "dark_dimmed", label: "다크 딤드", desc: "눈이 편안한 슬레이트", Icon: Contrast },
                                            { id: "dark", label: "다크", desc: "깊은 미드나잇 다크", Icon: Moon },
                                        ] as { id: ThemePreference; label: string; desc: string; Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }[]
                                    ).map(({ id, label, desc, Icon }) => {
                                        const isActive = themePreference === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={isActive}
                                                className={`theme-option${isActive ? " is-active" : ""}`}
                                                onClick={() => {
                                                    setThemePreference(id);
                                                    setThemeMenuOpen(false);
                                                    themeBtnRef.current?.focus();
                                                }}
                                            >
                                                <Icon size={15} aria-hidden={true} />
                                                <span className="theme-option-copy">
                                                    <span className="theme-option-label">{label}</span>
                                                    <span className="theme-option-desc">{desc}</span>
                                                </span>
                                                {isActive && <Check size={14} className="theme-option-check" aria-hidden="true" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 알림 아이콘 */}
                        {isLogin && (
                            <div className="notification-wrapper" ref={notificationRef}>
                                <button
                                    ref={notificationBtnRef}
                                    type="button"
                                    className="notification-icon-wrapper"
                                    onClick={handleOpenNotifications}
                                    aria-label="알림 열기"
                                    aria-expanded={notificationOpen}
                                >
                                    <Bell size={17} aria-hidden="true" />
                                    {unreadCount > 0 && (
                                        <span className="notification-badge">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    )}
                                </button>
                                {notificationOpen && (
                                    <div className="notification-dropdown">
                                        <div className="notification-header">
                                            <span className="notification-title">알림</span>
                                            {unreadCount > 0 && (
                                                <button type="button" className="mark-all-read-btn" onClick={handleMarkAllRead}>
                                                    모두 읽음
                                                </button>
                                            )}
                                        </div>
                                        <div className="notification-list">
                                            {notifications.length === 0 ? (
                                                <EmptyState compact icon={<Bell size={22} />} title="새로운 알림이 없습니다" />
                                            ) : (
                                                notifications.map(n => (
                                                    <button
                                                        type="button"
                                                        key={n.id}
                                                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                                                        onClick={() => handleNotificationClick(n)}
                                                    >
                                                        <div className="notification-content">
                                                            <span className="notification-actor">
                                                                {n.actor_semester > 0 ? `${n.actor_semester}기 ` : ''}{n.actor_name}
                                                            </span>
                                                            <span className="notification-text">
                                                                {n.notification_type <= 5 && '님이 '}
                                                                {n.notification_type === 1 && '회원님의 글에 댓글을 남겼습니다'}
                                                                {n.notification_type === 2 && '회원님의 댓글에 답글을 남겼습니다'}
                                                                {n.notification_type === 3 && '회원님의 글을 좋아합니다'}
                                                                {n.notification_type === 4 && '회원님의 댓글을 좋아합니다'}
                                                                {n.notification_type === 5 && '회원님의 모집에 지원했습니다'}
                                                                {n.notification_type === 6 && '모집에 합류가 확정되었습니다!'}
                                                                {n.notification_type === 7 && '모집에 선발되지 않았습니다'}
                                                                {n.notification_type === 8 && '모집이 마감되었습니다'}
                                                            </span>
                                                        </div>
                                                        <div className="notification-post-title">
                                                            {n.post_title && n.post_title.length > 28 ? n.post_title.slice(0, 28) + '...' : (n.post_title || '삭제된 게시글')}
                                                        </div>
                                                        {n.comment_content && (
                                                            <div className="notification-comment">
                                                                &ldquo;{n.comment_content}&rdquo;
                                                            </div>
                                                        )}
                                                        <div className="notification-time">
                                                            {new Date(n.created_at).toLocaleDateString('ko-KR', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 유저 메뉴 */}
                        <div className="user-info-wrapper" ref={dropdownRef}>
                            {userName ? (
                                <button
                                    ref={userMenuBtnRef}
                                    type="button"
                                    className="user-info-clickable"
                                    onClick={() => setMenuOpen(prev => !prev)}
                                    aria-expanded={menuOpen}
                                >
                                    <span className="user-avatar-chip" aria-hidden="true">{userInitial}</span>
                                    <span className="user-info-name">
                                        {typeof userSemester === "number" && userSemester > 0 && (
                                            <span className="user-semester-tag">{userSemester}기&nbsp;</span>
                                        )}
                                        {userName}
                                    </span>
                                    <ChevronDown size={14} className="user-chevron" aria-hidden="true" />
                                </button>
                            ) : (
                                <Button variant="default" size="small" className="login-button" onClick={() => setLoginModalOpen(true)}>
                                    로그인
                                </Button>
                            )}

                            {menuOpen && (
                                <div className="user-dropdown">
                                    <div className="dropdown-user-header">
                                        <span className="dropdown-user-name">
                                            {typeof userSemester === "number" && userSemester > 0 ? `${userSemester}기 ` : ""}
                                            {userName}
                                        </span>
                                        {user?.email && <span className="dropdown-user-email">{user.email}</span>}
                                    </div>
                                    <div className="dropdown-divider" />
                                    <button type="button" className="dropdown-item" onClick={() => {
                                        if (user?.email) {
                                            const username = user.email.split("@")[0];
                                            navigate(`/@${username}`);
                                        }
                                        setMenuOpen(false);
                                    }}>
                                        <UserIcon size={15} aria-hidden="true" />
                                        <span>내 정보</span>
                                    </button>
                                    {(staffAuth || user?.is_staff) && (
                                        <button type="button" className="dropdown-item" onClick={() => {
                                            navigate('/admin');
                                            setMenuOpen(false);
                                        }}>
                                            <Shield size={15} aria-hidden="true" />
                                            <span>관리자 페이지 열기</span>
                                        </button>
                                    )}
                                    <div className="dropdown-divider" />
                                    <button type="button" className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                                        <LogOut size={15} aria-hidden="true" />
                                        <span>로그아웃</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            {isProfilePage ? (
                <Suspense fallback={routeFallback}>
                    <Profile />
                </Suspense>
            ) : (
            <>
            {isHomePage && !isArenaPage && (
                <div className="home-banner-wrap">
                    <button type="button" className="home-banner" onClick={() => navigate('/')} aria-label="홈으로 이동">
                        {/* design-lint-allow img-lazy: 첫 화면 맨 위 배너라 바로 불러온다 */}
                        <img decoding="async" src={BANNER_IMAGE_URL} alt="JBIG 배너" className="banner-image"/>
                    </button>
                </div>
            )}
            <div className="home-content">
                <Routes>
                    {/* home-content 전체 차지하는 경로 */}
                    <Route path="board/:category/write" element={
                        <Suspense fallback={routeFallback}>
                            <PostWrite boards={boards}/>
                        </Suspense>
                    }/>
                    <Route path="/board/:category/:id/modify" element={
                        <Suspense fallback={routeFallback}>
                            <PostWrite boards={boards}/>
                        </Suspense>
                    }/>
                    {/* sidebar+main-area */}
                    <Route path="arena/*" element={
                        <MainLayout sidebarProps={sidebarProps}>
                            <Suspense fallback={routeFallback}>
                                <Arena onLogin={() => setLoginModalOpen(true)} />
                            </Suspense>
                        </MainLayout>
                    }/>
                    <Route path="/" element={
                        <MainLayout sidebarProps={sidebarProps}>
                            <JbigInfo
                                calendarSlot={
                                    <Calendar
                                        staffAuth={staffAuth}
                                        compact
                                        embedded
                                        toolbarAction={staffAuth ? (
                                            <Button
                                                size="small"
                                                variant="default"
                                                leadingVisual={() => <Plus size={13} aria-hidden="true" />}
                                                onClick={handleAddEvent}
                                                className="add-event-btn-home"
                                            >
                                                일정 추가
                                            </Button>
                                        ) : undefined}
                                    />
                                }
                            />
                            <PostList boards={boards} isHome={true}/>
                            <PhotoAlbumSlider boards={boards} />
                        </MainLayout>
                    }/>
                    <Route path="board/:boardId" element={
                        <MainLayout sidebarProps={sidebarProps}>
                            <PostList boards={boards}/>
                        </MainLayout>
                    }/>
                    <Route path="board/:boardId/:id" element={
                        <MainLayout sidebarProps={sidebarProps}>
                            <Suspense fallback={routeFallback}>
                                <PostDetail/>
                            </Suspense>
                        </MainLayout>
                    }/>
                    <Route
                        path="search/:boardId"
                        element={
                            <MainLayout sidebarProps={sidebarProps}>
                                <Suspense fallback={routeFallback}>
                                    <Search boards={boards}/>
                                </Suspense>
                            </MainLayout>
                        }
                    />
                </Routes>
            </div>
            {isModalOpen && (
                <Suspense fallback={null}>
                    <EventModal
                        mode={modalMode}
                        initial={initialEvent}
                        onClose={handleCloseModal}
                        onSave={handleSaveEvent}
                    />
                </Suspense>
            )}

            {/* 팝업 슬라이더 */}
            {!isPostWorkRoute && !isArenaPage && (
                <Suspense fallback={null}>
                    <PopupSlider />
                </Suspense>
            )}
            </>
            )}
            {isLoginModalOpen && (
                <LoginModal onClose={() => setLoginModalOpen(false)} redirectTo={isArenaPage ? location.pathname : '/'} />
            )}
        </div>
    );
};

export default Home;
