import { isAxiosError } from "axios";
import client, { authHeaders } from "./client";
import { BASE_URL } from "./auth";

const root = `${BASE_URL}/api/arena/`;

export type ArenaPhase = "preparing" | "open" | "closed" | "finalized";
export interface ArenaInfo {
    name: string;
    phase: ArenaPhase;
    starts_at: string | null;
    ends_at: string | null;
    finalized_at: string | null;
    server_time: string;
    daily_limit: number;
    remaining_today: number | null;
    used_today: number | null;
    max_upload_bytes: number;
    train_rows: number;
    test_rows: number;
    data_version: string | null;
    eligible: boolean;
    public_name: string | null;
}
export interface ArenaSubmission {
    id: string;
    filename: string;
    accepted_at: string;
    status: "queued" | "scoring" | "scored" | "error";
    public_rmse: number | null;
    private_rmse: number | null;
    is_selected: boolean;
}
export interface ArenaHistory {
    count: number;
    page: number;
    pages: number;
    results: ArenaSubmission[];
}
export interface ArenaLeaderboard {
    phase: ArenaPhase;
    metric: "public_rmse" | "private_rmse";
    results: { rank: number; public_name: string; score: number; accepted_at: string; is_me: boolean }[];
}
export interface ArenaFailure {
    message: string;
    errors: { code: string; message: string; record: number | null }[];
}

export const fetchArenaInfo = async (signal?: AbortSignal) =>
    (await client.get<ArenaInfo>(root, { headers: authHeaders(), signal, timeout: 15000 })).data;

export const fetchArenaHistory = async (page = 1, signal?: AbortSignal, requestKey?: string) =>
    (await client.get<ArenaHistory>(`${root}submissions/`, {
        headers: authHeaders(), params: { page, request_key: requestKey }, signal, timeout: 15000,
    })).data;

export const fetchArenaLeaderboard = async (signal?: AbortSignal) =>
    (await client.get<ArenaLeaderboard>(`${root}leaderboard/`, { headers: authHeaders(), signal, timeout: 15000 })).data;

export const downloadArenaData = async (kind: "train" | "test" | "sample") =>
    (await client.get<Blob>(`${root}downloads/${kind}/`, { headers: authHeaders(), responseType: "blob", timeout: 60000 })).data;

export async function submitArena(file: File, requestKey: string, onProgress: (percent: number) => void) {
    const body = new FormData();
    body.append("file", file);
    return (await client.post<{ submission: ArenaSubmission; remaining_today: number; replayed: boolean }>(`${root}submissions/`, body, {
        headers: { ...authHeaders(), "Idempotency-Key": requestKey },
        timeout: 45000,
        onUploadProgress: event => { if (event.total) onProgress(Math.round(event.loaded / event.total * 100)); },
    })).data;
}

export const selectArenaSubmission = async (id: string) =>
    (await client.put(`${root}final-selection/`, { submission_id: id }, { headers: authHeaders(), timeout: 15000 })).data;

export async function arenaFailure(error: unknown): Promise<ArenaFailure> {
    let data = isAxiosError(error) ? error.response?.data : null;
    if (data instanceof Blob) {
        try { data = JSON.parse(await data.text()); } catch { data = null; }
    }
    return {
        message: typeof data?.message === "string" ? data.message
            : typeof data?.detail === "string" ? data.detail
            : "요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
        errors: Array.isArray(data?.errors) ? data.errors : [],
    };
}
