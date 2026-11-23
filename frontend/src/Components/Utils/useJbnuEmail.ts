import React, { useCallback, useState } from "react";

export const JBNU_EMAIL_DOMAIN = "@jbnu.ac.kr";

/**
 * 입력창 글자를 아이디와 "사용자가 직접 친 도메인 앞부분"으로 나눈다.
 * - 도메인은 입력창 뒤에 고정 접미사로 보인다. 사용자가 "@"부터 직접 치기 시작하면 친 글자가
 *   접미사와 겹쳐 채워지고(tail), 접미사는 남은 부분만 보인다. ("abc@jb" → tail "@jb", 남은 접미사 "nu.ac.kr")
 * - 도메인과 다른 글자는 받지 않는다. ("abc@gm" → tail "@")
 * - 공백은 이메일 주소에 올 수 없으므로 지운다.
 */
export const splitJbnuInput = (raw: string): { local: string; tail: string } => {
    const noSpace = raw.replace(/\s+/g, "");
    const at = noSpace.indexOf("@");
    if (at === -1) return { local: noSpace, tail: "" };
    const typed = noSpace.slice(at);
    let matched = 0;
    while (
        matched < typed.length &&
        matched < JBNU_EMAIL_DOMAIN.length &&
        typed[matched].toLowerCase() === JBNU_EMAIL_DOMAIN[matched]
    ) {
        matched += 1;
    }
    return { local: noSpace.slice(0, at), tail: JBNU_EMAIL_DOMAIN.slice(0, matched) };
};

/** 아이디(@ 앞부분)만 뽑는다. */
export const toJbnuLocalPart = (raw: string) => splitJbnuInput(raw).local;

/**
 * 전북대 메일 입력 훅. 사용자는 아이디만 치면 되고 "@jbnu.ac.kr"은 고정 접미사로 붙는다.
 * - `value`: 입력창에 보일 글자(아이디 + 사용자가 직접 친 도메인 앞부분)
 * - `email`: 서버로 보낼 전체 주소 (아이디가 비어 있으면 "")
 */
export function useJbnuEmail(initial: string = "") {
    // 코드에서 넣는 값(초기값, setEmail)은 아이디만 남긴다. 도메인 겹쳐 치기는 사용자가 직접 칠 때만.
    const [value, setValue] = useState<string>(() => splitJbnuInput(initial).local);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { local, tail } = splitJbnuInput(e.target.value);
        setValue(local + tail);
    }, []);

    const setEmail = useCallback((next: string) => {
        setValue(splitJbnuInput(next).local);
    }, []);

    const local = toJbnuLocalPart(value);
    return {
        value,
        email: local ? `${local}${JBNU_EMAIL_DOMAIN}` : "",
        setEmail,
        onChange,
    };
}
