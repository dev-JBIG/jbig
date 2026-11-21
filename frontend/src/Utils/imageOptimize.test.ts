import {
    computeTargetDimensions,
    IMAGE_ENCODE_QUALITY,
    isAnimatedImageFile,
    isOptimizableImage,
    MAX_IMAGE_DIMENSION,
    optimizeImageForUpload,
    replaceFileExtension,
} from "./imageOptimize";

function buildAnimatedWebpBytes(): Uint8Array {
    // RIFF....WEBP + VP8X chunk with animation bit (0x02) set at byte 20
    const bytes = new Uint8Array(30);
    const writeAscii = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i);
    };
    writeAscii(0, "RIFF");
    bytes[4] = 22;
    writeAscii(8, "WEBP");
    writeAscii(12, "VP8X");
    bytes[16] = 10;
    bytes[20] = 0x02; // animation flag
    return bytes;
}

function buildApngBytes(): Uint8Array {
    // PNG signature (8) + IHDR chunk (length 0, 12 bytes) + acTL chunk (length 0, 12 bytes)
    const bytes = new Uint8Array(32);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    // IHDR length = 0
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    // acTL length = 0
    bytes.set([0x61, 0x63, 0x54, 0x4c], 24);
    return bytes;
}

describe("imageOptimize helpers", () => {
    test("isOptimizableImage optimizes raster photos and skips GIF, SVG, and non-images", () => {
        expect(isOptimizableImage(new File(["x"], "photo.jpg", { type: "image/jpeg" }))).toBe(true);
        expect(isOptimizableImage(new File(["x"], "screen.png", { type: "image/png" }))).toBe(true);
        expect(isOptimizableImage(new File(["x"], "pic.webp", { type: "image/webp" }))).toBe(true);
        expect(isOptimizableImage(new File(["x"], "iphone.HEIC", { type: "" }))).toBe(true);

        expect(isOptimizableImage(new File(["x"], "anim.gif", { type: "image/gif" }))).toBe(false);
        expect(isOptimizableImage(new File(["x"], "icon.svg", { type: "image/svg+xml" }))).toBe(false);
        expect(isOptimizableImage(new File(["x"], "report.pdf", { type: "application/pdf" }))).toBe(false);
    });

    test("computeTargetDimensions preserves images <= 2560px and scales larger images proportionally", () => {
        expect(computeTargetDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 });
        expect(computeTargetDimensions(2560, 1440)).toEqual({ width: 2560, height: 1440 });
        expect(computeTargetDimensions(4032, 3024)).toEqual({ width: MAX_IMAGE_DIMENSION, height: 1920 });
        expect(computeTargetDimensions(3024, 4032)).toEqual({ width: 1920, height: MAX_IMAGE_DIMENSION });
        expect(computeTargetDimensions(0, 100)).toEqual({ width: 0, height: 0 });
    });

    test("replaceFileExtension swaps extensions cleanly", () => {
        expect(replaceFileExtension("IMG_001.JPG", "webp")).toBe("IMG_001.webp");
        expect(replaceFileExtension("my.photo.name.png", "webp")).toBe("my.photo.name.webp");
        expect(replaceFileExtension("clipboard", "webp")).toBe("clipboard.webp");
    });

    test("isAnimatedImageFile detects animated WebP and APNG while returning false for static images", async () => {
        const animWebp = new File([buildAnimatedWebpBytes()], "sticker.webp", { type: "image/webp" });
        const apng = new File([buildApngBytes()], "badge.png", { type: "image/png" });
        const staticJpg = new File(["plain-jpeg"], "photo.jpg", { type: "image/jpeg" });

        expect(await isAnimatedImageFile(animWebp)).toBe(true);
        expect(await isAnimatedImageFile(apng)).toBe(true);
        expect(await isAnimatedImageFile(staticJpg)).toBe(false);
    });
});

