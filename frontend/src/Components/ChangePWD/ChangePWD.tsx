import React, { useState, useEffect } from "react";
import "./ChangePWD.css";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@primer/react";
import { requestVerificationCode, verifyCode, resetPassword } from "../../API/req";
import { useUser } from "../Utils/UserContext";
import { useAlert } from "../Utils/AlertContext";
import { useJbnuEmail } from "../Utils/useJbnuEmail";
import JbnuEmailInput from "../Utils/JbnuEmailInput";
import { EMAIL_DOMAIN_MESSAGE, PASSWORD_RULE_MESSAGE, isValidEmailDomain, isValidPassword } from "../Utils/authValidation";
import AuthLayout from "../Utils/AuthLayout";

// 이메일 도메인 유효성 검사

const ChangePWD: React.FC = () => {
    const { email, value: emailLocal, onChange: onEmailChange } = useJbnuEmail();
    const [verificationCode, setVerificationCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isCodeVerified, setIsCodeVerified] = useState(false);
    const [resetToken, setResetToken] = useState("");
    const [timer, setTimer] = useState(300); // 5분 = 300초
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { signOutLocal } = useUser();
    const { showAlert } = useAlert();

    // 타이머 로직
    useEffect(() => {
        if (!isCodeSent || isCodeVerified) return;

        const expireAt = Date.now() + 300 * 1000; // 현재 시각 + 5분

        const intervalId = setInterval(() => {
            const remaining = Math.max(0, Math.floor((expireAt - Date.now()) / 1000));
            setTimer(remaining);

            if (remaining === 0) {
                clearInterval(intervalId);
                showAlert({ message: "인증코드 유효시간이 만료되었습니다. 다시 요청해주세요.", type: 'warning' });
                setIsCodeSent(false);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isCodeSent, isCodeVerified, showAlert]);


    // 1. 인증코드 요청 핸들러
    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidEmailDomain(email.trim())) {
            showAlert({ message: EMAIL_DOMAIN_MESSAGE, type: 'warning' });
            return;
        }

        setIsLoading(true);
        try {
            const result = await requestVerificationCode(email);
            if (result.success) {
                showAlert({ message: "인증코드가 발송되었습니다. 이메일을 확인해주세요.", type: 'success' });
                setIsCodeSent(true);
                setTimer(300); // 타이머 초기화
            } else {
                showAlert({ message: result.message || "인증코드 발송에 실패했습니다.", type: 'error' });
            }
        } catch (error) {
            showAlert({ message: "인증코드 요청 중 오류가 발생했습니다.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // 2. 인증코드 확인 핸들러
    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verificationCode.trim()) {
            showAlert({ message: "인증코드를 입력해주세요.", type: 'warning' });
            return;
        }
        setIsLoading(true);
        try {
            const result = await verifyCode(email, verificationCode);
            if (result.success && result.reset_token) {
                showAlert({ message: "인증되었습니다. 새 비밀번호를 입력해주세요.", type: 'success' });
                setResetToken(result.reset_token);
                setIsCodeVerified(true);
            } else {
                showAlert({ message: result.message || "인증에 실패했습니다.", type: 'error' });
            }
        } catch (error) {
            showAlert({ message: "인증코드 확인 중 오류가 발생했습니다.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // 3. 새 비밀번호 설정 핸들러
    const handleSubmitNewPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidPassword(newPassword)) {
            showAlert({ message: PASSWORD_RULE_MESSAGE, type: 'warning' });
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert({ message: "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.", type: 'warning' });
            return;
        }

        setIsLoading(true);
        try {
            if (!resetToken) {
                showAlert({ message: "인증 세션이 만료되었습니다. 처음부터 다시 진행해주세요.", type: 'warning' });
                setIsCodeSent(false);
                setIsCodeVerified(false);
                return;
            }
            const result = await resetPassword(email, resetToken, newPassword, confirmPassword);
            if (result.success) {
                // 비밀번호 변경 성공 시 로그아웃 처리함
                signOutLocal();
                showAlert({
                    message: "비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.",
                    type: 'success',
                    onClose: () => navigate("/signin")
                });
            } else {
                showAlert({ message: result.message || "비밀번호 변경에 실패했습니다.", type: 'error' });
            }
        } catch (error) {
            showAlert({ message: "비밀번호 변경 중 오류가 발생했습니다.", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout title="비밀번호 찾기" cardClassName="changepwd-container" titleClassName="changepwd-title">
            {/* 1단계: 이메일 입력 */}
            {!isCodeSent && (
                <form className="auth-form" onSubmit={handleRequestCode}>
                    <label className="auth-label" htmlFor="email">
                        아이디
                    </label>
                    <JbnuEmailInput
                        className="auth-input changepwd-input"
                        id="email"
                        value={emailLocal}
                        onChange={onEmailChange}
                        placeholder="학교메일"
                        disabled={isLoading}
                    />
                    <Button variant="primary" block className="auth-submit" type="submit" disabled={isLoading}>
                        {isLoading ? "전송 중..." : "인증코드 받기"}
                    </Button>
                </form>
            )}

            {/* 2단계: 인증코드 입력 */}
            {isCodeSent && !isCodeVerified && (
                <form className="auth-form" onSubmit={handleVerifyCode}>
                    <label className="auth-label" htmlFor="verificationCode">
                        인증코드
                    </label>
                    <div className="changepwd-code-row">
                        <input
                            className="auth-input changepwd-input"
                            id="verificationCode"
                            type="text"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            placeholder="이메일로 받은 인증코드를 입력하세요"
                            disabled={isLoading}
                        />
                        <span className={`changepwd-timer${timer <= 60 ? " is-expiring" : ""}`}>
                            {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
                        </span>
                    </div>

                    <Button variant="primary" block className="auth-submit" type="submit" disabled={isLoading}>
                        {isLoading ? "확인 중..." : "인증코드 확인"}
                    </Button>
                </form>
            )}

            {/* 3단계: 새 비밀번호 입력 */}
            {isCodeVerified && (
                <form className="auth-form" onSubmit={handleSubmitNewPassword}>
                    <label className="auth-label" htmlFor="newPassword">
                        새 비밀번호
                    </label>
                    <input
                        className="auth-input changepwd-input"
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="영문, 숫자, 특수문자(!@) 포함 8~16자"
                        disabled={isLoading}
                    />
                    <label className="auth-label" htmlFor="confirmPassword">
                        새 비밀번호 확인
                    </label>
                    <input
                        className="auth-input changepwd-input"
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="비밀번호를 다시 한번 입력하세요"
                        disabled={isLoading}
                    />
                    <Button variant="primary" block className="auth-submit" type="submit" disabled={isLoading}>
                        {isLoading ? "변경 중..." : "비밀번호 변경"}
                    </Button>
                </form>
            )}

            <div className="auth-links changepwd-links">
                <Link to="/signin" className="auth-link">로그인하기</Link>
            </div>
        </AuthLayout>
    );
};

export default ChangePWD;
