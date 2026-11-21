/**
 * 업로드 직전 클라이언트 측 이미지 최적화 유틸리티.
 *
 * - sRGB 2D 캔버스로 재인코딩하여 스마트폰 HDR Gain Map(주변 배경 회색화 원인)과
 *   불필요한 EXIF(GPS 위치 정보 등) 메타데이터를 자동 제거한다.
 * - 긴 변이 MAX_IMAGE_DIMENSION(2560px)을 초과하는 초고해상도 사진만 비율 유지 축소하여
 *   Retina/HiDPI 화면에서도 원본 수준의 선명도를 유지하면서 업로드·조회 트래픽을 크게 줄인다.
 * - GIF·애니메이션 WebP·APNG(움짤)와 SVG(벡터)는 훼손 방지를 위해 원본을 그대로 유지한다.
 */

export const MAX_IMAGE_DIMENSION = 2560;
export const IMAGE_ENCODE_QUALITY = 0.92;
const MAX_OPTIMIZED_BYTES = 20 * 1024 * 1024;
const HEADER_INSPECT_BYTES = 64 * 1024;

const SKIP_MIME_TYPES = new Set(["image/gif", "image/svg+xml"]);
const OPTIMIZABLE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/avif",
    "image/heic",
    "image/heif",
]);
const OPTIMIZABLE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "bmp",
    "avif",
    "heic",
    "heif",
]);
const ALPHA_CAPABLE_MIME_TYPES = new Set([
    "image/png",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
]);
const ALPHA_CAPABLE_EXTENSIONS = new Set(["png", "webp", "avif", "heic", "heif"]);

function getExtension(filename: string): string {
    const idx = filename.lastIndexOf(".");
    if (idx <= 0 || idx === filename.length - 1) return "";
    return filename.slice(idx + 1).toLowerCase();
}

function mayHaveAlphaChannel(file: File): boolean {
    const mime = (file.type || "").toLowerCase();
    const ext = getExtension(file.name);
    return ALPHA_CAPABLE_MIME_TYPES.has(mime) || ALPHA_CAPABLE_EXTENSIONS.has(ext);
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
    if (offset < 0 || offset + text.length > bytes.length) return false;
    for (let i = 0; i < text.length; i++) {
        if (bytes[offset + i] !== text.charCodeAt(i)) return false;
    }
    return true;
}

/**
 * PNG 헤더 청크를 순회해 IDAT 이전 acTL 청크(APNG) 존재 여부를 확인한다.
 */
function isApngBytes(bytes: Uint8Array): boolean {
    if (
        bytes.length < 24 ||
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47 ||
        bytes[4] !== 0x0d ||
        bytes[5] !== 0x0a ||
        bytes[6] !== 0x1a ||
        bytes[7] !== 0x0a
    ) {
        return false;
    }

    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length =
            ((bytes[offset] << 24) |
                (bytes[offset + 1] << 16) |
                (bytes[offset + 2] << 8) |
                bytes[offset + 3]) >>>
            0;
        if (matchesAscii(bytes, offset + 4, "acTL")) {
            return true;
        }
        if (matchesAscii(bytes, offset + 4, "IDAT")) {
            return false;
        }
        const nextOffset = offset + 12 + length;
        if (nextOffset <= offset || nextOffset > bytes.length) {
            break;
        }
        offset = nextOffset;
    }
    return false;
}

/**
 * WebP(RIFF/WEBP) 컨테이너에서 VP8X 애니메이션 플래그 또는 ANIM 청크를 확인한다.
 */
function isAnimatedWebpBytes(bytes: Uint8Array): boolean {
    if (bytes.length < 30 || !matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) {
        return false;
    }

    if (matchesAscii(bytes, 12, "VP8X") && (bytes[20] & 0x02) !== 0) {
        return true;
    }

    let offset = 12;
    while (offset + 8 <= bytes.length) {
        if (matchesAscii(bytes, offset, "ANIM")) {
            return true;
        }
        const chunkSize =
            (bytes[offset + 4] |
                (bytes[offset + 5] << 8) |
                (bytes[offset + 6] << 16) |
                (bytes[offset + 7] << 24)) >>>
            0;
        const paddedSize = chunkSize + (chunkSize % 2);
        const nextOffset = offset + 8 + paddedSize;
        if (nextOffset <= offset || nextOffset > bytes.length) {
            break;
        }
        offset = nextOffset;
    }
    return false;
}

async function readHeadBytes(file: File): Promise<Uint8Array | null> {
    const headBlob = file.slice(0, HEADER_INSPECT_BYTES);
    try {
        if (typeof headBlob.arrayBuffer === "function") {
            return new Uint8Array(await headBlob.arrayBuffer());
        }
        if (typeof FileReader !== "undefined") {
            const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(reader.error || new Error("Failed to read file header"));
                reader.readAsArrayBuffer(headBlob);
            });
            return new Uint8Array(buffer);
        }
    } catch {
        return null;
    }
    return null;
}

