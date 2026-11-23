import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JbnuEmailInput from "./JbnuEmailInput";
import { JBNU_EMAIL_DOMAIN, splitJbnuInput, toJbnuLocalPart, useJbnuEmail } from "./useJbnuEmail";

// 실제 폼처럼 훅과 입력창을 함께 쓰는 하네스. 서버로 갈 전체 주소를 화면에 노출해 검증한다.
const Harness: React.FC<{ initial?: string }> = ({ initial }) => {
    const { email, value, onChange, setEmail } = useJbnuEmail(initial);
    return (
        <div>
            <label htmlFor="mail">아이디</label>
            <JbnuEmailInput id="mail" className="auth-input" value={value} onChange={onChange} />
            <output data-testid="email">{email}</output>
            <button type="button" onClick={() => setEmail("reset@jbnu.ac.kr")}>reset</button>
        </div>
    );
};

const input = () => screen.getByLabelText("아이디") as HTMLInputElement;
const email = () => screen.getByTestId("email").textContent;
// 화면에 보이는 고정 접미사(남은 도메인)
const suffix = () => document.getElementById("mail-domain")!.textContent;

describe("toJbnuLocalPart", () => {
    const cases: Array<[string, string]> = [
        ["", ""],
        ["abc", "abc"],
        ["abc@", "abc"],
        ["abc@j", "abc"],
        ["abc@jbnu", "abc"],
        ["abc@jbnu.ac.kr", "abc"],
        ["abc@JBNU.AC.KR", "abc"],
        ["abc@gmail.com", "abc"],
        ["  abc  ", "abc"],
        ["a b c", "abc"],
        ["@jbnu.ac.kr", ""],
        ["@", ""],
        ["a.b_c-d+e", "a.b_c-d+e"],
        ["abc@@jbnu.ac.kr", "abc"],
        ["\tabc\n@jbnu.ac.kr", "abc"],
    ];
    test.each(cases)("%j → %j", (raw, expected) => {
        expect(toJbnuLocalPart(raw)).toBe(expected);
    });
});

describe("splitJbnuInput", () => {
    const cases: Array<[string, string, string]> = [
        ["abc", "abc", ""],
        ["abc@", "abc", "@"],
        ["abc@jb", "abc", "@jb"],
        ["abc@JB", "abc", "@jb"],
        ["abc@jbnu.ac.kr", "abc", "@jbnu.ac.kr"],
        ["abc@jbnu.ac.krx", "abc", "@jbnu.ac.kr"],
        ["abc@gm", "abc", "@"],
        ["abc@jbx", "abc", "@jb"],
        ["@jbnu", "", "@jbnu"],
    ];
    test.each(cases)("%j → 아이디 %j, 직접 친 도메인 %j", (raw, local, tail) => {
        expect(splitJbnuInput(raw)).toEqual({ local, tail });
    });
});

