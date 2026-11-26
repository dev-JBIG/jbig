import React, { useEffect, useRef, useState } from "react";

/**
 * 결석계, 에러/피드백 제보, 스터디 모집 양식이 같이 쓰는 도구.
 * 양식 값은 마크다운 표(| **항목** | 값 |)로 글 본문에 저장되고, 수정할 때는 본문에서 다시 읽는다.
 * 저장 형식은 기존 글과 맞아야 하므로 각 양식의 마크다운 모양은 각 파일이 정한다.
 */

/** 표 칸 안 줄바꿈은 <br /> 로 저장한다 */
export const toTableCell = (text: string) => text.replace(/\n/g, "<br />");

/** 본문 표에서 `| **key** | 값 |` 의 값을 읽는다(줄바꿈 복원). 없으면 '' */
export const getTableValue = (md: string, key: string) => {
    const match = md.match(new RegExp(`\\| \\*\\*${key}\\*\\* \\| (.*?) \\|`));
    return match ? match[1].replace(/<br \/>/g, "\n") : "";
};

/**
 * 첫 줄 "{이름} {종류} 제출합니다." 의 종류. 종류에 띄어쓰기가 있어도(에러/피드백 제보) 그대로 읽는다.
 * 예전 정규식은 마지막 띄어쓰기 앞을 모두 이름으로 봐서 "제보"만 남았다.
 */
export const getSubmitType = (md: string) => md.match(/^\S+ (.+?) 제출합니다\./m)?.[1] ?? "";

/**
 * 양식 값 <-> 글 본문 동기화.
 * - 값이 바뀌면 generate 로 본문을 만들어 setContent 로 올린다.
 * - 수정 화면에서 본문(initialContent)이 늦게 오면 parse 로 값을 채운다.
 *   방금 이 양식이 만든 본문이 되돌아온 것이면 다시 읽지 않는다(입력 중 값이 튀거나 무한 갱신 방지).
 */
export function useMarkdownTemplateForm<T>(
    initialContent: string,
    setContent: (content: string) => void,
    parse: (md: string) => T,
    generate: (state: T) => string,
) {
    const [state, setState] = useState<T>(() => parse(initialContent));
    const lastGeneratedRef = useRef("");
    // parse, generate 는 렌더마다 새로 만들어질 수 있어 최신 것을 ref 로 쓴다
    const parseRef = useRef(parse);
    const generateRef = useRef(generate);
    parseRef.current = parse;
    generateRef.current = generate;

    useEffect(() => {
        const md = generateRef.current(state);
        lastGeneratedRef.current = md;
        setContent(md);
    }, [state, setContent, generate]);

    useEffect(() => {
        if (!initialContent || initialContent === lastGeneratedRef.current) return;
        const next = parseRef.current(initialContent);
        setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, [initialContent]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;
        setState((prev) => ({ ...prev, [name]: value }));
    };

    return { state, setState, handleChange };
}
