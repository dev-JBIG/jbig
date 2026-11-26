import React, { useRef } from "react";
import { Button } from "@primer/react";
import "./LoginModal.css";
import { useNavigate } from "react-router-dom";
import JbnuEmailInput from "./JbnuEmailInput";
import Dialog from "./Dialog";
import { useSigninForm } from "./useSigninForm";
import PasswordInput from "./PasswordInput";
import { sanitizeInternalPath } from "./safeUrl";

interface LoginModalProps {
    onClose: () => void;
    redirectTo?: string;
}


const LoginModal: React.FC<LoginModalProps> = ({ onClose, redirectTo = '/' }) => {
    const userIdRef = useRef<HTMLInputElement | null>(null);
    const navigate = useNavigate();
    const { emailFieldProps, passwordFieldProps, fieldErrors, error, loading, handleSubmit } = useSigninForm({
        onSuccess: () => {
            onClose();
            const safeRedirect = sanitizeInternalPath(redirectTo, "/");
            if (window.location.pathname !== safeRedirect) {
                navigate(safeRedirect);
            }
        },
    });

    const handleSignupClick = () => {
        onClose();
        navigate("/signup");
    };

    const handleForgotPasswordClick = () => {
        onClose();
        navigate("/changepwd");
    };

    return (
        <Dialog
            labelledBy="login-modal-heading"
            onClose={onClose}
            backdropClassName="login-modal-backdrop"
            panelClassName="login-modal-container"
            initialFocusRef={userIdRef}
        >
            <button
                type="button"
                className="login-modal-close"
                onClick={onClose}
                aria-label="로그인 창 닫기"
            >
                &times;
            </button>
            <div className="login-modal-header">
                <h2 id="login-modal-heading" className="login-modal-title">로그인</h2>
            </div>
            <form className="login-modal-form" onSubmit={handleSubmit}>
                <label className="login-modal-label" htmlFor="modal-userid">
                    아이디 (이메일)
                </label>
                <JbnuEmailInput
                    ref={userIdRef}
                    className="login-modal-input"
                    placeholder="학교메일"
                    id="modal-userid"
                    aria-describedby={fieldErrors.email ? "modal-userid-error" : undefined}
                    {...emailFieldProps}
                />
                {fieldErrors.email && <span id="modal-userid-error" className="login-modal-field-error">{fieldErrors.email}</span>}

                <label className="login-modal-label" htmlFor="modal-password">
                    비밀번호
                </label>
                <PasswordInput
                    rowClassName="login-modal-password-row"
                    toggleClassName="login-modal-toggle"
                    className={`login-modal-input ${fieldErrors.password ? "input-error" : ""}`}
                    id="modal-password"
                    aria-invalid={!!fieldErrors.password || undefined}
                    aria-describedby={fieldErrors.password ? "modal-password-error" : undefined}
                    {...passwordFieldProps}
                />
                {fieldErrors.password && <span id="modal-password-error" className="login-modal-field-error">{fieldErrors.password}</span>}

                {error && <div className="login-modal-error" role="alert">{error}</div>}

                <Button variant="primary" block className="login-modal-button" type="submit" disabled={loading}>
                    {loading ? "로그인 중..." : "로그인"}
                </Button>
            </form>
            <div className="login-modal-links">
                <button type="button" className="login-modal-link" onClick={handleSignupClick}>
                    가입하기
                </button>
                <button type="button" className="login-modal-link" onClick={handleForgotPasswordClick}>
                    비밀번호를 잊어버리셨나요?
                </button>
            </div>
        </Dialog>
    );
};

export default LoginModal;
