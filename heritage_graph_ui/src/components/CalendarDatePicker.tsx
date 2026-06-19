"use client";

import { useId, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── types ──────────────────────────────────────────────────────────────────────

export type CalendarSystem = "gregorian" | "bikram_sambat" | "nepal_sambat";
export type DatePrecision = "exact_year" | "circa" | "decade" | "century";

export interface CalendarDate {
  calendar_system: CalendarSystem;
  year: number | "";
  month: number | null;
  day: number | null;
  date_precision: DatePrecision;
}

interface CalendarDatePickerProps {
  label?: string;
  value: CalendarDate;
  onChange: (next: CalendarDate) => void;
  className?: string;
}

// ── calendar conversion helpers ────────────────────────────────────────────────

function toGregorian(year: number, system: CalendarSystem): number {
  if (system === "bikram_sambat") return year - 57;
  if (system === "nepal_sambat") return year + 880;
  return year;
}

function toBs(gregorianYear: number): number {
  return gregorianYear + 57;
}

function toNs(gregorianYear: number): number {
  return gregorianYear - 880;
}

// ── EDTF encoding ─────────────────────────────────────────────────────────────

function toEdtf(value: CalendarDate): string {
  const { year, month, day, date_precision } = value;
  if (year === "" || year === undefined) return "";

  if (date_precision === "decade") {
    const d = Math.floor(Number(year) / 10) * 10;
    return `${d}X`;
  }
  if (date_precision === "century") {
    const c = Math.floor(Number(year) / 100);
    return `${String(c).padStart(2, "0")}XX`;
  }

  const parts: string[] = [String(year).padStart(4, "0")];
  if (month) {
    parts.push(String(month).padStart(2, "0"));
    if (day) parts.push(String(day).padStart(2, "0"));
  }
  const edtf = parts.join("-");
  return date_precision === "circa" ? `${edtf}~` : edtf;
}

// ── calendar equivalents ───────────────────────────────────────────────────────

function equivalentLabel(value: CalendarDate): string {
  const { year, calendar_system, date_precision } = value;
  if (year === "" || year === undefined) return "";
  const y = Number(year);
  const greg = toGregorian(y, calendar_system);
  const prec = date_precision === "circa" ? "~" : "";
  const parts: string[] = [];
  if (calendar_system !== "gregorian") parts.push(`Gregorian ${greg}${prec}`);
  if (calendar_system !== "bikram_sambat") parts.push(`BS ${toBs(greg)}${prec}`);
  if (calendar_system !== "nepal_sambat") parts.push(`NS ${toNs(greg)}${prec}`);
  return parts.join(" · ");
}

// ── month options ─────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// ── component ─────────────────────────────────────────────────────────────────

export function CalendarDatePicker({
  label = "Date",
  value,
  onChange,
  className,
}: CalendarDatePickerProps) {
  const id = useId();

  const edtf = useMemo(() => toEdtf(value), [value]);
  const equivalents = useMemo(() => equivalentLabel(value), [value]);

  function patch(delta: Partial<CalendarDate>) {
    onChange({ ...value, ...delta });
  }

  const gregorianYear =
    value.year !== "" ? toGregorian(Number(value.year), value.calendar_system) : null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="text-sm font-medium">{label}</p>

      {/* Calendar system */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
          Calendar system
        </legend>
        <RadioGroup
          value={value.calendar_system}
          onValueChange={(v) => patch({ calendar_system: v as CalendarSystem })}
          className="flex flex-wrap gap-4"
        >
          {(
            [
              ["gregorian", "Gregorian"],
              ["bikram_sambat", "Bikram Sambat"],
              ["nepal_sambat", "Nepal Sambat"],
            ] as const
          ).map(([val, lbl]) => (
            <div key={val} className="flex items-center gap-1.5">
              <RadioGroupItem value={val} id={`${id}-cs-${val}`} />
              <Label htmlFor={`${id}-cs-${val}`} className="text-sm cursor-pointer">
                {lbl}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      {/* Year / Month / Day */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-year`} className="text-xs text-muted-foreground">
            Year
          </Label>
          <Input
            id={`${id}-year`}
            type="number"
            min={1}
            max={9999}
            placeholder="YYYY"
            className="w-24"
            value={value.year === "" ? "" : value.year}
            onChange={(e) => {
              const raw = e.target.value;
              patch({ year: raw === "" ? "" : parseInt(raw, 10) });
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Select
            value={value.month !== null ? String(value.month) : "unknown"}
            onValueChange={(v) => patch({ month: v === "unknown" ? null : parseInt(v, 10) })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="— unknown —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">— unknown —</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {value.month !== null && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Day</Label>
            <Select
              value={value.day !== null ? String(value.day) : "unknown"}
              onValueChange={(v) => patch({ day: v === "unknown" ? null : parseInt(v, 10) })}
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">— unknown —</SelectItem>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Precision */}
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
          Precision
        </legend>
        <RadioGroup
          value={value.date_precision}
          onValueChange={(v) => patch({ date_precision: v as DatePrecision })}
          className="flex flex-wrap gap-4"
        >
          {(
            [
              ["exact_year", "Exact year"],
              ["circa", "Circa"],
              ["decade", "Decade"],
              ["century", "Century"],
            ] as const
          ).map(([val, lbl]) => (
            <div key={val} className="flex items-center gap-1.5">
              <RadioGroupItem value={val} id={`${id}-prec-${val}`} />
              <Label htmlFor={`${id}-prec-${val}`} className="text-sm cursor-pointer">
                {lbl}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      {/* Preview box */}
      {edtf && (
        <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          <div>
            <span className="text-foreground font-semibold">Stored as:</span>{" "}
            EDTF &ldquo;{edtf}&rdquo;
          </div>
          {equivalents && (
            <div>
              <span className="text-foreground font-semibold">Equivalent:</span>{" "}
              {equivalents}
            </div>
          )}
          <div className="mt-1 border-t pt-1">
            <div>RDF: crm:E52_Time-Span</div>
            {gregorianYear !== null && (
              <div className="ml-6">
                crm:P82a_begin &ldquo;{gregorianYear}&rdquo;^^xsd:gYear
              </div>
            )}
            <div className="ml-6">
              hg:calendar_system &ldquo;{value.calendar_system}&rdquo;
            </div>
            <div className="ml-6">
              hg:date_precision &ldquo;{value.date_precision}&rdquo;
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
