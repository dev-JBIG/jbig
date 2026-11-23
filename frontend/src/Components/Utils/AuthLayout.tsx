import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import BrandMark from "./BrandMark";

interface AuthLayoutProps {
    /** 카드 제목 (로그인, 회원가입, 비밀번호 찾기) */
    title: string;
    children: ReactNode;
    /** 화면마다 다른 카드 폭, 여백 (예: signup-container) */
    cardClassName?: string;
    titleClassName?: string;
}

/**
 * 인증 화면(로그인, 회원가입, 비밀번호 찾기)의 공통 틀:
 * 회색 바탕 가운데 카드 + 위쪽 "로고 JBIG | 제목" 줄. 폼과 아래 링크는 children.
 * 모양은 shared.css 의 .auth-*.
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({ title, children, cardClassName, titleClassName }) => (
    <div className="auth-page">
        <div className={cardClassName ? `auth-card ${cardClassName}` : "auth-card"}>
            <div className="auth-title-row">
                <Link to="/" className="auth-logo">
                    <BrandMark />
                    <span>JBIG</span>
                </Link>
                <h2 className={titleClassName ? `auth-title ${titleClassName}` : "auth-title"}>{title}</h2>
            </div>
            {children}
        </div>
    </div>
);

export default AuthLayout;
