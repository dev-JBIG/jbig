import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import PostWrite, { extractKeyFromUrl } from "./PostWrite";
import { fetchPostDetail } from "../../API/req";
import { useUser } from "../Utils/UserContext";
import { useStaffAuth } from "../Utils/StaffAuthContext";
import { useAlert } from "../Utils/AlertContext";
import { Section } from "../Utils/interfaces";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ category: "10", id: "42" }),
}), { virtual: true });

jest.mock("@uiw/react-md-editor", () => {
    const React = require("react");
    return {
        __esModule: true,
        default: React.forwardRef(
            ({ value, onChange }: { value?: string; onChange?: (v?: string) => void }, _ref: unknown) => (
                <textarea
                    aria-label="본문 마크다운"
                    value={value ?? ""}
                    onChange={(e) => onChange?.(e.target.value)}
                />
            )
        ),
    commands: {
        bold: {},
        italic: {},
        strikethrough: {},
        hr: {},
        divider: {},
        title: {},
        link: {},
        quote: {},
        code: {},
        codeBlock: {},
        unorderedListCommand: {},
        orderedListCommand: {},
        checkedListCommand: {},
        table: {},
    },
    };
});

jest.mock("remark-math", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("rehype-katex", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("rehype-sanitize", () => ({
    __esModule: true,
    default: jest.fn(),
    defaultSchema: { attributes: {} },
}));

jest.mock("../../API/req", () => ({
    createPost: jest.fn(),
    modifyPost: jest.fn(),
    fetchPostDetail: jest.fn(),
    uploadAttachment: jest.fn(),
    fetchDraft: jest.fn(),
    saveDraft: jest.fn(),
    deleteDraft: jest.fn(),
    deleteUploadedFile: jest.fn(),
    createRecruitment: jest.fn(),
    updateRecruitment: jest.fn(),
}));

jest.mock("../Utils/UserContext", () => ({
    useUser: jest.fn(),
}));

jest.mock("../Utils/StaffAuthContext", () => ({
    useStaffAuth: jest.fn(),
}));

jest.mock("../Utils/AlertContext", () => ({
    useAlert: jest.fn(),
}));

const mockedFetchPostDetail = fetchPostDetail as jest.Mock;
const mockedUseUser = useUser as jest.Mock;
const mockedUseStaffAuth = useStaffAuth as jest.Mock;
const mockedUseAlert = useAlert as jest.Mock;

describe("extractKeyFromUrl", () => {
    test("CDN URL에서 uploads/ prefix를 손상시키지 않고 보존한다", () => {
        expect(
            extractKeyFromUrl("https://cdn.jbig.kr/uploads/2026/05/report.pdf", "fallback")
        ).toBe("uploads/2026/05/report.pdf");
    });

    test("S3 path-style 버킷 URL에서 버킷명 뒤의 객체 키를 추출한다", () => {
        expect(
            extractKeyFromUrl("https://s3.ap-northeast-2.amazonaws.com/jbig-bucket/uploads/2026/05/img.png", "fallback")
        ).toBe("uploads/2026/05/img.png");
    });

    test("게이트 다운로드(/api/...) URL은 경로를 훼손하지 않고 보존한다", () => {
        expect(
            extractKeyFromUrl("/api/posts/42/attachments/0/download/", "fallback")
        ).toBe("/api/posts/42/attachments/0/download/");
        expect(
            extractKeyFromUrl("https://api.jbig.kr/api/posts/42/attachments/0/download/", "fallback")
        ).toBe("https://api.jbig.kr/api/posts/42/attachments/0/download/");
    });

    test("explicitPath, media-key://, 쿼리 key/path 파라미터를 우선 추출한다", () => {
        expect(
            extractKeyFromUrl("https://cdn.jbig.kr/any", "fallback", "uploads/explicit/a.png")
        ).toBe("uploads/explicit/a.png");
        expect(
            extractKeyFromUrl("media-key://uploads/2026/b.png", "fallback")
        ).toBe("uploads/2026/b.png");
        expect(
            extractKeyFromUrl("https://api.jbig.kr/api/download/?key=uploads/2026/c.pdf", "fallback")
        ).toBe("uploads/2026/c.pdf");
    });
});

describe("PostWrite 수정 모드 상태 복원", () => {
    const boards: Section[] = [
        {
            category: "커뮤니티",
            boards: [
                {
                    id: 10,
                    name: "공모전게시판",
                    board_type: 1,
                    form_type: 0,
                    available_tags: ["정보", "팀원모집", "후기"],
                },
            ],
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseUser.mockReturnValue({
            accessToken: "access-token",
            user: { username: "홍길동", semester: "10", email: "hong@jbnu.ac.kr", is_staff: false },
            signOutLocal: jest.fn(),
        });
        mockedUseStaffAuth.mockReturnValue({ staffAuth: false });
        mockedUseAlert.mockReturnValue({ showAlert: jest.fn(), showConfirm: jest.fn() });
    });

    test("수정 모드 진입 시 제목, 본문, 실명 여부, 태그, 모집 설정을 복원한다", async () => {
        mockedFetchPostDetail.mockResolvedValue({
            post_data: {
                id: 42,
                title: "빅데이터 공모전 팀원 모집",
                content_md: "함께 나갈 분 구합니다.",
                is_anonymous: false,
                tag: "팀원모집",
                board: {
                    id: 10,
                    name: "공모전게시판",
                    board_type: 1,
                    form_type: 0,
                    available_tags: ["정보", "팀원모집", "후기"],
                },
                recruitment: {
                    recruitment_type: 2,
                    max_members: 4,
                    deadline: "2026-12-31T00:00:00Z",
                    required_skills: ["Python", "PyTorch"],
                    contact_info: "open.kakao.com/jbig",
                    show_applicants: true,
                },
                attachment_paths: [
                    {
                        name: "guide.pdf",
                        url: "https://cdn.jbig.kr/uploads/2026/guide.pdf",
                        size: 1024,
                    },
                ],
            },
        });

        render(<PostWrite boards={boards} />);

        await waitFor(() => {
            expect(screen.getByDisplayValue("빅데이터 공모전 팀원 모집")).toBeInTheDocument();
        });
        expect(screen.getByLabelText(/비회원에게도 실명이 표시돼요/)).toBeChecked();
        expect(screen.getByText(/PyTorch/)).toBeInTheDocument();
        expect(screen.getByDisplayValue("open.kakao.com/jbig")).toBeInTheDocument();
        expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    });
});
