import React, { useState } from "react";
import { signin } from "../../API/req";
import { useUser } from "./UserContext";
import { useJbnuEmail } from "./useJbnuEmail";
import { getEmailError, getPasswordError } from "./authValidation";

type FieldErrors = { email?: string; password?: string };

interface UseSigninFormOptions {
    /** 로그인 성공(세션 저장 뒤) */
    onSuccess: () => void;
    /** 메일 인증이 아직인 계정. 주지 않으면 서버 문구를 오류로 보여준다 */
    onNotVerified?: (email: string) => void;
}

/**
 * 로그인 화면과 로그인 모달이 같이 쓰는 로그인 폼 상태와 제출.
 * 입력칸 검사(전북대 메일, 비밀번호 규칙), 중복 제출 막기, 세션 저장, 오류 문구를 한 곳에서 처리한다.
 * 화면 모양(클래스, id)은 각 화면이 정한다.
 */
export const useSigninForm = ({ onSuccess, onNotVerified }: UseSigninFormOptions) => {
    const { email, value: emailLocal, onChange: onEmailChange } = useJbnuEmail();
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const { setAuth } = useUser();

    const clearField = (field: keyof FieldErrors) => {
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    /** JbnuEmailInput 에 그대로 펼쳐 넣는 값, 이벤트 */
    const emailFieldProps = {
        value: emailLocal,
        invalid: !!fieldErrors.email,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            onEmailChange(e);
            clearField("email");
        },
        onBlur: () => setFieldErrors((prev) => ({ ...prev, email: getEmailError(email) })),
    };

    /** PasswordInput 에 그대로 펼쳐 넣는 값, 이벤트 */
    const passwordFieldProps = {
        value: password,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            setPassword(e.target.value);
            clearField("password");
        },
        onBlur: () => setFieldErrors((prev) => ({ ...prev, password: getPasswordError(password) })),
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError(null);

        const emailErr = getEmailError(email);
        const pwdErr = getPasswordError(password);
        if (emailErr || pwdErr) {
            setFieldErrors({ email: emailErr, password: pwdErr });
            return;
        }

        setLoading(true);
        try {
            const result = await signin(email, password);
            if (result.access && result.username && result.semester) {
                setAuth(
                    {
                        username: result.username,
                        semester: result.semester,
                        email,
                        is_staff: !!result.is_staff,
                    },
                    result.access,
                    result.refresh
                );
                onSuccess();
            } else if (onNotVerified && result.status === 401 && result.errorCode === "ACCOUNT_NOT_VERIFIED") {
                setPassword("");
                setFieldErrors({});
                onNotVerified(email.trim());
            } else {
                setError(result.message || "로그인에 실패했습니다.");
            }
        } catch {
            setError("로그인 요청 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return { emailFieldProps, passwordFieldProps, fieldErrors, error, loading, handleSubmit };
};
