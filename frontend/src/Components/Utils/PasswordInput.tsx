import React, { useState } from "react";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

interface PasswordInputProps extends InputProps {
    /** 입력칸과 토글을 감싸는 줄의 클래스 (인증 화면: auth-input-row, 로그인 모달: login-modal-password-row) */
    rowClassName: string;
    /** 보이기/숨기기 버튼 클래스 (auth-toggle, login-modal-toggle) */
    toggleClassName: string;
    /** 바깥에서 보임 상태를 함께 쓸 때(회원가입: 비밀번호 확인 칸도 같이 보임) */
    visible?: boolean;
    onVisibleChange?: (visible: boolean) => void;
}

/**
 * 비밀번호 입력 + 오른쪽 "보이기/숨기기" 버튼.
 * 로그인, 회원가입, 로그인 모달이 같은 동작을 쓰고 모양만 클래스로 다르다.
 * 토글은 aria-pressed 와 aria-controls 로 어떤 칸을 보이게 하는지 알린다.
 */
const PasswordInput: React.FC<PasswordInputProps> = ({ rowClassName, toggleClassName, visible, onVisibleChange, id, ...inputProps }) => {
    const [ownVisible, setOwnVisible] = useState(false);
    const shown = visible ?? ownVisible;
    const toggle = () => {
        if (onVisibleChange) onVisibleChange(!shown);
        if (visible === undefined) setOwnVisible(!shown);
    };
    return (
        <div className={rowClassName}>
            <input {...inputProps} id={id} type={shown ? "text" : "password"} />
            <button type="button" className={toggleClassName} onClick={toggle} aria-pressed={shown} aria-controls={id}>
                {shown ? "숨기기" : "보이기"}
            </button>
        </div>
    );
};

export default PasswordInput;
