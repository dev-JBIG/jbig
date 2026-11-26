/**
 * 업로드 공통 규칙. 글쓰기, 관리자 팝업, 프로필 블록 편집기가 같이 쓴다.
 * 서버 쪽 제한과 같아야 한다(파일 하나 10MB).
 */

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** 프로필 블록 이미지로 받는 확장자 */
export const PROFILE_IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp)$/i;

export const UPLOAD_MESSAGES = {
    imageOnly: "이미지 파일만 올릴 수 있습니다.",
    profileImageOnly: "PNG, JPG, GIF, WebP, BMP 이미지만 올릴 수 있습니다.",
    imageTooLarge: `이미지는 ${MAX_UPLOAD_MB}MB 이하만 올릴 수 있습니다.`,
    fileTooLarge: `${MAX_UPLOAD_MB}MB를 넘는 파일은 올릴 수 없습니다.`,
    uploadFailed: "이미지를 올리지 못했습니다.",
} as const;

/**
 * 이미지 파일 검사. 문제가 있으면 안내 문구, 없으면 undefined.
 * extensions 를 주면 파일 이름 확장자로, 아니면 파일 종류(image/*)로 판단한다.
 */
export const getImageUploadError = (file: File, extensions?: RegExp): string | undefined => {
    if (extensions) {
        if (!extensions.test(file.name)) return UPLOAD_MESSAGES.profileImageOnly;
    } else if (!file.type.startsWith("image/")) {
        return UPLOAD_MESSAGES.imageOnly;
    }
    if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_MESSAGES.imageTooLarge;
    return undefined;
};
