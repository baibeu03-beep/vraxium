import { supabaseAdmin } from "@/lib/supabase";

const CACHE_TTL = 5 * 60 * 1000; // 5분

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

export async function getCachedTeams(): Promise<{ id: string; name: string }[]> {
  const cached = getCached<{ id: string; name: string }[]>("teams");
  if (cached) return cached;

  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("teams").select("id, name");
  const result = data || [];
  setCache("teams", result);
  return result;
}

export async function getCachedParts(): Promise<{ id: string; name: string; team_id?: string }[]> {
  const cached = getCached<{ id: string; name: string; team_id?: string }[]>("parts");
  if (cached) return cached;

  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("parts").select("id, name, team_id");
  const result = data || [];
  setCache("parts", result);
  return result;
}

export async function getCachedActivityTypes(): Promise<{ id: string; cluster_id: string }[]> {
  const cached = getCached<{ id: string; cluster_id: string }[]>("activity_types");
  if (cached) return cached;

  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from("activity_types").select("id, cluster_id");
  const result = data || [];
  setCache("activity_types", result);
  return result;
}
