import { AxiosError, AxiosAdapter } from "axios";
import client from "./client";
import { authTransport, getAuthState, readAuth, setAuth, signOutLocal, subscribeAuth } from "./auth";
import { createComment, createPost, uploadAttachment, fetchApplications, fetchBoardPosts, fetchPostDetail, fetchQuizUrl, signin } from "./req";

jest.mock("../Utils/imageOptimize", () => ({ optimizeImageForUpload: async (f: File) => f }));

const user = { username: "회원", semester: "3", email: "member@jbnu.ac.kr", is_staff: false };
const token = (seconds: number) => `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + seconds }))}.signature`;
const ok = (config: any, data: any) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const reject = (config: any, status = 401, data: any = { detail: 'expired' }) => Promise.reject(
    new AxiosError('request failed', 'ERR_BAD_REQUEST', config, undefined, { config, data, status, statusText: 'Error', headers: {} })
);
let adapter: jest.Mock<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>;
let refreshAdapter: jest.Mock<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>;
let freshAccess: string;

beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'session-id' } });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _options: any, callback: () => unknown) => callback() } });
    localStorage.clear();
    setAuth(user, token(-60), 'old-refresh');
    freshAccess = token(3600);
    adapter = jest.fn();
    refreshAdapter = jest.fn(async config => ok(config, { ...user, isSuccess: true, access: freshAccess, refresh: 'new-refresh' }));
    client.defaults.adapter = adapter;
    authTransport.defaults.adapter = refreshAdapter;
});
afterEach(() => { signOutLocal(); jest.restoreAllMocks(); });

test('recruitment with no applicants returns an empty array', async () => {
    adapter.mockImplementation(async config => ok(config, {
        count: 0, next: null, previous: null, results: [],
    }));

    await expect(fetchApplications(1)).resolves.toEqual([]);
});

test('fetches every applicant page from the recruitment endpoint', async () => {
    const pending = { id: 1, status: 1 };
    const accepted = { id: 2, status: 2 };
    adapter.mockImplementationOnce(async config => ok(config, {
        count: 2, next: 'https://pagination.example/?page=2', previous: null, results: [pending],
    }));
    adapter.mockImplementationOnce(async config => ok(config, {
        count: 2, next: null, previous: 'https://pagination.example/', results: [accepted],
    }));

    await expect(fetchApplications(1)).resolves.toEqual([pending, accepted]);
    expect(adapter).toHaveBeenCalledTimes(2);
    const [first, second] = adapter.mock.calls.map(([config]) => config);
    expect(second.url).toBe(first.url);
    expect(second.params).toMatchObject({ page: 2 });
});

test('fetches an unpaginated applicant response', async () => {
    const rejected = { id: 3, status: 3 };
    adapter.mockImplementation(async config => ok(config, [rejected]));

    await expect(fetchApplications(1)).resolves.toEqual([rejected]);
    expect(adapter).toHaveBeenCalledTimes(1);
});

test('rejects a response without an applicant list', async () => {
    adapter.mockImplementation(async config => ok(config, '<html></html>'));

    await expect(fetchApplications(1)).rejects.toThrow('지원자 목록 응답 형식이 올바르지 않습니다.');
});

test.each(['ACCOUNT_NOT_VERIFIED', 'INVALID_CREDENTIALS', 'ACCOUNT_INACTIVE'])(
    'signin preserves %s without refreshing an existing session', async errorCode => {
        adapter.mockImplementation(config => reject(config, 401, { errorCode, message: '로그인 실패' }));
        expect(await signin(user.email, 'Password!1x')).toMatchObject({ status: 401, errorCode, message: '로그인 실패' });
        expect(refreshAdapter).not.toHaveBeenCalled();
        expect(readAuth().session?.refreshToken).toBe('old-refresh');
    }
);

test('post detail refreshes, retries and publishes fresh state to UI subscribers', async () => {
    const states: string[] = [];
    const unsubscribe = subscribeAuth(() => { states.push(getAuthState().session?.accessToken || ''); });
    adapter.mockImplementationOnce(config => reject(config));
    adapter.mockImplementationOnce(async config => ok(config, { id: 1, title: '본문' }));
    expect(await fetchPostDetail(1)).toMatchObject({ id: 1 });
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe(`Bearer ${freshAccess}`);
    expect(readAuth().session?.refreshToken).toBe('new-refresh');
    expect(states).toContain(freshAccess);
    unsubscribe();
});

test('post creation also uses the shared refresh path', async () => {
    adapter.mockImplementationOnce(config => reject(config));
    adapter.mockImplementationOnce(async config => ok(config, { id: 2 }));
    expect(await createPost(1, { title: '제목', content_md: '본문', attachment_paths: [] })).toEqual({ id: 2 });
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[1][0].data).toBe(adapter.mock.calls[0][0].data);
});

test('403 stays a permission failure and does not expire the session', async () => {
    adapter.mockImplementation(config => reject(config, 403));
    expect(await fetchPostDetail(1)).toEqual({ unauthorized: true });
    expect(refreshAdapter).not.toHaveBeenCalled();
    expect(readAuth().session).not.toBeNull();
});

test('expired refresh clears the session and produces a login result, not forbidden', async () => {
    adapter.mockImplementation(config => reject(config));
    refreshAdapter.mockImplementation(config => reject(config));
    expect(await fetchPostDetail(1)).toEqual({ loginRequired: true });
    expect(readAuth()).toEqual({ session: null, expired: true });
});

