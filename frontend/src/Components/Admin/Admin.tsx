import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Label } from "@primer/react";
import { useUser } from "../Utils/UserContext";
import { useStaffAuth } from "../Utils/StaffAuthContext";
import { useAlert } from "../Utils/AlertContext";
import { useColorMode } from "../Utils/ThemeContext";
import { sanitizeHttpUrl } from "../Utils/safeUrl";
import {
    fetchSiteSettings,
    updateSiteSettings,
    fetchAllPopups,
    createPopup,
    updatePopup,
    deletePopup,
    PopupItem,
    PopupCreate,
    uploadAttachment,
    getAdminBoards,
    updateBoardPermissions,
    AdminBoard,
    BoardReadPermission,
    BoardTwoLevelPermission
} from "../../API/req";
import {
    Menu,
    X,
    Plus,
    Edit2,
    Trash2,
    Eye,
    EyeOff,
    Lock,
    Sun,
    Moon,
    LayoutDashboard,
    SlidersHorizontal,
    Settings,
    Megaphone,
} from "lucide-react";
import "./Admin.css";
import BrandMark from "../Utils/BrandMark";
import EmptyState from "../Utils/EmptyState";

function SettingsManagement({ accessToken }: { accessToken: string }) {
    const [notionPageId, setNotionPageId] = useState("");
    const [quizUrl, setQuizUrl] = useState("");
    const [jbigDescription, setJbigDescription] = useState("");
    const [jbigPresident, setJbigPresident] = useState("");
    const [jbigPresidentDept, setJbigPresidentDept] = useState("");
    const [jbigVicePresident, setJbigVicePresident] = useState("");
    const [jbigVicePresidentDept, setJbigVicePresidentDept] = useState("");
    const [jbigEmail, setJbigEmail] = useState("");
    const [jbigAdvisor, setJbigAdvisor] = useState("");
    const [jbigAdvisorDept, setJbigAdvisorDept] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadedSettingsRef = React.useRef(false);

    useEffect(() => {
        if (loadedSettingsRef.current) return;
        let cancelled = false;
        const load = async () => {
            try {
                const settings = await fetchSiteSettings(accessToken);
                if (cancelled) return;
                loadedSettingsRef.current = true;
                setNotionPageId(settings.notion_page_id || "");
                setQuizUrl(settings.quiz_url || "");
                setJbigDescription(settings.jbig_description || "");
                setJbigPresident(settings.jbig_president || "");
                setJbigPresidentDept(settings.jbig_president_dept || "");
                setJbigVicePresident(settings.jbig_vice_president || "");
                setJbigVicePresidentDept(settings.jbig_vice_president_dept || "");
                setJbigEmail(settings.jbig_email || "");
                setJbigAdvisor(settings.jbig_advisor || "");
                setJbigAdvisorDept(settings.jbig_advisor_dept || "");
            } catch {
                if (!cancelled) {
                    setMessage({ type: 'error', text: '설정을 불러오는데 실패했습니다.' });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const handleSave = async () => {
        const trimmedQuiz = quizUrl.trim();
        if (trimmedQuiz && !sanitizeHttpUrl(trimmedQuiz)) {
            setMessage({ type: 'error', text: '퀴즈 URL은 http:// 또는 https:// 주소여야 합니다.' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            await updateSiteSettings(accessToken, {
                notion_page_id: notionPageId,
                quiz_url: trimmedQuiz ? sanitizeHttpUrl(trimmedQuiz) || "" : "",
                jbig_description: jbigDescription,
                jbig_president: jbigPresident,
                jbig_president_dept: jbigPresidentDept,
                jbig_vice_president: jbigVicePresident,
                jbig_vice_president_dept: jbigVicePresidentDept,
                jbig_email: jbigEmail,
                jbig_advisor: jbigAdvisor,
                jbig_advisor_dept: jbigAdvisorDept
            });
            setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
        } catch {
            setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <>
                <h2 className="admin-content-header">사이트 설정</h2>
                <div className="admin-card">
                    <p className="admin-muted-text">로딩 중...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <h2 className="admin-content-header">사이트 설정</h2>
            <div className="admin-card">
                <h3 className="card-title">주요 설정</h3>
                {message && (
                    <div className={`admin-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                        {message.text}
                    </div>
                )}
                <div className="admin-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-notion-id">Notion 페이지 ID</label>
                        <input
                            id="admin-notion-id"
                            className="admin-input"
                            type="text"
                            value={notionPageId}
                            onChange={(e) => setNotionPageId(e.target.value)}
                            placeholder="예: 1ad4d7781cdc803a9a5ef553af7782fe"
                        />
                        <p className="form-hint">교안 페이지의 기본 Notion 페이지 ID입니다.</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-quiz-url">퀴즈 URL</label>
                        <input
                            id="admin-quiz-url"
                            className="admin-input"
                            type="url"
                            value={quizUrl}
                            onChange={(e) => setQuizUrl(e.target.value)}
                            placeholder="예: https://forms.gle/..."
                        />
                        <p className="form-hint">사이드바에 표시되는 퀴즈 링크입니다.</p>
                    </div>

                    <h3 className="card-title admin-section-divider-title">JBIG 정보</h3>

                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-jbig-desc">JBIG 소개</label>
                        <textarea
                            id="admin-jbig-desc"
                            className="admin-input admin-textarea"
                            value={jbigDescription}
                            onChange={(e) => setJbigDescription(e.target.value)}
                            placeholder="예: 'JBIG'(JBNU Big Data & AI Group)은..."
                            rows={3}
                        />
                        <p className="form-hint">홈페이지 상단에 표시되는 JBIG 학회 소개 문구입니다.</p>
                    </div>

                    <div className="admin-grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-president">회장 이름</label>
                            <input
                                id="admin-president"
                                className="admin-input"
                                type="text"
                                value={jbigPresident}
                                onChange={(e) => setJbigPresident(e.target.value)}
                                placeholder="예: 박성현"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-president-dept">회장 소속</label>
                            <input
                                id="admin-president-dept"
                                className="admin-input"
                                type="text"
                                value={jbigPresidentDept}
                                onChange={(e) => setJbigPresidentDept(e.target.value)}
                                placeholder="예: 전자공학부"
                            />
                        </div>
                    </div>

                    <div className="admin-grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-vp">부회장 이름</label>
                            <input
                                id="admin-vp"
                                className="admin-input"
                                type="text"
                                value={jbigVicePresident}
                                onChange={(e) => setJbigVicePresident(e.target.value)}
                                placeholder="예: 국환"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-vp-dept">부회장 소속</label>
                            <input
                                id="admin-vp-dept"
                                className="admin-input"
                                type="text"
                                value={jbigVicePresidentDept}
                                onChange={(e) => setJbigVicePresidentDept(e.target.value)}
                                placeholder="예: 사회학과"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="admin-email">이메일</label>
                        <input
                            id="admin-email"
                            className="admin-input"
                            type="email"
                            value={jbigEmail}
                            onChange={(e) => setJbigEmail(e.target.value)}
                            placeholder="예: green031234@naver.com"
                        />
                    </div>

                    <div className="admin-grid-2">
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-advisor">지도 교수</label>
                            <input
                                id="admin-advisor"
                                className="admin-input"
                                type="text"
                                value={jbigAdvisor}
                                onChange={(e) => setJbigAdvisor(e.target.value)}
                                placeholder="예: 최규빈 교수님"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="admin-advisor-dept">지도 교수 소속</label>
                            <input
                                id="admin-advisor-dept"
                                className="admin-input"
                                type="text"
                                value={jbigAdvisorDept}
                                onChange={(e) => setJbigAdvisorDept(e.target.value)}
                                placeholder="예: 통계학과"
                            />
                        </div>
                    </div>

                    <div className="admin-form-actions">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? "저장 중..." : "설정 저장"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Dashboard({ onSelectPage }: { onSelectPage: (page: string) => void }) {
    const shortcuts = [
        {
            id: "boards",
            title: "게시판 관리",
            desc: "게시판별 조회·작성·댓글 권한 정책을 관리합니다.",
            icon: SlidersHorizontal,
        },
        {
            id: "settings",
            title: "사이트 설정",
            desc: "Notion 페이지 ID, 퀴즈 URL, JBIG 운영진 정보를 수정합니다.",
            icon: Settings,
        },
        {
            id: "popups",
            title: "팝업 관리",
            desc: "홈페이지 공지 팝업의 게시 기간과 노출 순서를 관리합니다.",
            icon: Megaphone,
        },
    ];

    return (
        <>
            <h2 className="admin-content-header">대시보드</h2>
            <div className="admin-card">
                <h3 className="card-title">관리자 페이지</h3>
                <p className="admin-muted-text admin-card-lead">
                    왼쪽 메뉴 또는 아래 바로가기에서 관리할 항목을 선택하세요.
                </p>
                <div className="admin-shortcut-grid">
                    {shortcuts.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                className="admin-shortcut-card"
                                onClick={() => onSelectPage(item.id)}
                            >
                                <div className="admin-shortcut-icon">
                                    <Icon size={18} aria-hidden="true" />
                                </div>
                                <div className="admin-shortcut-title">{item.title}</div>
                                <div className="admin-shortcut-desc">{item.desc}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

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

function BoardManagement({ accessToken }: { accessToken: string }) {
    const [boards, setBoards] = useState<AdminBoard[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAdminBoards(accessToken);
                setBoards(data);
            } catch {
                setMessage({ type: 'error', text: '게시판 목록을 불러오는데 실패했습니다.' });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [accessToken]);

    const handleChange = async (board: AdminBoard, field: PermissionField, value: string) => {
        const prev = board[field];
        if (prev === value) return;
        setSavingId(board.id);
        setMessage(null);
        // 낙관적 업데이트
        setBoards((bs) => bs.map((b) => (b.id === board.id ? { ...b, [field]: value } : b)));
        const res = await updateBoardPermissions(accessToken, board.id, { [field]: value });
        if (res.success) {
            setMessage({ type: 'success', text: `'${board.name}' ${PERMISSION_FIELD_LABELS[field]} 권한을 변경했습니다.` });
        } else {
            // 실패 시 롤백
            setBoards((bs) => bs.map((b) => (b.id === board.id ? { ...b, [field]: prev } : b)));
            setMessage({ type: 'error', text: res.message || '권한 변경에 실패했습니다.' });
        }
        setSavingId(null);
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
                                const saving = savingId === board.id;
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

function PopupManagement({ accessToken }: { accessToken: string }) {
    const [popups, setPopups] = useState<PopupItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPopup, setEditingPopup] = useState<PopupItem | null>(null);
    const { showAlert, showConfirm } = useAlert();

    // 폼 상태
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [order, setOrder] = useState(0);

    const imageInputRef = React.useRef<HTMLInputElement>(null);

    const loadPopups = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchAllPopups(accessToken);
            setPopups(data);
        } catch (err) {
            console.error('[Popup] Failed to fetch popups:', err);
            showAlert({ message: "팝업 목록을 불러오는데 실패했습니다.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [accessToken, showAlert]);

    useEffect(() => {
        loadPopups();
    }, [loadPopups]);

    const resetForm = () => {
        setTitle("");
        setContent("");
        setImageUrl("");
        setImageFile(null);
        setImagePreview("");
        setStartDate("");
        setEndDate("");
        setIsActive(true);
        setOrder(0);
        setEditingPopup(null);
        setShowForm(false);
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const handleEdit = (popup: PopupItem) => {
        setEditingPopup(popup);
        setTitle(popup.title);
        setContent(popup.content);
        setImageUrl(popup.image_url || "");
        setImageFile(null);
        setImagePreview(popup.image_url || "");
        setStartDate(popup.start_date.slice(0, 16));
        setEndDate(popup.end_date.slice(0, 16));
        setIsActive(popup.is_active);
        setOrder(popup.order);
        setShowForm(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 이미지 파일 검증
        if (!file.type.startsWith('image/')) {
            showAlert({ message: '이미지 파일만 업로드할 수 있습니다.', type: 'warning' });
            if (imageInputRef.current) {
                imageInputRef.current.value = "";
            }
            return;
        }

        // 10MB 제한
        if (file.size > 10 * 1024 * 1024) {
            showAlert({ message: '이미지 파일은 10MB 이하만 업로드할 수 있습니다.', type: 'warning' });
            if (imageInputRef.current) {
                imageInputRef.current.value = "";
            }
            return;
        }

        setImageFile(file);

        // 미리보기 생성
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview("");
        setImageUrl("");
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 제목, 시작일, 종료일은 필수
        if (!title.trim() || !startDate || !endDate) {
            showAlert({ message: "제목, 시작일, 종료일은 필수 항목입니다.", type: 'warning' });
            return;
        }

        // 내용과 이미지 중 하나는 있어야 함
        if (!content.trim() && !imageFile && !imageUrl) {
            showAlert({ message: "내용 또는 이미지 중 하나는 입력해야 합니다.", type: 'warning' });
            return;
        }

        setUploading(true);
        let finalImagePath = imageUrl;

        try {
            // 새로운 이미지 파일이 있으면 오브젝트 스토리지에 업로드
            if (imageFile) {
                const uploadResult = await uploadAttachment(imageFile, accessToken);
                if (uploadResult.message || !uploadResult.path) {
                    showAlert({ message: `이미지 업로드 실패: ${uploadResult.message || '알 수 없는 오류'}`, type: 'error' });
                    setUploading(false);
                    return;
                }
                // path를 저장 (게시글과 동일한 방식)
                finalImagePath = uploadResult.path;
            }

            const data: PopupCreate = {
                title: title.trim(),
                content: content.trim(),
                image_path: finalImagePath || undefined,
                start_date: startDate,
                end_date: endDate,
                is_active: isActive,
                order
            };

            if (editingPopup) {
                await updatePopup(editingPopup.id, data, accessToken);
                showAlert({ message: "팝업이 수정되었습니다.", type: 'success' });
            } else {
                await createPopup(data, accessToken);
                showAlert({ message: "팝업이 생성되었습니다.", type: 'success' });
            }
            resetForm();
            loadPopups();
        } catch (err) {
            console.error('[Popup] Failed to save popup:', err);
            showAlert({
                message: editingPopup ? "팝업 수정에 실패했습니다." : "팝업 생성에 실패했습니다.",
                type: 'error'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: number) => {
        showConfirm({
            message: "정말 이 팝업을 삭제하시겠습니까?",
            onConfirm: async () => {
                try {
                    await deletePopup(id, accessToken);
                    showAlert({ message: "팝업이 삭제되었습니다.", type: 'success' });
                    loadPopups();
                } catch (err) {
                    console.error('[Popup] Failed to delete popup:', err);
                    showAlert({ message: "팝업 삭제에 실패했습니다.", type: 'error' });
                }
            }
        });
    };

    const toggleActive = async (popup: PopupItem) => {
        try {
            await updatePopup(popup.id, { is_active: !popup.is_active }, accessToken);
            showAlert({
                message: `팝업이 ${!popup.is_active ? '활성화' : '비활성화'}되었습니다.`,
                type: 'success'
            });
            loadPopups();
        } catch (err) {
            console.error('[Popup] Failed to toggle popup:', err);
            showAlert({ message: "팝업 상태 변경에 실패했습니다.", type: 'error' });
        }
    };

    if (loading) {
        return (
            <>
                <h2 className="admin-content-header">팝업 관리</h2>
                <div className="admin-card">
                    <p className="admin-muted-text">로딩 중...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <h2 className="admin-content-header">팝업 관리</h2>

            {/* 팝업 생성/수정 폼 */}
            {showForm && (
                <div className="admin-card">
                    <h3 className="card-title admin-card-title-spaced">
                        {editingPopup ? '팝업 수정' : '새 팝업 생성'}
                    </h3>
                    <form className="admin-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="popup-title">제목 *</label>
                            <input
                                id="popup-title"
                                className="admin-input"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="팝업 제목"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="popup-content">내용</label>
                            <textarea
                                id="popup-content"
                                className="admin-input admin-textarea"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="팝업 내용 (이미지만 있어도 생성 가능)"
                                rows={6}
                            />
                            <small className="form-hint">
                                내용 또는 이미지 중 하나는 필수입니다.
                            </small>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="popup-image">이미지 (선택)</label>
                            <input
                                id="popup-image"
                                ref={imageInputRef}
                                className="admin-input admin-file-input"
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                            <small className="form-hint">
                                이미지를 업로드하면 팝업 상단에 표시됩니다. (최대 10MB)
                            </small>
                            {imagePreview && (
                                <div className="admin-image-preview-wrap">
                                    <img
                                        src={imagePreview}
                                        alt="미리보기"
                                        className="admin-image-preview"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="small"
                                        onClick={handleRemoveImage}
                                    >
                                        이미지 제거
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="admin-grid-2">
                            <div className="form-group">
                                <label className="form-label" htmlFor="popup-start">시작 일시 *</label>
                                <input
                                    id="popup-start"
                                    className="admin-input"
                                    type="datetime-local"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="popup-end">종료 일시 *</label>
                                <input
                                    id="popup-end"
                                    className="admin-input"
                                    type="datetime-local"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="admin-grid-2">
                            <div className="form-group">
                                <label className="form-label" htmlFor="popup-order">표시 순서</label>
                                <input
                                    id="popup-order"
                                    className="admin-input"
                                    type="number"
                                    value={order}
                                    onChange={(e) => setOrder(Number(e.target.value))}
                                    placeholder="0"
                                />
                                <small className="form-hint">
                                    작은 숫자가 먼저 표시됩니다
                                </small>
                            </div>
                            <div className="form-group">
                                <span className="form-label">활성 여부</span>
                                <label className="admin-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                    />
                                    <span>활성화</span>
                                </label>
                            </div>
                        </div>
                        <div className="admin-form-actions">
                            <Button variant="primary" type="submit" disabled={uploading}>
                                {uploading ? '업로드 중...' : (editingPopup ? '수정' : '생성')}
                            </Button>
                            <Button variant="default" type="button" onClick={resetForm}>
                                취소
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* 팝업 목록 */}
            <div className="admin-card">
                <div className="card-header">
                    <h3 className="card-title">팝업 목록 ({popups.length}개)</h3>
                    <Button
                        type="button"
                        variant="primary"
                        size="small"
                        leadingVisual={() => <Plus size={15} aria-hidden="true" />}
                        onClick={() => setShowForm(!showForm)}
                    >
                        새 팝업
                    </Button>
                </div>

                {popups.length === 0 ? (
                    <EmptyState icon={<Megaphone size={24} />} title="등록된 팝업이 없습니다." />
                ) : (
                    <div className="table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>순서</th>
                                    <th>제목</th>
                                    <th>기간</th>
                                    <th>상태</th>
                                    <th>작성자</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {popups.map((popup) => (
                                    <tr key={popup.id}>
                                        <td>{popup.order}</td>
                                        <td>
                                            <div className="admin-popup-title">{popup.title}</div>
                                            <div className="admin-popup-snippet">
                                                {popup.content.length > 50
                                                    ? popup.content.slice(0, 50) + '...'
                                                    : popup.content
                                                }
                                            </div>
                                        </td>
                                        <td>
                                            <div className="admin-popup-date">
                                                {new Date(popup.start_date).toLocaleString('ko-KR')}
                                            </div>
                                            <div className="admin-popup-date-end">
                                                ~ {new Date(popup.end_date).toLocaleString('ko-KR')}
                                            </div>
                                        </td>
                                        <td>
                                            <Label variant={popup.is_active ? "success" : "danger"} size="small">
                                                {popup.is_active ? '활성' : '비활성'}
                                            </Label>
                                        </td>
                                        <td>{popup.created_by_username || '-'}</td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    type="button"
                                                    className="admin-icon-button"
                                                    onClick={() => toggleActive(popup)}
                                                    title={popup.is_active ? '비활성화' : '활성화'}
                                                    aria-label={popup.is_active ? '비활성화' : '활성화'}
                                                >
                                                    {popup.is_active ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-icon-button"
                                                    onClick={() => handleEdit(popup)}
                                                    title="수정"
                                                    aria-label="수정"
                                                >
                                                    <Edit2 size={15} aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-icon-button admin-icon-button-danger"
                                                    onClick={() => handleDelete(popup.id)}
                                                    title="삭제"
                                                    aria-label="삭제"
                                                >
                                                    <Trash2 size={15} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

function Admin() {
    const { user, authReady, accessToken, signOutLocal } = useUser();
    const { staffAuth } = useStaffAuth();
    const { showAlert } = useAlert();
    const { resolvedColorMode, toggleColorMode } = useColorMode();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [authorized, setAuthorized] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (!authReady) return;
        if (!user || !accessToken) {
            showAlert({ message: "로그인이 필요합니다.", type: 'warning' });
            signOutLocal();
            navigate("/signin");
            return;
        }
        if (!staffAuth && !user.is_staff) {
            showAlert({
                message: "관리자 권한이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/")
            });
            return;
        }
        setAuthorized(true);
    }, [authReady, user, accessToken, navigate, signOutLocal, staffAuth, showAlert]);

    const adminMenus = [
        { id: "dashboard", name: "대시보드", icon: LayoutDashboard },
        { id: "boards", name: "게시판 관리", icon: SlidersHorizontal },
        { id: "settings", name: "사이트 설정", icon: Settings },
        { id: "popups", name: "팝업 관리", icon: Megaphone },
    ];

    const handleGoHome = () => {
        navigate("/");
    };

    const handleMenuSelect = (menuId: string) => {
        setCurrentPage(menuId);
        setMobileMenuOpen(false);
    };

    const renderContent = () => {
        if (!accessToken) return null;
        switch (currentPage) {
            case "boards":
                return <BoardManagement accessToken={accessToken} />;
            case "settings":
                return <SettingsManagement accessToken={accessToken} />;
            case "popups":
                return <PopupManagement accessToken={accessToken} />;
            default:
                return <Dashboard onSelectPage={handleMenuSelect} />;
        }
    };

    if (!authReady || !authorized) {
        return (
            <div className="admin-container">
                <div className="admin-loading">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <header className="admin-header-bar">
                <div className="admin-header-left">
                    <button
                        type="button"
                        className="admin-menu-toggle"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="메뉴 토글"
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
                    </button>
                    <button type="button" className="admin-logo" onClick={handleGoHome}>
                        <BrandMark className="admin-logo-mark" />
                        <span>JBIG Admin</span>
                    </button>
                </div>
                <div className="admin-user-info">
                    <span className="admin-user-label">{user?.username || "관리자"}님</span>
                    <button
                        type="button"
                        className="admin-icon-button"
                        onClick={toggleColorMode}
                        aria-label={resolvedColorMode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
                        title={resolvedColorMode === "dark" ? "라이트 모드" : "다크 모드"}
                    >
                        {resolvedColorMode === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                    </button>
                    <Button variant="default" size="small" onClick={handleGoHome}>
                        사이트 홈
                    </Button>
                </div>
            </header>

            <div className="admin-content">
                {/* 모바일 오버레이 */}
                {/* design-lint-allow clickable-div: 모바일 메뉴 뒤 배경막 클릭은 마우스 보조 동작이고 메뉴 버튼으로도 닫힌다 */}
                <div
                    className={`admin-sidebar-overlay ${mobileMenuOpen ? 'show' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                />

                <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                    <nav className="admin-menu" aria-label="관리자 메뉴">
                        <ul>
                            {adminMenus.map((menu) => {
                                const Icon = menu.icon;
                                const isActive = currentPage === menu.id;
                                return (
                                    <li key={menu.id}>
                                        <button
                                            type="button"
                                            className={`admin-menu-btn${isActive ? " active" : ""}`}
                                            aria-current={isActive ? "page" : undefined}
                                            onClick={() => handleMenuSelect(menu.id)}
                                        >
                                            <Icon size={16} aria-hidden="true" />
                                            <span>{menu.name}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>

                <main className="admin-main-area">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}

export default Admin;
