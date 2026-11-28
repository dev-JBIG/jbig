/**
 * API 모음. 분야별 파일(authApi, postsApi, ...)을 한곳에서 다시 내보낸다.
 * 화면과 테스트는 이 파일에서 가져다 쓰므로 함수 위치를 옮겨도 가져오는 경로는 그대로다.
 */
export { signout } from "./auth";
export type { PhotoPostItem } from "./apiShared";
export * from "./authApi";
export * from "./boardsApi";
export * from "./postsApi";
export * from "./siteApi";
export * from "./uploadsApi";
export * from "./adminApi";
export * from "./commentsApi";
export * from "./usersApi";
export * from "./calendarApi";
export * from "./notificationsApi";
export * from "./draftsApi";
export * from "./popupsApi";
export * from "./recruitmentsApi";
export * from "./notionApi";
