import React, { useCallback, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, CounterLabel } from "@primer/react";
import { Menu, X, FileText, SquareCheckBig, Lock } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faDiscord, faGithub, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { Section, Board } from "./interfaces";
import { getBoardIcon } from "./boardIcons";
import { useUser } from "./UserContext";
import { useAlert } from "./AlertContext";
import { useFocusTrap } from "./useFocusTrap";
import "./MobileNav.css";
import MemberQuickLinks from "./MemberQuickLinks";
import { sanitizeHttpUrl } from "./safeUrl";

interface MobileNavProps {
  boards: Section[];
  isLogin: boolean;
  quizURL: string;
  totalCount: number;
  navigate: (path: string) => void;
  staffAuth: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({
  boards,
  isLogin,
  quizURL,
  totalCount,
  navigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const { accessToken, user } = useUser();
  const { showAlert } = useAlert();
  const location = useLocation();

  const closeDrawer = useCallback(() => setIsOpen(false), []);
  useFocusTrap(drawerRef, isOpen, {
    onClose: closeDrawer,
    initialFocusRef: closeBtnRef,
    restoreFocusRef: toggleBtnRef,
  });

  const activeBoardMatch = location.pathname.match(/^\/board\/(\d+)/);
  const activeBoardId = activeBoardMatch ? Number(activeBoardMatch[1]) : null;

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  // read_permission 미지정은 'all'(전체공개)로 취급해 하위호환 유지
  // 'author'(본인+스태프) 게시판은 진입 자체는 회원 전체에게 열린다(제출·본인 글 확인용).
  const requiresLogin = (board: Board): boolean =>
    board.read_permission === 'member' || board.read_permission === 'author';

  const isBoardLocked = (board: Board): boolean =>
    (requiresLogin(board) && !accessToken) ||
    (board.read_permission === 'staff' && !(user?.is_staff));

  const handleBoardClick = (board: Board) => {
    if (requiresLogin(board) && !accessToken) {
      showAlert({ message: '회원 전용 게시판입니다. 로그인 후 이용해주세요.', type: 'warning' });
      handleNavigate("/signin");
      return;
    }
    if (board.read_permission === 'staff' && !(user?.is_staff)) {
      showAlert({ message: '스태프 전용 게시판입니다.', type: 'warning' });
      setIsOpen(false);
      return;
    }
    handleNavigate(`/board/${board.id}`);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSearchQuery("");
      navigate(`/search/all?q=${encodeURIComponent(searchQuery)}`);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        ref={toggleBtnRef}
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="mobile-nav-overlay" onClick={closeDrawer}>
          <div
            ref={drawerRef}
            className="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="모바일 내비게이션"
            tabIndex={-1}
          >
            <div className="mobile-nav-header">
              <h2 className="mobile-nav-title">JBIG 메뉴</h2>
              <button
                ref={closeBtnRef}
                type="button"
                className="mobile-nav-close"
                onClick={closeDrawer}
                aria-label="메뉴 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="mobile-nav-content">
              {!isLogin && (
                <div className="mobile-nav-signup-wrap">
                  <Button
                    variant="primary"
                    block
                    onClick={() => handleNavigate("/signup")}
                  >
                    회원가입
                  </Button>
                </div>
              )}

              <MemberQuickLinks isLogin={isLogin} onOpen={() => setIsOpen(false)} />

              <div className="mobile-search-group">
                <input
                  type="text"
                  className="mobile-search-input"
                  placeholder="게시글 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="default"
                  size="small"
                  onClick={handleSearch}
                >
                  검색
                </Button>
              </div>

              <div className="mobile-nav-divider" />

              <button
                type="button"
                className={`mobile-nav-item${activeBoardId === 0 ? " is-active" : ""}`}
                onClick={() => handleNavigate("/board/0")}
              >
                <div className="mobile-nav-item-content">
                  <FileText size={16} aria-hidden="true" />
                  <span>전체 글 보기</span>
                </div>
                <CounterLabel>{totalCount.toLocaleString()}</CounterLabel>
              </button>

              {(() => {
                const safeQuizUrl = sanitizeHttpUrl(quizURL);
                if (!safeQuizUrl) return null;
                return (
                  <button
                    type="button"
                    className="mobile-nav-item"
                    onClick={() => {
                      window.open(safeQuizUrl, "_blank", "noopener,noreferrer");
                      setIsOpen(false);
                    }}
                  >
                    <div className="mobile-nav-item-content">
                      <SquareCheckBig size={16} aria-hidden="true" />
                      <span>이번 주 퀴즈</span>
                    </div>
                  </button>
                );
              })()}

              <div className="mobile-nav-divider" />

              {boards.map((section, idx) => (
                <React.Fragment key={section.category}>
                  <div className="mobile-nav-section">
                    {section.category && (
                      <div className="mobile-nav-section-heading">{section.category}</div>
                    )}
                    {section.boards.map((board) => {
                      const IconComponent = getBoardIcon(board.name);
                      const locked = isBoardLocked(board);
                      return (
                        <button
                          key={board.id}
                          type="button"
                          className={`mobile-nav-item${activeBoardId === board.id ? " is-active" : ""}`}
                          onClick={() => handleBoardClick(board)}
                        >
                          <div className="mobile-nav-item-content">
                            <IconComponent size={16} aria-hidden="true" />
                            <span>{board.name}</span>
                            {locked && (
                              <Lock size={13} className="board-lock-icon" aria-hidden="true" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {idx !== boards.length - 1 && <div className="mobile-nav-divider" />}
                </React.Fragment>
              ))}

              <div className="mobile-nav-divider" />
              <div className="mobile-nav-section-heading">외부 채널</div>

              <div className="mobile-nav-external-links">
                <a
                  href="https://www.instagram.com/jbig.jbnu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-external-link"
                  onClick={() => setIsOpen(false)}
                >
                  <FontAwesomeIcon icon={faInstagram as IconProp} className="sidebar-discord-icon" aria-hidden="true" />
                  <span className="sidebar-external-text">JBIG 인스타그램</span>
                </a>

                <a
                  href="https://discord.gg/knpBCvvfGa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-external-link"
                  onClick={() => setIsOpen(false)}
                >
                  <FontAwesomeIcon icon={faDiscord as IconProp} className="sidebar-discord-icon" aria-hidden="true" />
                  <span className="sidebar-external-text">비밀 게임 소모임</span>
                </a>

                <a
                  href="https://indigo-coder-github.github.io/Big-Tech-News/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-external-link"
                  onClick={() => setIsOpen(false)}
                >
                  <FontAwesomeIcon icon={faGithub as IconProp} className="sidebar-discord-icon" aria-hidden="true" />
                  <span className="sidebar-external-text">BigTech AI News</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNav;
