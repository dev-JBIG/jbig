import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Calendar from "./Calendar";
import { fetchCalendarEvents, deleteCalendarEvent } from "../../../API/req";
import { useUser } from "../UserContext";
import { useAlert } from "../AlertContext";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../../API/req", () => ({
    fetchCalendarEvents: jest.fn(),
    deleteCalendarEvent: jest.fn(),
}));

jest.mock("../UserContext", () => ({
    useUser: jest.fn(),
}));

jest.mock("../AlertContext", () => ({
    useAlert: jest.fn(),
}));

const mockedFetchEvents = fetchCalendarEvents as jest.Mock;
const mockedDeleteEvent = deleteCalendarEvent as jest.Mock;
const mockedUseUser = useUser as jest.Mock;
const mockedUseAlert = useAlert as jest.Mock;

describe("Primer React Calendar", () => {
    const showAlert = jest.fn();
    const showConfirm = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseUser.mockReturnValue({ accessToken: "staff-token", signOutLocal: jest.fn() });
        mockedUseAlert.mockReturnValue({ showAlert, showConfirm });
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        mockedFetchEvents.mockResolvedValue([
            {
                id: "101",
                title: "정기 세미나",
                start: new Date(`${y}-${m}-15T18:00:00`),
                end: new Date(`${y}-${m}-15T20:00:00`),
                description: "공대 7호관 201호",
                color: "#0969da",
            },
        ]);
        mockedDeleteEvent.mockResolvedValue({});
        showConfirm.mockResolvedValue(true);
    });

    test("월간 캘린더와 일정을 렌더링하고 클릭 시 상세 모달을 연다", async () => {
        render(<Calendar staffAuth={true} />);

        const eventButton = await screen.findByRole("button", { name: /정기 세미나/ });
        expect(eventButton).toBeInTheDocument();

        fireEvent.click(eventButton);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("공대 7호관 201호")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    });

    test("운영진이 삭제를 확정하면 deleteCalendarEvent API를 호출한다", async () => {
        render(<Calendar staffAuth={true} />);

        fireEvent.click(await screen.findByRole("button", { name: /정기 세미나/ }));
        fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

        await waitFor(() => {
            expect(showConfirm).toHaveBeenCalledTimes(1);
            expect(mockedDeleteEvent).toHaveBeenCalledWith("101", "staff-token");
        });
    });

    test("이전 달 / 다음 달 / 오늘 네비게이션이 동작한다", async () => {
        render(<Calendar staffAuth={false} />);
        await screen.findByRole("button", { name: /정기 세미나/ });

        const now = new Date();
        const currentHeading = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
        expect(screen.getByText(currentHeading)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        expect(
            screen.getByText(`${nextMonth.getFullYear()}년 ${nextMonth.getMonth() + 1}월`)
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "오늘" }));
        expect(screen.getByText(currentHeading)).toBeInTheDocument();
    });
});
