import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlertProvider, useAlert } from "./AlertContext";

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
});
