import { describe, it, expect } from "vitest";
import { computeChanges, type Matrix } from "./use-rbac-draft";
import type { RbacRole, RbacModule } from "@/lib/api/queries/rbac";

const roles: RbacRole[] = [
  { key: "support_agent", label: "Support Agent", description: null, rank: 1, is_system: true },
  { key: "validator", label: "Validator", description: null, rank: 1, is_system: false },
];
const modules: RbacModule[] = [
  { key: "orders", label: "Orders" },
  { key: "disputes", label: "Disputes" },
];

describe("computeChanges", () => {
  it("returns no changes when draft matches saved", () => {
    const saved: Matrix = { support_agent: { orders: "view", disputes: "edit" } };
    const draft: Matrix = { support_agent: { orders: "view", disputes: "edit" } };
    expect(computeChanges(saved, draft, roles, modules)).toEqual([]);
  });

  it("reports a single changed cell with role/module labels and from/to levels", () => {
    const saved: Matrix = { support_agent: { orders: "view", disputes: "edit" } };
    const draft: Matrix = { support_agent: { orders: "admin", disputes: "edit" } };
    expect(computeChanges(saved, draft, roles, modules)).toEqual([
      {
        role_key: "support_agent",
        role_label: "Support Agent",
        module: "orders",
        module_label: "Orders",
        from: "view",
        level: "admin",
      },
    ]);
  });

  it("treats a missing cell as 'none' on both sides", () => {
    const saved: Matrix = {};
    const draft: Matrix = { validator: { orders: "none" } };
    expect(computeChanges(saved, draft, roles, modules)).toEqual([]);
  });

  it("reports multiple changes across different roles and modules", () => {
    const saved: Matrix = { support_agent: { orders: "view" }, validator: { disputes: "none" } };
    const draft: Matrix = { support_agent: { orders: "edit" }, validator: { disputes: "view" } };
    const changes = computeChanges(saved, draft, roles, modules);
    expect(changes).toHaveLength(2);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role_key: "support_agent",
          module: "orders",
          from: "view",
          level: "edit",
        }),
        expect.objectContaining({
          role_key: "validator",
          module: "disputes",
          from: "none",
          level: "view",
        }),
      ]),
    );
  });

  it("a change reverted back to the saved value within the same draft disappears from the change list", () => {
    const saved: Matrix = { support_agent: { orders: "view" } };
    // Draft was edited to 'admin' then edited back to 'view' — net draft equals saved.
    const draft: Matrix = { support_agent: { orders: "view" } };
    expect(computeChanges(saved, draft, roles, modules)).toEqual([]);
  });
});
