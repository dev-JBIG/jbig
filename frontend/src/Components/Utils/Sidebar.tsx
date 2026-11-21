import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button, CounterLabel, Label } from "@primer/react";
import "../Home/Home.css";
import { SidebarProps, Board } from "./interfaces";
import { FileText, SquareCheckBig, Lock } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faDiscord, faGithub, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { getBoardIcon } from "./boardIcons";
import { useUser } from "./UserContext";
import { useAlert } from "./AlertContext";
import MemberQuickLinks from "./MemberQuickLinks";
import { sanitizeHttpUrl } from "./safeUrl";

/**
 * 게시글이 24시간 이내에 작성되었는지 확인하는 함수
 */
const isNewPost = (dateString?: string | null): boolean => {
    if (!dateString) return false;

    const postDate = new Date(dateString);
    if (isNaN(postDate.getTime())) return false;

    const now = new Date();
    const diffInHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
    return diffInHours >= 0 && diffInHours <= 24;
};

// 좌측에 나오는 게시판 목록 등 관리 페이지
const Sidebar: React.FC<SidebarProps> = ({
    boards,
    isLogin,
    quizURL,
    totalCount,
    navigate
}) => {
    const { accessToken, user } = useUser();
    const { showAlert } = useAlert();
    const location = useLocation();

    const activeBoardMatch = location.pathname.match(/^\/board\/(\d+)/);
    const activeBoardId = activeBoardMatch ? Number(activeBoardMatch[1]) : null;

    // read_permission 미지정은 'all'(전체공개)로 취급해 하위호환 유지
    // 'author'(본인+스태프) 게시판은 진입 자체는 회원 전체에게 열린다(제출·본인 글 확인용).
    const requiresLogin = (board: Board): boolean =>
        board.read_permission === 'member' || board.read_permission === 'author';

    const isBoardLocked = (board: Board): boolean =>
        (requiresLogin(board) && !accessToken) ||
        (board.read_permission === 'staff' && !(user?.is_staff));

    const handleBoardClick = (e: React.MouseEvent<HTMLAnchorElement>, board: Board) => {
        if (requiresLogin(board) && !accessToken) {
            e.preventDefault();
            showAlert({ message: '회원 전용 게시판입니다. 로그인 후 이용해주세요.', type: 'warning' });
            navigate("/signin");
            return;
        }
        if (board.read_permission === 'staff' && !(user?.is_staff)) {
            e.preventDefault();
            showAlert({ message: '스태프 전용 게시판입니다.', type: 'warning' });
        }
    };

    return (
        <aside className="sidebar" aria-label="게시판 메뉴">
            <div className="sidebar-scrollable">
                {!isLogin && (
                    <div className="sidebar-signup-wrap">
                        <Button
                            variant="primary"
                            block
                            className="sidebar-signup-btn"
                            onClick={() => navigate("/signup")}
                        >
                            회원가입
                        </Button>
                    </div>
                )}
                <MemberQuickLinks isLogin={isLogin} />
                <ul className="menu">
                    <li>
                        <Link
                            to="/board/0"
                            className={`sidebar-nav-btn${activeBoardId === 0 ? " is-active" : ""}`}
                            aria-current={activeBoardId === 0 ? "page" : undefined}
                        >
                            <span className="board-item-content">
                                <FileText size={16} className="board-icon" aria-hidden="true" />
                                <span>전체 글 보기</span>
                            </span>
                            <CounterLabel>{totalCount.toLocaleString()}</CounterLabel>
                        </Link>
                    </li>
                    {(() => {
                        const safeQuizUrl = sanitizeHttpUrl(quizURL);
                        if (!safeQuizUrl) return null;
                        return (
                            <li>
                                <a
                                    href={safeQuizUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="sidebar-nav-btn"
                                >
                                    <span className="board-item-content">
                                        <SquareCheckBig size={16} className="board-icon" aria-hidden="true" />
                                        <span>이번 주 퀴즈</span>
                                    </span>
                                </a>
                            </li>
                        );
                    })()}
                </ul>
                <div className="sidebar-top-divider" />

                {boards.map((section, idx) => (
                    <React.Fragment key={section.category}>
                        {section.category && (
                            <div className="sidebar-section-heading">{section.category}</div>
                        )}
                        <ul className="menu">
                            {section.boards.map((board) => {
                                const IconComponent = getBoardIcon(board.name);
                                const hasNewPost = isNewPost(board.latest_post_created_at);
                                const locked = isBoardLocked(board);
                                const isActive = activeBoardId === board.id;
                                return (
                                    <li key={board.id}>
                                        <Link
                                            to={`/board/${board.id}`}
                                            className={`sidebar-nav-btn${isActive ? " is-active" : ""}`}
                                            aria-current={isActive ? "page" : undefined}
                                            onClick={(e) => handleBoardClick(e, board)}
                                        >
                                            <span className="board-item-content">
                                                <IconComponent className="board-icon" size={16} aria-hidden="true" />
                                                <span>{board.name}</span>
                                                {locked && (
                                                    <Lock size={13} className="board-lock-icon" aria-hidden="true" />
                                                )}
                                            </span>
                                            {hasNewPost && (
                                                <Label variant="danger" size="small" className="sidebar-new-badge">N</Label>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                        {idx !== boards.length - 1 && <div className="sidebar-middle-divider" />}
                    </React.Fragment>
                ))}

                <div className="sidebar-top-divider" />

                <div className="sidebar-external-links">
                    <a
                        href="https://www.instagram.com/jbig.jbnu/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar-external-link"
                    >
                        <FontAwesomeIcon icon={faInstagram as IconProp} className="sidebar-discord-icon" aria-hidden="true" />
                        <span>JBIG 인스타그램</span>
                    </a>

                    <a
                        href="https://discord.gg/knpBCvvfGa"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar-external-link"
                    >
                        <FontAwesomeIcon icon={faDiscord as IconProp} className="sidebar-discord-icon" aria-hidden="true" />
                        <span>비밀 게임 소모임</span>
                    </a>

                    <a
                        href="https://indigo-coder-github.github.io/Big-Tech-News/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar-external-link"
                    >
                        <FontAwesomeIcon icon={faGithub as IconProp} className="sidebar-discord-icon" aria-hidden="true" />
                        <span>BigTech AI News</span>
                    </a>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