test('server failure preserves the session and can be retried', async () => {
    adapter.mockImplementation(config => reject(config));
    refreshAdapter.mockImplementationOnce(config => reject(config, 503));
    await expect(fetchPostDetail(1)).rejects.toMatchObject({ response: { status: 503 } });
    expect(readAuth().session?.refreshToken).toBe('old-refresh');
    expect(getAuthState().status).toBe('error');
    adapter.mockImplementationOnce(config => reject(config));
    adapter.mockImplementationOnce(async config => ok(config, { id: 1 }));
    expect(await fetchPostDetail(1)).toMatchObject({ id: 1 });
});

test('quiz authentication failure preserves the central session-expired notice', async () => {
    adapter.mockImplementation(config => reject(config));
    refreshAdapter.mockImplementation(config => reject(config));
    await expect(fetchQuizUrl()).rejects.toMatchObject({ response: { status: 401 } });
    expect(readAuth()).toEqual({ session: null, expired: true });
});

test('multiple 401s share one refresh', async () => {
    adapter.mockImplementation(config => config.headers.Authorization === `Bearer ${freshAccess}`
        ? Promise.resolve(ok(config, { id: 1 })) : reject(config));
    await Promise.all([fetchPostDetail(1), fetchPostDetail(2), fetchPostDetail(3)]);
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
});

test('a second 401 terminates the session without a retry loop', async () => {
    adapter.mockImplementation(config => reject(config));
    expect(await fetchPostDetail(1)).toEqual({ loginRequired: true });
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(readAuth().session).toBeNull();
});

test('public and external requests do not use the auth refresh interceptor', async () => {
    adapter.mockImplementation(config => reject(config));
    await expect(client.get('/api/settings/')).rejects.toBeDefined();
    await expect(client.put('https://storage.example/upload', 'file')).rejects.toBeDefined();
    expect(refreshAdapter).not.toHaveBeenCalled();
    expect(adapter.mock.calls.every(([config]) => !config.headers.Authorization)).toBe(true);
});

test('logout while a request is in flight cannot log out a subsequent login', async () => {
    let rejectRequest!: () => void;
    adapter.mockImplementation(config => new Promise((_resolve, rejectPromise) => {
        rejectRequest = () => rejectPromise(new AxiosError('expired', '', config, undefined,
            { config, data: {}, status: 401, statusText: '', headers: {} }));
    }));
    const request = fetchPostDetail(1);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    signOutLocal();
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => 'new-session-id' });
    setAuth({ ...user, username: '다른 회원' }, freshAccess, 'different-refresh');
    rejectRequest();
    await expect(request).rejects.toThrow('로그인 상태가 변경');
    expect(readAuth().session?.user.username).toBe('다른 회원');
    expect(refreshAdapter).not.toHaveBeenCalled();
});

test('fetchBoardPosts calls /api/posts/all/ with trailing slash when boardId is omitted', async () => {
    adapter.mockImplementation(async (config) =>
        ok(config, { posts: [], total_pages: 1, post_permission: false })
    );

    await fetchBoardPosts(undefined, 10, 1, false);
    await fetchBoardPosts(undefined, 10, 1, true);

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(new URL(adapter.mock.calls[0][0].url ?? '').pathname).toBe('/api/posts/all/');
    expect(new URL(adapter.mock.calls[1][0].url ?? '').pathname).toBe('/api/posts/all/');
});


test('authHeaders: 로그인 세션이 있을 때만 인증 헤더를 붙인다', () => {
    const { authHeaders, currentAccessToken } = jest.requireActual('./client');
    signOutLocal();
    expect(currentAccessToken()).toBeNull();
    expect(authHeaders()).toEqual({});
    setAuth({ username: 'u', semester: '1', email: 'u@jbnu.ac.kr', is_staff: false }, 'access-1', 'refresh-1');
    expect(authHeaders()).toEqual({ Authorization: 'Bearer access-1' });
    signOutLocal();
    expect(authHeaders()).toEqual({});
});

test('createComment keeps the server anonymity flag (defaults to anonymous)', async () => {
    const base = { id: 9, user_id: 'u', author_semester: 1, author: 'u', content: 'c', created_at: '2026-11-28T10:00:00', is_owner: true, is_deleted: false };
    adapter.mockImplementationOnce(async config => ok(config, { ...base, parent: null, is_anonymous: false }));
    expect((await createComment(1, { content: 'c', parent: null, is_anonymous: false })).is_anonymous).toBe(false);
    adapter.mockImplementationOnce(async config => ok(config, { ...base, parent: 3 }));
    expect((await createComment(1, { content: 'c', parent: 3 })).is_anonymous).toBe(true);
});

test('uploadAttachment stops when the account changes during the upload', async () => {
    let crypto = 0;
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => `session-${++crypto}` } });
    setAuth(user, token(3600), 'refresh-a');
    adapter.mockImplementation(async config => {
        const url = String(config.url);
        if (url.includes('generate-upload-url')) return ok(config, { upload_url: 'https://storage.example/put', file_key: 'uploads/k.png', url: 'https://cdn/k.png' });
        if (url.startsWith('https://storage.example')) {
            // 스토리지에 올리는 동안 다른 탭에서 다른 계정으로 로그인
            setAuth({ ...user, username: '다른 회원' }, token(3600), 'refresh-b');
            return ok(config, {});
        }
        return ok(config, {});
    });
    const res = await uploadAttachment(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(res.path).toBe('');
    expect(res.message).toMatch('계정이 바뀌어');
    expect(adapter.mock.calls.some(([c]) => String(c.url).includes('confirm-upload'))).toBe(false);
});
