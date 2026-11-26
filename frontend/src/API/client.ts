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

/**
 * 이 요청에 로그인 세션을 쓴다는 표시. 아래 요청 가로채기가 /api/ 요청에서만
 * 이 헤더를 지금 세션의 최신 토큰으로 바꿔 넣고, 바깥 주소로 가는 요청에서는 지운다.
 * 토큰이 없으면 아무것도 붙이지 않는다(비회원 요청).
 */
export const authHeaders = (token?: string | null): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {};

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
