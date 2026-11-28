import React, {useEffect, useMemo, useRef, useState, useCallback, memo} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PostDetailData, FormType } from "../Utils/interfaces";
import { deletePost, fetchPostDetail, togglePostLike, downloadGatedAttachment } from "../../API/req";
import "./PostDetail.css";
import "./PostDetail-mobile.css";
import "./PostDetail-comments.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Button, Label } from '@primer/react';
import {useUser} from "../Utils/UserContext";
import {
    Heart,
    Paperclip,
    FileText,
    Download,
    Eye,
    Clock,
    ArrowLeft,
} from "lucide-react";
import {useStaffAuth} from "../Utils/StaffAuthContext";
import {useAlert} from "../Utils/AlertContext";
import RecruitmentDetailSection from './RecruitmentDetail';
import { safeSanitizeSchema as sanitizeSchema } from '../Utils/safeMarkdown';
import Skeleton from "../Utils/Skeleton";
import PostComments from "./PostComments";

// HeartBurst 애니메이션 컴포넌트 (분리하여 리렌더링 최적화)
const HeartBurst = memo(({ triggerKey }: { triggerKey: number }) => {
    const [active, setActive] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (triggerKey === 0) return;
        setActive(true);
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setActive(false), 700);
        return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
    }, [triggerKey]);

    return (
        <div className={`postdetail-heart-burst${active ? " is-active" : ""}`}>
            {[0, 1, 2, 3, 4].map(slot => <span key={slot} />)}
        </div>
    );
});

// +1/-1 애니메이션 컴포넌트
const LikePlusOne = memo(({ triggerKey, count, isLiked }: { triggerKey: number; count: number; isLiked: boolean }) => {
    const [active, setActive] = useState(false);
    const [displayCount, setDisplayCount] = useState(count);
    const [displayLiked, setDisplayLiked] = useState(isLiked);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (triggerKey === 0) return;
        setDisplayCount(count);
        setDisplayLiked(isLiked);
        setActive(true);
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setActive(false), 800);
        return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
    }, [triggerKey, count, isLiked]);

    return (
        <div className={`postdetail-like-plusone${active ? " is-active" : ""}${!displayLiked ? " minus" : ""}`}>
            {displayLiked ? "+1" : "-1"} ({displayCount})
        </div>
    );
});


