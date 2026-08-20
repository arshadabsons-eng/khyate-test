import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight, IconRefresh } from "@tabler/icons-react";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { useInvoicePreviewPdf } from "@/lib/api/queries/tailor";

export const Route = createFileRoute("/tailor/invoice-preview")({
  component: InvoicePreviewPage,
});

function InvoicePreviewPage() {
  const { url, isLoading, isError, error, refetch, isRefetching } = useInvoicePreviewPdf();
  const busy = isLoading || isRefetching;

  return (
    <div className="w-full space-y-6">
      <header className="kh-section">
        <h1 className="kh-h1 font-serif">Invoice Preview</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          This is exactly what a customer receives — your saved logo, authorised signature, company
          stamp and standing invoice note, applied to a representative sample order. It reflects
          your currently saved branding, not what you're mid-typing on the Documents page, so use
          "Refresh preview" after saving a change there.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={busy}>
          <IconRefresh size={14} className={`mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
          {isRefetching ? "Refreshing…" : "Refresh preview"}
        </Button>
        <Link
          to="/tailor/documents"
          className="text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline"
        >
          Edit your logo, signature & invoice note <IconArrowRight size={14} />
        </Link>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isError ? (
          <div className="p-5">
            <ErrorState
              error={error}
              onRetry={() => refetch()}
              title="Couldn't build the invoice preview"
            />
          </div>
        ) : !url ? (
          <div className="min-h-[80vh] grid place-items-center">
            <CenteredSpinner label="Building your sample invoice…" />
          </div>
        ) : (
          <iframe
            src={url}
            title="Invoice preview"
            className="w-full min-h-[80vh] border-0 block"
          />
        )}
      </div>
    </div>
  );
}
