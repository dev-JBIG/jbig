import React, { useState, useEffect } from "react";
import { Button } from "@primer/react";
import "./LoginModal.css";
import { signin } from "../../API/req";
import { useUser } from "./UserContext";
import { useNavigate } from "react-router-dom";
import { useJbnuEmail } from "./useJbnuEmail";

interface LoginModalProps {
    onClose: () => void;
    redirectTo?: string;
}

const isValidEmailDomain = (email: string) => /@jbnu\.ac\.kr$/i.test(email.trim());
const isValidPassword = (pwd: string) =>
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@])[A-Za-z\d!@]{8,16}$/.test(pwd);

const LoginModal: React.FC<LoginModalProps> = ({ onClose, redirectTo = '/' }) => {
    const { email: userId, inputRef: userIdRef, onChange: onUserIdChange, onFocus: onUserIdFocus, onClick: onUserIdClick } = useJbnuEmail();
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { setAuth } = useUser();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const validateEmail = (value: string) => {
        if (!value.trim()) return "이메일을 입력해주세요.";
        if (!isValidEmailDomain(value)) return "전북대 이메일(@jbnu.ac.kr)만 사용할 수 있습니다.";
        return undefined;
    };

    const validatePassword = (value: string) => {
        if (!value) return "비밀번호를 입력해주세요.";
        if (!isValidPassword(value)) return "8~16자, 영문/숫자 각 1개 이상, 특수문자(!,@) 포함";
        return undefined;
    };

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
                if (window.location.pathname !== redirectTo) {
                    navigate(redirectTo);
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

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
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
        <div
            className="login-modal-backdrop"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-heading"
        >
            <div className="login-modal-container">
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
                    <input
                        ref={userIdRef}
                        className={`login-modal-input ${fieldErrors.email ? "input-error" : ""}`}
                        id="modal-userid"
                        type="text"
                        value={userId}
                        onChange={(e) => {
                            onUserIdChange(e);
                            if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                        }}
                        onFocus={onUserIdFocus}
                        onClick={onUserIdClick}
                        onBlur={handleEmailBlur}
                        autoFocus
                    />
                    {fieldErrors.email && <span className="login-modal-field-error">{fieldErrors.email}</span>}

                    <label className="login-modal-label" htmlFor="modal-password">
                        비밀번호
                    </label>
                    <div className="login-modal-password-row">
                        <input
                            className={`login-modal-input ${fieldErrors.password ? "input-error" : ""}`}
                            id="modal-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                            }}
                            onBlur={handlePasswordBlur}
                        />
                        <button
                            type="button"
                            className="login-modal-toggle"
                            onClick={() => setShowPassword((prev) => !prev)}
                        >
                            {showPassword ? "숨기기" : "보이기"}
                        </button>
                    </div>
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
            </div>
        </div>
    );
};

export default LoginModal;
