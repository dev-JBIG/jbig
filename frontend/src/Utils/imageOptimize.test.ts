import {
    computeTargetDimensions,
    IMAGE_ENCODE_QUALITY,
    isOptimizableImage,
    MAX_IMAGE_DIMENSION,
    optimizeImageForUpload,
    replaceFileExtension,
} from "./imageOptimize";

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

    test("returns GIF and non-image files untouched", async () => {
        const gif = new File(["gif-bytes"], "dance.gif", { type: "image/gif" });
        const pdf = new File(["pdf-bytes"], "paper.pdf", { type: "application/pdf" });

        expect(await optimizeImageForUpload(gif)).toBe(gif);
        expect(await optimizeImageForUpload(pdf)).toBe(pdf);
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

    test("falls back to JPEG when WebP canvas encoding is unsupported", async () => {
        const closeMock = jest.fn();
        (globalThis as any).createImageBitmap = jest.fn().mockResolvedValue({
            width: 1600,
            height: 1200,
            close: closeMock,
        });

        const toBlob = jest.fn((cb: (b: Blob | null) => void, type?: string) => {
            if (type === "image/webp") {
                // 구형 브라우저가 WebP 미지원 시 PNG로 돌려주는 동작 모사
                cb(new Blob(["png"], { type: "image/png" }));
                return;
            }
            cb(new Blob(["jpeg-data"], { type: "image/jpeg" }));
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

        const input = new File(["raw"], "photo.jpeg", { type: "image/jpeg" });
        const result = await optimizeImageForUpload(input);

        expect(result.name).toBe("photo.jpg");
        expect(result.type).toBe("image/jpeg");
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    test("falls back to original file safely when decoding fails", async () => {
        (globalThis as any).createImageBitmap = jest.fn().mockRejectedValue(new Error("decode error"));
        const input = new File(["corrupt"], "weird.jpg", { type: "image/jpeg" });

        expect(await optimizeImageForUpload(input)).toBe(input);
    });
});
