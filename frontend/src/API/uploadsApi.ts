/** 첨부 업로드(Presigned URL), 업로드 파일 삭제. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import { isAxiosError } from "axios";
import axios, { authHeaders, currentSessionId, pinSession, SESSION_CHANGED_MESSAGE } from "./client";
import { BASE_URL, SessionChangedError } from "./auth";
import { optimizeImageForUpload } from "../Utils/imageOptimize";
import { getErrorMessage } from "./apiShared";

// 첨부파일 업로드

// 첨부파일 업로드 (Presigned URL 방식)
export const uploadAttachment = async (file: File): Promise<{ path: string; name: string; url?: string; message?: string }> => {
    // 이미지 준비, 주소 받기, 확인 요청을 모두 시작한 계정으로만 보낸다(도중에 계정이 바뀌면 멈춤)
    const session = pinSession(currentSessionId());
    const preparedFile = await optimizeImageForUpload(file);

    let generateUrlResponse;
    try {
        generateUrlResponse = await axios.post(
            `${BASE_URL}/api/boards/files/generate-upload-url/`,
            { filename: preparedFile.name },
            { headers: { "Content-Type": "application/json", ...authHeaders() }, ...session }
        );
    } catch (error: unknown) {
        if (error instanceof SessionChangedError) return { path: "", name: preparedFile.name, message: SESSION_CHANGED_MESSAGE };
        return { path: "", name: preparedFile.name, message: getErrorMessage(error, "업로드 URL 요청에 실패했습니다.") };
    }

    const { upload_url, file_key, url } = generateUrlResponse.data;
    if (!upload_url || !file_key) {
        return { path: "", name: preparedFile.name, message: "서버에서 유효한 업로드 URL을 받지 못했습니다." };
    }

    try {
        await axios.put(upload_url, preparedFile, {
            headers: { "Content-Type": preparedFile.type || "application/octet-stream" },
        });
    } catch {
        return { path: "", name: preparedFile.name, message: "클라우드 스토리지 업로드에 실패했습니다." };
    }

    // 업로드 완료 후 public-read ACL 적용
    try {
        await axios.post(
            `${BASE_URL}/api/boards/files/confirm-upload/`,
            { file_key },
            { headers: { "Content-Type": "application/json", ...authHeaders() }, ...session }
        );
    } catch (error: unknown) {
        // 계정이 바뀌었으면 이 파일을 지금 계정 글에 넣지 않게 실패로 알린다
        if (error instanceof SessionChangedError) return { path: "", name: preparedFile.name, message: SESSION_CHANGED_MESSAGE };
        // ACL 적용 실패해도 파일 자체는 업로드됨
    }

    return {
        path: file_key,
        name: preparedFile.name,
        url: url,
    };
};

// 업로드된 파일 삭제 (스토리지)
export const deleteUploadedFile = async (path: string): Promise<{ success: boolean; message?: string }> => {
    try {
        await axios.delete(`${BASE_URL}/api/boards/files/delete/`, {
            data: { path },
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
        });
        return { success: true };
    } catch (error: unknown) {
        // 404는 이미 삭제된 것으로 간주하여 성공 처리
        if (isAxiosError(error) && error.response?.status === 404) {
            return { success: true };
        }
        return { success: false, message: getErrorMessage(error, "파일 삭제에 실패했습니다.") };
    }
};
