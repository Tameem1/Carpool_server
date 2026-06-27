import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Clock, Users, Repeat, MapPin } from "lucide-react";
import { nowGMTPlus3, toGMTPlus3, formatGMTPlus3TimeOnly } from "@shared/timezone";
import { SlotFormDialog } from "@/components/SlotFormDialog";
import { SlotDetailsDialog, type SlotWithMeta } from "@/components/SlotDetailsDialog";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_PX = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAY_LABELS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAY_SHORT = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

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

function formatHour(h: number): string {
  const ampm = h >= 12 ? "م" : "ص";
  const display = h % 12 || 12;
  return `${display} ${ampm}`;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isMobile = useIsMobile();

  const [weekStart, setWeekStart] = useState<number>(() => weekStartOf(nowGMTPlus3()));
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefault, setCreateDefault] = useState<string | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<SlotWithMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const todayWallMidnight = useMemo(() => {
    const g = nowGMTPlus3();
    return Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate());
  }, []);

  // Mobile shows one day at a time; default to today (or the first day of the week).
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const g = nowGMTPlus3();
    return g.getUTCDay();
  });

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

  // Start the timed grid scrolled to the morning rather than midnight (desktop).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, [isMobile]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const wallMs = weekStart + i * DAY_MS;
        const d = new Date(wallMs);
        return {
          index: i,
          wallMs,
          label: WEEKDAY_LABELS[d.getUTCDay()],
          short: WEEKDAY_SHORT[d.getUTCDay()],
          dateNum: d.getUTCDate(),
          month: d.getUTCMonth() + 1,
          isToday: wallMs === todayWallMidnight,
        };
      }),
    [weekStart, todayWallMidnight],
  );

  // Map each slot to its day column + timed position, sorted by start.
  const positioned = useMemo(() => {
    return slots
      .map((slot) => {
        const g = toGMTPlus3(new Date(slot.startTime));
        const slotDayWall = Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate());
        const dayIndex = Math.round((slotDayWall - weekStart) / DAY_MS);
        const startHour = g.getUTCHours() + g.getUTCMinutes() / 60;
        const durationHours =
          (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 3_600_000;
        return {
          slot,
          dayIndex,
          startMs: new Date(slot.startTime).getTime(),
          top: startHour * HOUR_PX,
          height: Math.max(durationHours * HOUR_PX, 26),
        };
      })
      .sort((a, b) => a.startMs - b.startMs);
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold sm:text-xl">جدول الرحلات</h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => w - 7 * DAY_MS)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setWeekStart(weekStartOf(nowGMTPlus3()))}
          >
            اليوم
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => w + 7 * DAY_MS)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              className="h-8"
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
      <p className="mb-3 text-sm text-muted-foreground">{monthLabel}</p>

      {isMobile ? (
        <MobileView
          days={days}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={setSelectedDayIndex}
          positioned={positioned}
          isAdmin={isAdmin}
          onSelectSlot={setSelectedSlot}
          onAddForDay={(wallMs) => handleCellClick(wallMs, 12)}
        />
      ) : (
        <WeekGrid
          days={days}
          positioned={positioned}
          isAdmin={isAdmin}
          scrollRef={scrollRef}
          onCellClick={handleCellClick}
          onSelectSlot={setSelectedSlot}
        />
      )}

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

type DayInfo = {
  index: number;
  wallMs: number;
  label: string;
  short: string;
  dateNum: number;
  month: number;
  isToday: boolean;
};

type Positioned = {
  slot: SlotWithMeta;
  dayIndex: number;
  startMs: number;
  top: number;
  height: number;
};

/* ---------------- Mobile: day strip + agenda list ---------------- */
function MobileView({
  days,
  selectedDayIndex,
  onSelectDay,
  positioned,
  isAdmin,
  onSelectSlot,
  onAddForDay,
}: {
  days: DayInfo[];
  selectedDayIndex: number;
  onSelectDay: (i: number) => void;
  positioned: Positioned[];
  isAdmin: boolean;
  onSelectSlot: (s: SlotWithMeta) => void;
  onAddForDay: (wallMs: number) => void;
}) {
  const dayEvents = positioned.filter((p) => p.dayIndex === selectedDayIndex);
  const selectedDay = days[selectedDayIndex];

  return (
    <div>
      {/* Day selector strip */}
      <div dir="ltr" className="mb-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const active = day.index === selectedDayIndex;
          return (
            <button
              key={day.index}
              onClick={() => onSelectDay(day.index)}
              className={`flex flex-col items-center rounded-lg border py-2 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : day.isToday
                    ? "border-primary/40 bg-primary/10"
                    : "hover:bg-accent"
              }`}
            >
              <span className="opacity-80">{day.short}</span>
              <span className="text-sm font-semibold">{day.dateNum}</span>
            </button>
          );
        })}
      </div>

      {/* Agenda list for the selected day */}
      <div className="space-y-2">
        {dayEvents.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            لا توجد مواعيد في {selectedDay.label}
          </Card>
        ) : (
          dayEvents.map((p) => (
            <EventListItem key={p.slot.id} slot={p.slot} onClick={() => onSelectSlot(p.slot)} />
          ))
        )}

        {isAdmin && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onAddForDay(selectedDay.wallMs)}
          >
            <Plus className="ml-1 h-4 w-4" /> إضافة موعد في {selectedDay.label}
          </Button>
        )}
      </div>
    </div>
  );
}

