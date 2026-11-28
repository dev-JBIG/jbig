/** 관리자: 게시판별 조회, 글쓰기, 댓글 권한 */
import React, { useState, useEffect } from "react";
import {
    getAdminBoards,
    updateBoardPermissions,
    AdminBoard,
    BoardReadPermission,
    BoardTwoLevelPermission,
} from "../../API/req";
import { Lock } from "lucide-react";
import "./Admin.css";
const READ_PERMISSION_OPTIONS: { value: BoardReadPermission; label: string }[] = [
    { value: "all", label: "전체공개 (비회원 포함)" },
    { value: "member", label: "회원전용 (로그인 회원)" },
    { value: "author", label: "본인+스태프" },
    { value: "staff", label: "스태프전용" },
];

const TWO_LEVEL_OPTIONS: { value: BoardTwoLevelPermission; label: string }[] = [
    { value: "all", label: "회원" },
    { value: "staff", label: "스태프만" },
];

// 게시판 유형별로 선택 가능한 조회 범위와 안내 문구. 백엔드 BoardAdminSerializer의
// validate_read_permission과 같은 규칙 — 사진첩(4)은 이미지 렌더링 특성상 전체공개만,
// 사유서형(3)은 글 단위 잠금(본인+스태프)이 전제라 'author'로 고정된다.
const getBoardPolicy = (board: AdminBoard) => {
    if (board.board_type === 4) {
        return {
            readOptions: READ_PERMISSION_OPTIONS.filter((o) => o.value === "all"),
            hint: "이미지 렌더링 특성상 전체공개만 지원해요",
        };
    }
    if (board.board_type === 3) {
        return {
            readOptions: READ_PERMISSION_OPTIONS.filter((o) => o.value === "author"),
            hint: "제출형 게시판 — 글은 작성자 본인과 스태프만 볼 수 있어요",
        };
    }
    return { readOptions: READ_PERMISSION_OPTIONS, hint: null };
};

type PermissionField = "read_permission" | "post_permission" | "comment_permission";

const PERMISSION_FIELD_LABELS: Record<PermissionField, string> = {
    read_permission: "조회",
    post_permission: "작성",
    comment_permission: "댓글",
};

function BoardManagement() {
    const [boards, setBoards] = useState<AdminBoard[]>([]);
    const [loading, setLoading] = useState(true);
    // 저장 중인 게시판 id 들. 한 게시판 요청이 끝나도 다른 게시판의 진행 상태는 그대로 둔다
    const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set());
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAdminBoards();
                setBoards(data);
            } catch {
                setMessage({ type: 'error', text: '게시판 목록을 불러오는데 실패했습니다.' });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleChange = async (board: AdminBoard, field: PermissionField, value: string) => {
        const prev = board[field];
        if (prev === value) return;
        setSavingIds((ids) => new Set(ids).add(board.id));
        setMessage(null);
        // 낙관적 업데이트
        setBoards((bs) => bs.map((b) => (b.id === board.id ? { ...b, [field]: value } : b)));
        const res = await updateBoardPermissions(board.id, { [field]: value });
        if (res.success) {
            setMessage({ type: 'success', text: `'${board.name}' ${PERMISSION_FIELD_LABELS[field]} 권한을 변경했습니다.` });
        } else {
            // 실패 시 롤백: 화면 값이 아직 이 요청이 넣은 값일 때만(그 사이 다른 변경이 성공했으면 그대로 둔다)
            setBoards((bs) => bs.map((b) => (b.id === board.id && b[field] === value ? { ...b, [field]: prev } : b)));
            setMessage({ type: 'error', text: res.message || '권한 변경에 실패했습니다.' });
        }
        setSavingIds((ids) => {
            const next = new Set(ids);
            next.delete(board.id);
            return next;
        });
    };

    // 카테고리별 그룹핑 (서버가 category__id, name 순으로 정렬해 내려준다)
    const grouped: { category: string; list: AdminBoard[] }[] = [];
    boards.forEach((b) => {
        const key = b.category_name || '기타';
        const bucket = grouped.find((g) => g.category === key);
        if (bucket) bucket.list.push(b);
        else grouped.push({ category: key, list: [b] });
    });

    if (loading) {
        return (
            <>
                <h2 className="admin-content-header">게시판 관리</h2>
                <div className="admin-card"><p className="admin-muted-text">로딩 중...</p></div>
            </>
        );
    }

    return (
        <>
            <h2 className="admin-content-header">게시판 관리</h2>
            <div className="admin-card">
                <h3 className="card-title">게시판 권한</h3>
                <p className="form-hint admin-board-intro">
                    게시판별로 조회·작성·댓글 권한을 지정합니다. 조회의 &lsquo;본인+스태프&rsquo;는 회원이
                    제출은 할 수 있지만 글은 작성자 본인과 스태프만 볼 수 있는 범위입니다.
                    비공개 범위 게시판의 글과 첨부파일은 권한 확인 후에만 내려갑니다.
                </p>
                {message && (
                    <div className={`admin-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                        {message.text}
                    </div>
                )}
                {grouped.map(({ category, list }) => (
                    <div key={category} className="admin-board-category">
                        <h4 className="admin-board-category-title">{category}</h4>
                        <div className="admin-board-list">
                            {list.map((board) => {
                                const policy = getBoardPolicy(board);
                                const saving = savingIds.has(board.id);
                                return (
                                    <div key={board.id} className="admin-board-row">
                                        <div className="admin-board-info">
                                            <span className="admin-board-name">{board.name}</span>
                                            {policy.hint && (
                                                <span className="admin-board-hint">
                                                    <Lock size={12} aria-hidden="true" />
                                                    <span>{policy.hint}</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="admin-board-controls">
                                            <label className="admin-perm-field admin-perm-field-read">
                                                <span className="admin-perm-label">조회</span>
                                                <select
                                                    className="admin-input admin-perm-select"
                                                    value={board.read_permission}
                                                    disabled={saving || policy.readOptions.length <= 1}
                                                    onChange={(e) => handleChange(board, 'read_permission', e.target.value)}
                                                >
                                                    {policy.readOptions.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="admin-perm-field">
                                                <span className="admin-perm-label">작성</span>
                                                <select
                                                    className="admin-input admin-perm-select"
                                                    value={board.post_permission}
                                                    disabled={saving}
                                                    onChange={(e) => handleChange(board, 'post_permission', e.target.value)}
                                                >
                                                    {TWO_LEVEL_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="admin-perm-field">
                                                <span className="admin-perm-label">댓글</span>
                                                <select
                                                    className="admin-input admin-perm-select"
                                                    value={board.comment_permission}
                                                    disabled={saving}
                                                    onChange={(e) => handleChange(board, 'comment_permission', e.target.value)}
                                                >
                                                    {TWO_LEVEL_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

export default BoardManagement;
