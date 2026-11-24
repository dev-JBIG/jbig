/** 대문 "소식" 칸에 보여줄 학회 홍보, 새 기능 안내. 나중에 관리자 화면에서 고칠 수 있게 옮길 수 있다. */
export interface HomePromo {
    id: string;
    kicker: string;
    title: string;
    description: string;
    to: string;
}

/** 로그인한 사람은 자기 프로필, 아니면 로그인 화면 */
export const PROFILE_TARGET = "@me";

export const HOME_PROMOS: HomePromo[] = [
    {
        id: "resume",
        kicker: "새 기능",
        title: "프로필에서 이력서를 만들 수 있어요",
        description: "학회 활동과 프로젝트를 정리해 PDF로 저장하세요.",
        to: PROFILE_TARGET,
    },
    {
        id: "arena",
        kicker: "대회",
        title: "JBIG 아레나에서 예측 대회가 열려 있어요",
        description: "데이터를 받아 모델을 제출하고 순위를 확인하세요.",
        to: "/arena",
    },
    {
        id: "event",
        kicker: "행사",
        title: "이번 학기 세미나와 행사 안내",
        description: "이벤트 안내 게시판에서 일정과 신청 방법을 확인하세요.",
        to: "/board/3",
    },
];
