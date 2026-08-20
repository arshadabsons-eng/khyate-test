import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconSearch,
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconFlag,
  IconDownload,
  IconRefresh,
} from "@tabler/icons-react";
import { useCustomers } from "@/lib/api/queries/customers";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingCards, LoadingRows } from "@/components/common/AsyncStates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { relTime, maskName, maskPhone, downloadCsv } from "@/lib/format";
import { Money } from "@/components/common/Money";
import type { CustomerFilters } from "@/lib/api/queries/customers";

export const Route = createFileRoute("/_app/customers/")({ component: CustomersPage });

const STATUS_OPTS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "flagged", label: "Flagged" },
];

const SORT_OPTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "spent_desc", label: "Highest spend" },
  { value: "orders_desc", label: "Most orders" },
  { value: "name_asc", label: "Name A–Z" },
];

function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerFilters["status"]>("all");
  const [sort, setSort] = useState<CustomerFilters["sort"]>("newest");
  const [page, setPage] = useState(1);
  const dSearch = useDebouncedValue(search, 300);

  const filters: CustomerFilters = { search: dSearch || undefined, status, sort, page, limit: 25 };
  const { data, isLoading, isFetching, isError, error, refetch } = useCustomers(filters);

  const kpi = data?.kpi;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      {isLoading && !data ? (
        <LoadingCards count={5} />
      ) : isError ? null : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total Customers" value={kpi?.total ?? 0} icon={IconUsers} />
          <StatCard
            label="Active"
            value={kpi?.active ?? 0}
            icon={IconUserCheck}
            className="border-green-200 bg-green-50"
          />
          <StatCard
            label="Suspended"
            value={kpi?.suspended ?? 0}
            icon={IconUserX}
            className="border-red-200 bg-red-50"
          />
          <StatCard
            label="Flagged"
            value={kpi?.flagged ?? 0}
            icon={IconFlag}
            className="border-yellow-200 bg-yellow-50"
          />
          <StatCard label="New This Month" value={kpi?.new_this_month ?? 0} icon={IconUsers} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as CustomerFilters["status"]);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as CustomerFilters["sort"]);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            <IconRefresh size={16} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "customers.csv",
                (data?.data ?? []).map((c) => ({
                  name: c.full_name,
                  phone: c.phone,
                  city: c.city,
                  status: c.status,
                  orders: c.total_orders,
                  spent_aed: ((c.total_spent_fils ?? 0) / 100).toFixed(2),
                  open_disputes: c.active_disputes,
                  joined: c.joined_at,
                })),
              )
            }
          >
            <IconDownload size={15} className="mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingRows cols={7} rows={10} />
      ) : (
        <DataTable
          columns={[
            {
              header: "Customer",
              accessor: (r) => (
                <div>
                  <div className="font-medium">{maskName(r.full_name)}</div>
                  <div className="text-xs text-muted-foreground">{maskPhone(r.phone)}</div>
                </div>
              ),
            },
            { header: "City", accessor: (r) => r.city || "—" },
            { header: "Orders", accessor: (r) => r.total_orders },
            { header: "Total Spent", accessor: (r) => <Money fils={r.total_spent_fils} /> },
            {
              header: "Open Disputes",
              accessor: (r) => (
                <span className={r.active_disputes > 0 ? "text-destructive font-medium" : ""}>
                  {r.active_disputes}
                </span>
              ),
            },
            { header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
            { header: "Joined", accessor: (r) => relTime(r.joined_at) },
          ]}
          rows={data?.data ?? []}
          onRowClick={(r) => navigate({ to: "/customers/$id", params: { id: r.id } })}
          pagination={{
            page: data?.page ?? 1,
            totalPages: data?.total_pages ?? 1,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
