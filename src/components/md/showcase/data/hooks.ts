"use client";

import { useEffect, useState } from "react";
import { fetchPublishedPdbs, fetchPublishedRuns } from "./api";
import type { MdRun, PublishedPdb } from "./types";

type Query<T> = { data: T | undefined; isFetching: boolean; isError: boolean; error: Error | null };

/** Minimal async query: refetches when `key` changes, ignores stale responses. */
function useQuery<T>(key: string | null, fn: () => Promise<T>): Query<T> {
  const [state, setState] = useState<Query<T>>({ data: undefined, isFetching: false, isError: false, error: null });
  useEffect(() => {
    if (key === null) {
      setState({ data: undefined, isFetching: false, isError: false, error: null });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, isFetching: true, isError: false, error: null }));
    fn().then(
      (data) => live && setState({ data, isFetching: false, isError: false, error: null }),
      (error: Error) => live && setState({ data: undefined, isFetching: false, isError: true, error }),
    );
    return () => {
      live = false;
    };
    // fn is derived from key
  }, [key]);
  return state;
}

export const usePublishedRuns = (pdbId: string | null) =>
  useQuery<MdRun[]>(pdbId ? pdbId.toUpperCase() : null, () => fetchPublishedRuns(pdbId as string));

export const usePublishedPdbs = () => useQuery<PublishedPdb[]>("published", fetchPublishedPdbs);
