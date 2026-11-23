import React, { forwardRef, useCallback, useRef } from "react";
import { JBNU_EMAIL_DOMAIN, splitJbnuInput } from "./useJbnuEmail";
import "./JbnuEmailInput.css";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
    value: string;
    /** 입력창 자체에 붙던 기존 클래스(예: auth-input). 테두리와 크기는 바깥 상자가 대신 받는다 */
    className?: string;
    invalid?: boolean;
};

/**
 * 전북대 메일 입력창. 사용자는 아이디만 입력하고, "@jbnu.ac.kr"은 지울 수도 선택할 수도 없는
 * 고정 접미사로 보인다. 접미사나 상자 여백을 눌러도 입력창 끝으로 커서가 간다.
 * ref는 안쪽 실제 input으로 전달된다(모달 초기 포커스 등).
 */
const JbnuEmailInput = forwardRef<HTMLInputElement, Props>(
    ({ value, className = "", invalid = false, id, ...rest }, forwardedRef) => {
        const innerRef = useRef<HTMLInputElement | null>(null);
        const suffixId = id ? `${id}-domain` : undefined;
        // 사용자가 도메인 앞부분을 직접 쳤다면 그만큼은 입력창에 있으므로 남은 부분만 접미사로 보인다
        const remainingDomain = JBNU_EMAIL_DOMAIN.slice(splitJbnuInput(value).tail.length);

        const setRefs = useCallback((el: HTMLInputElement | null) => {
            innerRef.current = el;
            if (typeof forwardedRef === "function") forwardedRef(el);
            else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }, [forwardedRef]);

        const focusInput = (e: React.MouseEvent) => {
            const el = innerRef.current;
            if (!el || e.target === el || el.disabled) return;
            e.preventDefault();
            el.focus();
            const end = el.value.length;
            try { el.setSelectionRange(end, end); } catch { /* 일부 브라우저는 선택 범위 미지원 */ }
        };

        return (
            <div
                className={`jbnu-email-field ${className} ${invalid ? "input-error" : ""}`.trim()}
                onMouseDown={focusInput}
            >
                {/* 거울 글자가 input 폭을 친 글자 폭에 맞춰, 도메인이 글자 바로 뒤에 붙는다 */}
                <span className="jbnu-email-sizer">
                    <span className="jbnu-email-mirror" aria-hidden="true">{value || rest.placeholder || ""}</span>
                    <input
                        {...rest}
                        ref={setRefs}
                        id={id}
                        type="text"
                        inputMode="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        size={1}
                        value={value}
                        aria-describedby={suffixId}
                        aria-invalid={invalid || undefined}
                        className="jbnu-email-local"
                    />
                </span>
                {/* 스크린리더용 안내는 항상 전체 도메인, 화면에는 남은 부분만 */}
                <span id={suffixId} className="jbnu-email-domain" aria-label={JBNU_EMAIL_DOMAIN}>
                    <span aria-hidden="true">{remainingDomain}</span>
                </span>
            </div>
        );
    }
);

JbnuEmailInput.displayName = "JbnuEmailInput";

export default JbnuEmailInput;
