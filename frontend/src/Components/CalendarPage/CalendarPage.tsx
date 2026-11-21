import React from "react";
import "./CalendarPage.css";

const CalendarPage: React.FC = () => {
  return (
    <div className="calendar-page-wrap">
      <div className="calendar-page-card">
        <iframe
          src="https://calendar.google.com/calendar/embed?src=f8f636e48d4d33a2e191f9967e470341cb18aa5c57f12d015a660a751fddef10%40group.calendar.google.com&ctz=Asia%2FSeoul"
          className="calendar-page-frame"
          title="대회 캘린더"
        />
      </div>
    </div>
  );
};

export default CalendarPage;
