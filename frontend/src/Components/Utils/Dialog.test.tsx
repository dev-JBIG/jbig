import React, { useRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dialog, { DIALOG_ROOT_ID, DialogHeader, __resetDialogScrollLockForTest } from "./Dialog";

afterEach(() => __resetDialogScrollLockForTest());

// 배경막에서 누르고 떼기 (실제 마우스 클릭 순서)
const pressBackdrop = () => {
    const backdrop = screen.getByRole("dialog");
    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);
};

const Basic: React.FC<{ onClose?: () => void; closeOnBackdrop?: boolean; busy?: boolean; withInitial?: boolean }> = ({ onClose = () => {}, closeOnBackdrop, busy, withInitial }) => {
    const second = useRef<HTMLButtonElement>(null);
    return (
        <Dialog labelledBy="t" onClose={onClose} closeOnBackdrop={closeOnBackdrop} busy={busy}
            panelClassName="my-panel" backdropClassName="my-backdrop" initialFocusRef={withInitial ? second : undefined}>
            <DialogHeader onClose={onClose}><h2 id="t">제목</h2></DialogHeader>
            <button type="button">첫째</button>
            <button type="button" ref={second}>둘째</button>
        </Dialog>
    );
};

const Toggle: React.FC = () => {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button type="button" onClick={() => setOpen(true)}>열기</button>
            {open && (
                <Dialog labelledBy="tt" onClose={() => setOpen(false)}>
                    <DialogHeader onClose={() => setOpen(false)}><h2 id="tt">토글</h2></DialogHeader>
                    <p>내용</p>
                </Dialog>
            )}
        </div>
    );
};

describe("Dialog", () => {
    test("body로 포털되고 이름이 붙은 모달 다이얼로그로 읽힌다", () => {
        const { container } = render(<div id="host"><Basic /></div>);
        const dlg = screen.getByRole("dialog", { name: "제목" });
        expect(dlg).toHaveAttribute("aria-modal", "true");
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(dlg.parentElement).toBe(document.body);
        expect(dlg).toHaveClass("overlay-backdrop", "my-backdrop");
        expect(dlg.firstElementChild).toHaveClass("overlay-panel", "my-panel");
    });

    test("앱 포털 자리(#jbig-dialog-root)가 있으면 그 안에 렌더된다", () => {
        const root = document.createElement("div");
        root.id = DIALOG_ROOT_ID;
        document.body.appendChild(root);
        try {
            render(<Basic />);
            expect(screen.getByRole("dialog").parentElement).toBe(root);
        } finally {
            root.remove();
        }
    });

    test("열리면 첫 포커스 가능 요소(닫기 버튼)로, initialFocusRef가 있으면 그 요소로 포커스한다", () => {
        const { unmount } = render(<Basic />);
        expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
        unmount();
        render(<Basic withInitial />);
        expect(screen.getByRole("button", { name: "둘째" })).toHaveFocus();
    });

    test("ESC, 닫기 버튼, 배경막 클릭으로 닫히고 패널 안 클릭으로는 안 닫힌다", () => {
        const onClose = jest.fn();
        render(<Basic onClose={onClose} />);
        fireEvent.click(screen.getByText("첫째"));
        fireEvent.click(screen.getByRole("dialog").firstElementChild!);
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "닫기" }));
        expect(onClose).toHaveBeenCalledTimes(2);
        pressBackdrop();
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    test("패널 안에서 누르고 배경막에서 떼면(드래그) 닫히지 않는다", () => {
        const onClose = jest.fn();
        render(<Basic onClose={onClose} />);
        const backdrop = screen.getByRole("dialog");
        fireEvent.mouseDown(screen.getByText("첫째"));
        fireEvent.mouseUp(backdrop);
        fireEvent.click(backdrop);
        expect(onClose).not.toHaveBeenCalled();
        pressBackdrop();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("busy 동안은 머리 줄 닫기 버튼도 꺼진다", () => {
        const onClose = jest.fn();
        const { rerender } = render(<Basic onClose={onClose} busy />);
        expect(screen.getByRole("button", { name: "닫기" })).toBeDisabled();
        rerender(<Basic onClose={onClose} busy={false} />);
        expect(screen.getByRole("button", { name: "닫기" })).toBeEnabled();
    });

    test("closeOnBackdrop=false 면 배경막 클릭으로 닫히지 않지만 ESC로는 닫힌다", () => {
        const onClose = jest.fn();
        render(<Basic onClose={onClose} closeOnBackdrop={false} />);
        pressBackdrop();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("busy 동안은 ESC와 배경막으로 닫히지 않는다", () => {
        const onClose = jest.fn();
        const { rerender } = render(<Basic onClose={onClose} busy />);
        fireEvent.keyDown(document, { key: "Escape" });
        pressBackdrop();
        expect(onClose).not.toHaveBeenCalled();
        rerender(<Basic onClose={onClose} busy={false} />);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("Tab은 패널 안에서만 돈다", () => {
        render(<><button type="button">바깥</button><Basic /></>);
        const close = screen.getByRole("button", { name: "닫기" });
        expect(close).toHaveFocus();
        userEvent.tab();
        expect(screen.getByText("첫째")).toHaveFocus();
        userEvent.tab();
        expect(screen.getByText("둘째")).toHaveFocus();
        userEvent.tab();
        expect(close).toHaveFocus();
        userEvent.tab({ shift: true });
        expect(screen.getByText("둘째")).toHaveFocus();
    });

    test("닫히면 연 버튼으로 포커스가 돌아간다", () => {
        render(<Toggle />);
        const opener = screen.getByRole("button", { name: "열기" });
        userEvent.click(opener);
        expect(screen.getByRole("dialog", { name: "토글" })).toBeInTheDocument();
        userEvent.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(opener).toHaveFocus();
    });

    test("스크롤 잠금은 겹친 모달이 모두 닫힐 때 풀린다", () => {
        const a = render(<Dialog labelledBy="a" onClose={() => {}}><h2 id="a">A</h2></Dialog>);
        expect(document.body).toHaveClass("modal-open");
        const b = render(<Dialog labelledBy="b" onClose={() => {}}><h2 id="b">B</h2></Dialog>);
        b.unmount();
        expect(document.body).toHaveClass("modal-open");
        a.unmount();
        expect(document.body).not.toHaveClass("modal-open");
    });

    test("겹친 모달에서 ESC는 위의 모달만 닫는다", () => {
        const closeA = jest.fn(), closeB = jest.fn();
        render(<>
            <Dialog labelledBy="a" onClose={closeA}><h2 id="a">A</h2><button type="button">a</button></Dialog>
            <Dialog labelledBy="b" onClose={closeB}><h2 id="b">B</h2><button type="button">b</button></Dialog>
        </>);
        act(() => { fireEvent.keyDown(document, { key: "Escape" }); });
        expect(closeB).toHaveBeenCalledTimes(1);
        expect(closeA).not.toHaveBeenCalled();
    });

    test("DialogHeader 닫기 버튼 이름과 비활성 상태를 바꿀 수 있다", () => {
        const onClose = jest.fn();
        render(<Dialog labelledBy="h" onClose={onClose}>
            <DialogHeader onClose={onClose} closeLabel="창 닫기" closeDisabled className="x-head"><h2 id="h">H</h2></DialogHeader>
        </Dialog>);
        const btn = screen.getByRole("button", { name: "창 닫기" });
        expect(btn).toBeDisabled();
        expect(btn.parentElement).toHaveClass("overlay-header", "x-head");
    });
});
