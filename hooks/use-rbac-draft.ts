import { useEffect, useRef, useState } from "react";
import type { PermLevel, RbacRole, RbacModule } from "@/lib/api/queries/rbac";

export type Matrix = Record<string, Record<string, PermLevel>>;

export type RbacChange = {
  role_key: string;
  role_label: string;
  module: string;
  module_label: string;
  from: PermLevel;
  level: PermLevel;
};

/** Diffs `draft` against `saved` for every role x module pair, returning only
 *  the cells that actually changed. A missing cell on either side reads as
 *  'none' (matches the backend's own default — see rbac.js's DEFAULTS). */
export function computeChanges(
  saved: Matrix,
  draft: Matrix,
  roles: RbacRole[],
  modules: RbacModule[],
): RbacChange[] {
  return roles.flatMap((r) =>
    modules.flatMap((m) => {
      const from = (saved[r.key]?.[m.key] ?? "none") as PermLevel;
      const level = (draft[r.key]?.[m.key] ?? from) as PermLevel;
      return level !== from
        ? [
            {
              role_key: r.key,
              role_label: r.label,
              module: m.key,
              module_label: m.label,
              from,
              level,
            },
          ]
        : [];
    }),
  );
}

/** Staged-edit state for the permission matrix: edits accumulate in `draft`
 *  and are only real once the caller sends `changes` to useSetPermissions()
 *  and it succeeds — nothing here talks to the network. `super_admin` is
 *  always locked to 'admin' server-side (rbac.js's levelFor()); setCell()
 *  silently no-ops for it so the UI can't stage an edit that would be
 *  rejected/ignored server-side anyway. */
export function useRbacDraft(saved: Matrix, roles: RbacRole[], modules: RbacModule[]) {
  const [draft, setDraft] = useState<Matrix>(() => structuredClone(saved));
  const prevSavedRef = useRef(saved);

  // `saved` is a new object reference any time the underlying react-query
  // cache entry is invalidated — not just on first load. useSetPermissions,
  // useSaveRole and useDeleteRole (add/delete a role from the *same* Roles
  // page) all invalidate the ["rbac"] query key, which refetches this exact
  // matrix. Wholesale-replacing `draft` here on every such change used to
  // silently wipe any in-progress, unsaved edits (e.g. mid-edit on role A,
  // click "Add role" for role B → role A's staged changes vanish with no
  // warning). Instead, rebase: take the fresh server matrix as the new base,
  // then re-apply only the cells the user actually touched (draft value
  // differs from what they last saw), so unrelated server-side changes are
  // picked up without discarding real in-progress work.
  useEffect(() => {
    const prevSaved = prevSavedRef.current;
    prevSavedRef.current = saved;
    if (prevSaved === saved) return;
    setDraft((prevDraft) => {
      const next = structuredClone(saved);
      for (const roleKey of Object.keys(prevDraft)) {
        for (const moduleKey of Object.keys(prevDraft[roleKey] || {})) {
          const draftLevel = prevDraft[roleKey][moduleKey];
          const priorSavedLevel = prevSaved[roleKey]?.[moduleKey] ?? "none";
          if (draftLevel !== priorSavedLevel) {
            next[roleKey] = { ...(next[roleKey] || {}), [moduleKey]: draftLevel };
          }
        }
      }
      return next;
    });
  }, [saved]);

  function setCell(roleKey: string, moduleKey: string, level: PermLevel) {
    if (roleKey === "super_admin") return;
    setDraft((prev) => ({ ...prev, [roleKey]: { ...(prev[roleKey] || {}), [moduleKey]: level } }));
  }

  const changes = computeChanges(saved, draft, roles, modules);
  const dirty = changes.length > 0;
  const discard = () => setDraft(structuredClone(saved));

  return { draft, setCell, changes, dirty, discard };
}
