/**
 * 업로드 직전 클라이언트 측 이미지 최적화 유틸리티.
 *
 * - sRGB 2D 캔버스로 재인코딩하여 스마트폰 HDR Gain Map(주변 배경 회색화 원인)과
 *   불필요한 EXIF(GPS 위치 정보 등) 메타데이터를 자동 제거한다.
 * - 긴 변이 MAX_IMAGE_DIMENSION(2560px)을 초과하는 초고해상도 사진만 비율 유지 축소하여
 *   Retina/HiDPI 화면에서도 원본 수준의 선명도를 유지하면서 업로드·조회 트래픽을 크게 줄인다.
 * - GIF(애니메이션)와 SVG(벡터)는 훼손 방지를 위해 원본을 그대로 유지한다.
 */

export const MAX_IMAGE_DIMENSION = 2560;
export const IMAGE_ENCODE_QUALITY = 0.92;
const MAX_OPTIMIZED_BYTES = 20 * 1024 * 1024;

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

function getExtension(filename: string): string {
    const idx = filename.lastIndexOf(".");
    if (idx <= 0 || idx === filename.length - 1) return "";
    return filename.slice(idx + 1).toLowerCase();
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
 * 래스터 이미지를 고화질 sRGB WebP(미지원 시 JPEG/PNG)로 변환한다.
 * 브라우저 디코딩/인코딩이 불가능한 환경이나 오류 발생 시 원본 파일을 그대로 반환한다.
 */
export async function optimizeImageForUpload(file: File): Promise<File> {
    if (!isOptimizableImage(file) || typeof document === "undefined") {
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
            const isPng =
                (file.type || "").toLowerCase() === "image/png" ||
                getExtension(file.name) === "png";
            if (isPng) {
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
