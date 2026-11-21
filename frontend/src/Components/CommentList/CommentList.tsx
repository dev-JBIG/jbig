import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@primer/react";
import { fetchUserComments } from "../../API/req";
import { UserComment } from "../Utils/interfaces";
import { useUser } from "../Utils/UserContext";
import "./CommentList.css";

interface CommentListProps {
    userId: string;
}

const CommentList: React.FC<CommentListProps> = ({ userId }) => {
    const [comments, setComments] = useState<UserComment[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    const { accessToken } = useUser();
    const navigate = useNavigate();

    const observer = useRef<IntersectionObserver | null>(null);
    const lastCommentRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver(entries => {
                if (entries[0].isIntersecting && hasMore) {
                    setPage(prev => prev + 1);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore]
    );

    useEffect(() => {
        const loadComments = async () => {
            setLoading(true);
            try {
                const res = await fetchUserComments(userId, 10, page, accessToken || null);
                setComments(prev => [...prev, ...res.comments]);
                if (page >= res.totalPages) setHasMore(false);
            } catch {
                // 에러 무시
            }
            setLoading(false);
        };
        loadComments();
    }, [page, userId, accessToken]);

    return (
        <div className="user-comment-list">
            {comments.map((c, idx) => {
                const isLast = idx === comments.length - 1;
                return (
                    <div
                        key={c.id}
                        ref={isLast ? lastCommentRef : null}
                        className="user-comment-item"
                        onClick={() => navigate(`/board/${c.board_id}/${c.post_id}`)}
                    >
                        <div className="user-comment-post">{c.post_title}</div>
                        <div className="user-comment-content">{c.content}</div>
                        <div className="user-comment-date">{c.created_at}</div>
                    </div>
                );
            })}
            {loading && (
                <div className="loading" role="status" aria-label="댓글 불러오는 중">
                    <Spinner size="small" />
                </div>
            )}
            {!hasMore && <div className="end">모든 댓글을 불러왔습니다.</div>}
        </div>
    );
};

export default CommentList;
