import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@primer/react";
import { ChevronLeft, ChevronRight, Clock, FileText } from "lucide-react";
import "./Calendar.css";
import { CalendarEvent } from "../interfaces";
import { deleteCalendarEvent, fetchCalendarEvents } from "../../../API/req";
import { useUser } from "../UserContext";
import { useAlert } from "../AlertContext";
import Dialog, { DialogHeader } from "../Dialog";

interface CalendarProps {
    staffAuth: boolean;
    compact?: boolean;
    embedded?: boolean;
    toolbarAction?: React.ReactNode;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n: number) => String(n).padStart(2, "0");

const toDayKey = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatDateTime = (date: Date | null | undefined, allDay?: boolean): string => {
    if (!date || Number.isNaN(date.getTime())) return "";
    const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    if (allDay) return datePart;
    return `${datePart} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const formatEventTimeRange = (event: CalendarEvent): string => {
    const start = formatDateTime(event.start, event.allDay);
    if (event.allDay) {
        return start ? `${start} (하루 종일)` : "하루 종일";
    }
    const end = formatDateTime(event.end, false);
    if (start && end) return `${start} ~ ${end}`;
    return start || end || "시간 미정";
};

const getEventDayKeysInRange = (
    event: CalendarEvent,
    rangeStart: Date,
    rangeEnd: Date
): string[] => {
    if (!event.start || Number.isNaN(event.start.getTime())) return [];
    const startDay = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
    let endDay = new Date(startDay);

    if (event.end && !Number.isNaN(event.end.getTime()) && event.end > event.start) {
        const rawEnd = new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate());
        const isExactMidnight =
            event.end.getHours() === 0 &&
            event.end.getMinutes() === 0 &&
            event.end.getSeconds() === 0;
        if (event.allDay && isExactMidnight && rawEnd > startDay) {
            rawEnd.setDate(rawEnd.getDate() - 1);
        }
        if (rawEnd >= startDay) {
            endDay = rawEnd;
        }
    }

    const clampedStart = startDay > rangeStart ? startDay : rangeStart;
    const clampedEnd = endDay < rangeEnd ? endDay : rangeEnd;
    if (clampedStart > clampedEnd) return [];

    const keys: string[] = [];
    const cursor = new Date(clampedStart);
    while (cursor <= clampedEnd) {
        keys.push(toDayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
};

const buildMonthGrid = (year: number, month: number): Date[] => {
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const startOffset = firstOfMonth.getDay();
    const totalCells = Math.ceil((startOffset + lastOfMonth.getDate()) / 7) * 7;

    const cells: Date[] = [];
    for (let i = 0; i < totalCells; i++) {
        cells.push(new Date(year, month, 1 - startOffset + i));
    }
    return cells;
};

const Calendar: React.FC<CalendarProps> = ({ staffAuth, compact = false, embedded = false, toolbarAction }) => {
    const { signOutLocal, accessToken } = useUser();
    const { showAlert, showConfirm } = useAlert();
    const navigate = useNavigate();

    const today = useMemo(() => new Date(), []);
    const todayKey = useMemo(() => toDayKey(today), [today]);

    const [viewDate, setViewDate] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [expandedDay, setExpandedDay] = useState<{ key: string; label: string; events: CalendarEvent[] } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const savedOverridesRef = useRef<Map<string, CalendarEvent>>(new Map());
    const deletedIdsRef = useRef<Set<string>>(new Set());

    const closeExpandedDay = useCallback(() => setExpandedDay(null), []);
    const closeSelectedEvent = useCallback(() => setSelectedEvent(null), []);


    useEffect(() => {
        let cancelled = false;

        const loadEvents = async () => {
            setLoading(true);
            try {
                const fetched = await fetchCalendarEvents();
                if (!cancelled) {
                    const normalized: CalendarEvent[] = (fetched ?? []).map((ev: any) => ({
                        ...ev,
                        id: String(ev.id),
                        start: ev.start instanceof Date ? ev.start : new Date(ev.start),
                        end: ev.end ? (ev.end instanceof Date ? ev.end : new Date(ev.end)) : null,
                    }));

                    const merged = new Map<string, CalendarEvent>();
                    normalized.forEach((ev) => {
                        if (!deletedIdsRef.current.has(ev.id)) {
                            merged.set(ev.id, ev);
                        }
                    });
                    savedOverridesRef.current.forEach((ev, id) => {
                        if (!deletedIdsRef.current.has(id)) {
                            merged.set(id, ev);
                        }
                    });
                    setEvents(Array.from(merged.values()));
                }
            } catch {
                if (!cancelled) {
                    setEvents(Array.from(savedOverridesRef.current.values()));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadEvents();
        return () => {
            cancelled = true;
        };
    }, []);

    // Home.tsx의 EventModal 저장 결과 반영
    useEffect(() => {
        const handleEventSaved = (e: Event) => {
            const custom = e as CustomEvent<{ mode: "create" | "edit"; event: CalendarEvent }>;
            const detail = custom.detail;
            if (!detail?.event) return;
            const saved: CalendarEvent = {
                ...detail.event,
                id: String(detail.event.id),
                start: detail.event.start instanceof Date ? detail.event.start : new Date(detail.event.start),
                end: detail.event.end
                    ? (detail.event.end instanceof Date ? detail.event.end : new Date(detail.event.end))
                    : null,
            };

            deletedIdsRef.current.delete(saved.id);
            savedOverridesRef.current.set(saved.id, saved);

            setEvents(prev => {
                if (detail.mode === "edit") {
                    const exists = prev.some(item => item.id === saved.id);
                    return exists
                        ? prev.map(item => (item.id === saved.id ? saved : item))
                        : [...prev, saved];
                }
                return [...prev.filter(item => item.id !== saved.id), saved];
            });
        };

        window.addEventListener("CALENDAR_EVENT_SAVED", handleEventSaved);
        return () => window.removeEventListener("CALENDAR_EVENT_SAVED", handleEventSaved);
    }, []);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const gridDays = useMemo(() => buildMonthGrid(year, month), [year, month]);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        if (gridDays.length === 0) return map;
        const rangeStart = gridDays[0];
        const rangeEnd = gridDays[gridDays.length - 1];
        events.forEach(ev => {
            getEventDayKeysInRange(ev, rangeStart, rangeEnd).forEach(dayKey => {
                const list = map.get(dayKey);
                if (list) list.push(ev);
                else map.set(dayKey, [ev]);
            });
        });
        map.forEach(list => {
            list.sort((a, b) => a.start.getTime() - b.start.getTime());
        });
        return map;
    }, [events, gridDays]);

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));
    const handleToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

    const handleEditEvent = useCallback((ev: CalendarEvent) => {
        setSelectedEvent(null);
        setExpandedDay(null);
        window.dispatchEvent(new CustomEvent("OPEN_EVENT_MODAL", {
            detail: {
                mode: "edit",
                event: {
                    id: ev.id,
                    title: ev.title,
                    description: ev.description || "",
                    color: ev.color || "#0969da",
                    allDay: !!ev.allDay,
                    start: ev.start,
                    end: ev.end,
                },
            },
        }));
    }, []);

    const handleDeleteEvent = useCallback(async (ev: CalendarEvent) => {
        if (!accessToken) {
            showAlert({
                message: "로그인이 필요합니다.",
                type: "warning",
                onClose: () => {
                    signOutLocal();
                    navigate("/signin");
                },
            });
            return;
        }

        const confirmed = await showConfirm({
            title: "일정 삭제",
            message: `'${ev.title}' 일정을 삭제하시겠습니까?`,
            type: "danger",
            confirmText: "삭제",
            cancelText: "취소",
        });
        if (!confirmed) return;

        setDeleting(true);
        try {
            await deleteCalendarEvent(ev.id, accessToken);
            deletedIdsRef.current.add(ev.id);
            savedOverridesRef.current.delete(ev.id);
            setEvents(prev => prev.filter(item => item.id !== ev.id));
            setSelectedEvent(null);
            setExpandedDay(prev => {
                if (!prev) return null;
                const remaining = prev.events.filter(item => item.id !== ev.id);
                return remaining.length > 0 ? { ...prev, events: remaining } : null;
            });
        } catch {
            showAlert({ message: "이벤트 삭제 중 오류가 발생했습니다.", type: "error" });
        } finally {
            setDeleting(false);
        }
    }, [accessToken, navigate, showAlert, showConfirm, signOutLocal]);

    const maxVisible = compact ? 2 : 3;

    return (
        <div
            className={`primer-calendar${compact ? " primer-calendar-compact" : ""}${embedded ? " primer-calendar-embedded" : ""}`}
            aria-label="동아리 일정 캘린더"
        >
            <div className="primer-calendar-toolbar">
                <h4 className="primer-calendar-month" aria-live="polite">
                    {year}년 {month + 1}월
                </h4>
                <div className="primer-calendar-controls">
                    {toolbarAction}
                    <button
                        type="button"
                        className="primer-calendar-nav-btn"
                        onClick={handleToday}
                    >
                        오늘
                    </button>
                    <div className="primer-calendar-arrows">
                        <button
                            type="button"
                            className="primer-calendar-icon-btn"
                            onClick={handlePrevMonth}
                            aria-label="이전 달"
                        >
                            <ChevronLeft size={15} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="primer-calendar-icon-btn"
                            onClick={handleNextMonth}
                            aria-label="다음 달"
                        >
                            <ChevronRight size={15} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="primer-calendar-weekdays" role="row">
                {WEEKDAYS.map((day, idx) => (
                    <div
                        key={day}
                        role="columnheader"
                        className={`primer-calendar-weekday${idx === 0 ? " is-sun" : idx === 6 ? " is-sat" : ""}`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            <div className="primer-calendar-grid" role="grid" aria-busy={loading}>
                {gridDays.map((day) => {
                    const key = toDayKey(day);
                    const isCurrentMonth = day.getMonth() === month;
                    const isToday = key === todayKey;
                    const dayOfWeek = day.getDay();
                    const dayEvents = eventsByDay.get(key) || [];
                    const visibleEvents = dayEvents.slice(0, maxVisible);
                    const hiddenCount = dayEvents.length - visibleEvents.length;

                    return (
                        <div
                            key={key}
                            role="gridcell"
                            className={[
                                "primer-calendar-cell",
                                !isCurrentMonth ? "is-outside" : "",
                                isToday ? "is-today" : "",
                            ].filter(Boolean).join(" ")}
                        >
                            <div className="primer-calendar-day-header">
                                <span
                                    className={[
                                        "primer-calendar-day-num",
                                        isToday ? "is-today-badge" : "",
                                        dayOfWeek === 0 ? "is-sun" : dayOfWeek === 6 ? "is-sat" : "",
                                    ].filter(Boolean).join(" ")}
                                >
                                    {day.getDate()}
                                </span>
                            </div>

                            <div className="primer-calendar-events">
                                {visibleEvents.map(ev => {
                                    const accent = ev.color || "#0969da";
                                    return (
                                        <button
                                            key={`${key}-${ev.id}`}
                                            type="button"
                                            className="primer-calendar-event"
                                            style={{ "--event-color": accent } as React.CSSProperties}
                                            title={`${ev.title}${ev.description ? ` — ${ev.description}` : ""}`}
                                            onClick={() => setSelectedEvent(ev)}
                                        >
                                            <span className="primer-calendar-event-dot" aria-hidden="true" />
                                            <span className="primer-calendar-event-title">{ev.title}</span>
                                        </button>
                                    );
                                })}
                                {hiddenCount > 0 && (
                                    <button
                                        type="button"
                                        className="primer-calendar-more-btn"
                                        onClick={() => setExpandedDay({
                                            key,
                                            label: `${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일`,
                                            events: dayEvents,
                                        })}
                                    >
                                        +{hiddenCount}개 더보기
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 하루 전체 일정 모달 */}
            {expandedDay && (
                <Dialog labelledBy="calendar-day-modal-title" onClose={closeExpandedDay} panelClassName="primer-calendar-modal">
                    <DialogHeader onClose={closeExpandedDay} className="primer-calendar-modal-header">
                        <h3 id="calendar-day-modal-title">{expandedDay.label} 일정</h3>
                    </DialogHeader>
                    <div className="primer-calendar-day-list">
                        {expandedDay.events.map(ev => (
                            <button
                                key={ev.id}
                                type="button"
                                className="primer-calendar-day-list-item"
                                onClick={() => {
                                    setExpandedDay(null);
                                    setSelectedEvent(ev);
                                }}
                            >
                                <span
                                    className="primer-calendar-color-swatch"
                                    style={{ backgroundColor: ev.color || "#0969da" }}
                                    aria-hidden="true"
                                />
                                <div className="primer-calendar-day-list-text">
                                    <strong>{ev.title}</strong>
                                    <span>{formatEventTimeRange(ev)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </Dialog>
            )}

            {/* 일정 상세 모달 */}
            {selectedEvent && (
                <Dialog labelledBy="calendar-event-modal-title" onClose={closeSelectedEvent} panelClassName="primer-calendar-modal">
                    <DialogHeader onClose={closeSelectedEvent} className="primer-calendar-modal-header">
                        <div className="primer-calendar-modal-title-wrap">
                            <span
                                className="primer-calendar-color-swatch"
                                style={{ backgroundColor: selectedEvent.color || "#0969da" }}
                                aria-hidden="true"
                            />
                            <h3 id="calendar-event-modal-title">{selectedEvent.title}</h3>
                        </div>
                    </DialogHeader>

                    <div className="primer-calendar-modal-body">
                        <div className="primer-calendar-detail-row">
                            <Clock size={15} aria-hidden="true" />
                            <div>
                                <span className="primer-calendar-detail-label">시간</span>
                                <p>{formatEventTimeRange(selectedEvent)}</p>
                            </div>
                        </div>
                        <div className="primer-calendar-detail-row">
                            <FileText size={15} aria-hidden="true" />
                            <div>
                                <span className="primer-calendar-detail-label">설명</span>
                                <p>{selectedEvent.description || "설명이 없습니다."}</p>
                            </div>
                        </div>
                    </div>

                    <div className="primer-calendar-modal-footer">
                        {staffAuth ? (
                            <>
                                <Button
                                    type="button"
                                    variant="danger"
                                    size="small"
                                    disabled={deleting}
                                    onClick={() => { void handleDeleteEvent(selectedEvent); }}
                                >
                                    {deleting ? "삭제 중..." : "삭제"}
                                </Button>
                                <div className="primer-calendar-modal-footer-right">
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="small"
                                        onClick={() => setSelectedEvent(null)}
                                    >
                                        취소
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="small"
                                        onClick={() => handleEditEvent(selectedEvent)}
                                    >
                                        수정
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <Button
                                type="button"
                                variant="primary"
                                size="small"
                                onClick={() => setSelectedEvent(null)}
                            >
                                확인
                            </Button>
                        )}
                    </div>
                </Dialog>
            )}
        </div>
    );
};

export default Calendar;
