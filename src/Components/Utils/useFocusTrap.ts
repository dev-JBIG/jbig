import { RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(", ");

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
    );

interface UseFocusTrapOptions {
    onClose?: () => void;
    initialFocusRef?: RefObject<HTMLElement | null>;
    restoreFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * 모달/드로어 다이얼로그의 접근성 포커스 관리 훅:
 * - 열릴 때 이전 포커스 저장 후 내부 요소로 포커스 이동
 * - 열려 있는 동안 Tab/Shift+Tab 순환 및 외부 포커스 이탈 차단
 * - Escape 키 닫기 지원
 * - 닫힐 때 살아있는 트리거 요소로 포커스 복원
 */
export function useFocusTrap(
    containerRef: RefObject<HTMLElement | null>,
    active: boolean,
    options?: UseFocusTrapOptions
) {
    const onCloseRef = useRef(options?.onClose);
    onCloseRef.current = options?.onClose;
    const initialFocusRef = options?.initialFocusRef;
    const restoreFocusRef = options?.restoreFocusRef;

    useEffect(() => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;

        const previousFocus =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const explicitRestoreTarget = restoreFocusRef?.current ?? null;

        // 이미 컨테이너 내부에 포커스가 있지 않다면 초기 포커스를 이동
        if (!container.contains(document.activeElement)) {
            const explicitTarget = initialFocusRef?.current;
            const focusables = getFocusableElements(container);
            const target =
                explicitTarget && container.contains(explicitTarget)
                    ? explicitTarget
                    : focusables[0] ?? container;
            if (target === container && !container.hasAttribute("tabindex")) {
                container.setAttribute("tabindex", "-1");
            }
            target.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (onCloseRef.current) {
                    e.stopPropagation();
                    onCloseRef.current();
                }
                return;
            }

            if (e.key !== "Tab") return;

            const focusables = getFocusableElements(container);
            if (focusables.length === 0) {
                e.preventDefault();
                container.focus();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement as HTMLElement | null;

            if (e.shiftKey) {
                if (!current || current === first || !container.contains(current)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (!current || current === last || !container.contains(current)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as Node | null;
            if (!target || container.contains(target)) return;
            // 다른 상위 모달(예: AlertModal)이 열려 해당 모달로 포커스가 간 경우는 방해하지 않음
            if (target instanceof HTMLElement && target.closest('[role="dialog"][aria-modal="true"]')) {
                return;
            }
            const focusables = getFocusableElements(container);
            (focusables[0] ?? container).focus();
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("focusin", handleFocusIn);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("focusin", handleFocusIn);

            const restoreTarget = explicitRestoreTarget?.isConnected
                ? explicitRestoreTarget
                : previousFocus?.isConnected
                    ? previousFocus
                    : null;
            restoreTarget?.focus();
        };
    }, [active, containerRef, initialFocusRef, restoreFocusRef]);
}
