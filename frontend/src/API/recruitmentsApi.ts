/** 모집, 지원. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL, readAuth, SessionChangedError } from "./auth";
import { ApplicationItem } from "../Components/Utils/interfaces";
import { PaginatedResponse, extractResults } from "./apiShared";

// ========== 모집 시스템 API ==========

// 모집 상세 조회
export const fetchRecruitmentDetail = async (postId: number): Promise<any> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/`;
    const headers: Record<string, string> = {};
    Object.assign(headers, authHeaders());
    const res = await axios.get(url, { headers });
    return res.data;
};

// 모집 정보 수정
export const updateRecruitment = async (postId: number, data: any): Promise<any> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/`;
    const res = await axios.patch(url, data, {
        headers: { ...authHeaders(), "Content-Type": "application/json" }
    });
    return res.data;
};

// 모집 상태 변경 (close, reopen, complete, cancel)
export const changeRecruitmentStatus = async (postId: number, action: string): Promise<any> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/${action}/`;
    const res = await axios.post(url, {}, {
        headers: authHeaders()
    });
    return res.data;
};

// 모집에 지원
export const applyToRecruitment = async (postId: number, message: string): Promise<any> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/apply/`;
    const res = await axios.post(url, { message }, {
        headers: { ...authHeaders(), "Content-Type": "application/json" }
    });
    return res.data;
};

// 내 지원 상태 조회
export const fetchMyApplication = async (postId: number): Promise<any> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/my-application/`;
    try {
        const res = await axios.get(url, { headers: authHeaders() });
        return res.data;
    } catch {
        return null;
    }
};

// 지원 철회
export const withdrawApplication = async (postId: number): Promise<void> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/my-application/`;
    await axios.delete(url, { headers: authHeaders() });
};

// 지원자 목록 조회
export const fetchApplications = async (postId: number): Promise<ApplicationItem[]> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/applications/`;
    const sessionId = readAuth().session?.id;
    const applications: ApplicationItem[] = [];
    let page = 1;
    let hasNextPage: boolean;

    do {
        const { data } = await axios.get<PaginatedResponse<ApplicationItem> | ApplicationItem[]>(url, {
            headers: authHeaders(),
            params: { page },
        });
        if (readAuth().session?.id !== sessionId) throw new SessionChangedError();
        if (!Array.isArray(data) && !Array.isArray(data?.results)) {
            throw new Error('지원자 목록 응답 형식이 올바르지 않습니다.');
        }

        applications.push(...extractResults(data));
        hasNextPage = !Array.isArray(data) && Boolean(data.next);
        page += 1;
    } while (hasNextPage);

    return applications;
};

// 지원 수락/거절
export const updateApplicationStatus = async (
    postId: number, appId: number, action: string, recruiterNote: string
): Promise<any> => {
    const url = `${BASE_URL}/api/recruitments/${postId}/applications/${appId}/${action}/`;
    const res = await axios.post(url, { recruiter_note: recruiterNote }, {
        headers: { ...authHeaders(), "Content-Type": "application/json" }
    });
    return res.data;
};

// 내가 만든 모집 목록
export const fetchMyRecruitments = async (): Promise<any[]> => {
    const url = `${BASE_URL}/api/recruitments/my-recruitments/`;
    const res = await axios.get(url, { headers: authHeaders() });
    return res.data;
};

// 내가 지원한 목록
export const fetchMyApplications = async (): Promise<any[]> => {
    const url = `${BASE_URL}/api/recruitments/my-applications/`;
    const res = await axios.get(url, { headers: authHeaders() });
    return res.data;
};
