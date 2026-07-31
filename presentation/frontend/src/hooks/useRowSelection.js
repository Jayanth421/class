import { useCallback, useMemo, useState } from "react";

function normalizeId(value) {
  return String(value ?? "").trim();
}

export default function useRowSelection(initialSelectedIds = []) {
  const [selectedIds, setSelectedIds] = useState(() => {
    const seed = Array.isArray(initialSelectedIds) ? initialSelectedIds : [];
    return new Set(seed.map(normalizeId).filter(Boolean));
  });

  const selectedCount = selectedIds.size;

  const isSelected = useCallback((id) => selectedIds.has(normalizeId(id)), [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id) => {
    const key = normalizeId(id);
    if (!key) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const setAllSelected = useCallback((ids = []) => {
    const next = new Set((Array.isArray(ids) ? ids : []).map(normalizeId).filter(Boolean));
    setSelectedIds(next);
  }, []);

  const toggleAll = useCallback((ids = []) => {
    const normalized = (Array.isArray(ids) ? ids : []).map(normalizeId).filter(Boolean);
    if (normalized.length === 0) return;

    setSelectedIds((prev) => {
      const allSelected = normalized.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(normalized);
    });
  }, []);

  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    selectedIdList,
    selectedCount,
    isSelected,
    toggleSelected,
    toggleAll,
    setAllSelected,
    clearSelection
  };
}

