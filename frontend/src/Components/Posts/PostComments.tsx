/**
 * 게시글 상세의 댓글 영역: 댓글, 답글 목록과 작성, 수정, 삭제, 좋아요, 더보기 메뉴, 비회원 캡차.
 * 게시글 상태(post)는 부모(PostDetail)가 갖고, 댓글을 바꾸면 setPost 로 함께 갱신한다.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PostDetailData } from "../Utils/interfaces";
import { createComment, deleteComment, toggleCommentLike, updateComment } from "../../API/req";
import "./PostDetail-comments.css";
import { Button, Label } from '@primer/react';
import {useUser} from "../Utils/UserContext";
import { Heart, MessageSquare, MoreHorizontal } from "lucide-react";
import {useAlert} from "../Utils/AlertContext";
import { useColorMode } from "../Utils/ThemeContext";
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

// 댓글 작성 위치에 표시할 공개범위 안내 문구
// post_type(1=DEFAULT, 2=STAFF_ONLY, 3=JUSTIFICATION_LETTER)이 글 단위 접근 제한을
// 결정하므로 board.read_scope보다 먼저 분기한다.
const getCommentVisibilityHint = (
    scope?: 'all' | 'member' | 'author' | 'staff',
    postType?: number
): string | null => {
    if (postType === 3) {
        return "이 글과 댓글은 본인과 스태프만 볼 수 있습니다";
    }
    if (postType === 2) {
        return "스태프만 볼 수 있는 글입니다";
    }
    switch (scope) {
        case 'all':
            return "이 게시판의 댓글은 비회원에게도 공개됩니다";
        case 'member':
            return "회원전용 게시판 — 댓글은 로그인한 회원에게만 보입니다";
        case 'author':
            return "이 글과 댓글은 본인과 스태프만 볼 수 있습니다";
        case 'staff':
            return "스태프전용 게시판입니다";
        default:
            return null;
    }
};

interface PostCommentsProps {
    post: PostDetailData;
    setPost: React.Dispatch<React.SetStateAction<PostDetailData | null | "not-found">>;
    /** 삭제되지 않은 댓글, 답글 수 */
    commentCount: number;
}

