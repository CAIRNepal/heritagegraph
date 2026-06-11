'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { ATLAS_VIEW_IDS, type AtlasViewId } from '@/types/atlas';

import { useAtlasStore } from './use-atlas-store';

/**
 * Shareable Atlas state via query params (mirrors the Heritage Museum client):
 * `source=live|demo`, `selected=<entity id / IRI>`, `panel=<view>`, `year=<n>`.
 *
 * Reads params once on mount; afterwards reflects store changes back into the
 * URL with `history.replaceState` (debounced — avoids Next router re-renders).
 */
export function useAtlasUrlState() {
  const searchParams = useSearchParams();
  const corpusStatus = useAtlasStore((s) => s.corpusStatus);
  const appliedSelectionRef = useRef(false);
  const initialYearRef = useRef<number | null>(null);

  useEffect(() => {
    initialYearRef.current = useAtlasStore.getState().currentYear;
    const panel = searchParams.get('panel');
    if (panel && (ATLAS_VIEW_IDS as string[]).includes(panel)) {
      useAtlasStore.setState({ focusedView: panel as AtlasViewId });
    }
    const year = Number.parseInt(searchParams.get('year') ?? '', 10);
    if (Number.isFinite(year)) {
      useAtlasStore.getState().setCurrentYear(year);
    }
    // Mount-only: params are a bootstrap input, not a controlled binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply `?selected=` once the corpus that can contain it is ready.
  useEffect(() => {
    if (appliedSelectionRef.current) return;
    const selected = searchParams.get('selected');
    if (!selected) {
      appliedSelectionRef.current = true;
      return;
    }
    if (corpusStatus !== 'ready') return;
    const st = useAtlasStore.getState();
    if (st.entities.some((e) => e.id === selected)) {
      st.selectEntity(selected, false);
    }
    appliedSelectionRef.current = true;
  }, [corpusStatus, searchParams]);

  useEffect(() => {
    let timer: number | null = null;

    const write = () => {
      const st = useAtlasStore.getState();
      const params = new URLSearchParams(window.location.search);
      const setOrDelete = (key: string, value: string | null) => {
        if (value == null) params.delete(key);
        else params.set(key, value);
      };
      setOrDelete('source', st.dataSource === 'live' ? 'live' : null);
      setOrDelete('selected', st.selectedId);
      setOrDelete('panel', st.focusedView);
      const yearMoved =
        initialYearRef.current != null && st.currentYear !== initialYearRef.current;
      setOrDelete('year', yearMoved || params.has('year') ? String(st.currentYear) : null);

      const qs = params.toString();
      const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(null, '', next);
      }
    };

    const unsub = useAtlasStore.subscribe((s, prev) => {
      if (
        s.dataSource !== prev.dataSource ||
        s.selectedId !== prev.selectedId ||
        s.focusedView !== prev.focusedView ||
        s.currentYear !== prev.currentYear
      ) {
        if (timer != null) window.clearTimeout(timer);
        timer = window.setTimeout(write, 300);
      }
    });

    return () => {
      if (timer != null) window.clearTimeout(timer);
      unsub();
    };
  }, []);
}
