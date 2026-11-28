/** 관리자: 첫 화면 바로가기 */
import React from "react";
import { SlidersHorizontal, Settings, Megaphone } from "lucide-react";
import "./Admin.css";
function Dashboard({ onSelectPage }: { onSelectPage: (page: string) => void }) {
    const shortcuts = [
        {
            id: "boards",
            title: "게시판 관리",
            desc: "게시판별 조회·작성·댓글 권한 정책을 관리합니다.",
            icon: SlidersHorizontal,
        },
        {
            id: "settings",
            title: "사이트 설정",
            desc: "Notion 페이지 ID, 퀴즈 URL, JBIG 운영진 정보를 수정합니다.",
            icon: Settings,
        },
        {
            id: "popups",
            title: "팝업 관리",
            desc: "홈페이지 공지 팝업의 게시 기간과 노출 순서를 관리합니다.",
            icon: Megaphone,
        },
    ];

    return (
        <>
            <h2 className="admin-content-header">대시보드</h2>
            <div className="admin-card">
                <h3 className="card-title">관리자 페이지</h3>
                <p className="admin-muted-text admin-card-lead">
                    왼쪽 메뉴 또는 아래 바로가기에서 관리할 항목을 선택하세요.
                </p>
                <div className="admin-shortcut-grid">
                    {shortcuts.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className="admin-shortcut-card"
                                onClick={() => onSelectPage(item.id)}
                            >
                                <div className="admin-shortcut-icon">
                                    <Icon size={18} aria-hidden="true" />
                                </div>
                                <div className="admin-shortcut-title">{item.title}</div>
                                <div className="admin-shortcut-desc">{item.desc}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

export default Dashboard;
