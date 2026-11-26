/**
 * 양식 3종(결석계, 에러/피드백, 스터디 모집)이 만드는 글 본문이 바뀌지 않는지 확인한다.
 * 기존 글을 수정 화면에서 다시 읽어야 하므로 본문 형식은 그대로여야 한다.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AbsenceForm from "./AbsenceForm";
import FeedbackForm from "./FeedbackForm";
import StudyForm from "./StudyForm";

jest.mock("../Utils/UserContext", () => ({
    useUser: () => ({ user: { username: "홍길동" } }),
}));
jest.mock("../Utils/ThemeContext", () => ({
    useColorMode: () => ({ resolvedColorMode: "light" }),
}));
jest.mock("../Utils/safeMarkdown", () => ({ safeSanitizePlugin: () => undefined }));
jest.mock("@uiw/react-md-editor", () => {
    const Editor = ({ value, onChange }: { value?: string; onChange?: (v?: string) => void }) => (
        <textarea aria-label="활동 계획" value={value} onChange={(e) => onChange?.(e.target.value)} />
    );
    return { __esModule: true, default: Editor };
});

const lastCall = (fn: jest.Mock) => fn.mock.calls[fn.mock.calls.length - 1][0];

const ABSENCE = `홍길동 결석사유서 제출합니다.

| 항목 | 내용 |
| --- | --- |
| **성명** | 홍길동 |
| **결석 날짜** | 2026-11-20 |
| **관련 기관** | 학과 |
| **일정** | 오후 |
| **장소** | 공대 |
| **결석 사유** | 병원<br />진료 |
`;

describe("양식 본문", () => {
    test("결석계: 빈 양식과 기존 글 다시 읽기", () => {
        const empty = jest.fn();
        render(<AbsenceForm setContent={empty} initialContent="" />);
        expect(lastCall(empty)).toMatchSnapshot("빈 결석계");

        const filled = jest.fn();
        render(<AbsenceForm setContent={filled} initialContent={ABSENCE} />);
        expect(lastCall(filled)).toBe(ABSENCE);
    });

    test("에러/피드백: 에러일 때만 재현 방법 줄이 붙는다", () => {
        const fn = jest.fn();
        const { container } = render(<FeedbackForm setContent={fn} initialContent="" />);
        expect(lastCall(fn)).toMatchSnapshot("빈 에러 제보");
        const typeSelect = container.querySelector('select[name="reportType"]') as HTMLSelectElement;
        const other = Array.from(typeSelect.options).find((o) => o.value !== "에러")!.value;
        act(() => { fireEvent.change(typeSelect, { target: { name: "reportType", value: other } }); });
        expect(lastCall(fn)).toMatchSnapshot("에러가 아닌 제보");

        const again = jest.fn();
        render(<FeedbackForm setContent={again} initialContent={lastCall(fn)} />);
        expect(lastCall(again)).toBe(lastCall(fn));
    });

    test("스터디 모집: 마감일 미정과 활동 계획", () => {
        const fn = jest.fn();
        const { container } = render(<StudyForm setContent={fn} initialContent="" />);
        expect(lastCall(fn)).toMatchSnapshot("빈 스터디 모집");
        const name = container.querySelector('input[name="groupName"]') as HTMLInputElement;
        act(() => { fireEvent.change(name, { target: { name: "groupName", value: "캐글반" } }); });
        const tbd = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        act(() => { fireEvent.click(tbd); });
        act(() => { fireEvent.change(screen.getByLabelText("활동 계획"), { target: { value: "1주차 EDA" } }); });
        const md = lastCall(fn);
        expect(md).toMatchSnapshot("채운 스터디 모집");

        const again = jest.fn();
        render(<StudyForm setContent={again} initialContent={md} />);
        expect(lastCall(again)).toBe(md);
    });
});

describe("getSubmitType", () => {
    const { getSubmitType } = jest.requireActual("./markdownTemplateForm");
    test("이름과 종류에 띄어쓰기가 있어도 아는 종류로 읽는다", () => {
        expect(getSubmitType("Kim Min Su 에러/피드백 제보 제출합니다.\n\n| a |", ["에러/피드백 제보"])).toBe("에러/피드백 제보");
        expect(getSubmitType("홍 길동 결석사유서 제출합니다.", ["결석사유서", "조퇴사유서"])).toBe("결석사유서");
        expect(getSubmitType("홍길동 모르는종류 제출합니다.", ["결석사유서"])).toBe("");
        expect(getSubmitType("", ["결석사유서"])).toBe("");
    });
});
