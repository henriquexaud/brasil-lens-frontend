// "2026-10-16" → "16/10/2026", sem passar por Date (o fuso deslocaria o dia).
export function formatAlertDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
