import React, { ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@primer/react";
import { Eye, Heart, MessageSquare } from "lucide-react";
import { useUser } from "../Utils/UserContext";
import { fetchPopularPosts, PopularSort } from "../../API/req";
import { PostItem } from "../Utils/interfaces";
import EmptyState from "../Utils/EmptyState";
import Skeleton from "../Utils/Skeleton";
import { HOME_PROMOS, PROFILE_TARGET } from "./homePromos";
import "./HomeSidePane.css";

type PaneTab = "calendar" | "popular";

const TABS: { id: PaneTab; label: string }[] = [
    { id: "calendar", label: "일정" },
    { id: "popular", label: "인기 글" },
];
const TAB_STORAGE_KEY = "jbig-home-pane-tab";

const SORTS: { id: PopularSort; label: string; icon: React.ElementType }[] = [
    { id: "likes", label: "좋아요", icon: Heart },
    { id: "comments", label: "댓글", icon: MessageSquare },
    { id: "views", label: "조회", icon: Eye },
];

const readStoredTab = (): PaneTab => {
    try {
        const v = localStorage.getItem(TAB_STORAGE_KEY);
        if (v === "calendar" || v === "popular") return v;
    } catch {
        // 저장소를 못 쓰는 환경이면 기본값
    }
    return "calendar";
};

const metricOf = (post: PostItem, sort: PopularSort) =>
    sort === "likes" ? post.likes : sort === "comments" ? post.comment_count : post.views;

const PopularList: React.FC = () => {
    const [sort, setSort] = useState<PopularSort>("likes");
    const [posts, setPosts] = useState<PostItem[] | null>(null);
    const [failed, setFailed] = useState(false);
    // 실패 뒤 다시 시도 버튼이 올리는 값. 성공한 목록은 탭을 바꿔도 그대로 다시 쓴다
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        setPosts(null);
        setFailed(false);
        fetchPopularPosts(sort)
            .then((list) => { if (alive) setPosts(list); })
            .catch(() => { if (alive) { setPosts([]); setFailed(true); } });
        return () => { alive = false; };
    }, [sort, attempt]);

    const current = SORTS.find((s) => s.id === sort) ?? SORTS[0];
    const SortIcon = current.icon;

    return (
        <div className="home-pane-popular">
            <div className="home-pane-sort" role="group" aria-label="인기 기준">
                {SORTS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        className="home-pane-sort-btn"
                        aria-pressed={sort === s.id}
                        onClick={() => setSort(s.id)}
                    >
                        {s.label}
                    </button>
                ))}
                <span className="home-pane-sort-range">최근 30일</span>
            </div>
            {posts === null ? (
                <div className="home-pane-rank-skeleton">
                    <span className="sr-only" role="status">인기 글을 불러오는 중입니다.</span>
                    {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="home-pane-rank-skeleton-row" />)}
                </div>
            ) : posts.length === 0 ? (
                <EmptyState
                    compact
                    title={failed ? "인기 글을 불러오지 못했어요" : "아직 인기 글이 없어요"}
                    description={failed ? "잠시 뒤 다시 시도해 주세요." : "최근 30일 안에 반응이 모이면 여기에 보여요."}
                    action={failed ? (
                        <Button size="small" onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>
                    ) : undefined}
                />
            ) : (
                <ol className="home-pane-rank">
                    {posts.map((post, i) => (
                        <li key={post.id}>
                            <Link className="home-pane-rank-link" to={`/board/${post.board_id ?? 0}/${post.id}`}>
                                <span className="home-pane-rank-no">{i + 1}</span>
                                <span className="home-pane-rank-text">
                                    <span className="home-pane-rank-title">{post.title}</span>
                                    {post.board_name && <span className="home-pane-rank-meta">{post.board_name}</span>}
                                </span>
                                <span className="home-pane-rank-metric">
                                    <SortIcon size={12} aria-hidden="true" />
                                    <span className="sr-only">{current.label}</span>
                                    {metricOf(post, sort)}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

/** 맨 위 한 줄 소식(새 기능, 대회, 행사). 숫자 버튼으로 다음 소식 */
const NewsStrip: React.FC = () => {
    const { user } = useUser();
    const [index, setIndex] = useState(0);
    if (HOME_PROMOS.length === 0) return null;
    const item = HOME_PROMOS[index];
    const username = user?.email ? user.email.split("@")[0] : "";
    const to = item.to === PROFILE_TARGET ? (username ? `/@${username}` : "/signin") : item.to;
    const count = HOME_PROMOS.length;

    return (
        <div className="home-pane-strip">
            <Link className="home-pane-strip-link" to={to} title={item.description}>
                <span className="home-pane-strip-kicker">{item.kicker}</span>
                <span className="home-pane-strip-title">{item.title}</span>
            </Link>
            {count > 1 && (
                <button
                    type="button"
                    className="home-pane-strip-next"
                    aria-label={`다음 소식 보기, 지금 ${index + 1}번째 / 모두 ${count}개`}
                    onClick={() => setIndex((n) => (n + 1) % count)}
                >
                    {index + 1}/{count}
                </button>
            )}
        </div>
    );
};

interface HomeSidePaneProps {
    calendar: ReactNode;
}

/** 대문 오른쪽 칸: 맨 위 소식 띠 + 일정 / 인기 글 탭 */
const HomeSidePane: React.FC<HomeSidePaneProps> = ({ calendar }) => {
    const [tab, setTabState] = useState<PaneTab>(readStoredTab);
    // 인기 글은 처음 열 때 불러오고, 그 뒤로는 탭을 바꿔도 다시 불러오지 않는다
    const [popularOpened, setPopularOpened] = useState(tab === "popular");
    const baseId = useId();
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const setTab = (next: PaneTab) => {
        setTabState(next);
        if (next === "popular") setPopularOpened(true);
        try { localStorage.setItem(TAB_STORAGE_KEY, next); } catch { /* 저장 실패 무시 */ }
    };

    const onKeyDown = (e: React.KeyboardEvent, i: number) => {
        const last = TABS.length - 1;
        const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
            : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
            : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
        if (to < 0) return;
        e.preventDefault();
        setTab(TABS[to].id);
        tabRefs.current[to]?.focus();
    };

    return (
        <div className="home-pane">
            <NewsStrip />
            <div className="home-pane-tabs" role="tablist" aria-label="일정과 인기 글">
                {TABS.map((t, i) => (
                    <button
                        key={t.id}
                        ref={(el) => { tabRefs.current[i] = el; }}
                        type="button"
                        role="tab"
                        id={`${baseId}-tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls={`${baseId}-panel-${t.id}`}
                        tabIndex={tab === t.id ? 0 : -1}
                        className="home-pane-tab"
                        onClick={() => setTab(t.id)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {/* 패널을 한 칸에 겹쳐 두어 탭을 바꿔도 카드 높이가 그대로다(가장 큰 달력 기준).
                안 보이는 패널은 visibility: hidden 이라 초점 이동, 화면 낭독기에서도 빠진다 */}
            <div className="home-pane-panels">
                <div
                    role="tabpanel"
                    id={`${baseId}-panel-calendar`}
                    aria-labelledby={`${baseId}-tab-calendar`}
                    className={`home-pane-panel${tab === "calendar" ? " is-active" : ""}`}
                >
                    {calendar}
                </div>
                <div
                    role="tabpanel"
                    id={`${baseId}-panel-popular`}
                    aria-labelledby={`${baseId}-tab-popular`}
                    className={`home-pane-panel${tab === "popular" ? " is-active" : ""}`}
                >
                    {popularOpened && <PopularList />}
                </div>
            </div>
        </div>
    );
};

export default HomeSidePane;
