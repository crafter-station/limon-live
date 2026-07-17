import type { StoredRestaurant } from "./restaurant";

const DAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

type Range = { start: number; end: number };

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

function parseRanges(value: string): Range[] | null {
  if (/^(cerrado|closed)$/i.test(value.trim())) return [];
  const ranges = value.split(/\s*,\s*/).map((part) => {
    const match = part.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
    if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59)
      return null;
    return {
      start: startHour * 60 + startMinute,
      end: endHour * 60 + endMinute,
    };
  });
  return ranges.every((range) => range !== null) ? ranges : null;
}

export function openingStatus(
  hours: StoredRestaurant["hours"],
  now = new Date(),
): "Abierto ahora" | "Cerrado ahora" | null {
  if (!hours.length) return null;
  const schedule = new Map<number, Range[]>();
  for (const entry of hours) {
    const day = DAY_INDEX[fold(entry.day)];
    const ranges = parseRanges(entry.hours);
    if (day === undefined || ranges === null || schedule.has(day)) return null;
    schedule.set(day, ranges);
  }
  if (schedule.size !== 7) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const day = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].indexOf(weekday ?? "");
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (day < 0 || !Number.isFinite(hour) || !Number.isFinite(minute))
    return null;
  const currentMinute = hour * 60 + minute;
  const todayOpen = (schedule.get(day) ?? []).some(
    (range) =>
      range.end > range.start &&
      currentMinute >= range.start &&
      currentMinute < range.end,
  );
  const overnightOpen = (schedule.get((day + 6) % 7) ?? []).some(
    (range) => range.end < range.start && currentMinute < range.end,
  );
  const startsOvernight = (schedule.get(day) ?? []).some(
    (range) => range.end < range.start && currentMinute >= range.start,
  );
  return todayOpen || overnightOpen || startsOvernight
    ? "Abierto ahora"
    : "Cerrado ahora";
}

export function selectedReviews(reviews: StoredRestaurant["reviews"]) {
  return reviews
    .map((review, index) => ({ review, index }))
    .filter(({ review }) => review.text.trim())
    .sort((left, right) => {
      const leftTime = left.review.publishedAt
        ? Date.parse(left.review.publishedAt)
        : Number.NaN;
      const rightTime = right.review.publishedAt
        ? Date.parse(right.review.publishedAt)
        : Number.NaN;
      if (
        Number.isFinite(leftTime) &&
        Number.isFinite(rightTime) &&
        leftTime !== rightTime
      )
        return rightTime - leftTime;
      if (Number.isFinite(leftTime) !== Number.isFinite(rightTime))
        return Number.isFinite(leftTime) ? -1 : 1;
      return left.index - right.index;
    })
    .slice(0, 3)
    .map(({ review }) => review);
}

export function safeWebsite(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
