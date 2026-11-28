/** 사이드바 게시판 목록. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

// sidebar 게시판 목록 조회 함수
export const getBoards = async () => {
    const config = { headers: authHeaders() };
    const response = await axios.get(`${BASE_URL}/api/categories/`, config);
    return response.data;
};
