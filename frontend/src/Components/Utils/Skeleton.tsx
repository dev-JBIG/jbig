import React from "react";

interface SkeletonProps {
    /** 크기, 라운드를 정하는 화면별 클래스 (예: postdetail-skeleton-line postdetail-skeleton-title) */
    className?: string;
}

/**
 * 불러오는 중 자리 표시 막대. 반짝임은 shared.css 의 .skeleton-shimmer.
 * 화면 낭독기에는 읽히지 않는다(aria-hidden). 불러오는 중이라는 안내는
 * 부모가 role="status" 문구로 한 번만 알린다.
 */
const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
    <div aria-hidden="true" className={className ? `skeleton-shimmer ${className}` : "skeleton-shimmer"} />
);

export default Skeleton;
