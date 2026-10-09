const SECOND_MS: number = 1000;
const JUST_NOW_SECONDS: number = 45;
const MINUTES_PER_HOUR: number = 60;
const SECONDS_PER_MINUTE: number = 60;
const HOURS_PER_DAY: number = 24;
const DAYS_PER_WEEK: number = 7;

const SAME_YEAR: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
const OTHER_YEAR: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function calendarDate(time: number, now: number): string {
  const date: Date = new Date(time);
  const isThisYear: boolean = date.getFullYear() === new Date(now).getFullYear();
  return (isThisYear ? SAME_YEAR : OTHER_YEAR).format(date);
}

/** "just now", "3 min ago", "2 h ago", "Yesterday", "4 days ago", then "Oct 2" (v1's wording). */
export function relativeTime(time: number, now: number): string {
  const seconds: number = Math.max(0, Math.round((now - time) / SECOND_MS));
  if (seconds < JUST_NOW_SECONDS) {
    return 'just now';
  }
  const minutes: number = Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) {
    return `${String(minutes)} min ago`;
  }
  const hours: number = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${String(hours)} h ago`;
  }
  const days: number = Math.round(hours / HOURS_PER_DAY);
  if (days < DAYS_PER_WEEK) {
    return days === 1 ? 'Yesterday' : `${String(days)} days ago`;
  }
  return calendarDate(time, now);
}
