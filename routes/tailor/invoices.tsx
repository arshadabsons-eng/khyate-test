import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { IconFileInvoice, IconSearch, IconDownload } from "@tabler/icons-react";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingRows } from "@/components/common/AsyncStates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useTailorOrders } from "@/lib/api/queries/tailor";
import { filsToAed, fmtDate } from "@/lib/format";
import { labelize } from "@/components/inventory/options";
import { toast } from "sonner";
import type { OrderRow } from "@/lib/api/types";

export const Route = createFileRoute("/tailor/invoices")({ component: TailorInvoices });

function TailorInvoices() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const q = useTailorOrders(undefined, page);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // An invoice only exists once money is due/paid — unpaid orders have nothing to bill yet.
  const invoiceable = useMemo(
    () => (q.data?.data ?? []).filter((o) => o.payment_status !== "unpaid"),
    [q.data],
  );
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return invoiceable;
    return invoiceable.filter(
      (o) =>
        o.order_number.toLowerCase().includes(s) ||
        (o.customer_name ?? "").toLowerCase().includes(s),
    );
  }, [invoiceable, search]);

  async function download(o: OrderRow) {
    setDownloadingId(o.id);
    try {
      await apiClient.downloadPdf(
        `/tailors/me/orders/${o.id}/invoice`,
        `invoice-${o.order_number}.pdf`,
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Couldn't download the invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="kh-section">
        <h1 className="kh-h1 font-serif">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Download the tax invoice (PDF) for any order that has been paid. Invoices carry your brand
          and are FTA VAT-compliant.
        </p>
      </header>

      <div className="relative max-w-sm">
        <IconSearch
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order or customer…"
          className="pl-9"
        />
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load invoices" />
      ) : q.isLoading && !q.data ? (
        <LoadingRows cols={6} rows={8} />
      ) : (
        <DataTable
          rows={rows}
          onRowClick={(o) => navigate({ to: "/tailor/orders/$id", params: { id: o.id } })}
          emptyMessage="No paid orders yet — invoices appear here once an order is paid."
          pagination={{
            page: q.data?.page ?? 1,
            totalPages: q.data?.total_pages ?? 1,
            onPageChange: setPage,
          }}
          columns={[
            {
              header: "Invoice / Order",
              accessor: (o) => <span className="font-medium">{o.order_number}</span>,
            },
            { header: "Customer", accessor: (o) => o.customer_name },
            { header: "Type", accessor: (o) => labelize(o.order_type) },
            { header: "Amount", accessor: (o) => filsToAed(o.total_fils) },
            { header: "Payment", accessor: (o) => <StatusBadge status={o.payment_status} /> },
            { header: "Date", accessor: (o) => fmtDate(o.created_at) },
            {
              header: "",
              accessor: (o) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloadingId === o.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    download(o);
                  }}
                >
                  {downloadingId === o.id ? (
                    "Preparing…"
                  ) : (
                    <>
                      <IconDownload size={14} className="mr-1.5" /> Invoice
                    </>
                  )}
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
