/** 관리자: 팝업 만들기, 고치기, 지우기 */
import React, { useState, useEffect } from "react";
import { Button, Label } from "@primer/react";
import { useAlert } from "../Utils/AlertContext";
import {
    fetchAllPopups,
    createPopup,
    updatePopup,
    deletePopup,
    PopupItem,
    PopupCreate,
    uploadAttachment,
} from "../../API/req";
import {
    Plus,
    Edit2,
    Trash2,
    Eye,
    EyeOff,
    Megaphone,
} from "lucide-react";
import "./Admin.css";
import EmptyState from "../Utils/EmptyState";
import { getImageUploadError } from "../../Utils/uploadRules";

function PopupManagement() {
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
            const data = await fetchAllPopups();
            setPopups(data);
        } catch (err) {
            console.error('[Popup] Failed to fetch popups:', err);
            showAlert({ message: "팝업 목록을 불러오는데 실패했습니다.", type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

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

        // 이미지 종류, 크기(10MB) 검사
        const fileError = getImageUploadError(file);
        if (fileError) {
            showAlert({ message: fileError, type: 'warning' });
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
                const uploadResult = await uploadAttachment(imageFile);
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
                await updatePopup(editingPopup.id, data);
                showAlert({ message: "팝업이 수정되었습니다.", type: 'success' });
            } else {
                await createPopup(data);
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
                    await deletePopup(id);
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
            await updatePopup(popup.id, { is_active: !popup.is_active });
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

export default PopupManagement;
