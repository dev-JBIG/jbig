import axios, { InternalAxiosRequestConfig } from "axios";
import { BASE_URL, ensureSession, expireSession, readAuth, SessionChangedError } from "./auth";

type AuthRequest = InternalAxiosRequestConfig & { sessionId?: string; retried?: boolean };
const client = axios.create();
const apiRoot = `${BASE_URL.replace(/\/$/, "")}/api/`;

function isApiRequest(config: InternalAxiosRequestConfig) {
    try {
        const uri = axios.getUri({ baseURL: config.baseURL, url: config.url });
        return new URL(uri, BASE_URL).href.startsWith(apiRoot);
    } catch {
        return false;
    }
}

function stripAuthorizationHeader(headers: InternalAxiosRequestConfig["headers"]) {
    if (!headers) return;
    if (typeof headers.delete === "function") {
        headers.delete("Authorization");
    }
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === "authorization") {
            delete (headers as Record<string, unknown>)[key];
        }
    }
}

/** 지금 로그인 세션의 액세스 토큰(없으면 null). 화면이 토큰을 들고 다니지 않게 API 함수가 직접 읽는다 */
export const currentAccessToken = (): string | null => readAuth().session?.accessToken ?? null;

/**
 * 이 요청에 로그인 세션을 쓴다는 표시. 로그인해 있으면 인증 헤더를, 아니면 빈 객체를 준다.
 * 아래 요청 가로채기가 /api/ 요청에서만 이 헤더를 최신 토큰으로 바꿔 넣고, 바깥 주소로 가는 요청에서는 지운다.
 * 로그인, 회원가입처럼 세션을 쓰면 안 되는 요청은 이 함수를 부르지 않는다(만료 토큰이 붙으면 서버가 401).
 */
export const authHeaders = (): Record<string, string> => {
    const token = currentAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

client.interceptors.request.use(config => {
    if (!isApiRequest(config)) {
        stripAuthorizationHeader(config.headers);
        return config;
    }
    const hasAuth =
        (typeof config.headers?.get === "function" && !!config.headers.get("Authorization")) ||
        Object.keys(config.headers || {}).some(k => k.toLowerCase() === "authorization" && !!(config.headers as Record<string, unknown>)[k]);
    if (!hasAuth) return config;
    const request = config as AuthRequest;
    const session = readAuth().session;
    if (!session || (request.sessionId && request.sessionId !== session.id)) throw new SessionChangedError();
    request.sessionId = session.id;
    request.headers.Authorization = `Bearer ${session.accessToken}`;
    return request;
});

client.interceptors.response.use(response => response, async error => {
    const request = error.config as AuthRequest | undefined;
    if (error.response?.status !== 401 || !request?.sessionId) throw error;
    if (readAuth().session?.id !== request.sessionId) throw new SessionChangedError();
    if (request.retried) {
        expireSession(request.sessionId);
        throw error;
    }

    request.retried = true;
    const rejectedAccess = String(request.headers.Authorization).replace(/^Bearer /, "");
    const session = await ensureSession(rejectedAccess);
    if (!session) throw error;
    if (session.id !== request.sessionId) throw new SessionChangedError();
    return client(request);
});

export default client;
