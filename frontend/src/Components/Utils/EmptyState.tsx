import React, { ReactNode } from "react";

interface EmptyStateProps {
    /** 안내 제목 (예: "게시글이 없습니다") */
    title: ReactNode;
    /** 장식 아이콘 (lucide 아이콘 등). 화면 낭독기에는 읽히지 않는다 */
    icon?: ReactNode;
    /** 보조 설명 한 줄 */
    description?: ReactNode;
    /** 다음 행동 버튼 (예: 글쓰기) */
    action?: ReactNode;
    /** 드롭다운, 프로필 목록처럼 좁은 자리용 작은 여백 */
    compact?: boolean;
    /** 표나 카드가 없는 자리에서 혼자 카드처럼 보이게 */
    framed?: boolean;
    className?: string;
}

/**
 * 비어 있는 목록, 결과 없음 표시의 공통 모양 (DESIGN.md 6절).
 * 아이콘(흐리게) + 제목 + 설명 + 행동 버튼 순서로 가운데 정렬한다. 모양은 shared.css 의 .empty-state.
 */
const EmptyState: React.FC<EmptyStateProps> = ({ title, icon, description, action, compact, framed, className }) => {
    const cls = ["empty-state", compact && "empty-state--compact", framed && "empty-state--framed", className].filter(Boolean).join(" ");
    return (
        <div className={cls}>
            {icon && <span className="empty-state-icon" aria-hidden="true">{icon}</span>}
            <p className="empty-state-title">{title}</p>
            {description && <p className="empty-state-desc">{description}</p>}
            {action && <div className="empty-state-action">{action}</div>}
        </div>
    );
};

export default EmptyState;
