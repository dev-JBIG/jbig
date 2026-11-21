// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jest 27의 jsdom에는 TextEncoder/TextDecoder가 없어 react-router v7 로드가 실패한다.
import { TextDecoder, TextEncoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
    globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

// @primer/react 컴포넌트가 jsdom 환경에서 참조하는 브라우저 API 폴리필
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
    class MockResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    globalThis.ResizeObserver = MockResizeObserver as typeof ResizeObserver;
}

if (typeof globalThis.CSS === 'undefined') {
    (globalThis as unknown as { CSS: { supports: () => boolean } }).CSS = {
        supports: () => false,
    };
} else if (typeof globalThis.CSS.supports !== 'function') {
    globalThis.CSS.supports = () => false;
}