const PostDetail: React.FC = () => {
    const { boardId, id: postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState<PostDetailData | null | "not-found">(null);
    // 본문

    const { accessToken, authReady } = useUser();
    const { staffAuth } = useStaffAuth();
    const { showAlert, showConfirm } = useAlert();

    // 권한 게이트된 첨부(회원전용/스태프 게시판)는 공개 URL이 아니라 인증이 필요한
    // 백엔드 엔드포인트로만 받을 수 있어, Authorization 헤더를 실은 요청으로 다운로드한다.
    const handleGatedDownload = useCallback(async (e: React.MouseEvent, fileUrl: string, fileName: string) => {
        e.preventDefault();
        if (!accessToken) {
            showAlert({ message: "로그인이 필요합니다.", type: 'warning' });
            return;
        }
        const res = await downloadGatedAttachment(fileUrl, fileName);
        if (!res.success) {
            showAlert({ message: res.message || "파일 다운로드에 실패했습니다.", type: 'error' });
        }
    }, [accessToken, showAlert]);

    

    const [heartBurstKey, setHeartBurstKey] = useState(0);
    const [likePlusOneKey, setLikePlusOneKey] = useState(0);
    const [isLikePending, setIsLikePending] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<number | null>(null);

    const commentCount = useMemo(() => {
        if (!post || typeof post === "string") return 0;

        return (post.comments || []).reduce((sum, comment) => {
            const topLevel = comment.is_deleted ? 0 : 1;
            const replies = (comment.replies || []).reduce(
                (replySum, reply) => replySum + (reply.is_deleted ? 0 : 1),
                0
            );
            return sum + topLevel + replies;
        }, 0);
    }, [post]);



    // 동일 키로 중복 조회 안되도록
    const fetchedKeyRef = useRef<string | null>(null);

    // 페이지 진입 시 스크롤 최상단으로 이동
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [postId]);

    // 스크롤 시 좋아요 버튼 표시 (2초 후 숨김)
    useEffect(() => {
        const showFloating = () => {
            setIsScrolling(true);
            if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = window.setTimeout(() => setIsScrolling(false), 1500);
        };

        window.addEventListener('scroll', showFloating, { passive: true });
        window.addEventListener('wheel', showFloating, { passive: true });
        window.addEventListener('touchmove', showFloating, { passive: true });

        return () => {
            window.removeEventListener('scroll', showFloating);
            window.removeEventListener('wheel', showFloating);
            window.removeEventListener('touchmove', showFloating);
            if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
        };
    }, []);


    const redirectedRef = useRef(false);
    const safeAuthRedirect = useCallback(() => {
        if (redirectedRef.current) return;
        redirectedRef.current = true;

        showAlert({
            message: "접근 권한이 없습니다.",
            type: 'warning',
            onClose: () => navigate(-1)
        });
    }, [navigate, showAlert]);

    useEffect(() => {
        if (!authReady || !postId) return;

        const key = `${postId}:${accessToken || 'anonymous'}`;
        if (fetchedKeyRef.current === key) return;
        fetchedKeyRef.current = key;
        let cancelled = false;

        const loadPost = async () => {
            try {

                const raw = await fetchPostDetail(Number(postId));
                if (cancelled) return;

                if (raw.loginRequired) {
                    showAlert({
                        message: "로그인이 필요합니다. 다시 로그인해주세요.",
                        type: 'warning',
                        onClose: () => navigate("/signin"),
                    });
                    return;
                }
                if (raw.unauthorized === true) {
                    safeAuthRedirect();
                    return;
                }
                if (raw.notFound) {
                    setPost("not-found");
                    return;
                }


                const toDate = (s?: string) => (s ? s.slice(0, 16).replace("T", " ") : "");
                const ext = (name: string) => name.split(".").pop()?.toLowerCase() || "";

                const src = raw.post_data ?? raw;

                const rawComments = Array.isArray(src.comments) ? src.comments : [];
                const topLevelComments = rawComments
                    // parent가 있는 항목(=대댓글)은 상위 댓글 배열에서 제외
                    .filter((c: any) => !c.parent);

                const mapped: PostDetailData = {
                    id: src.id,
                    board_post_id: src.id,
                    board: src.board?.name || "",
                    board_id: src.board_id || src.board?.id,
                    board_type: src.board?.board_type ?? 1,
                    form_type: src.board?.form_type ?? 0,
                    board_read_scope: src.board?.read_scope,
                    author_semester: src.author_semester,
                    title: src.title || "",
                    content_html: src.content_html || "",
                    content_md: src.content_md || "",
                    author: src.author || "",
                    date: toDate(src.created_at),
                    updatedAt: toDate(src.updated_at),
                    views: src.views ?? 0,
                    likes: src.likes_count ?? 0,
                    user_id: src.user_id,
                    isLiked: src.is_liked ?? false,
                    is_owner: !!src.is_owner,
                    post_type: src.post_type,
                    is_anonymous: src.is_anonymous,
                    tag: src.tag,
                    recruitment: src.recruitment ?? null,
                    attachments: (src.attachment_paths || []).map((item: any, index: number) => {
                        // 객체 형태인지 문자열 형태인지 확인
                        if (typeof item === 'string') {
                            // 기존 문자열 형태인 경우
                            const filename = item.split('/').pop() || `file_${index}`;
                            return {
                                id: index,
                                fileUrl: item,
                                fileName: filename,
                                fileType: ext(filename),
                            };
                        } else {
                            // 새로운 객체 형태인 경우
                            return {
                                id: index,
                                fileUrl: item.url,
                                fileName: item.name,
                                fileType: ext(item.name),
                                gated: !!item.gated,
                            };
                        }
                    }),
                    comments: topLevelComments.map((c: any) => ({
                        id: c.id,
                        user_id: c.user_id,
                        author_semester: c.author_semester,
                        author: c.author,
                        content: c.content,
                        date: toDate(c.created_at),
                        is_owner: c.is_owner,
                        is_deleted: !!c.is_deleted,
                        likes: c.likes || 0,
                        isLiked: c.isLiked || false,
                        is_anonymous: c.is_anonymous ?? true,
                        can_delete: c.can_delete ?? false,
                        replies: (c.children || []).map((r: any) => ({
                            id: r.id,
                            user_id: r.user_id,
                            author_semester: r.author_semester,
                            author: r.author,
                            content: r.content,
                            date: toDate(r.created_at),
                            is_owner: r.is_owner,
                            is_deleted: !!r.is_deleted,
                            likes: r.likes || 0,
                            isLiked: r.isLiked || false,
                            is_anonymous: r.is_anonymous ?? true,
                            can_delete: r.can_delete ?? false,
                        })),
                    })),
                };

                // 접근 권한 체크
                // 어드민 게시글
                if (mapped.post_type === 2 && !staffAuth) {
                    showAlert({
                        message: "접근 권한이 없습니다.",
                        type: 'warning',
                        onClose: () => navigate("/", { replace: true })
                    });
                    return;
                }
                // 사유서 게시글
                if (mapped.post_type === 3 && !staffAuth && !mapped.is_owner) {
                    showAlert({
                        message: "접근 권한이 없습니다.",
                        type: 'warning',
                        onClose: () => navigate("/", { replace: true })
                    });
                    return;
                }

                setPost(mapped);
            } catch {
                if (cancelled) return;
                showAlert({ message: "게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", type: 'error' });
            }
        };

        loadPost();
        return () => { cancelled = true; };
    }, [authReady, accessToken, postId, boardId, navigate, safeAuthRedirect, showAlert, staffAuth]);

   

    // 게시글 삭제
    const handleDeletePost = async () => {
        if (!post || typeof post === "string") return;
        if (!accessToken) { 
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'warning',
                onClose: () => navigate("/signin")
            });
            return; 
        }

        const confirmed = await showConfirm({
            message: "게시글을 삭제하시겠습니까?",
            title: "게시글 삭제",
            type: 'danger',
            confirmText: '삭제',
            cancelText: '취소'
        });
        if (!confirmed) return;

        try {
            const res = await deletePost(post.id);
            if (res?.status === 401) { 
                showAlert({
                    message: "로그인이 필요합니다.",
                    type: 'warning',
                    onClose: () => navigate("/signin")
                });
                return; 
            }
            if (res?.notFound) { 
                showAlert({ message: "게시글을 찾을 수 없습니다.", type: 'error' });
                return; 
            }
            // 성공
            navigate(`/board/${boardId}`);
        } catch {
            showAlert({ message: "게시글 삭제에 실패했습니다.", type: 'error' });
        }
    };

    // 게시글 수정
    const handleEditPost = () => {
        if (!post || typeof post === "string") return;
        navigate(`/board/${boardId}/${post.id}/modify`);
    };

    const triggerHeartBurst = useCallback(() => {
        setHeartBurstKey(prev => prev + 1);
    }, []);

    const triggerLikePlusOne = useCallback(() => {
        setLikePlusOneKey(prev => prev + 1);
    }, []);

    // 게시글 추천(좋아요) 버튼 공통 핸들러
    const handleToggleLike = async (extendFloatingVisibility: boolean = false) => {
        if (!post || typeof post === "string" || isLikePending) return;

        if (!accessToken) {
            showAlert({
                message: "로그인이 필요합니다.",
                type: 'info',
                onClose: () => navigate("/signin")
            });
            return;
        }

        const previousLiked = !!post.isLiked;
        const previousLikes = post.likes;
        const nextLiked = !previousLiked;
        const nextLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));
        const toggledPostId = post.id;

        setIsLikePending(true);
        setPost(prev => {
            if (!prev || typeof prev === "string" || prev.id !== toggledPostId) return prev;
            return { ...prev, isLiked: nextLiked, likes: nextLikes };
        });

        // 애니메이션 트리거
        if (nextLiked) triggerHeartBurst();
        triggerLikePlusOne();

        // 플로팅 버튼을 직접 클릭했을 때만 기존 노출 타이머를 연장한다.
        if (extendFloatingVisibility) {
            setIsScrolling(true);
            if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = window.setTimeout(() => setIsScrolling(false), 1500);
        }

        try {
            const response = await togglePostLike(toggledPostId);
            setPost(prev => {
                if (!prev || typeof prev === "string" || prev.id !== toggledPostId) return prev;
                return {
                    ...prev,
                    isLiked: response.is_liked,
                    likes: response.likes_count,
                };
            });
        } catch (e) {
            setPost(prev => {
                if (!prev || typeof prev === "string" || prev.id !== toggledPostId) return prev;
                return { ...prev, isLiked: previousLiked, likes: previousLikes };
            });
            showAlert({ message: "좋아요 처리 중 오류가 발생했습니다.", type: 'error' });
        } finally {
            setIsLikePending(false);
        }
    };


    if (post === "not-found") {
        return (
            <div className="postdetail-container post-not-found">
                <h2>해당 게시글을 찾을 수 없습니다.</h2>
                <p>게시글이 삭제되었거나, 주소가 잘못되었습니다.</p>
                <Button variant="default" className="post-not-found-btn" onClick={() => navigate(-1)}>
                    이전 페이지로
                </Button>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="postdetail-container">
                <span className="sr-only" role="status">게시글을 불러오는 중입니다.</span>
                <div className="postdetail-skeleton" aria-hidden="true">
                    <Skeleton className="postdetail-skeleton-line postdetail-skeleton-crumb" />
                    <Skeleton className="postdetail-skeleton-line postdetail-skeleton-title" />
                    <Skeleton className="postdetail-skeleton-line postdetail-skeleton-meta" />
                    <div className="postdetail-divider" />
                    <Skeleton className="postdetail-skeleton-line postdetail-skeleton-body" />
                    <Skeleton className="postdetail-skeleton-line postdetail-skeleton-body short" />
                </div>
            </div>
        );
    }

    // 폼 게시판(사유서·에러/피드백 제보)은 본문을 form-style로 렌더한다.
    const isFormBoard =
        post.form_type === FormType.ABSENCE || post.form_type === FormType.FEEDBACK;

    return (
        <div className="postdetail-container has-floating-like">
            <div className="postdetail-header">
                <div className="postdetail-header-top">
                    <div className="postdetail-breadcrumbs">
                        <button
                            type="button"
                            className="postdetail-category postdetail-category-link"
                            onClick={() => navigate(`/board/${post.board_id}`)}
                        >
                            <ArrowLeft size={14} aria-hidden="true" />
                            <span>{post.board}</span>
                        </button>
                        {post.tag && (
                            <Label variant="accent" size="small" className="postdetail-tag-label">
                                {post.tag}
                            </Label>
                        )}
                    </div>
                    {post.is_owner && (
                        <div className="postdetail-actions">
                            <Button
                                size="small"
                                variant="default"
                                className="postdetail-edit-link"
                                aria-label="게시글 수정"
                                onClick={handleEditPost}
                            >
                                수정
                            </Button>
                            <Button
                                size="small"
                                variant="danger"
                                className="postdetail-delete-link"
                                aria-label="게시글 삭제"
                                onClick={handleDeletePost}
                            >
                                삭제
                            </Button>
                        </div>
                    )}
                </div>
                <h2 className="postdetail-title">
                    {post.title}
                    {post.post_type === 3 && (
                        <Label
                            variant="attention"
                            size="small"
                            className="postdetail-private-badge"
                            title="해당 게시물은 작성자와 관리자만 열람할 수 있습니다"
                        >
                            (비공개)
                        </Label>
                    )}
                </h2>
            </div>
            <div className="postdetail-info-row">
                <button
                    type="button"
                    className="postdetail-author"
                    onClick={() => navigate(`/@${post.user_id}`)}
                >
                    {post.author_semester ? `${post.author_semester}기 ` : ""}{post.author}
                </button>
                <span className="postdetail-dot" aria-hidden="true">·</span>
                <span className="postdetail-meta-item postdetail-date">
                    <Clock size={13} aria-hidden="true" />
                    <span>{post.date}</span>
                    {post.updatedAt && post.updatedAt !== post.date && (
                        <span className="postdetail-updated-time">
                            (수정 {post.updatedAt})
                        </span>
                    )}
                </span>
                <span className="postdetail-dot" aria-hidden="true">·</span>
                <span className="postdetail-meta-item">
                    <Eye size={13} aria-hidden="true" />
                    <span>조회수 {post.views}</span>
                </span>
                <span className="postdetail-dot" aria-hidden="true">·</span>
                <span className="postdetail-meta-item">
                    <Heart size={13} aria-hidden="true" />
                    <span>좋아요 {post.likes}</span>
                </span>
            </div>
            <div className="postdetail-divider"/>

            {/* 모집 정보 */}
            {post.recruitment && (
                <RecruitmentDetailSection
                    recruitment={post.recruitment}
                    postId={post.id}
                    onUpdate={() => {
                        // 게시글 다시 로드
                        fetchPostDetail(post.id).then(raw => {
                            const src = raw.post_data ?? raw;
                            setPost(prev => {
                                if (!prev || typeof prev === "string") return prev;
                                return { ...prev, recruitment: src.recruitment };
                            });
                        }).catch(() => {});
                    }}
                />
            )}

            {/* 본문 */}
            <div className="content-body">
                <div className={`postdetail-content${isFormBoard ? " form-style" : ""}`}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[
                            rehypeRaw,
                            [rehypeSanitize, sanitizeSchema],
                            rehypeKatex
                        ]}
                        components={{
                            a: ({node, children, ...props}) => (
                                <a {...props} target="_blank" rel="noopener noreferrer">
                                    {children}
                                </a>
                            ),
                            img: ({node, alt, ...props}) => (
                                <img {...props} alt={alt ?? ""} loading="lazy" decoding="async" />
                            )
                        }}
                    >
                        {post.content_md}
                    </ReactMarkdown>

                    {/* 사진첩 게시글: 이미지 첨부파일을 인라인으로 표시 */}
                    {post.board_type === 4 && post.attachments?.filter(att =>
                        /^(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.fileType || "")
                    ).map(att => (
                        <img
                            key={att.id}
                            src={att.fileUrl}
                            alt={att.fileName}
                            className="photo-album-inline-image"
                            loading="lazy"
                            decoding="async"
                        />
                    ))}
                </div>
            </div>

            {/* 첨부파일 (사진첩 게시글은 이미지 제외) */}
            {post.attachments && post.attachments.length > 0 && (() => {
                const filtered = post.board_type === 4
                    ? post.attachments.filter(att => !/^(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.fileType || ""))
                    : post.attachments;
                return filtered.length > 0 ? (
                    <section className="postdetail-attachments" aria-label="첨부파일">
                        <div className="postdetail-attachments-header">
                            <Paperclip size={14} aria-hidden="true" />
                            <span>첨부파일</span>
                            <span className="postdetail-attachments-count">{filtered.length}</span>
                        </div>
                        <ul className="postdetail-attachments-list">
                            {filtered.map(att => (
                                <li key={att.id} className="postdetail-attachment-item">
                                    <a
                                        href={att.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="postdetail-attachment-link"
                                        onClick={att.gated ? (e) => handleGatedDownload(e, att.fileUrl, att.fileName) : undefined}
                                    >
                                        <FileText size={15} className="postdetail-attachment-icon" aria-hidden="true" />
                                        <span className="postdetail-attachment-name">{att.fileName}</span>
                                        {att.fileType && (
                                            <Label variant="secondary" size="small" className="postdetail-attachment-type">
                                                {att.fileType.toUpperCase()}
                                            </Label>
                                        )}
                                        <Download size={14} className="postdetail-attachment-download" aria-hidden="true" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null;
            })()}

            <div className="postdetail-inline-like">
                <button
                    type="button"
                    className={`postdetail-inline-like-btn${post.isLiked ? " liked" : ""}`}
                    onClick={() => handleToggleLike(false)}
                    aria-label={post.isLiked
                        ? `게시글 추천 취소, 현재 ${post.likes}개`
                        : `게시글 추천, 현재 ${post.likes}개`}
                    aria-pressed={!!post.isLiked}
                    disabled={isLikePending}
                >
                    <Heart
                        size={18}
                        aria-hidden="true"
                        className={`postdetail-heart-icon${post.isLiked ? " is-liked" : ""}`}
                    />
                    <span>{post.isLiked ? "추천했어요" : "추천"}</span>
                    <span className="postdetail-inline-like-count">{post.likes}</span>
                </button>
            </div>

            <PostComments post={post} setPost={setPost} commentCount={commentCount} />
            <div className={`postdetail-like-floating${isScrolling ? ' scrolling' : ''}`}>
                <div className="postdetail-like-btn-wrapper">
                    <button
                        type="button"
                        className="postdetail-like-btn"
                        onClick={() => handleToggleLike(true)}
                        aria-label={post.isLiked
                            ? `게시글 추천 취소, 현재 ${post.likes}개`
                            : `게시글 추천, 현재 ${post.likes}개`}
                        aria-pressed={!!post.isLiked}
                        title={post.isLiked ? "좋아요 취소" : "좋아요"}
                        disabled={isLikePending}
                    >
                        <Heart
                            size={18}
                            aria-hidden="true"
                            className={`postdetail-heart-icon postdetail-floating-heart${post.isLiked ? " is-liked" : ""}`}
                        />
                    </button>
                    <HeartBurst triggerKey={heartBurstKey} />
                    <LikePlusOne triggerKey={likePlusOneKey} count={post.likes ?? 0} isLiked={post.isLiked ?? false} />
                </div>
            </div>
        </div>
    );
};

export default PostDetail;
