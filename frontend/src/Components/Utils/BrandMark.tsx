import React from "react";

export const BRAND_MARK_SRC = "/JBIG-logo-192.png";

interface BrandMarkProps {
    /** 크기, 라운드 등 자리마다 다른 값을 주는 클래스 (예: logo-mark, footer-brand-mark) */
    className?: string;
    /** 첫 화면 밖(푸터 등)은 "lazy" */
    loading?: "eager" | "lazy";
}

/**
 * JBIG 마스코트 로고 이미지 (DESIGN.md 4절: 임의 J 모노그램 대신 실제 마스코트).
 * 옆에 항상 "JBIG" 글자가 함께 있으므로 이미지는 장식(alt="", aria-hidden)이다.
 * 공통 모양은 shared.css 의 .brand-mark.
 */
const BrandMark: React.FC<BrandMarkProps> = ({ className, loading }) => (
    // design-lint-allow img-lazy: 헤더, 인증 화면 로고는 첫 화면에 바로 보여야 해서 기본은 즉시 로드하고 푸터만 loading="lazy"
    <img
        src={BRAND_MARK_SRC}
        alt=""
        aria-hidden="true"
        className={className ? `brand-mark ${className}` : "brand-mark"}
        loading={loading}
        decoding="async"
    />
);

export default BrandMark;
