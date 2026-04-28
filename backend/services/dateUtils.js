const { DateTime } = require("luxon");

const ZONE = "Europe/Madrid";

function getLang(language = "es") {
  return String(language || "es").startsWith("en") ? "en" : "es";
}

function nowMadrid() {
  return DateTime.now().setZone(ZONE);
}

function toSql(dt) {
  return dt.toFormat("yyyy-LL-dd HH:mm:ss");
}

function rangeToday(language = "es") {
  const now = nowMadrid();
  const from = now.startOf("day");
  const to = from.plus({ days: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: getLang(language) === "en" ? "today" : "hoy",
  };
}

function rangeTomorrow(language = "es") {
  const now = nowMadrid();
  const from = now.startOf("day").plus({ days: 1 });
  const to = from.plus({ days: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: getLang(language) === "en" ? "tomorrow" : "mañana",
  };
}

function rangeThisWeekend(language = "es") {
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
    label: getLang(language) === "en" ? "this weekend" : "este finde",
  };
}

function rangeThisWeek(language = "es") {
  const now = nowMadrid();
  const from = now.startOf("day");
  const to = now.endOf("week").plus({ days: 1 }).startOf("day");

  return {
    from: toSql(from),
    to: toSql(to),
    label: getLang(language) === "en" ? "this week" : "esta semana",
  };
}

function rangeThisMonth(language = "es") {
  const now = nowMadrid();
  const from = now.startOf("month");
  const to = from.plus({ months: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: getLang(language) === "en" ? "this month" : "este mes",
  };
}

function rangeNextMonth(language = "es") {
  const now = nowMadrid();
  const from = now.plus({ months: 1 }).startOf("month");
  const to = from.plus({ months: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: getLang(language) === "en" ? "next month" : "mes que viene",
  };
}

function rangeSpecificMonth(month, year = nowMadrid().year, language = "es") {
  const lang = getLang(language);
  const from = DateTime.fromObject(
    { year, month, day: 1 },
    { zone: ZONE }
  ).startOf("day");

  const to = from.plus({ months: 1 });

  return {
    from: toSql(from),
    to: toSql(to),
    label: from.setLocale(lang === "en" ? "en" : "es").toFormat("LLLL"),
  };
}

function rangeNextWeekday(targetWeekday, language = "es") {
  const lang = getLang(language);
  const now = nowMadrid();
  let candidate = now.startOf("day");

  while (candidate.weekday !== targetWeekday || candidate < now.startOf("day")) {
    candidate = candidate.plus({ days: 1 });
  }

  return {
    from: toSql(candidate.startOf("day")),
    to: toSql(candidate.plus({ days: 1 }).startOf("day")),
    label: candidate.setLocale(lang === "en" ? "en" : "es").toFormat("cccc"),
  };
}

function defaultRange14Days(language = "es") {
  const now = nowMadrid();

  return {
    from: toSql(now.startOf("day")),
    to: toSql(now.startOf("day").plus({ days: 14 })),
    label:
      getLang(language) === "en"
        ? "the next 14 days"
        : "próximos 14 días",
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