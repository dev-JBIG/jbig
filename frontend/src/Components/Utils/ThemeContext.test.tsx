import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { COLOR_MODE_STORAGE_KEY, ColorModeProvider, useColorMode } from "./ThemeContext";

const Probe: React.FC = () => {
    const { colorMode, resolvedColorMode, themePreference, resolvedTheme, setThemePreference, toggleColorMode } =
        useColorMode();
    return (
        <div>
            <span data-testid="pref">{themePreference}</span>
            <span data-testid="mode">{colorMode}</span>
            <span data-testid="resolved-mode">{resolvedColorMode}</span>
            <span data-testid="resolved-theme">{resolvedTheme}</span>
            <button type="button" onClick={() => setThemePreference("light")}>light</button>
            <button type="button" onClick={() => setThemePreference("dark_dimmed")}>dimmed</button>
            <button type="button" onClick={() => setThemePreference("dark")}>dark</button>
            <button type="button" onClick={() => setThemePreference("auto")}>auto</button>
            <button type="button" onClick={toggleColorMode}>toggle</button>
        </div>
    );
};

describe("ColorModeProvider (4-theme Primer system)", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute("data-color-mode");
        document.documentElement.removeAttribute("data-light-theme");
        document.documentElement.removeAttribute("data-dark-theme");

        let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.appendChild(meta);
        }
        meta.content = "#ffffff";

        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: jest.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            })),
        });
    });

    test("defaults to auto (system) mode and switches cleanly across light, dark_dimmed, dark, and auto", () => {
        render(
            <ColorModeProvider>
                <Probe />
            </ColorModeProvider>
        );

        expect(screen.getByTestId("pref")).toHaveTextContent("auto");
        expect(document.documentElement.getAttribute("data-color-mode")).toBe("auto");
        expect(document.documentElement.getAttribute("data-dark-theme")).toBe("dark_dimmed");
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#ffffff");

        fireEvent.click(screen.getByRole("button", { name: "dimmed" }));
        expect(screen.getByTestId("pref")).toHaveTextContent("dark_dimmed");
        expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark_dimmed");
        expect(document.documentElement.getAttribute("data-color-mode")).toBe("dark");
        expect(document.documentElement.getAttribute("data-dark-theme")).toBe("dark_dimmed");
        expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe("dark_dimmed");
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#212830");

        fireEvent.click(screen.getByRole("button", { name: "dark" }));
        expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
        expect(document.documentElement.getAttribute("data-dark-theme")).toBe("dark");
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#0d1117");

        fireEvent.click(screen.getByRole("button", { name: "light" }));
        expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
        expect(document.documentElement.getAttribute("data-color-mode")).toBe("light");
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#ffffff");
    });

    test("respects OS dark preference in auto mode using dark_dimmed by default", () => {
        (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
            matches: query.includes("dark"),
            media: query,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        }));

        render(
            <ColorModeProvider>
                <Probe />
            </ColorModeProvider>
        );

        expect(screen.getByTestId("pref")).toHaveTextContent("auto");
        expect(screen.getByTestId("resolved-mode")).toHaveTextContent("dark");
        expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark_dimmed");
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#212830");
    });
});
