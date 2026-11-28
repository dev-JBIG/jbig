/** 노션 프록시. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

// ========== Notion 프록시 API ==========

export const fetchNotionPage = async (pageId: string): Promise<any> => {
    const url = `${BASE_URL}/api/notion/${encodeURIComponent(pageId)}/`;
    const res = await axios.get(url, { headers: authHeaders() });
    return res.data;
};
