/** 학회 일정. 화면은 API/req 에서 가져다 쓴다(모두 다시 내보냄) */
import axios, { authHeaders } from "./client";
import { BASE_URL } from "./auth";
import { CalendarEvent, CalendarEventCreate } from "../Components/Utils/interfaces";

// 캘린더 일정 정보 가져오기
interface RawCalendarEvent {
    id: number | string;
    title: string;
    start: string;
    end?: string | null;
    allDay?: boolean;
    color?: string;
    description?: string;
}

export const fetchCalendarEvents = async (): Promise<CalendarEvent[]> => {
    const res = await axios.get<RawCalendarEvent[]>(`${BASE_URL}/api/calendar/`, {
        headers: { Accept: "application/json" },
        withCredentials: true,
    });

    return res.data.map(ev => ({
        id: String(ev.id),
        title: ev.title,
        start: new Date(ev.start),
        end: ev.end ? new Date(ev.end) : null,
        allDay: ev.allDay ?? false,
        color: ev.color ?? "",
        description: ev.description ?? "",
    }));
};

// 캘린더 일정 추가하기
export const createCalendarEvent = async (
    newEvent: CalendarEventCreate
): Promise<CalendarEvent> => {
    const url = `${BASE_URL}/api/calendar/`;

    const payload = {
        ...newEvent,
        start: newEvent.start.toISOString(),
        end: newEvent.end ? newEvent.end.toISOString() : null,
    };

    const res = await axios.post(url, payload, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        withCredentials: true,
        responseType: "json",
    });

    const ev = res.data as CalendarEvent;

    return {
        ...ev,
        id: String(ev.id),
        start: new Date(ev.start),
        end: ev.end ? new Date(ev.end) : null,
    };
};

// 캘린더 일정 수정하기 (PUT)
export const updateCalendarEvent = async (
    id: string,
    event: CalendarEventCreate
): Promise<CalendarEvent> => {
    const url = `${BASE_URL}/api/calendar/${id}/`;

    const payload = {
        ...event,
        start: event.start.toISOString(),
        end: event.end ? event.end.toISOString() : null,
    };

    const res = await axios.put(url, payload, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...authHeaders(),
        },
        withCredentials: true,
        responseType: "json",
    });

    const ev = res.data as CalendarEvent;
    return {
        ...ev,
        start: new Date(ev.start),
        end: ev.end ? new Date(ev.end) : null,
    };
};

// 캘린더 일정 삭제하기 (DELETE)
export const deleteCalendarEvent = async (
    id: string
): Promise<void> => {
    const url = `${BASE_URL}/api/calendar/${id}/`;
    await axios.delete(url, {
        headers: {
            Accept: "application/json",
            ...authHeaders(),
        },
        withCredentials: true,
        responseType: "json",
    });
};
