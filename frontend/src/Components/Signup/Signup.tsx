import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@primer/react";
import { signupUser } from "../../API/req";
import { useAlert } from "../Utils/AlertContext";
import { useJbnuEmail } from "../Utils/useJbnuEmail";
import JbnuEmailInput from "../Utils/JbnuEmailInput";
import { EMAIL_DOMAIN_MESSAGE, PASSWORD_RULE_MESSAGE, isValidEmailDomain, isValidPassword } from "../Utils/authValidation";
import AuthLayout from "../Utils/AuthLayout";
import PasswordInput from "../Utils/PasswordInput";
import LoadingOverlay from "../Utils/LoadingOverlay";
import "./Signup.css";
import EmailVerification from "./EmailVerification";

const isValidSemester = (n: number) => Number.isInteger(n) && n >= 1 && n < 100;

const Signup: React.FC = () => {
    // 단계: 1) 정보 입력/회원가입 요청(인증코드 발송) -> 2) 이메일 인증 코드 검증
    const [step, setStep] = useState<1 | 2>(1);

    // 1단계 입력값
    const { email, value: emailLocal, onChange: onEmailChange } = useJbnuEmail();
    const [userId, setUserId] = useState("");
    const [semester, setSemester] = useState<number | null>(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const [expiresAt, setExpiresAt] = useState<number | null>(null);

    const navigate = useNavigate();
    const { showAlert } = useAlert();

    // 1단계: 회원가입 요청 -> 서버가 인증코드 이메일 발송
    const handleSignupRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        const trimmedEmail = email.trim();
        const trimmedUserId = userId.trim();
        const trimmedPwd = password.trim();

        // 검증
        if (!isValidEmailDomain(trimmedEmail)) {
            showAlert({ message: EMAIL_DOMAIN_MESSAGE, type: 'warning' });
            return;
        }
        if (!trimmedUserId) {
            showAlert({ message: "아이디(유저명)를 입력해주세요.", type: 'warning' });
            return;
        }
        if (semester === null || !isValidSemester(semester)) {
            showAlert({ message: "부적절한 기수 입니다.", type: 'warning' });
            return;
        }
        if (!isValidPassword(trimmedPwd)) {
            showAlert({ message: PASSWORD_RULE_MESSAGE, type: 'warning' });
            return;
        }
        if (password !== confirmPassword) {
            showAlert({ message: "비밀번호 확인이 일치하지 않습니다.", type: 'warning' });
            return;
        }

        try {
            setLoading(true);
            const result = await signupUser(trimmedEmail, trimmedUserId, semester, password);
            if (result.success) {
                setStep(2);
                setExpiresAt(Date.now() + 300000);
                setPassword("");
                setConfirmPassword("");
            } else {
                showAlert({ message: result?.message || "회원가입 요청에 실패했습니다.", type: 'error' });
            }
        } catch {
            showAlert({ message: "회원가입 요청 중 오류가 발생했습니다.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="회원가입" cardClassName="signup-container">
            {step === 1 && (
                <>
                    <form className="auth-form signup-form" onSubmit={handleSignupRequest}>
                        <label className="auth-label signup-label" htmlFor="email">이메일</label>
                        <JbnuEmailInput
                            className="auth-input signup-input"
                            id="email"
                            value={emailLocal}
                            onChange={onEmailChange}
                            required
                            placeholder="학교메일"
                        />

                        <label className="auth-label signup-label" htmlFor="userId">이름</label>
                        <input
                            className="auth-input signup-input"
                            id="userId"
                            type="text"
                            value={userId}
                            placeholder="예: 홍길동"
                            onChange={(e) => setUserId(e.target.value)}
                            required
                        />

                        <label className="auth-label signup-label" htmlFor="semester">기수 (숫자)</label>
                        <input
                            className="auth-input signup-input"
                            id="semester"
                            type="number"
                            min={1}
                            max={99}
                            value={semester ?? ""}
                            onChange={(e) => {
                                const v = e.target.value;
                                setSemester(v === "" ? null : Number(v));
                            }}
                            required
                        />

                        <label className="auth-label signup-label" htmlFor="password">
                            비밀번호
                        </label>
                        {/* 보이기를 누르면 아래 비밀번호 확인 칸도 함께 보인다 */}
                        <PasswordInput
                            rowClassName="auth-input-row"
                            toggleClassName="auth-toggle"
                            visible={showPassword}
                            onVisibleChange={setShowPassword}
                            className="auth-input signup-input"
                            id="password"
                            value={password}
                            placeholder="숫자 + 영문 + !,@"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <label className="auth-label signup-label" htmlFor="confirmPassword">
                            비밀번호 확인
                        </label>
                        <input
                            className="auth-input signup-input"
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="숫자 + 영문 + !,@"
                        />

                        <Button variant="primary" block className="auth-submit" type="submit" disabled={loading}>
                            인증코드 받기
                        </Button>
                    </form>

                    <div className="auth-links">
                        <Link to="/signin" className="auth-link">이미 가입을 시도하셨나요? 로그인하여 이메일 인증을 이어가세요.</Link>
                    </div>
                </>
            )}

            {step === 2 && (
                <EmailVerification
                    email={email.trim()}
                    initialExpiresAt={expiresAt}
                    onVerified={() => showAlert({
                        message: "회원가입이 완료되었습니다. 로그인해주세요.",
                        type: 'success',
                        onClose: () => navigate("/signin")
                    })}
                />
            )}
            {loading && <LoadingOverlay label="처리 중..." />}
        </AuthLayout>
    );
};

export default Signup;
