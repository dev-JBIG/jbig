import React, { useState } from "react";
import { Button } from "@primer/react";
import "./Signin.css";
import EmailVerification from "../Signup/EmailVerification";
import {Link, useNavigate} from "react-router-dom";
import {signin} from "../../API/req";
import {useUser} from "../Utils/UserContext";
import {useJbnuEmail} from "../Utils/useJbnuEmail";
import JbnuEmailInput from "../Utils/JbnuEmailInput";
import { getEmailError, getPasswordError } from "../Utils/authValidation";
import AuthLayout from "../Utils/AuthLayout";
import PasswordInput from "../Utils/PasswordInput";


const Signin: React.FC = () => {
    const { email: userId, value: userIdLocal, onChange: onUserIdChange } = useJbnuEmail();
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
    const [notice, setNotice] = useState("");

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
        if (loading) return;
        setError(null);
        setNotice("");

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
                navigate("/");
            } else if (result.status === 401 && result.errorCode === "ACCOUNT_NOT_VERIFIED") {
                setPassword("");
                // 인증 화면으로 바뀌며 비밀번호 칸이 내려가므로, 돌아오면 보임 상태도 처음(가림)부터 시작한다
                setFieldErrors({});
                setVerificationEmail(userId.trim());
            } else {
                setError(result.message || "로그인에 실패했습니다.");
            }
        } catch {
            setError("로그인 요청 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="로그인">
            {verificationEmail !== null ? (
                <>
                    <p className="signin-verify-lead">이메일 인증을 마저 완료해주세요</p>
                    <EmailVerification
                        email={verificationEmail}
                        onVerified={() => {
                            setVerificationEmail(null);
                            setNotice("이메일 인증이 완료되었습니다. 비밀번호를 입력하여 로그인해주세요.");
                        }}
                        onBack={() => setVerificationEmail(null)}
                    />
                </>
            ) : (
                <>
                    {notice && <p className="auth-status-banner" role="status">{notice}</p>}
                    <form className="auth-form" onSubmit={handleSubmit}>
                        <label className="auth-label" htmlFor="userid">
                            아이디 (이메일)
                        </label>
                        <JbnuEmailInput
                            className="auth-input"
                            placeholder="학교메일"
                            invalid={!!fieldErrors.email}
                            id="userid"
                            aria-describedby={fieldErrors.email ? "userid-error" : undefined}
                            value={userIdLocal}
                            onChange={(e) => {
                                onUserIdChange(e);
                                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                            }}
                            onBlur={handleEmailBlur}
                        />
                        {fieldErrors.email && <span id="userid-error" className="field-error">{fieldErrors.email}</span>}

                        <label className="auth-label" htmlFor="password">
                            비밀번호
                        </label>
                        <PasswordInput
                            rowClassName="auth-input-row"
                            toggleClassName="auth-toggle"
                            className={`auth-input ${fieldErrors.password ? "input-error" : ""}`}
                            id="password"
                            aria-invalid={!!fieldErrors.password || undefined}
                            aria-describedby={fieldErrors.password ? "password-error" : undefined}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                            }}
                            onBlur={handlePasswordBlur}
                        />
                        {fieldErrors.password && <span id="password-error" className="field-error">{fieldErrors.password}</span>}

                        {error && <div className="form-error" role="alert">{error}</div>}

                        <Button variant="primary" block className="auth-submit signin-submit-btn" type="submit" disabled={loading}>
                            {loading ? "로그인 중..." : "로그인"}
                        </Button>
                    </form>
                    <div className="auth-links">
                        <Link to="/signup" className="auth-link">가입하기</Link>
                        <Link to="/changepwd" className="auth-link">비밀번호를 잊어버리셨나요?</Link>
                    </div>
                </>
            )}
        </AuthLayout>
    );
};

export default Signin;
