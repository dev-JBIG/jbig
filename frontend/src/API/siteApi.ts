/** 퀴즈 주소, 사이트 설정. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

// 퀴즈 url 반환
export const fetchQuizUrl = async (): Promise<string | null> => {
    const res = await axios.get(`${BASE_URL}/api/quiz-url/`, {
        headers: authHeaders(),
    });
    const quizUrl = typeof res.data?.quiz_url === "string" ? res.data.quiz_url.trim() : "";
    return quizUrl || null;
};

// 사이트 설정 인터페이스
export interface SiteSettings {
    notion_page_id: string;
    quiz_url: string;
    jbig_description: string;
    jbig_president: string;
    jbig_president_dept: string;
    jbig_vice_president: string;
    jbig_vice_president_dept: string;
    jbig_email: string;
    jbig_advisor: string;
    jbig_advisor_dept: string;
}

// 사이트 설정 가져오기
/** withAuth=false 면 로그인해 있어도 비회원으로 읽는다(대문, 노트처럼 공개 값만 쓰는 곳. 퀴즈 주소는 회원에게만 온다) */
export const fetchSiteSettings = async (withAuth: boolean = true): Promise<SiteSettings> => {
    const url = `${BASE_URL}/api/settings/`;
    
    try {
        const res = await axios.get(url, {
            headers: withAuth ? authHeaders() : {},
        });
        return res.data;
    } catch (err) {
        throw err;
    }
};

// 사이트 설정 업데이트
export const updateSiteSettings = async (
    settings: Partial<SiteSettings>
): Promise<any> => {
    const url = `${BASE_URL}/api/settings/`;
    
    try {
        const res = await axios.put(url, settings, {
            headers: authHeaders(),
        });
        return res.data;
    } catch (err) {
        throw err;
    }
};
