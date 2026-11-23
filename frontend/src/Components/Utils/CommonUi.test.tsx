import React, { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import AuthLayout from "./AuthLayout";
import BrandMark, { BRAND_MARK_SRC } from "./BrandMark";
import LoadingOverlay from "./LoadingOverlay";
import PasswordInput from "./PasswordInput";
import Skeleton from "./Skeleton";

describe("BrandMark", () => {
    test("마스코트 이미지를 장식으로 그리고 자리별 클래스를 덧붙인다", () => {
        const { container } = render(<BrandMark className="footer-brand-mark" loading="lazy" />);
        const img = container.querySelector("img")!;
        expect(img).toHaveAttribute("src", BRAND_MARK_SRC);
        expect(img).toHaveAttribute("alt", "");
        expect(img).toHaveAttribute("aria-hidden", "true");
        expect(img).toHaveAttribute("decoding", "async");
        expect(img).toHaveAttribute("loading", "lazy");
        expect(img).toHaveClass("brand-mark", "footer-brand-mark");
    });
});

describe("Skeleton", () => {
    test("반짝임 클래스와 화면별 클래스를 붙이고 낭독기에서 숨긴다", () => {
        const { container } = render(<Skeleton className="skeleton skeleton-title" />);
        const bar = container.firstElementChild!;
        expect(bar).toHaveClass("skeleton-shimmer", "skeleton", "skeleton-title");
        expect(bar).toHaveAttribute("aria-hidden", "true");
    });
});

describe("AuthLayout", () => {
    test("로고 링크, 제목, 내용을 카드 안에 그린다", () => {
        render(
            <MemoryRouter>
                <AuthLayout title="로그인" cardClassName="signup-container" titleClassName="x-title">
                    <form aria-label="폼" />
                </AuthLayout>
            </MemoryRouter>
        );
        const heading = screen.getByRole("heading", { name: "로그인" });
        expect(heading).toHaveClass("auth-title", "x-title");
        expect(screen.getByRole("link", { name: "JBIG" })).toHaveAttribute("href", "/");
        const card = heading.closest(".auth-card")!;
        expect(card).toHaveClass("signup-container");
        expect(card.parentElement).toHaveClass("auth-page");
        expect(card).toContainElement(screen.getByRole("form", { name: "폼" }));
    });
});

describe("PasswordInput", () => {
    test("보이기/숨기기로 입력 종류와 버튼 상태가 바뀐다", () => {
        render(<PasswordInput id="pw" aria-label="비밀번호" rowClassName="auth-input-row" toggleClassName="auth-toggle" className="auth-input" value="a" onChange={() => {}} />);
        const input = screen.getByLabelText("비밀번호");
        const btn = screen.getByRole("button", { name: "보이기" });
        expect(input).toHaveAttribute("type", "password");
        expect(input).toHaveClass("auth-input");
        expect(input.parentElement).toHaveClass("auth-input-row");
        expect(btn).toHaveAttribute("aria-pressed", "false");
        expect(btn).toHaveAttribute("aria-controls", "pw");
        fireEvent.click(btn);
        expect(input).toHaveAttribute("type", "text");
        expect(screen.getByRole("button", { name: "숨기기" })).toHaveAttribute("aria-pressed", "true");
    });

    test("visible을 바깥에서 주면 다른 칸과 함께 보임 상태를 쓴다", () => {
        const Two = () => {
            const [shown, setShown] = useState(false);
            return (
                <>
                    <PasswordInput id="a" aria-label="비밀번호" rowClassName="r" toggleClassName="t" visible={shown} onVisibleChange={setShown} />
                    <input aria-label="확인" type={shown ? "text" : "password"} />
                </>
            );
        };
        render(<Two />);
        fireEvent.click(screen.getByRole("button", { name: "보이기" }));
        expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "text");
        expect(screen.getByLabelText("확인")).toHaveAttribute("type", "text");
    });
});

describe("LoadingOverlay", () => {
    test("처리 중 문구를 status로 알린다", () => {
        render(<LoadingOverlay label="처리 중..." />);
        expect(screen.getByRole("status")).toHaveTextContent("처리 중...");
        expect(screen.getByRole("status")).toHaveClass("loading-overlay");
    });
});
