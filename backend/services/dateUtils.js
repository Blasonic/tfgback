const { DateTime } = require("luxon");

const ZONE = "Europe/Madrid";

function nowMadrid() {
  return DateTime.now().setZone(ZONE);
}

function toSql(dt) {
  return dt.toFormat("yyyy-LL-dd HH:mm:ss");
}

function rangeToday() {
  const now = nowMadrid();
  const from = now.startOf("day");
  const to = from.plus({ days: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: "hoy",
  };
}

function rangeTomorrow() {
  const now = nowMadrid();
  const from = now.startOf("day").plus({ days: 1 });
  const to = from.plus({ days: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: "mañana",
  };
}

function rangeThisWeekend() {
  const now = nowMadrid();
  let friday = now.startOf("week").plus({ days: 4 });

  if (now.weekday > 5) {
    friday = friday.plus({ weeks: 1 });
  }

  const from = friday.startOf("day");
  const to = from.plus({ days: 3 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: "este finde",
  };
}

function rangeThisWeek() {
  const now = nowMadrid();
  const from = now.startOf("day");
  const to = now.endOf("week").plus({ days: 1 }).startOf("day");

  return {
    from: toSql(from),
    to: toSql(to),
    label: "esta semana",
  };
}

function rangeThisMonth() {
  const now = nowMadrid();
  const from = now.startOf("month");
  const to = from.plus({ months: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: "este mes",
  };
}

function rangeNextMonth() {
  const now = nowMadrid();
  const from = now.plus({ months: 1 }).startOf("month");
  const to = from.plus({ months: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: "mes que viene",
  };
}

function rangeSpecificMonth(month, year = nowMadrid().year) {
  const from = DateTime.fromObject({ year, month, day: 1 }, { zone: ZONE }).startOf("day");
  const to = from.plus({ months: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: from.setLocale("es").toFormat("LLLL"),
  };
}

function rangeNextWeekday(targetWeekday) {
  const now = nowMadrid();
  let candidate = now.startOf("day");

  while (candidate.weekday !== targetWeekday || candidate < now.startOf("day")) {
    candidate = candidate.plus({ days: 1 });
  }

  return {
    from: toSql(candidate.startOf("day")),
    to: toSql(candidate.plus({ days: 1 }).startOf("day")),
    label: candidate.setLocale("es").toFormat("cccc"),
  };
}

function defaultRange14Days() {
  const now = nowMadrid();

  return {
    from: toSql(now.startOf("day")),
    to: toSql(now.startOf("day").plus({ days: 14 })),
    label: "próximos 14 días",
  };
}

module.exports = {
  rangeToday,
  rangeTomorrow,
  rangeThisWeekend,
  rangeThisWeek,
  rangeThisMonth,
  rangeNextMonth,
  rangeSpecificMonth,
  rangeNextWeekday,
  defaultRange14Days,
};