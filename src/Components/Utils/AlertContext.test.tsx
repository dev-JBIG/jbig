import React, { useRef, useState } from "react";
import ReactDOM from "react-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlertProvider, useAlert } from "./AlertContext";
import { useFocusTrap } from "./useFocusTrap";

const AlertHarness: React.FC<{
    onConfirm?: () => void;
    onCancel?: () => void;
    onAlertClose?: () => void;
    onResolved?: (value: boolean) => void;
}> = ({ onConfirm, onCancel, onAlertClose, onResolved }) => {
    const { showAlert, showConfirm } = useAlert();

    return (
        <div>
            <button
                type="button"
                onClick={async () => {
                    const result = await showConfirm({
                        title: "삭제 확인",
                        message: "정말 삭제하시겠습니까?",
                        confirmText: "확인",
                        cancelText: "취소",
                        onConfirm,
                        onCancel,
                    });
                    onResolved?.(result);
                }}
            >
                open-confirm
            </button>
            <button
                type="button"
                onClick={() => {
                    showAlert({
                        title: "안내",
                        message: "처리되었습니다.",
                        onClose: onAlertClose,
                    });
                }}
            >
                open-alert
            </button>
        </div>
    );
};

describe("AlertContext / AlertModal", () => {
    test("확인 클릭 시 onConfirm만 1회 호출하고 onCancel은 호출하지 않는다", async () => {
        const onConfirm = jest.fn();
        const onCancel = jest.fn();
        const onResolved = jest.fn();

        render(
            <AlertProvider>
                <AlertHarness onConfirm={onConfirm} onCancel={onCancel} onResolved={onResolved} />
            </AlertProvider>
        );

        fireEvent.click(screen.getByText("open-confirm"));
        expect(await screen.findByText("정말 삭제하시겠습니까?")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "확인" }));

        await waitFor(() => {
            expect(onResolved).toHaveBeenCalledWith(true);
        });
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    test("취소 클릭 시 onCancel만 1회 호출하고 onConfirm은 호출하지 않는다", async () => {
        const onConfirm = jest.fn();
        const onCancel = jest.fn();
        const onResolved = jest.fn();

        render(
            <AlertProvider>
                <AlertHarness onConfirm={onConfirm} onCancel={onCancel} onResolved={onResolved} />
            </AlertProvider>
        );

        fireEvent.click(screen.getByText("open-confirm"));
        expect(await screen.findByText("정말 삭제하시겠습니까?")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "취소" }));

        await waitFor(() => {
            expect(onResolved).toHaveBeenCalledWith(false);
        });
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test("Escape 키로 닫으면 onCancel만 1회 호출하고 false를 반환한다", async () => {
        const onConfirm = jest.fn();
        const onCancel = jest.fn();
        const onResolved = jest.fn();

        render(
            <AlertProvider>
                <AlertHarness onConfirm={onConfirm} onCancel={onCancel} onResolved={onResolved} />
            </AlertProvider>
        );

        fireEvent.click(screen.getByText("open-confirm"));
        expect(await screen.findByText("정말 삭제하시겠습니까?")).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });

        await waitFor(() => {
            expect(onResolved).toHaveBeenCalledWith(false);
        });
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test("showAlert 확인 클릭 시 onClose를 호출한다", async () => {
        const onAlertClose = jest.fn();

        render(
            <AlertProvider>
                <AlertHarness onAlertClose={onAlertClose} />
            </AlertProvider>
        );

        fireEvent.click(screen.getByText("open-alert"));
        expect(await screen.findByText("처리되었습니다.")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "확인" }));

        await waitFor(() => {
            expect(onAlertClose).toHaveBeenCalledTimes(1);
        });
    });

    test("포털 모달 위에 AlertModal이 열렸을 때 Escape와 Tab은 AlertModal에만 적용된다", async () => {
        const NestedHarness: React.FC = () => {
            const { showConfirm } = useAlert();
            const [open, setOpen] = useState(true);
            const portalRef = useRef<HTMLDivElement>(null);

            useFocusTrap(portalRef, open, { onClose: () => setOpen(false) });

            if (!open) return <div>parent-closed</div>;

            return ReactDOM.createPortal(
                <div role="dialog" aria-modal="true" aria-label="부모 포털 모달">
                    <div ref={portalRef} tabIndex={-1}>
                        <button
                            type="button"
                            onClick={() => {
                                void showConfirm({
                                    title: "중첩 확인",
                                    message: "정말 진행할까요?",
                                    confirmText: "진행",
                                    cancelText: "닫기",
                                });
                            }}
                        >
                            open-nested-confirm
                        </button>
                    </div>
                </div>,
                document.body
            );
        };

        render(
            <AlertProvider>
                <NestedHarness />
            </AlertProvider>
        );

        const trigger = screen.getByRole("button", { name: "open-nested-confirm" });
        fireEvent.click(trigger);

        expect(await screen.findByText("정말 진행할까요?")).toBeInTheDocument();

        const cancelBtn = screen.getByRole("button", { name: "닫기" });
        const confirmBtn = screen.getByRole("button", { name: "진행" });
        confirmBtn.focus();

        // Tab은 AlertModal 내부(진행 -> 닫기)로만 순환해야 하며 부모 모달로 새지 않아야 한다
        fireEvent.keyDown(document, { key: "Tab" });
        expect(document.activeElement).toBe(cancelBtn);

        // Escape는 AlertModal만 닫고 부모 포털 모달은 유지해야 한다
        fireEvent.keyDown(document, { key: "Escape" });

        await waitFor(() => {
            expect(screen.queryByText("정말 진행할까요?")).not.toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "open-nested-confirm" })).toBeInTheDocument();
        expect(screen.queryByText("parent-closed")).not.toBeInTheDocument();

        // 이후 Escape를 한 번 더 누르면 부모 포털 모달이 정상적으로 닫힌다
        fireEvent.keyDown(document, { key: "Escape" });
        expect(await screen.findByText("parent-closed")).toBeInTheDocument();
    });
});