describe("optimizeImageForUpload", () => {
    const originalCreateImageBitmap = (globalThis as any).createImageBitmap;

    afterEach(() => {
        jest.restoreAllMocks();
        if (originalCreateImageBitmap === undefined) {
            delete (globalThis as any).createImageBitmap;
        } else {
            (globalThis as any).createImageBitmap = originalCreateImageBitmap;
        }
    });

    test("returns GIF, animated WebP, APNG, and non-image files untouched", async () => {
        const gif = new File(["gif-bytes"], "dance.gif", { type: "image/gif" });
        const pdf = new File(["pdf-bytes"], "paper.pdf", { type: "application/pdf" });
        const animWebp = new File([buildAnimatedWebpBytes()], "anim.webp", { type: "image/webp" });
        const apng = new File([buildApngBytes()], "anim.png", { type: "image/png" });

        expect(await optimizeImageForUpload(gif)).toBe(gif);
        expect(await optimizeImageForUpload(pdf)).toBe(pdf);
        expect(await optimizeImageForUpload(animWebp)).toBe(animWebp);
        expect(await optimizeImageForUpload(apng)).toBe(apng);
    });

    test("re-encodes high-res photo via sRGB canvas to high-quality WebP and closes bitmap", async () => {
        const closeMock = jest.fn();
        (globalThis as any).createImageBitmap = jest.fn().mockResolvedValue({
            width: 4032,
            height: 3024,
            close: closeMock,
        });

        const drawImage = jest.fn();
        const mockCtx = {
            imageSmoothingEnabled: false,
            imageSmoothingQuality: "low",
            drawImage,
        };
        const getContext = jest.fn().mockReturnValue(mockCtx);
        const toBlob = jest.fn((cb: (b: Blob | null) => void, type?: string) => {
            cb(new Blob(["webp-data"], { type: type || "image/webp" }));
        });
        const fakeCanvas = { width: 0, height: 0, getContext, toBlob };

        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
            if (tag === "canvas") return fakeCanvas as unknown as HTMLCanvasElement;
            return originalCreateElement(tag);
        }) as typeof document.createElement);

        const input = new File(["raw-hdr-jpeg"], "IMG_1234.JPG", {
            type: "image/jpeg",
            lastModified: 1700000000000,
        });

        const result = await optimizeImageForUpload(input);

        expect(getContext).toHaveBeenCalledWith("2d", { colorSpace: "srgb" });
        expect(fakeCanvas.width).toBe(MAX_IMAGE_DIMENSION);
        expect(fakeCanvas.height).toBe(1920);
        expect(mockCtx.imageSmoothingEnabled).toBe(true);
        expect(mockCtx.imageSmoothingQuality).toBe("high");
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, MAX_IMAGE_DIMENSION, 1920);
        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", IMAGE_ENCODE_QUALITY);
        expect(closeMock).toHaveBeenCalledTimes(1);
        expect(result.name).toBe("IMG_1234.webp");
        expect(result.type).toBe("image/webp");
    });

    test("falls back to JPEG for opaque inputs and PNG for alpha-capable WebP when WebP encoding is unsupported", async () => {
        const closeMock = jest.fn();
        (globalThis as any).createImageBitmap = jest.fn().mockResolvedValue({
            width: 1600,
            height: 1200,
            close: closeMock,
        });

        const toBlob = jest.fn((cb: (b: Blob | null) => void, type?: string) => {
            if (type === "image/webp") {
                cb(new Blob(["png"], { type: "image/png" }));
                return;
            }
            cb(new Blob(["encoded"], { type: type || "image/png" }));
        });
        const fakeCanvas = {
            width: 0,
            height: 0,
            getContext: jest.fn().mockReturnValue({
                imageSmoothingEnabled: false,
                imageSmoothingQuality: "low",
                drawImage: jest.fn(),
            }),
            toBlob,
        };

        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
            if (tag === "canvas") return fakeCanvas as unknown as HTMLCanvasElement;
            return originalCreateElement(tag);
        }) as typeof document.createElement);

        const opaqueInput = new File(["raw"], "photo.jpeg", { type: "image/jpeg" });
        const opaqueResult = await optimizeImageForUpload(opaqueInput);
        expect(opaqueResult.name).toBe("photo.jpg");
        expect(opaqueResult.type).toBe("image/jpeg");

        const alphaWebpInput = new File(["static-webp"], "transparent.webp", { type: "image/webp" });
        const alphaResult = await optimizeImageForUpload(alphaWebpInput);
        expect(alphaResult.name).toBe("transparent.png");
        expect(alphaResult.type).toBe("image/png");
        expect(closeMock).toHaveBeenCalledTimes(2);
    });

    test("falls back to original file safely when decoding fails", async () => {
        (globalThis as any).createImageBitmap = jest.fn().mockRejectedValue(new Error("decode error"));
        const input = new File(["corrupt"], "weird.jpg", { type: "image/jpeg" });

        expect(await optimizeImageForUpload(input)).toBe(input);
    });
});
