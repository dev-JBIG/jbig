/** 관리자 게시판 권한. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";
import { getErrorMessage } from "./apiShared";

// 관리자: 게시판 목록(권한 매트릭스 포함) 조회
export type BoardReadPermission = "all" | "member" | "author" | "staff";
export type BoardTwoLevelPermission = "all" | "staff";

export interface AdminBoard {
    id: number;
    name: string;
    category: number;
    category_name: string;
    board_type: number;
    form_type: number;
    read_permission: BoardReadPermission;
    post_permission: BoardTwoLevelPermission;
    comment_permission: BoardTwoLevelPermission;
}

export const getAdminBoards = async (): Promise<AdminBoard[]> => {
    const response = await axios.get(`${BASE_URL}/api/admin/boards/`, {
        headers: authHeaders(),
    });
    return response.data as AdminBoard[];
};

// 관리자: 게시판 권한(조회/작성/댓글) 변경 — 바꿀 필드만 부분 PATCH
export const updateBoardPermissions = async (
    boardId: number,
    patch: Partial<Pick<AdminBoard, "read_permission" | "post_permission" | "comment_permission">>
): Promise<{ success: boolean; message?: string }> => {
    try {
        await axios.patch(
            `${BASE_URL}/api/admin/boards/${boardId}/`,
            patch,
            { headers: { "Content-Type": "application/json", ...authHeaders() } }
        );
        return { success: true };
    } catch (error: unknown) {
        return { success: false, message: getErrorMessage(error, "게시판 권한 변경에 실패했습니다.") };
    }
};
