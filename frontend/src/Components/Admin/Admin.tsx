import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@primer/react";
import { useUser } from "../Utils/UserContext";
import { useStaffAuth } from "../Utils/StaffAuthContext";
import { useAlert } from "../Utils/AlertContext";
import { useColorMode } from "../Utils/ThemeContext";
import {
    Menu,
    X,
    Sun,
    Moon,
    LayoutDashboard,
    SlidersHorizontal,
    Settings,
    Megaphone,
} from "lucide-react";
import "./Admin.css";
import BrandMark from "../Utils/BrandMark";
import PopupManagement from "./PopupManagement";
import BoardManagement from "./BoardManagement";
import Dashboard from "./AdminDashboard";
import SettingsManagement from "./SettingsManagement";

function Admin() {
    const { user, authReady, accessToken, signOutLocal } = useUser();
    const { staffAuth } = useStaffAuth();
    const { showAlert } = useAlert();
    const { resolvedColorMode, toggleColorMode } = useColorMode();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [authorized, setAuthorized] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (!authReady) return;
        if (!user || !accessToken) {
            showAlert({ message: "로그인이 필요합니다.", type: 'warning' });
            signOutLocal();
            navigate("/signin");
            return;
        }
        if (!staffAuth && !user.is_staff) {
            showAlert({
                message: "관리자 권한이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/")
            });
            return;
        }
        setAuthorized(true);
    }, [authReady, user, accessToken, navigate, signOutLocal, staffAuth, showAlert]);

    const adminMenus = [
        { id: "dashboard", name: "대시보드", icon: LayoutDashboard },
        { id: "boards", name: "게시판 관리", icon: SlidersHorizontal },
        { id: "settings", name: "사이트 설정", icon: Settings },
        { id: "popups", name: "팝업 관리", icon: Megaphone },
    ];

    const handleGoHome = () => {
        navigate("/");
    };

    const handleMenuSelect = (menuId: string) => {
        setCurrentPage(menuId);
        setMobileMenuOpen(false);
    };

    const renderContent = () => {
        if (!accessToken) return null;
        switch (currentPage) {
            case "boards":
                return <BoardManagement />;
            case "settings":
                return <SettingsManagement />;
            case "popups":
                return <PopupManagement />;
            default:
                return <Dashboard onSelectPage={handleMenuSelect} />;
        }
    };

    if (!authReady || !authorized) {
        return (
            <div className="admin-container">
                <div className="admin-loading">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <header className="admin-header-bar">
                <div className="admin-header-left">
                    <button
                        type="button"
                        className="admin-menu-toggle"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="메뉴 토글"
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
                    </button>
                    <button type="button" className="admin-logo" onClick={handleGoHome}>
                        <BrandMark className="admin-logo-mark" />
                        <span>JBIG Admin</span>
                    </button>
                </div>
                <div className="admin-user-info">
                    <span className="admin-user-label">{user?.username || "관리자"}님</span>
                    <button
                        type="button"
                        className="admin-icon-button"
                        onClick={toggleColorMode}
                        aria-label={resolvedColorMode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
                        title={resolvedColorMode === "dark" ? "라이트 모드" : "다크 모드"}
                    >
                        {resolvedColorMode === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                    </button>
                    <Button variant="default" size="small" onClick={handleGoHome}>
                        사이트 홈
                    </Button>
                </div>
            </header>

            <div className="admin-content">
                {/* 모바일 오버레이 */}
                {/* design-lint-allow clickable-div: 모바일 메뉴 뒤 배경막 클릭은 마우스 보조 동작이고 메뉴 버튼으로도 닫힌다 */}
                <div
                    className={`admin-sidebar-overlay ${mobileMenuOpen ? 'show' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                />

                <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                    <nav className="admin-menu" aria-label="관리자 메뉴">
                        <ul>
                            {adminMenus.map((menu) => {
                                const Icon = menu.icon;
                                const isActive = currentPage === menu.id;
                                return (
                                    <li key={menu.id}>
                                        <button
                                            type="button"
                                            className={`admin-menu-btn${isActive ? " active" : ""}`}
                                            aria-current={isActive ? "page" : undefined}
                                            onClick={() => handleMenuSelect(menu.id)}
                                        >
                                            <Icon size={16} aria-hidden="true" />
                                            <span>{menu.name}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>

                <main className="admin-main-area">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}

export default Admin;