export async function isAnimatedImageFile(file: File): Promise<boolean> {
    const mime = (file.type || "").toLowerCase();
    const ext = getExtension(file.name);
    if (mime === "image/gif" || ext === "gif") {
        return true;
    }

    const mightBeAnimated =
        mime === "image/webp" ||
        mime === "image/png" ||
        ext === "webp" ||
        ext === "png";
    if (!mightBeAnimated) {
        return false;
    }

    const bytes = await readHeadBytes(file);
    if (!bytes) {
        return false;
    }
    return isAnimatedWebpBytes(bytes) || isApngBytes(bytes);
}

export function isOptimizableImage(file: File): boolean {
    const mime = (file.type || "").toLowerCase();
    const ext = getExtension(file.name);

    if (SKIP_MIME_TYPES.has(mime) || ext === "gif" || ext === "svg") {
        return false;
    }
    if (OPTIMIZABLE_MIME_TYPES.has(mime)) {
        return true;
    }
    return !mime && OPTIMIZABLE_EXTENSIONS.has(ext);
}

export function computeTargetDimensions(
    width: number,
    height: number,
    maxDimension: number = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
    if (width <= 0 || height <= 0 || maxDimension <= 0) {
        return { width: 0, height: 0 };
    }
    const longestSide = Math.max(width, height);
    if (longestSide <= maxDimension) {
        return { width: Math.round(width), height: Math.round(height) };
    }
    const scale = maxDimension / longestSide;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

export function replaceFileExtension(filename: string, newExtension: string): string {
    const cleanExt = newExtension.replace(/^\.+/, "").toLowerCase();
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex <= 0) {
        return `${filename}.${cleanExt}`;
    }
    return `${filename.slice(0, dotIndex)}.${cleanExt}`;
}

interface DecodedImage {
    source: CanvasImageSource;
    width: number;
    height: number;
    cleanup: () => void;
}

async function decodeImageFile(file: File): Promise<DecodedImage> {
    if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file);
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            cleanup: () => {
                if (typeof bitmap.close === "function") {
                    bitmap.close();
                }
            },
        };
    }

    if (typeof Image === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        throw new Error("Image decoding is not available in this environment.");
    }

    const objectUrl = URL.createObjectURL(file);
    return new Promise<DecodedImage>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                source: img,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                cleanup: () => URL.revokeObjectURL(objectUrl),
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Failed to decode image."));
        };
        img.src = objectUrl;
    });
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality?: number
): Promise<Blob | null> {
    return new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob), mimeType, quality);
        } catch {
            resolve(null);
        }
    });
}

function getSrgb2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    try {
        const ctx = canvas.getContext("2d", { colorSpace: "srgb" });
        if (ctx) return ctx;
    } catch {
        // colorSpace 옵션을 지원하지 않는 구형 브라우저 폴백
    }
    return canvas.getContext("2d");
}

/**
 * 래스터 이미지를 고화질 sRGB WebP(미지원 시 투명도 가능 포맷은 PNG, 불투명 사진은 JPEG)로 변환한다.
 * 애니메이션 이미지(GIF/애니메이션 WebP/APNG)나 오류 발생 시 원본 파일을 그대로 반환한다.
 */
export async function optimizeImageForUpload(file: File): Promise<File> {
    if (!isOptimizableImage(file) || typeof document === "undefined") {
        return file;
    }

    if (await isAnimatedImageFile(file)) {
        return file;
    }

    let decoded: DecodedImage | null = null;
    try {
        decoded = await decodeImageFile(file);
        const { width, height } = computeTargetDimensions(
            decoded.width,
            decoded.height,
            MAX_IMAGE_DIMENSION
        );
        if (width <= 0 || height <= 0) {
            return file;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = getSrgb2DContext(canvas);
        if (!ctx) {
            return file;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(decoded.source, 0, 0, width, height);

        let blob = await canvasToBlob(canvas, "image/webp", IMAGE_ENCODE_QUALITY);
        let targetExt = "webp";

        if (!blob || blob.type !== "image/webp") {
            if (mayHaveAlphaChannel(file)) {
                blob = await canvasToBlob(canvas, "image/png");
                targetExt = "png";
            } else {
                blob = await canvasToBlob(canvas, "image/jpeg", IMAGE_ENCODE_QUALITY);
                targetExt = "jpg";
            }
        }

        if (!blob || blob.size === 0) {
            return file;
        }
        if (blob.size > MAX_OPTIMIZED_BYTES && file.size <= MAX_OPTIMIZED_BYTES) {
            return file;
        }

        const nextName = replaceFileExtension(file.name, targetExt);
        return new File([blob], nextName, {
            type: blob.type || `image/${targetExt === "jpg" ? "jpeg" : targetExt}`,
            lastModified: file.lastModified,
        });
    } catch {
        return file;
    } finally {
        decoded?.cleanup();
    }
}
