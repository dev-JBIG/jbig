import { getImageUploadError, MAX_UPLOAD_BYTES, PROFILE_IMAGE_EXT_RE, UPLOAD_MESSAGES } from "./uploadRules";

const fileOf = (name: string, type: string, size = 10) => {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
};

describe("uploadRules", () => {
    test("종류로 검사: image/* 만 통과", () => {
        expect(getImageUploadError(fileOf("a.png", "image/png"))).toBeUndefined();
        expect(getImageUploadError(fileOf("a.pdf", "application/pdf"))).toBe(UPLOAD_MESSAGES.imageOnly);
    });

    test("확장자로 검사: 프로필 이미지 확장자만 통과", () => {
        expect(getImageUploadError(fileOf("a.JPG", "image/jpeg"), PROFILE_IMAGE_EXT_RE)).toBeUndefined();
        expect(getImageUploadError(fileOf("a.svg", "image/svg+xml"), PROFILE_IMAGE_EXT_RE)).toBe(UPLOAD_MESSAGES.profileImageOnly);
    });

    test("10MB 를 넘으면 막는다", () => {
        expect(getImageUploadError(fileOf("a.png", "image/png", MAX_UPLOAD_BYTES))).toBeUndefined();
        expect(getImageUploadError(fileOf("a.png", "image/png", MAX_UPLOAD_BYTES + 1))).toBe(UPLOAD_MESSAGES.imageTooLarge);
    });
});
