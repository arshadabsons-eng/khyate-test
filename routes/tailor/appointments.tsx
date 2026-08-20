import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IconClockHour4,
  IconHome,
  IconBuildingStore,
  IconRuler,
  IconCheck,
  IconX,
  IconCar,
  IconMapPin,
  IconUserOff,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CenteredSpinner, ErrorState, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { AvailabilityEditor } from "@/components/tailor/AvailabilityEditor";
import {
  useAppointments,
  useAvailability,
  useAcceptAppointment,
  useDeclineAppointment,
  useEnRoute,
  useUpdateApptLocation,
  useMeasurementDone,
  useMarkNoShow,
} from "@/lib/api/queries/tailor";
import { labelize } from "@/components/inventory/options";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/appointments")({ component: AppointmentsPage });

function uaeTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function AppointmentsPage() {
  const appts = useAppointments();
  const avail = useAvailability();
  const accept = useAcceptAppointment();
  const decline = useDeclineAppointment();
  const enRoute = useEnRoute();
  const updateLoc = useUpdateApptLocation();
  const measured = useMeasurementDone();
  const noShow = useMarkNoShow();

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  if (appts.isLoading || avail.isLoading) return <CenteredSpinner />;
  if (appts.isError) return <ErrorState error={appts.error} onRetry={() => appts.refetch()} />;

  const active = ["pending", "confirmed", "en_route", "arrived", "measured"];
  const upcoming = (appts.data ?? []).filter((a) => active.includes(a.status));
  const past = (appts.data ?? []).filter((a) => !active.includes(a.status));

  // Tailor taps "Update my location" → one-shot browser GPS → server checks 30 m.
  function shareLocation(id: string) {
    if (!navigator.geolocation) {
      toast.error("Location not available on this device");
      return;
    }
    toast.message("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        updateLoc.mutate(
          { id, body: { lat: pos.coords.latitude, lng: pos.coords.longitude } },
          {
            onSuccess: (r: unknown) => {
              const result = r as { in_zone?: boolean; distance_m?: number } | undefined;
              toast[result?.in_zone ? "success" : "message"](
                result?.in_zone
                  ? `You're at the customer (${result.distance_m} m) — they can now approve.`
                  : `Location sent — ${result?.distance_m ?? "?"} m from the customer.`,
              );
            },
          },
        ),
      () => toast.error("Could not get your location (permission denied?)"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <Card title="Your weekly hours">
        <AvailabilityEditor />
      </Card>

      <div className="space-y-6">
        <Card title={`Appointments (${upcoming.length})`}>
          {upcoming.length === 0 ? (
            <NoData
              icon={IconClockHour4}
              title="No appointments yet"
              description="Bookings from customers appear here."
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map((a) => {
                const home = a.type === "home_visit";
                return (
                  <div key={a.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                        {home ? <IconHome size={20} /> : <IconBuildingStore size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{a.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {uaeTime(a.slot_start)} · {home ? "Home visit" : "In-shop"}
                          {home && a.address_text ? ` · ${a.address_text}` : ""}
                        </div>
                        {home && a.required_tailor_gender && a.required_tailor_gender !== "any" && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Requires a {a.required_tailor_gender}'s tailor
                          </div>
                        )}
                      </div>
                      <StatusBadge status={a.status} />
                    </div>

                    {/* Status-appropriate big actions */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {a.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              accept.mutate(
                                { id: a.id },
                                { onError: mutationErrorToast("Couldn't accept this appointment") },
                              )
                            }
                          >
                            <IconCheck size={15} className="mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              decline.mutate(
                                { id: a.id },
                                {
                                  onError: mutationErrorToast("Couldn't decline this appointment"),
                                },
                              )
                            }
                          >
                            <IconX size={15} className="mr-1" /> Decline
                          </Button>
                        </>
                      )}
                      {a.status === "confirmed" && home && (
                        <Button
                          size="sm"
                          onClick={() =>
                            enRoute.mutate(
                              { id: a.id },
                              { onError: mutationErrorToast("Couldn't update your status") },
                            )
                          }
                        >
                          <IconCar size={15} className="mr-1" /> On my way
                        </Button>
                      )}
                      {(a.status === "en_route" || a.status === "arrived") && home && (
                        <Button
                          size="sm"
                          variant={a.in_zone ? "outline" : "default"}
                          onClick={() => shareLocation(a.id)}
                        >
                          <IconMapPin size={15} className="mr-1" />{" "}
                          {a.in_zone ? "Update location again" : "Update my location"}
                        </Button>
                      )}
                      {a.in_zone && (
                        <span className="inline-flex items-center text-xs text-success self-center">
                          ✓ At the customer ({a.arrival_distance_m} m)
                        </span>
                      )}
                      {["confirmed", "en_route", "arrived"].includes(a.status) && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/tailor/measurements">
                            <IconRuler size={15} className="mr-1" /> Record measurements
                          </Link>
                        </Button>
                      )}
                      {["arrived", "confirmed", "en_route"].includes(a.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            measured.mutate(
                              { id: a.id },
                              { onError: mutationErrorToast("Couldn't mark this as measured") },
                            )
                          }
                        >
                          <IconCheck size={15} className="mr-1" /> Mark measured
                        </Button>
                      )}
                      {a.status === "measured" && (
                        <span className="text-xs text-success self-center">
                          Measurements sent · awaiting customer approval
                        </span>
                      )}
                      {["confirmed", "en_route", "arrived"].includes(a.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-red-200 hover:bg-red-50"
                          onClick={() =>
                            noShow.mutate(
                              { id: a.id },
                              { onError: mutationErrorToast("Couldn't mark this as a no-show") },
                            )
                          }
                        >
                          <IconUserOff size={15} className="mr-1" /> Customer no-show
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {past.length > 0 && (
          <Card title="Past appointments">
            <ul className="divide-y">
              {past.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1">
                    {a.customer_name} · {uaeTime(a.slot_start)} · {labelize(a.type)}
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
