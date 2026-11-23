import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Button } from '@primer/react';
import './EventModal.css';
import { CalendarEventCreate } from '../interfaces';
import { useAlert } from '../AlertContext';
import Dialog, { DialogHeader } from '../Dialog';

interface EventModalProps {
    mode: 'create' | 'edit';
    initial?: Partial<CalendarEventCreate> & { id?: string };
    onClose: () => void;
    onSave: (event: CalendarEventCreate, id?: string) => void; // id는 edit일 때만
}

const colorOptions = [
    '#0969da', '#cf222e', '#1a7f37', '#9a6700', '#8250df', '#1b7c83', '#59636e',
];

const getInitialStartTime = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // 오전 9시 기본값
    return now;
};

const EventModal: React.FC<EventModalProps> = ({ mode, initial, onClose, onSave }) => {
    const { showAlert } = useAlert();
    const [title, setTitle] = useState(initial?.title ?? '');
    const [start, setStart] = useState<Date | null>(initial?.start ?? getInitialStartTime());
    const [endManuallySet, setEndManuallySet] = useState(Boolean(initial?.end));
    const [end, setEnd] = useState<Date | null>(initial?.end ?? null);
    const [description, setDescription] = useState(initial?.description ?? '');
    const [allDay, setAllDay] = useState(initial?.allDay ?? false);
    const [color, setColor] = useState(initial?.color ?? colorOptions[0]);

    useEffect(() => {
        if (start instanceof Date && !endManuallySet) {
            if (!end || (end instanceof Date && end <= start)) {
                setEnd(new Date(start.getTime() + 60 * 60 * 1000));
            }
        }
    }, [start, end, endManuallySet]);

    const handleAllDayChange = (isChecked: boolean) => {
        setAllDay(isChecked);

        if (isChecked) {
            if (start instanceof Date) {
                setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate()));
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!start) {
            showAlert({ message: "시작 시각을 입력해주세요.", type: 'warning' });
            return;
        }
        if (!title.trim()) {
            showAlert({ message: "일정 제목을 입력해주세요.", type: 'warning' });
            return;
        }
        if (!allDay && !end) {
            showAlert({ message: "종료 시각을 입력해주세요.", type: 'warning' });
            return;
        }
        if (!allDay && end && end <= start) {
            showAlert({ message: "종료 시각은 시작 시각보다 이후여야 합니다.", type: 'warning' });
            return;
        }
        if (description.trim().length < 1) {
            showAlert({ message: "설명란이 비어있습니다.", type: 'warning' });
            return;
        }

        const newEvent: CalendarEventCreate = { title: title.trim(), start, end, allDay, color, description: description.trim() };
        onSave(newEvent, initial?.id);
    };

    return (
        <Dialog labelledBy="event-modal-heading" onClose={onClose} panelClassName="event-modal-card">
            <DialogHeader onClose={onClose} className="event-modal-header">
                <h2 id="event-modal-heading">{mode === 'edit' ? '일정 수정' : '새 일정 추가'}</h2>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="event-modal-form">
                <div className="event-modal-field">
                    <label htmlFor="event-title">일정 제목</label>
                    <input
                        id="event-title"
                        type="text"
                        className="event-modal-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="일정 제목을 입력하세요"
                        required
                    />
                </div>

                <div className="event-modal-field">
                    <div className="event-modal-label-row">
                        <label htmlFor="event-start-picker">시작</label>
                        <label className="event-all-day-check" htmlFor="all-day">
                            <input
                                id="all-day"
                                type="checkbox"
                                checked={allDay}
                                onChange={(e) => handleAllDayChange(e.target.checked)}
                            />
                            <span>하루 종일</span>
                        </label>
                    </div>
                    <DatePicker
                        id="event-start-picker"
                        selected={start}
                        onChange={(date) => setStart(date)}
                        dateFormat={allDay ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm"}
                        showTimeSelect={!allDay}
                        timeFormat="HH:mm"
                        timeIntervals={30}
                        placeholderText="시작 날짜/시간 선택"
                        className="event-modal-input"
                    />
                </div>

                {!allDay && (
                    <div className="event-modal-field">
                        <label htmlFor="event-end-picker">종료</label>
                        <DatePicker
                            id="event-end-picker"
                            selected={end}
                            onChange={(date) => { setEnd(date); setEndManuallySet(true); }}
                            dateFormat="yyyy-MM-dd HH:mm"
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={30}
                            placeholderText="종료 날짜/시간 선택"
                            minDate={start || undefined}
                            className="event-modal-input"
                        />
                    </div>
                )}

                <div className="event-modal-field">
                    <div className="event-modal-label-row">
                        <label htmlFor="event-description">설명</label>
                        <span className="event-modal-counter">{description.length} / 20</span>
                    </div>
                    <textarea
                        id="event-description"
                        className="event-modal-textarea"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={20}
                        rows={2}
                        placeholder="간단한 설명을 입력하세요"
                    />
                </div>

                <div className="event-modal-field">
                    <label>색상</label>
                    <div className="event-color-picker">
                        {colorOptions.map((c) => (
                            <button
                                key={c}
                                type="button"
                                className={`event-color-swatch ${color === c ? 'selected' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setColor(c)}
                                aria-label={`색상 ${c}`}
                                aria-pressed={color === c}
                            />
                        ))}
                    </div>
                </div>

                <div className="event-modal-actions">
                    <Button type="button" variant="default" onClick={onClose}>취소</Button>
                    <Button type="submit" variant="primary">저장</Button>
                </div>
            </form>
        </Dialog>
    );
};

export default EventModal;
