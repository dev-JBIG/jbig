import React, { useRef, useState } from "react";
import { Button } from "@primer/react";
import "./LoginModal.css";
import { signin } from "../../API/req";
import { useUser } from "./UserContext";
import { useNavigate } from "react-router-dom";
import { useJbnuEmail } from "./useJbnuEmail";
import JbnuEmailInput from "./JbnuEmailInput";
import Dialog from "./Dialog";
import { getEmailError, getPasswordError } from "./authValidation";
import PasswordInput from "./PasswordInput";
import { sanitizeInternalPath } from "./safeUrl";

interface LoginModalProps {
    onClose: () => void;
    redirectTo?: string;
}


const LoginModal: React.FC<LoginModalProps> = ({ onClose, redirectTo = '/' }) => {
    const { email: userId, value: userIdLocal, onChange: onUserIdChange } = useJbnuEmail();
    const userIdRef = useRef<HTMLInputElement | null>(null);
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { setAuth } = useUser();

    const validateEmail = getEmailError;
    const validatePassword = getPasswordError;

    const handleEmailBlur = () => {
        const err = validateEmail(userId);
        setFieldErrors(prev => ({ ...prev, email: err }));
    };

    const handlePasswordBlur = () => {
        const err = validatePassword(password);
        setFieldErrors(prev => ({ ...prev, password: err }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const emailErr = validateEmail(userId);
        const pwdErr = validatePassword(password);

        if (emailErr || pwdErr) {
            setFieldErrors({ email: emailErr, password: pwdErr });
            return;
        }

        setLoading(true);
        try {
            const result = await signin(userId, password);
            if (result.access && result.username && result.semester) {
                setAuth(
                    {
                        username: result.username,
                        semester: result.semester,
                        email: userId,
                        is_staff: !!result.is_staff,
                    },
                    result.access,
                    result.refresh
                );
                onClose();
                const safeRedirect = sanitizeInternalPath(redirectTo, "/");
                if (window.location.pathname !== safeRedirect) {
                    navigate(safeRedirect);
                }
            } else {
                setError(result.message || "로그인에 실패했습니다.");
            }
        } catch {
            setError("로그인 요청 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

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
                    invalid={!!fieldErrors.email}
                    id="modal-userid"
                    value={userIdLocal}
                    onChange={(e) => {
                        onUserIdChange(e);
                        if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    onBlur={handleEmailBlur}
                />
                {fieldErrors.email && <span className="login-modal-field-error">{fieldErrors.email}</span>}

                <label className="login-modal-label" htmlFor="modal-password">
                    비밀번호
                </label>
                <PasswordInput
                    rowClassName="login-modal-password-row"
                    toggleClassName="login-modal-toggle"
                    className={`login-modal-input ${fieldErrors.password ? "input-error" : ""}`}
                    id="modal-password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                    }}
                    onBlur={handlePasswordBlur}
                />
                {fieldErrors.password && <span className="login-modal-field-error">{fieldErrors.password}</span>}

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
