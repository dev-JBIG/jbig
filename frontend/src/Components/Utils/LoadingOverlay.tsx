import React from "react";
import { Spinner } from "@primer/react";

interface LoadingOverlayProps {
    label: string;
}

/**
 * 화면 전체를 덮는 처리 중 표시 (회원가입 인증코드 요청 등).
 * 스피너는 앱의 다른 곳과 같은 Primer Spinner. 모양은 shared.css 의 .loading-overlay.
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ label }) => (
    <div className="loading-overlay" role="status" aria-live="polite">
        <div className="loading-overlay-panel">
            <Spinner size="medium" />
            <span className="loading-overlay-text">{label}</span>
        </div>
    </div>
);

export default LoadingOverlay;