const PostComments: React.FC<PostCommentsProps> = ({ post, setPost, commentCount }) => {
    const navigate = useNavigate();
    const { accessToken } = useUser();
    const { showAlert, showConfirm } = useAlert();
    const { resolvedColorMode } = useColorMode();

    const [commentInput, setCommentInput] = useState("");
    const [showCommentRealName, setShowCommentRealName] = useState(false);
    // 답글 입력 대상 댓글 id (하나만)
    const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
    // 답글 입력값 (하나만)
    const [replyInput, setReplyInput] = useState("");
    const [showReplyRealName, setShowReplyRealName] = useState(false);
    // Turnstile CAPTCHA (비회원용)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileInstance | null>(null);

    type OpenMenu =
        | { type: "comment"; id: number }
        | { type: "reply"; cId: number; rId: number }
        | null;

    const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
    const [editingCommentId, setEditingCommentId] = useState<number|null>(null);
    const [editingReplyKey, setEditingReplyKey] = useState<{cId:number; rId:number} | null>(null);
    const [editText, setEditText] = useState("");
    const [editShowRealName, setEditShowRealName] = useState(false);

    const openMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

    const toggleCommentMenu = (id: number, triggerEl?: HTMLButtonElement | null) => {
        if (triggerEl) openMenuTriggerRef.current = triggerEl;
        setOpenMenu(m => (m && m.type === "comment" && m.id === id ? null : { type: "comment", id }));
    };

    const toggleReplyMenu = (cId: number, rId: number, triggerEl?: HTMLButtonElement | null) => {
        if (triggerEl) openMenuTriggerRef.current = triggerEl;
        setOpenMenu(m =>
            m && m.type === "reply" && m.cId === cId && m.rId === rId ? null : { type: "reply", cId, rId }
        );
    };

    useEffect(() => {
        if (!openMenu) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            const trigger = openMenuTriggerRef.current;
            const activeEl = document.activeElement;
            const shouldRestore = Boolean(
                trigger && activeEl && trigger.closest(".more-wrapper")?.contains(activeEl)
            );
            setOpenMenu(null);
            if (shouldRestore) {
                trigger?.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [openMenu]);

    useEffect(() => {
        const onPointerDown = (ev: PointerEvent) => {
            const el = ev.target as Element | null;
            if (!el || !el.closest(".more-wrapper")) setOpenMenu(null);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);

    // 댓글 좋아요 토글 핸들러
    const handleToggleCommentLike = async (commentId: number, isReply: boolean = false) => {
        if (!post || typeof post === "string" || !post.comments) return;

        if (!accessToken) {
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'info',
                onClose: () => navigate("/signin")
            });
            return;
        }

        // 낙관적 업데이트
        const updatedComments = post.comments.map(c => {
            if (c.id === commentId) {
                const currentLikes = c.likes || 0;
                const nextLiked = !c.isLiked;
                const nextLikes = currentLikes + (nextLiked ? 1 : -1);
                return { ...c, isLiked: nextLiked, likes: Math.max(0, nextLikes) };
            }
            // 답글인 경우
            if (c.replies) {
                const updatedReplies = c.replies.map(r => {
                    if (r.id === commentId) {
                        const currentLikes = r.likes || 0;
                        const nextLiked = !r.isLiked;
                        const nextLikes = currentLikes + (nextLiked ? 1 : -1);
                        return { ...r, isLiked: nextLiked, likes: Math.max(0, nextLikes) };
                    }
                    return r;
                });
                return { ...c, replies: updatedReplies };
            }
            return c;
        });

        setPost({ ...post, comments: updatedComments });

        try {
            const response = await toggleCommentLike(commentId);
            
            // 서버 응답으로 실제 값 업데이트
            const finalComments = post.comments.map(c => {
                if (c.id === commentId) {
                    return { ...c, isLiked: response.isLiked, likes: response.likes };
                }
                if (c.replies) {
                    const finalReplies = c.replies.map(r => {
                        if (r.id === commentId) {
                            return { ...r, isLiked: response.isLiked, likes: response.likes };
                        }
                        return r;
                    });
                    return { ...c, replies: finalReplies };
                }
                return c;
            });
            setPost({ ...post, comments: finalComments });
        } catch (e) {
            // 실패 시 롤백
            setPost(post);
            showAlert({ message: "좋아요 처리 중 오류가 발생했습니다.", type: 'error' });
        }
    };

    // 댓글 등록
    const handleAddComment = async () => {
        if (!post || typeof post === "string") return;
        const content = commentInput.trim();
        if (!content) return;

        // 비회원인 경우 Turnstile 검증 필요
        if (!accessToken && !turnstileToken) {
            showAlert({ message: "CAPTCHA 인증을 완료해주세요.", type: 'warning' });
            return;
        }

        try {
            const payload: any = { content, parent: null };
            if (accessToken) {
                payload.is_anonymous = !showCommentRealName;
            } else {
                payload.turnstile_token = turnstileToken;
                // 비회원은 항상 익명
            }
            const created = await createComment(post.id, payload);
            setPost({
                ...post,
                comments: [ ...(post.comments || []), created ],
            });
            setCommentInput("");
            setShowCommentRealName(false);
            // Turnstile 리셋
            setTurnstileToken(null);
            turnstileRef.current?.reset();
        } catch {
            showAlert({ message: "댓글 등록에 실패했습니다.", type: 'error' });
            // 실패 시에도 Turnstile 리셋
            setTurnstileToken(null);
            turnstileRef.current?.reset();
        }
    };

    // 댓글 삭제
    const handleDeleteComment = async (commentId: number) => {
        if (!post || typeof post === "string") return;
        if (!accessToken) { 
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/signin")
            });
            return; 
        }

        const prev = post;
        const optimistic = {
            ...post,
            comments: (post.comments || []).map(c =>
                c.id === commentId ? { ...c, content: "삭제 된 댓글입니다", is_deleted: true } : c
            ),
        };
        setPost(optimistic);

        try {
            const res: any = await deleteComment(commentId);
            if (res && res.status === 401) { 
                setPost(prev); 
                showAlert({
                    message: "로그인이 필요합니다.",
                    type: 'warning',
                    onClose: () => navigate("/signin")
                });
                return; 
            }
            if (res && res.deleted === false) { throw new Error(res.message || "삭제 실패"); }
            // 성공 시 그대로 유지
        } catch {
            setPost(prev);
            showAlert({ message: "댓글 삭제에 실패했습니다.", type: 'error' });
        }
    };

    // 답글 삭제
    const handleDeleteReply = async (commentId: number, replyId: number) => {
        if (!post || typeof post === "string") return;
        if (!accessToken) { 
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/signin")
            });
            return; 
        }

        const prev = post;
        const optimistic = {
            ...post,
            comments: (post.comments || []).map(c =>
                c.id === commentId
                    ? {
                        ...c,
                        replies: (c.replies || []).map(r =>
                            r.id === replyId ? { ...r, content: "삭제 된 댓글입니다", is_deleted: true } : r
                        ),
                    }
                    : c
            ),
        };
        setPost(optimistic);

        try {
            const res: any = await deleteComment(replyId); // 답글도 같은 엔드포인트
            if (res && res.status === 401) { 
                setPost(prev); 
                showAlert({
                    message: "로그인이 필요합니다.",
                    type: 'warning',
                    onClose: () => navigate("/signin")
                });
                return; 
            }
            if (res && res.deleted === false) { throw new Error(res.message || "삭제 실패"); }
        } catch {
            setPost(prev);
            showAlert({ message: "답글 삭제에 실패했습니다.", type: 'error' });
        }
    };

    // 답글쓰기 버튼 클릭
    const handleReplyWriteClick = async (id: number) => {
        // 이미 다른 답글창이 열려 있고, 입력값이 있다면 confirm
        if (replyTargetId !== null && replyTargetId !== id && replyInput.trim().length > 0) {
            await showConfirm({
                message: "작성 중인 답글을 취소 하시겠습니까?",
                title: "답글 작성 취소",
                type: 'warning',
                confirmText: '취소',
                cancelText: '계속 작성',
                onConfirm: () => {
                    setReplyTargetId(id);
                    setReplyInput("");
                }
            });
            // 취소시 아무 것도 하지 않음 (기존 답글창/입력값 유지)
        } else {
            setReplyTargetId(replyTargetId === id ? null : id);
            setReplyInput("");
        }
    };

    // 답글 등록
    const handleAddReply = async (commentId: number) => {
        if (!post || typeof post === "string") return;
        const content = replyInput.trim();
        if (!content) return;

        // 비회원인 경우 Turnstile 검증 필요
        if (!accessToken && !turnstileToken) {
            showAlert({ message: "CAPTCHA 인증을 완료해주세요.", type: 'warning' });
            return;
        }

        try {
            const payload: any = { content, parent: commentId };
            if (accessToken) {
                payload.is_anonymous = !showReplyRealName;
            } else {
                payload.turnstile_token = turnstileToken;
                // 비회원은 항상 익명
            }
            const created = await createComment(post.id, payload);
            setPost({
                ...post,
                comments: (post.comments || []).map(c =>
                    c.id === commentId
                        ? { ...c, replies: [ ...(c.replies || []), created ] }
                        : c
                ),
            });
            setReplyInput("");
            setShowReplyRealName(false);
            setReplyTargetId(null);
            // Turnstile 리셋
            setTurnstileToken(null);
            turnstileRef.current?.reset();
        } catch {
            showAlert({ message: "답글 등록에 실패했습니다.", type: 'error' });
            // 실패 시에도 Turnstile 리셋
            setTurnstileToken(null);
            turnstileRef.current?.reset();
        }
    };

    const cancelEdit = () => {
        setEditingCommentId(null);
        setEditingReplyKey(null);
        setEditText("");
        setEditShowRealName(false);
    };

    const saveEditComment = async (commentId: number) => {
        if (!post || typeof post === "string") return;
        if (!accessToken) {
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/signin")
            });
            return;
        }
        const content = editText.trim();
        if (!content) return;

        const is_anonymous = !editShowRealName;

        try {
            await updateComment(commentId, { content, parent: null, is_anonymous });
            setPost({
                ...post,
                comments: (post.comments || []).map(c => c.id === commentId ? { ...c, content, is_anonymous } : c),
            });
            cancelEdit();
        } catch {
            showAlert({ message: "댓글 수정에 실패했습니다.", type: 'error' });
        }
    };

    const saveEditReply = async (cId: number, rId: number) => {
        if (!post || typeof post === "string") return;
        if (!accessToken) {
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/signin")
            });
            return;
        }
        const content = editText.trim();
        if (!content) return;

        const is_anonymous = !editShowRealName;

        try {
            await updateComment(rId, { content, parent: cId, is_anonymous });
            setPost({
                ...post,
                comments: (post.comments || []).map(c =>
                    c.id === cId
                        ? { ...c, replies: (c.replies || []).map(r => r.id === rId ? { ...r, content, is_anonymous } : r) }
                        : c
                ),
            });
            cancelEdit();
        } catch {
            showAlert({ message: "답글 수정에 실패했습니다.", type: 'error' });
        }
    };

    // 댓글 수정 시작
    const handleEditComment = (commentId: number) => {
        if (!post || typeof post === "string") return;

        const target = (post.comments || []).find(c => c.id === commentId);
        if (!target) return;

        setOpenMenu(null);               // 더보기 닫기
        setEditingReplyKey(null);        // 답글 편집 모드 해제
        setEditingCommentId(commentId);  // 댓글 편집 모드 진입
        setEditText(target.content);     // 현재 내용으로 에디터 채우기
        setEditShowRealName(!target.is_anonymous);  // 현재 실명 표시 여부 로드
    };

    // 답글 수정 시작
    const handleEditReply = (commentId: number, replyId: number) => {
        if (!post || typeof post === "string") return;

        const parent = (post.comments || []).find(c => c.id === commentId);
        const target = parent?.replies?.find(r => r.id === replyId);
        if (!parent || !target) return;

        setOpenMenu(null);                     // 더보기 닫기
        setEditingCommentId(null);             // 댓글 편집 모드 해제
        setEditingReplyKey({ cId: commentId, rId: replyId }); // 답글 편집 모드 진입
        setEditText(target.content);           // 현재 내용으로 에디터 채우기
        setEditShowRealName(!target.is_anonymous);  // 현재 실명 표시 여부 로드
    };

    return (
        <section className="postdetail-comment-section" aria-label="댓글">
            <div className="postdetail-comment-header">
                <MessageSquare size={16} aria-hidden="true" />
                <span>댓글</span>
                <span className="postdetail-comment-count-pill">{commentCount}</span>
            </div>
            <ul className="postdetail-comment-list">
                {(post.comments || []).map(c => (
                    <li className="postdetail-comment-item" key={c.id}>
                        <div className="comment-item">
                            <div className="comment-meta">
                                <button
                                    type="button"
                                    className={"comment-author" + (c.is_deleted ? " deleted" : "")}
                                    disabled={c.is_deleted}
                                    onClick={() => !c.is_deleted && navigate(`/@${c.user_id}`)}
                                >
                                    {!c.is_deleted && c.author_semester ? `${c.author_semester}기 ` : ""}{c.author}
                                </button>
                                {!c.is_deleted && c.is_owner && (
                                    <Label variant="accent" size="small" className="comment-owner-badge">
                                        나
                                    </Label>
                                )}
                                <span className="comment-date">{c.date}</span>
                                <div className="comment-meta-actions">
                                    {!c.is_deleted && (
                                        <button
                                            type="button"
                                            className={`comment-like-btn ${c.isLiked ? "liked" : ""}`}
                                            onClick={() => handleToggleCommentLike(c.id, false)}
                                            aria-label={c.isLiked ? "좋아요 취소" : "좋아요"}
                                        >
                                            <Heart
                                                size={13}
                                                aria-hidden="true"
                                                className={`postdetail-heart-icon${c.isLiked ? " is-liked" : ""}`}
                                            />
                                            <span className="comment-like-count">{c.likes || 0}</span>
                                        </button>
                                    )}
                                    {!c.is_deleted && (
                                        <button
                                            type="button"
                                            className="reply-write-btn"
                                            onClick={() => handleReplyWriteClick(c.id)}
                                        >
                                            답글쓰기
                                        </button>
                                    )}
                                    {!c.is_deleted && (c.is_owner || c.can_delete) && (
                                        <div className="more-wrapper">
                                            <button
                                                type="button"
                                                className="more-btn"
                                                aria-expanded={openMenu?.type === "comment" && openMenu.id === c.id}
                                                onClick={(e) => toggleCommentMenu(c.id, e.currentTarget)}
                                                title="더보기"
                                                aria-label="댓글 더보기"
                                            >
                                                <MoreHorizontal size={16} aria-hidden="true" />
                                            </button>
                                            {openMenu?.type === "comment" && openMenu.id === c.id && (
                                                <div className="more-menu">
                                                    {c.is_owner && (
                                                        <button
                                                            type="button"
                                                            className="more-menu-item"
                                                            onClick={() => { setOpenMenu(null); handleEditComment(c.id); }}
                                                        >
                                                            수정
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="more-menu-item danger"
                                                        onClick={() => { setOpenMenu(null); handleDeleteComment(c.id); }}
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {editingCommentId === c.id ? (
                                <div className="comment-body-edit">
                                    <textarea
                                        className="reply-input"
                                        rows={2}
                                        value={editText}
                                        onChange={e => setEditText(e.target.value)}
                                        placeholder="내용을 수정하세요"
                                    />
                                    <div className="reply-action-row">
                                        <label className="comment-realname-label">
                                            <input
                                                type="checkbox"
                                                checked={editShowRealName}
                                                onChange={(e) => setEditShowRealName(e.target.checked)}
                                            />
                                            <span>비회원에게도 실명이 표시돼요</span>
                                        </label>
                                        <Button type="button" variant="default" size="small" onClick={cancelEdit}>
                                            취소
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="small"
                                            disabled={!editText.trim()}
                                            onClick={() => editText.trim() && saveEditComment(c.id)}
                                        >
                                            저장
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className={"comment-content" + (c.is_deleted ? " deleted" : "")}>
                                    {c.content}
                                </div>
                            )}
                        </div>
                        {/* 답글 리스트 */}
                        {(c.replies && c.replies.length > 0) && (
                            <ul className="reply-list">
                                {c.replies.map(r => (
                                    <li className="reply-item" key={r.id}>
                                        <div className="reply-meta">
                                            <button
                                                type="button"
                                                className={"reply-author" + (r.is_deleted ? " deleted" : "")}
                                                disabled={r.is_deleted}
                                                onClick={() => !r.is_deleted && navigate(`/@${r.user_id}`)}
                                            >
                                                {!r.is_deleted && r.author_semester ? `${r.author_semester}기 ` : ""}{r.author}
                                            </button>
                                            {!r.is_deleted && r.is_owner && (
                                                <Label variant="accent" size="small" className="comment-owner-badge">
                                                    나
                                                </Label>
                                            )}
                                            <span className="reply-date">{r.date}</span>
                                            <div className="comment-meta-actions">
                                                {!r.is_deleted && (
                                                    <button
                                                        type="button"
                                                        className={`comment-like-btn ${r.isLiked ? "liked" : ""}`}
                                                        onClick={() => handleToggleCommentLike(r.id, true)}
                                                        aria-label={r.isLiked ? "좋아요 취소" : "좋아요"}
                                                    >
                                                        <Heart
                                                            size={13}
                                                            aria-hidden="true"
                                                            className={`postdetail-heart-icon${r.isLiked ? " is-liked" : ""}`}
                                                        />
                                                        <span className="comment-like-count">{r.likes || 0}</span>
                                                    </button>
                                                )}
                                                {!r.is_deleted && (r.is_owner || r.can_delete) && (
                                                    <div className="more-wrapper">
                                                        <button
                                                            type="button"
                                                            className="more-btn"
                                                            aria-expanded={openMenu?.type === "reply" && openMenu.cId === c.id && openMenu.rId === r.id}
                                                            onClick={(e) => toggleReplyMenu(c.id, r.id, e.currentTarget)}
                                                            title="더보기"
                                                            aria-label="답글 더보기"
                                                        >
                                                            <MoreHorizontal size={16} aria-hidden="true" />
                                                        </button>
                                                        {openMenu?.type === "reply" && openMenu.cId === c.id && openMenu.rId === r.id && (
                                                            <div className="more-menu">
                                                                {r.is_owner && (
                                                                    <button
                                                                        type="button"
                                                                        className="more-menu-item"
                                                                        onClick={() => { setOpenMenu(null); handleEditReply(c.id, r.id); }}
                                                                    >
                                                                        수정
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="more-menu-item danger"
                                                                    onClick={() => { setOpenMenu(null); handleDeleteReply(c.id, r.id); }}
                                                                >
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {editingReplyKey && editingReplyKey.cId === c.id && editingReplyKey.rId === r.id ? (
                                            <div className="comment-body-edit">
                                                <textarea
                                                    className="reply-input"
                                                    rows={2}
                                                    value={editText}
                                                    onChange={e => setEditText(e.target.value)}
                                                    placeholder="내용을 수정하세요"
                                                />
                                                <div className="reply-action-row">
                                                    <label className="comment-realname-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={editShowRealName}
                                                            onChange={(e) => setEditShowRealName(e.target.checked)}
                                                        />
                                                        <span>비회원에게도 실명이 표시돼요</span>
                                                    </label>
                                                    <Button type="button" variant="default" size="small" onClick={cancelEdit}>
                                                        취소
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="small"
                                                        disabled={!editText.trim()}
                                                        onClick={() => editText.trim() && saveEditReply(c.id, r.id)}
                                                    >
                                                        저장
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={"reply-content" + (r.is_deleted ? " deleted" : "")}>
                                                {r.content}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {/* 답글 입력창: replyTargetId와 id가 같을 때만 노출 */}
                        {replyTargetId === c.id && (
                            <div className="reply-input-box">
                                <textarea
                                    className="reply-input"
                                    rows={2}
                                    placeholder="답글을 입력하세요"
                                    value={replyInput}
                                    onChange={e => setReplyInput(e.target.value)}
                                />
                                <div className="reply-action-row">
                                    {accessToken ? (
                                        <label className="comment-realname-label">
                                            <input
                                                type="checkbox"
                                                checked={showReplyRealName}
                                                onChange={(e) => setShowReplyRealName(e.target.checked)}
                                            />
                                            <span>비회원에게도 실명이 표시돼요</span>
                                        </label>
                                    ) : (
                                        <div className="comment-guest-hint-row">
                                            <span className="comment-guest-hint">
                                                비회원은 익명으로 작성됩니다
                                            </span>
                                            {turnstileToken ? (
                                                <span className="comment-captcha-status is-ok">CAPTCHA 완료</span>
                                            ) : (
                                                <span className="comment-captcha-status is-needed">아래 댓글창에서 CAPTCHA 인증 필요</span>
                                            )}
                                        </div>
                                    )}
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="small"
                                        onClick={() => {
                                            setReplyInput("");
                                            setShowReplyRealName(false);
                                            setReplyTargetId(null);
                                        }}
                                    >
                                        취소
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="small"
                                        disabled={!replyInput.trim() || (!accessToken && !turnstileToken)}
                                        onClick={() => {
                                            if (replyInput.trim() && (accessToken || turnstileToken)) handleAddReply(c.id);
                                        }}
                                    >
                                        등록
                                    </Button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            <div className="postdetail-comment-input-row">
                <div className="comment-composer">
                    {getCommentVisibilityHint(post.board_read_scope, post.post_type) && (
                        <span className="comment-visibility-hint">
                            {getCommentVisibilityHint(post.board_read_scope, post.post_type)}
                        </span>
                    )}
                    <textarea
                        className="postdetail-comment-input"
                        rows={2}
                        placeholder="댓글을 입력하세요"
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                    />
                    <div className="comment-composer-footer">
                        {accessToken ? (
                            <label className="comment-realname-label">
                                <input
                                    type="checkbox"
                                    checked={showCommentRealName}
                                    onChange={(e) => setShowCommentRealName(e.target.checked)}
                                />
                                <span>비회원에게도 실명이 표시돼요</span>
                            </label>
                        ) : (
                            <div className="comment-guest-stack">
                                <span className="comment-guest-hint">
                                    비회원은 익명으로 작성됩니다
                                </span>
                                {process.env.REACT_APP_TURNSTILE_SITE_KEY && (
                                    <Turnstile
                                        ref={turnstileRef}
                                        siteKey={process.env.REACT_APP_TURNSTILE_SITE_KEY}
                                        onSuccess={(token: string) => setTurnstileToken(token)}
                                        onExpire={() => setTurnstileToken(null)}
                                        onError={() => setTurnstileToken(null)}
                                        options={{ theme: resolvedColorMode, size: 'compact' }}
                                    />
                                )}
                            </div>
                        )}
                        <Button
                            type="button"
                            variant="primary"
                            className="postdetail-comment-btn"
                            onClick={handleAddComment}
                            disabled={!commentInput.trim() || (!accessToken && !turnstileToken)}
                        >
                            등록
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PostComments;
