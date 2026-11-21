import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Home from './Home';
import { ColorModeProvider } from '../Utils/ThemeContext';
import { AlertProvider } from '../Utils/AlertContext';

const mockNavigate = jest.fn();
let mockPathname = '/';

jest.mock('react-router-dom', () => ({
    Routes: ({ children }: any) => <div data-testid="routes">{children}</div>,
    Route: ({ path, element }: any) => (path === '/' && mockPathname === '/' ? element : null),
    Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname, search: '' }),
}), { virtual: true });

jest.mock('../Utils/UserContext', () => ({
    useUser: () => ({
        user: { username: '홍길동', semester: 7, email: 'hong@jbnu.ac.kr', is_staff: false },
        signOutLocal: jest.fn(),
        authReady: true,
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
    }),
}));

jest.mock('../Utils/StaffAuthContext', () => ({
    useStaffAuth: () => ({ staffAuth: false }),
}));

jest.mock('../../API/req', () => ({
    getBoards: jest.fn().mockResolvedValue({
        categories: [
            {
                category: '커뮤니티',
                boards: [{ id: 1, name: '자유게시판', read_permission: 'all' }],
            },
        ],
        total_post_count: 12,
    }),
    fetchQuizUrl: jest.fn().mockResolvedValue(''),
    fetchUnreadNotificationCount: jest.fn().mockResolvedValue(0),
    fetchNotifications: jest.fn().mockResolvedValue([]),
    markNotificationRead: jest.fn().mockResolvedValue(undefined),
    signout: jest.fn().mockResolvedValue(undefined),
    createCalendarEvent: jest.fn(),
    updateCalendarEvent: jest.fn(),
}));

jest.mock('./JbigInfo', () => () => <div data-testid="jbig-info" />);
jest.mock('../Posts/PostList', () => () => <div data-testid="post-list" />);
jest.mock('./PhotoAlbumSlider', () => () => <div data-testid="photo-slider" />);
jest.mock('../Utils/PopupSlider', () => () => null);
jest.mock('../Utils/Calendar/Calendar', () => () => null);
jest.mock('../Utils/Calendar/EventModal', () => () => null);
jest.mock('../Utils/LoginModal', () => () => null);

beforeEach(() => {
    mockNavigate.mockReset();
    mockPathname = '/';
    localStorage.clear();
    sessionStorage.clear();
});

const renderHome = () =>
    render(
        <ColorModeProvider>
            <AlertProvider>
                <Home />
            </AlertProvider>
        </ColorModeProvider>
    );

test('renders Primer global header search, focuses on slash key, and navigates on submit', async () => {
    renderHome();
    const searchInput = await screen.findByLabelText('전체 게시글 검색');
    expect(searchInput).toBeInTheDocument();

    fireEvent.keyDown(document, { key: '/' });
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, { target: { value: '딥러닝 스터디' } });
    fireEvent.submit(searchInput.closest('form')!);

    expect(mockNavigate).toHaveBeenCalledWith(
        '/search/all?q=%EB%94%A5%EB%9F%AC%EB%8B%9D%20%EC%8A%A4%ED%84%B0%EB%94%94&page_size=10'
    );
});

test('shows banner only on the home route and hides it on board routes', async () => {
    const { unmount } = renderHome();
    expect(await screen.findByRole('button', { name: '홈으로 이동' })).toBeInTheDocument();
    unmount();

    mockPathname = '/board/1';
    renderHome();
    await screen.findByLabelText('전체 게시글 검색');
    expect(screen.queryByRole('button', { name: '홈으로 이동' })).not.toBeInTheDocument();
});

test('toggles Primer color mode and closes user dropdown on Escape', async () => {
    renderHome();
    const themeBtn = await screen.findByRole('button', { name: /모드로 전환/ });
    const initialMode = document.documentElement.getAttribute('data-color-mode');
    fireEvent.click(themeBtn);
    expect(document.documentElement.getAttribute('data-color-mode')).not.toBe(initialMode);

    const userMenuBtn = screen.getByRole('button', { name: /홍길동/ });
    fireEvent.click(userMenuBtn);
    const profileItem = screen.getByRole('button', { name: '내 정보' });
    expect(profileItem).toBeInTheDocument();

    profileItem.focus();
    expect(profileItem).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: '내 정보' })).not.toBeInTheDocument();
    expect(userMenuBtn).toHaveFocus();
});
