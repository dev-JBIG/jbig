/**
 * 로그인, 회원가입, 비밀번호 찾기, 로그인 모달이 같이 쓰는 입력 검사.
 * 서버(backend/users)의 규칙과 같아야 한다.
 */

/** 전북대 메일(@jbnu.ac.kr)인가. 대소문자 무시, 앞뒤 공백 무시 */
export const isValidEmailDomain = (email: string) => /@jbnu\.ac\.kr$/i.test(email.trim());

/** 8~16자, 영문/숫자 각 1개 이상, 특수문자 ! 또는 @ 최소 1개 포함 (그 밖의 문자는 불가) */
export const isValidPassword = (pwd: string) =>
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@])[A-Za-z\d!@]{8,16}$/.test(pwd);

export const EMAIL_DOMAIN_MESSAGE = "전북대 이메일(@jbnu.ac.kr)만 사용할 수 있습니다.";
/** 입력칸 아래에 붙는 짧은 안내 */
export const PASSWORD_RULE_SHORT = "8~16자, 영문/숫자 각 1개 이상, 특수문자(!,@) 포함";
/** 알림 창에 띄우는 문장형 안내 */
export const PASSWORD_RULE_MESSAGE = "비밀번호는 8~16자이며, 영문/숫자 각 1개 이상과 특수문자(!,@)를 포함해야 합니다.";

/** 입력칸 오류 문구 (없으면 undefined) */
export const getEmailError = (value: string): string | undefined => {
    if (!value.trim()) return "이메일을 입력해주세요.";
    if (!isValidEmailDomain(value)) return EMAIL_DOMAIN_MESSAGE;
    return undefined;
};

export const getPasswordError = (value: string): string | undefined => {
    if (!value) return "비밀번호를 입력해주세요.";
    if (!isValidPassword(value)) return PASSWORD_RULE_SHORT;
    return undefined;
};
