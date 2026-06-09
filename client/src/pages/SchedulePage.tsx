import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { nowGMTPlus3, toGMTPlus3, formatGMTPlus3TimeOnly } from "@shared/timezone";
import { SlotFormDialog } from "@/components/SlotFormDialog";
import { SlotDetailsDialog, type SlotWithMeta } from "@/components/SlotDetailsDialog";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_PX = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAY_LABELS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const pad = (n: number) => String(n).padStart(2, "0");

// Wall-clock (GMT+3) ms for the Sunday that starts the week containing `date`.
function weekStartOf(date: Date): number {
  const g = toGMTPlus3(date);
  const dayMidnight = Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate());
  return dayMidnight - g.getUTCDay() * DAY_MS;
}

function ymd(wallMs: number): string {
  const d = new Date(wallMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [weekStart, setWeekStart] = useState<number>(() => weekStartOf(nowGMTPlus3()));
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState<string | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<SlotWithMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStartStr = ymd(weekStart);

  const { data: slots = [] } = useQuery<SlotWithMeta[]>({
    queryKey: ["/api/schedule/slots", weekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/schedule/slots?weekStart=${weekStartStr}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load slots");
      return res.json();
    },
    enabled: !!user,
  });

  // Start the week view scrolled to the morning rather than midnight.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const wallMs = weekStart + i * DAY_MS;
        const d = new Date(wallMs);
        return {
          index: i,
          wallMs,
          label: WEEKDAY_LABELS[d.getUTCDay()],
          dateNum: d.getUTCDate(),
          month: d.getUTCMonth() + 1,
        };
      }),
    [weekStart],
  );

  const todayWallMidnight = useMemo(() => {
    const g = nowGMTPlus3();
    return Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate());
  }, []);

  // Group slots into their day column with computed top/height.
  const positioned = useMemo(() => {
    return slots.map((slot) => {
      const g = toGMTPlus3(new Date(slot.startTime));
      const slotDayWall = Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate());
      const dayIndex = Math.round((slotDayWall - weekStart) / DAY_MS);
      const startHour = g.getUTCHours() + g.getUTCMinutes() / 60;
      const durationHours =
        (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 3_600_000;
      return {
        slot,
        dayIndex,
        top: startHour * HOUR_PX,
        height: Math.max(durationHours * HOUR_PX, 26),
      };
    });
  }, [slots, weekStart]);

  const handleCellClick = (dayWallMs: number, hour: number) => {
    if (!isAdmin) return;
    const d = new Date(dayWallMs);
    const start = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate(),
    )}T${pad(hour)}:00`;
    setCreateDefault(start);
    setCreateOpen(true);
  };

  const monthLabel = `${days[0].dateNum}/${days[0].month} - ${days[6].dateNum}/${days[6].month}`;

  return (
    <div className="mobile-container py-3 sm:py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">جدول الرحلات</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => w - 7 * DAY_MS)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(weekStartOf(nowGMTPlus3()))}
          >
            هذا الأسبوع
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => w + 7 * DAY_MS)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{monthLabel}</span>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setCreateDefault(undefined);
                setCreateOpen(true);
              }}
            >
              <Plus className="ml-1 h-4 w-4" /> موعد
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div dir="ltr">
          {/* Sticky day header */}
          <div className="flex border-b bg-background">
            <div className="w-14 shrink-0" />
            {days.map((day) => {
              const isToday = day.wallMs === todayWallMidnight;
              return (
                <div
                  key={day.index}
                  className={`flex-1 border-l py-2 text-center ${
                    isToday ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground">{day.label}</div>
                  <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {day.dateNum}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable timed grid */}
          <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
            <div className="flex">
              {/* Time gutter */}
              <div className="w-14 shrink-0">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="relative border-b text-[10px] text-muted-foreground"
                    style={{ height: HOUR_PX }}
                  >
                    <span className="absolute -top-2 right-1">{formatHour(h)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => (
                <div key={day.index} className="relative flex-1 border-l">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className={`border-b ${isAdmin ? "cursor-pointer hover:bg-accent/40" : ""}`}
                      style={{ height: HOUR_PX }}
                      onClick={() => handleCellClick(day.wallMs, h)}
                    />
                  ))}

                  {/* Events for this day */}
                  {positioned
                    .filter((p) => p.dayIndex === day.index)
                    .map((p) => {
                      const met = p.slot.registeredCount >= p.slot.driversNeeded;
                      return (
                        <button
                          key={p.slot.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlot(p.slot);
                          }}
                          className={`absolute inset-x-0.5 overflow-hidden rounded px-1 py-0.5 text-right text-[11px] text-white shadow-sm ${
                            met ? "bg-green-600 hover:bg-green-700" : "bg-rose-600 hover:bg-rose-700"
                          }`}
                          style={{ top: p.top, height: p.height }}
                        >
                          <div className="truncate font-medium">{p.slot.destination}</div>
                          <div className="truncate opacity-90">
                            {formatGMTPlus3TimeOnly(new Date(p.slot.startTime))} ·{" "}
                            {p.slot.registeredCount}/{p.slot.driversNeeded}
                          </div>
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <SlotFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultStart={createDefault}
      />
      <SlotDetailsDialog
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "م" : "ص";
  const display = h % 12 || 12;
  return `${display} ${ampm}`;
}
