import { createFileRoute } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/common/Page";
import { ErrorState, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { IconToggleLeft } from "@tabler/icons-react";
import { useFeatureFlags, useUpdateFeatureFlag } from "@/lib/api/queries/featureFlags";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/features")({ component: FeaturesPage });

function FeaturesPage() {
  const q = useFeatureFlags();
  const update = useUpdateFeatureFlag();

  const toggle = (name: string, value: boolean) => {
    const flag = q.data?.find((f) => f.name === name);
    if (!flag) return;
    update.mutate(
      {
        name,
        enabled_tailor: value,
        enabled_customer: flag.enabled_customer,
      },
      {
        onSuccess: () => toast.success("Page visibility updated"),
        onError: () => toast.error("Couldn't update flag"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Page visibility</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle pages on or off for the tailor app. Disabled pages are hidden from the tailor's
          navigation — useful for building features before publishing them.
        </p>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load flags" />
      ) : q.isLoading ? (
        <LoadingRows cols={3} rows={6} />
      ) : !q.data?.length ? (
        <NoData icon={IconToggleLeft} title="No feature flags configured" />
      ) : (
        <Card>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2.5 pl-4 font-medium">Page</th>
                  <th className="text-left py-2.5 font-medium">Description</th>
                  <th className="text-center py-2.5 pr-4 font-medium">Tailor</th>
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((flag) => (
                  <tr key={flag.name} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3.5 pl-4">
                      <div className="font-medium">{flag.label}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{flag.name}</div>
                    </td>
                    <td className="py-3.5 text-muted-foreground max-w-xs">
                      {flag.description ?? "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-center">
                      <Switch
                        checked={flag.enabled_tailor}
                        onCheckedChange={(v) => toggle(flag.name, v)}
                        disabled={update.isPending}
                        aria-label={`Toggle ${flag.label} for tailors`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
