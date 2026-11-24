import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeSidePane from "./HomeSidePane";
import { fetchPopularPosts } from "../../API/req";

jest.mock("../../API/req", () => ({
    fetchPopularPosts: jest.fn(),
    POPULAR_DAYS: 90,
}));
jest.mock("../Utils/UserContext", () => ({
    useUser: () => ({ user: null }),
}));

const mockFetch = fetchPopularPosts as jest.MockedFunction<typeof fetchPopularPosts>;
const post = (id: number, title: string, likes: number) => ({
    id, board_post_id: id, title, author: "a", user_id: "a", author_semester: 0, date: "26/11/24",
    views: 100 - id, likes, comment_count: id, board_id: 4, board_name: "자유게시판",
});

const renderPane = () => render(
    <MemoryRouter>
        <HomeSidePane calendar={<div>달력 자리</div>} />
    </MemoryRouter>
);

beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue([post(1, "첫째 글", 9), post(2, "둘째 글", 4)]);
});

test("처음에는 일정 탭이 열리고 인기 글은 탭을 열 때 불러온다", async () => {
    renderPane();
    expect(screen.getByRole("tab", { name: "일정" })).toHaveAttribute("aria-selected", "true");
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "인기 글" }));
    expect(await screen.findByText("첫째 글")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith("likes");
    expect(screen.getByText("최근 90일")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /첫째 글/ })).toHaveAttribute("href", "/board/4/1");
    expect(localStorage.getItem("jbig-home-pane-tab")).toBe("popular");
});

test("방향키로 탭을 옮기고 기준 버튼으로 다시 불러온다", async () => {
    renderPane();
    const calendarTab = screen.getByRole("tab", { name: "일정" });
    calendarTab.focus();
    fireEvent.keyDown(calendarTab, { key: "ArrowRight" });
    const popularTab = screen.getByRole("tab", { name: "인기 글" });
    expect(popularTab).toHaveFocus();
    expect(popularTab).toHaveAttribute("aria-selected", "true");
    await screen.findByText("첫째 글");

    fireEvent.click(screen.getByRole("button", { name: "댓글" }));
    await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith("comments"));
    expect(screen.getByRole("button", { name: "댓글" })).toHaveAttribute("aria-pressed", "true");
});

test("불러오기 실패와 빈 목록을 구분해 알린다", async () => {
    mockFetch.mockRejectedValueOnce(new Error("x"));
    localStorage.setItem("jbig-home-pane-tab", "popular");
    renderPane();
    expect(await screen.findByText("인기 글을 불러오지 못했어요")).toBeInTheDocument();

    // 다시 시도하면 같은 기준으로 다시 불러온다
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("첫째 글")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith("likes");
});

test("소식 띠는 다음 버튼으로 돌아가며 보여준다", () => {
    renderPane();
    const next = screen.getByRole("button", { name: /다음 소식 보기/ });
    expect(next).toHaveTextContent("1/3");
    expect(screen.getByRole("link", { name: /이력서/ })).toHaveAttribute("href", "/signin");
    fireEvent.click(next);
    expect(next).toHaveTextContent("2/3");
    fireEvent.click(next);
    fireEvent.click(next);
    expect(next).toHaveTextContent("1/3");
});
