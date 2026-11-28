/** 가입, 메일 인증, 로그인, 비밀번호 찾기, 회원 탈퇴. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import { AxiosError } from "axios";
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";
import { ApiErrorResponse, getErrorMessage } from "./apiShared";

// 이메일 인증코드 인증
export const verifyAuthEmail = async (email: string, code: string) => {
    try {
        const res = await axios.post(`${BASE_URL}/api/users/verify/`, {
            email,
            verifyCode: code,
        });
        return { success: true, status: res.status, data: res.data };
    } catch (error: unknown) {
        const axiosErr = error as AxiosError<ApiErrorResponse>;
        return {
            success: false,
            status: axiosErr.response?.status,
            message: getErrorMessage(error, "인증 실패"),
        };
    }
};

// 이메일 인증코드 재전송
export const resendVerifyEmail = async (email: string) => {
    try {
        const res = await axios.post(
            `${BASE_URL}/api/users/resend-verify-email/`,
            { email },
            { headers: { Accept: "*/*", "Content-Type": "application/json" }, withCredentials: false }
        );
        return { success: true, status: res.status, data: res.data };
    } catch (error: unknown) {
        const axiosErr = error as AxiosError<ApiErrorResponse>;
        return {
            success: false,
            status: axiosErr.response?.status,
            message: getErrorMessage(error, "인증 메일 재전송 실패"),
        };
    }
};

// 회원가입
export const signupUser = async (
    email: string,
    username: string,
    semester: number,
    password: string
) => {
    try {
        const res = await axios.post(
            `${BASE_URL}/api/users/signup/`,
            { email, username, semester, password },
            { headers: { Accept: "*/*", "Content-Type": "application/json" }, withCredentials: false }
        );
        return { success: true, status: res.status, data: res.data };
    } catch (error: unknown) {
        const axiosErr = error as AxiosError<ApiErrorResponse>;
        return {
            success: false,
            status: axiosErr.response?.status,
            message: getErrorMessage(error, "회원가입 실패"),
        };
    }
};

// 로그인 api
export const signin = async (email: string, password: string) => {
    try {
        const response = await axios.post(
            `${BASE_URL}/api/users/signin/`,
            { email, password },
            { headers: { Accept: "*/*", "Content-Type": "application/json" }, withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        const axiosErr = error as AxiosError<ApiErrorResponse>;
        return {
            status: axiosErr.response?.status,
            errorCode: axiosErr.response?.data?.errorCode,
            message: getErrorMessage(error, "로그인 요청 중 오류가 발생했습니다."),
        };
    }
};

// 비밀번호 찾기 api - 인증 코드 요청
export const requestVerificationCode = async (email: string) => {
    try {
        const response = await axios.post(
            `${BASE_URL}/api/users/password/reset/request/`,
            { email },
            { headers: { Accept: "*/*", "Content-Type": "application/json" }, withCredentials: true }
        );
        return { success: true, ...response.data };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "인증코드 요청에 실패했습니다.") };
    }
};

// 비밀번호 찾기 api - 인증 코드 확인
export const verifyCode = async (email: string, verification_code: string) => {
    try {
        const response = await axios.post(
            `${BASE_URL}/api/users/password/reset/verify/`,
            { email, verification_code },
            { headers: { Accept: "*/*", "Content-Type": "application/json" }, withCredentials: true }
        );
        return { success: true, ...response.data };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "인증코드 확인에 실패했습니다.") };
    }
};

// 비밀번호 찾기 api - 비밀번호 재설정
export const resetPassword = async (
    email: string,
    reset_token: string,
    new_password1: string,
    new_password2: string
) => {
    try {
        const response = await axios.post(
            `${BASE_URL}/api/users/password/reset/`,
            { email, reset_token, new_password1, new_password2 },
            { headers: { Accept: "*/*", "Content-Type": "application/json" }, withCredentials: true }
        );
        return { success: true, ...response.data };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "비밀번호 재설정에 실패했습니다.") };
    }
};

// 회원 탈퇴
export const deleteAccount = async (password: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const res = await axios.post(
            `${BASE_URL}/api/users/delete-account/`,
            { password },
            {
                headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json"
                }
            }
        );
        return { success: true, message: res.data?.message || "회원 탈퇴가 완료되었습니다." };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "회원 탈퇴에 실패했습니다.") };
    }
};