function EventListItem({ slot, onClick }: { slot: SlotWithMeta; onClick: () => void }) {
  const met = slot.registeredCount >= slot.driversNeeded;
  const remaining = Math.max(slot.driversNeeded - slot.registeredCount, 0);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-lg border bg-card p-3 text-right shadow-sm active:bg-accent"
    >
      <div className={`w-1.5 shrink-0 rounded-full ${met ? "bg-green-600" : "bg-rose-600"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{slot.destination}</span>
          {slot.seriesId && <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatGMTPlus3TimeOnly(new Date(slot.startTime))} -{" "}
          {formatGMTPlus3TimeOnly(new Date(slot.endTime))}
        </div>
        {slot.notes && <p className="mt-1 truncate text-xs text-muted-foreground">{slot.notes}</p>}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={met ? "default" : "destructive"} className="gap-1">
            <Users className="h-3 w-3" />
            {slot.registeredCount}/{slot.driversNeeded}
          </Badge>
          {!met && <span className="text-xs text-muted-foreground">المتبقي: {remaining}</span>}
          {slot.isRegistered && (
            <Badge variant="outline" className="text-xs">
              مسجّل
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

/* ---------------- Desktop: 7-column timed week grid ---------------- */
function WeekGrid({
  days,
  positioned,
  isAdmin,
  scrollRef,
  onCellClick,
  onSelectSlot,
}: {
  days: DayInfo[];
  positioned: Positioned[];
  isAdmin: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onCellClick: (wallMs: number, hour: number) => void;
  onSelectSlot: (s: SlotWithMeta) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div dir="ltr">
        {/* Sticky day header */}
        <div className="flex border-b bg-background">
          <div className="w-14 shrink-0" />
          {days.map((day) => (
            <div
              key={day.index}
              className={`flex-1 border-l py-2 text-center ${day.isToday ? "bg-primary/10" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{day.label}</div>
              <div className={`text-sm font-semibold ${day.isToday ? "text-primary" : ""}`}>
                {day.dateNum}
              </div>
            </div>
          ))}
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
                    onClick={() => onCellClick(day.wallMs, h)}
                  />
                ))}

                {positioned
                  .filter((p) => p.dayIndex === day.index)
                  .map((p) => {
                    const met = p.slot.registeredCount >= p.slot.driversNeeded;
                    return (
                      <button
                        key={p.slot.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSlot(p.slot);
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
  );
}