describe("JbnuEmailInput", () => {
    test("입력창에는 아이디만, 도메인은 고정 접미사로 보인다", () => {
        render(<Harness />);
        expect(input().value).toBe("");
        expect(suffix()).toBe(JBNU_EMAIL_DOMAIN);
        expect(email()).toBe("");
    });

    test("아이디를 치면 전체 주소가 만들어진다", () => {
        render(<Harness />);
        userEvent.type(input(), "jbig");
        expect(input().value).toBe("jbig");
        expect(email()).toBe("jbig@jbnu.ac.kr");
    });

    test("사용자가 @jbnu.ac.kr을 한 글자씩 직접 치면 접미사와 딱 맞게 겹쳐 채워진다", () => {
        render(<Harness />);
        const typed = "jbig@jbnu.ac.kr";
        for (let i = 1; i <= typed.length; i++) {
            fireEvent.change(input(), { target: { value: typed.slice(0, i) } });
            const shown = typed.slice(0, i);
            const tailLen = Math.max(0, i - "jbig".length);
            expect(input().value).toBe(shown);
            expect(suffix()).toBe(JBNU_EMAIL_DOMAIN.slice(tailLen));
            expect(input().value + suffix()).toBe(i < 4 ? shown + JBNU_EMAIL_DOMAIN : "jbig@jbnu.ac.kr");
            expect(email()).toBe(`${typed.slice(0, Math.min(i, 4))}@jbnu.ac.kr`);
        }
    });

    test("userEvent로 실제 키 입력해도 결과 주소가 한 번만 붙는다", () => {
        render(<Harness />);
        userEvent.type(input(), "jbig@jbnu.ac.kr");
        expect(input().value).toBe("jbig@jbnu.ac.kr");
        expect(suffix()).toBe("");
        expect(email()).toBe("jbig@jbnu.ac.kr");
    });

    test("도메인과 다른 글자는 받지 않는다", () => {
        render(<Harness />);
        userEvent.type(input(), "jbig@gmail");
        expect(input().value).toBe("jbig@");
        expect(suffix()).toBe("jbnu.ac.kr");
        expect(email()).toBe("jbig@jbnu.ac.kr");
    });

    test("전체 주소를 붙여넣으면 접미사와 겹쳐 한 번만 보인다", () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: "paste.user@jbnu.ac.kr" } });
        expect(input().value + suffix()).toBe("paste.user@jbnu.ac.kr");
        expect(email()).toBe("paste.user@jbnu.ac.kr");
    });

    test("다른 도메인을 붙여넣으면 조용히 바꾸지 않고 안내하며, 안내는 입력과 연결된다", () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: "someone@gmail.com" } });
        expect(input().value).toBe("someone@");
        expect(email()).toBe("someone@jbnu.ac.kr");
        const notice = document.getElementById("mail-notice")!;
        expect(notice).toHaveAttribute("role", "status");
        expect(notice).toHaveTextContent("전북대 메일(@jbnu.ac.kr)만 쓸 수 있어요");
        expect(input().getAttribute("aria-describedby")!.split(" ")).toContain(notice.id);
        // 올바르게 다시 치면 안내가 사라진다
        fireEvent.change(input(), { target: { value: "someone" } });
        expect(document.getElementById("mail-notice")).toBeNull();
    });

    test("도메인 앞부분을 맞게 치는 중에는 안내가 뜨지 않는다", () => {
        render(<Harness />);
        userEvent.type(input(), "jbig@jbnu.ac");
        expect(document.getElementById("mail-notice")).toBeNull();
        userEvent.type(input(), "x");
        expect(document.getElementById("mail-notice")).toBeInTheDocument();
    });

    test("호출자가 준 aria-describedby(오류 문구)와 도메인 안내를 함께 연결한다", () => {
        render(<JbnuEmailInput id="m2" aria-label="메일" aria-describedby="m2-error" value="" onChange={() => {}} />);
        expect(screen.getByLabelText("메일").getAttribute("aria-describedby")).toBe("m2-error m2-domain");
    });

    test("대문자 도메인을 쳐도 소문자 도메인으로 맞춰진다", () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: "abc@JBNU.AC.KR" } });
        expect(input().value).toBe("abc@jbnu.ac.kr");
        expect(email()).toBe("abc@jbnu.ac.kr");
    });

    test("직접 친 도메인을 지우면 접미사가 다시 늘어난다", () => {
        render(<Harness />);
        userEvent.type(input(), "ab@jb");
        expect(suffix()).toBe("nu.ac.kr");
        userEvent.type(input(), "{backspace}{backspace}{backspace}");
        expect(input().value).toBe("ab");
        expect(suffix()).toBe(JBNU_EMAIL_DOMAIN);
    });

    test("백스페이스로 아이디를 다 지워도 도메인은 지워지지 않고 주소는 비어 있다", () => {
        render(<Harness />);
        userEvent.type(input(), "ab");
        userEvent.type(input(), "{backspace}{backspace}{backspace}");
        expect(input().value).toBe("");
        expect(suffix()).toBe(JBNU_EMAIL_DOMAIN);
        expect(email()).toBe("");
    });

    test("도메인은 선택할 수 없고 입력 요소가 아니다", () => {
        render(<Harness />);
        const domain = document.getElementById("mail-domain")!;
        expect(domain.tagName).toBe("SPAN");
        expect(domain).toHaveClass("jbnu-email-domain");
        expect(domain.closest("input")).toBeNull();
    });

    test("도메인 쪽을 눌러도 입력창으로 포커스가 간다", () => {
        render(<Harness />);
        userEvent.type(input(), "abc");
        input().blur();
        fireEvent.mouseDown(document.getElementById("mail-domain")!);
        expect(document.activeElement).toBe(input());
    });

    test("라벨과 도메인 안내가 접근성 트리에 연결된다", () => {
        render(<Harness />);
        expect(input()).toHaveAttribute("aria-describedby", "mail-domain");
        expect(document.getElementById("mail-domain")).toHaveAttribute("aria-label", JBNU_EMAIL_DOMAIN);
    });

    test("기존 폼 클래스와 오류 상태는 바깥 상자에 붙는다", () => {
        const { rerender } = render(<JbnuEmailInput id="x" aria-label="x" className="auth-input" value="" onChange={() => {}} />);
        const box = screen.getByLabelText("x").closest(".jbnu-email-field")!;
        expect(box).toHaveClass("jbnu-email-field", "auth-input");
        expect(box).not.toHaveClass("input-error");
        rerender(<JbnuEmailInput id="x" aria-label="x" className="auth-input" value="" invalid onChange={() => {}} />);
        expect(box).toHaveClass("input-error");
        expect(screen.getByLabelText("x")).toHaveAttribute("aria-invalid", "true");
    });

    test("초기값과 setEmail도 아이디만 남긴다", () => {
        render(<Harness initial="start@jbnu.ac.kr" />);
        expect(input().value).toBe("start");
        fireEvent.click(screen.getByText("reset"));
        expect(input().value).toBe("reset");
        expect(email()).toBe("reset@jbnu.ac.kr");
    });

    test("ref는 안쪽 input으로 전달된다", () => {
        const ref = React.createRef<HTMLInputElement>();
        render(<JbnuEmailInput ref={ref} id="r" aria-label="r" value="" onChange={() => {}} />);
        expect(ref.current).toBe(screen.getByLabelText("r"));
    });

    test("비활성 상태에서는 상자를 눌러도 포커스가 가지 않는다", () => {
        render(<JbnuEmailInput id="d" aria-label="d" value="" disabled onChange={() => {}} />);
        fireEvent.mouseDown(document.getElementById("d-domain")!);
        expect(document.activeElement).not.toBe(screen.getByLabelText("d"));
    });
});

describe("JbnuEmailInput 구조", () => {
    test("도메인이 친 글자 바로 뒤에 오도록 거울 글자가 같은 값을 갖는다", () => {
        render(<JbnuEmailInput id="m" aria-label="m" value="abc@jb" onChange={() => {}} />);
        const mirror = document.querySelector(".jbnu-email-mirror")!;
        expect(mirror).toHaveTextContent("abc@jb");
        expect(mirror).toHaveAttribute("aria-hidden", "true");
        expect(document.getElementById("m-domain")).toHaveTextContent("nu.ac.kr");
    });

    test("빈 값이면 placeholder 폭을 거울 글자로 쓴다", () => {
        render(<JbnuEmailInput id="p" aria-label="p" value="" placeholder="학교메일" onChange={() => {}} />);
        expect(document.querySelector(".jbnu-email-mirror")).toHaveTextContent("학교메일");
    });
});
