import React, { ReactNode, RefObject, createContext, useContext, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "./useFocusTrap";

/**
 * 화면을 가리는 모달 다이얼로그의 공통 뼈대 (DESIGN.md 6절).
 *
 * 모든 모달이 같은 방식으로 동작하도록 한곳에서 맡는다.
 * - 앱 최상단 포털 자리(#jbig-dialog-root, 없으면 body)로 렌더 (부모의 overflow, z-index에 갇히지 않음)
 * - role="dialog", aria-modal, aria-labelledby
 * - 포커스 가두기, ESC로 닫기, 닫힐 때 원래 위치로 포커스 복원 (useFocusTrap)
 * - 배경막 클릭으로 닫기 (closeOnBackdrop=false 로 끌 수 있음)
 * - 뒤 화면 스크롤 잠금 (여러 모달이 겹쳐도 마지막 모달이 닫힐 때 풀림)
 *
 * 모양은 shared.css 의 .overlay-backdrop / .overlay-panel 이 기본이고,
 * 모달마다 다른 폭, 여백은 backdropClassName / panelClassName 으로 덧붙인다.
 * 열고 닫기는 부모가 조건부 렌더로 정한다: {open && <Dialog ...>}.
 */
export interface DialogProps {
    /** 제목 요소의 id. 스크린리더가 다이얼로그 이름으로 읽는다 */
    labelledBy: string;
    onClose: () => void;
    children: ReactNode;
    backdropClassName?: string;
    panelClassName?: string;
    /** 열릴 때 처음 포커스할 요소. 없으면 첫 번째 포커스 가능한 요소 */
    initialFocusRef?: RefObject<HTMLElement | null>;
    /** 배경막을 눌러 닫을지 (기본 true). 작성 중인 폼처럼 실수로 닫히면 안 될 때 false */
    closeOnBackdrop?: boolean;
    /** 처리 중처럼 닫으면 안 되는 동안 true: ESC, 배경막, 닫기 버튼이 모두 무시된다 */
    busy?: boolean;
}

/** ThemeContext 가 BaseStyles 안에 두는 포털 자리. 없으면(테스트 등) document.body */
export const DIALOG_ROOT_ID = "jbig-dialog-root";

// 열린 모달 수. 0이 될 때만 스크롤 잠금을 푼다.
let openCount = 0;
let savedPaddingRight = "";

function lockBodyScroll() {
    if (openCount === 0) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        savedPaddingRight = document.body.style.paddingRight;
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.classList.add("modal-open");
    }
    openCount += 1;
}

function unlockBodyScroll() {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) {
        document.body.classList.remove("modal-open");
        document.body.style.paddingRight = savedPaddingRight;
    }
}

/** 테스트 전용: 모듈 상태 초기화 */
export function __resetDialogScrollLockForTest() {
    openCount = 0;
    savedPaddingRight = "";
    document.body.classList.remove("modal-open");
    document.body.style.paddingRight = "";
}

const Dialog: React.FC<DialogProps> = ({
    labelledBy,
    onClose,
    children,
    backdropClassName,
    panelClassName,
    initialFocusRef,
    closeOnBackdrop = true,
    busy = false,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const busyRef = useRef(busy);
    busyRef.current = busy;
    const requestClose = useRef(() => { if (!busyRef.current) onClose(); });
    requestClose.current = () => { if (!busyRef.current) onClose(); };

    useFocusTrap(panelRef, true, { onClose: () => requestClose.current(), initialFocusRef });

    useEffect(() => {
        lockBodyScroll();
        return unlockBodyScroll;
    }, []);

    const cls = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

    // 누르기 시작한 곳과 뗀 곳이 모두 배경막일 때만 닫는다.
    // 패널 안에서 누르고(글자 드래그 등) 배경막에서 떼면 click 은 공통 조상인 배경막에서 일어나므로
    // click 의 대상만 보면 폼이 닫혀 입력이 사라진다.
    const pressStartedOnBackdrop = useRef(false);
    const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
    };
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const startedHere = pressStartedOnBackdrop.current;
        pressStartedOnBackdrop.current = false;
        if (closeOnBackdrop && startedHere && e.target === e.currentTarget) requestClose.current();
    };

    const backdrop = (
        // design-lint-allow clickable-div: 배경막 클릭은 마우스 보조 동작이고 키보드는 ESC와 닫기 버튼으로 닫는다
        <div className={cls("overlay-backdrop", backdropClassName)} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
            <div ref={panelRef} className={cls("overlay-panel", panelClassName)} tabIndex={-1}>
                <DialogContext.Provider value={{ busy }}>{children}</DialogContext.Provider>
            </div>
        </div>
    );

    return ReactDOM.createPortal(backdrop, document.getElementById(DIALOG_ROOT_ID) ?? document.body);
};

/** DialogHeader 가 Dialog 의 busy 를 따르도록 전달한다 */
const DialogContext = createContext<{ busy: boolean }>({ busy: false });

export interface DialogHeaderProps {
    onClose: () => void;
    /** 제목 영역. 제목 요소에 Dialog 의 labelledBy 와 같은 id 를 단다 */
    children: ReactNode;
    className?: string;
    closeLabel?: string;
    closeDisabled?: boolean;
}

/** 회색 머리 줄 + 오른쪽 닫기(X) 버튼. Dialog 가 busy 인 동안에는 닫기 버튼도 꺼진다 */
export const DialogHeader: React.FC<DialogHeaderProps> = ({ onClose, children, className, closeLabel = "닫기", closeDisabled }) => {
    const { busy } = useContext(DialogContext);
    return (
        <div className={className ? `overlay-header ${className}` : "overlay-header"}>
            {children}
            <button type="button" className="overlay-close" onClick={onClose} aria-label={closeLabel} disabled={closeDisabled || busy}>
                <X size={16} aria-hidden="true" />
            </button>
        </div>
    );
};

export default Dialog;
