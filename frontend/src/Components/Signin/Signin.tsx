import React, { useState } from "react";
import { Button } from "@primer/react";
import "./Signin.css";
import EmailVerification from "../Signup/EmailVerification";
import {Link, useNavigate} from "react-router-dom";
import JbnuEmailInput from "../Utils/JbnuEmailInput";
import { useSigninForm } from "../Utils/useSigninForm";
import AuthLayout from "../Utils/AuthLayout";
import PasswordInput from "../Utils/PasswordInput";


const Signin: React.FC = () => {
    const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
    const [notice, setNotice] = useState("");
    const navigate = useNavigate();
    const { emailFieldProps, passwordFieldProps, fieldErrors, error, loading, handleSubmit } = useSigninForm({
        onSuccess: () => navigate("/"),
        // 인증 화면으로 바뀌며 비밀번호 칸이 내려가므로, 돌아오면 보임 상태도 처음(가림)부터 시작한다
        onNotVerified: setVerificationEmail,
    });

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
                    <form className="auth-form" onSubmit={(e) => { setNotice(""); handleSubmit(e); }}>
                        <label className="auth-label" htmlFor="userid">
                            아이디 (이메일)
                        </label>
                        <JbnuEmailInput
                            className="auth-input"
                            placeholder="학교메일"
                            id="userid"
                            aria-describedby={fieldErrors.email ? "userid-error" : undefined}
                            {...emailFieldProps}
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
                            {...passwordFieldProps}
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
