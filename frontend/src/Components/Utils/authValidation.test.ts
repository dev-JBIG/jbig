import { EMAIL_DOMAIN_MESSAGE, PASSWORD_RULE_SHORT, getEmailError, getPasswordError, isValidEmailDomain, isValidPassword } from "./authValidation";

describe("authValidation", () => {
    test.each([
        ["a@jbnu.ac.kr", true],
        ["A@JBNU.AC.KR", true],
        ["  a@jbnu.ac.kr  ", true],
        ["a@jbnu.ac.kr.evil.com", false],
        ["a@gmail.com", false],
        ["a@jbnuXacXkr", false],
        ["", false],
    ])("전북대 메일 판정 %p -> %p", (email, ok) => {
        expect(isValidEmailDomain(email)).toBe(ok);
    });

    test.each([
        ["abcd123!", true],
        ["Abcdefgh1@", true],
        ["abcdefgh", false],          // 숫자, 특수문자 없음
        ["12345678!", false],         // 영문 없음
        ["abcd1234", false],          // 특수문자 없음
        ["abc12!", false],            // 7자 미만
        ["abcdefgh12345678!", false], // 16자 초과
        ["abcd123#", false],          // 허용 안 되는 특수문자
        ["abcd 123!", false],         // 공백
    ])("비밀번호 규칙 %p -> %p", (pwd, ok) => {
        expect(isValidPassword(pwd)).toBe(ok);
    });

    test("입력칸 오류 문구", () => {
        expect(getEmailError("")).toBe("이메일을 입력해주세요.");
        expect(getEmailError("a@gmail.com")).toBe(EMAIL_DOMAIN_MESSAGE);
        expect(getEmailError("a@jbnu.ac.kr")).toBeUndefined();
        expect(getPasswordError("")).toBe("비밀번호를 입력해주세요.");
        expect(getPasswordError("abc")).toBe(PASSWORD_RULE_SHORT);
        expect(getPasswordError("abcd123!")).toBeUndefined();
    });
});
