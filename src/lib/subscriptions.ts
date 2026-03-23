export const ALL_EVENT_TYPES = "*" as const;

export function normalizeEventSubscriptions(value: string[] | null | undefined): string[] {
  if (!value || value.length === 0) {
    return [ALL_EVENT_TYPES];
  }

  const normalized = Array.from(
    new Set(
      value
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => (item === ALL_EVENT_TYPES ? ALL_EVENT_TYPES : item))
    )
  );

  return normalized.length > 0 ? normalized : [ALL_EVENT_TYPES];
}

export function parseEventSubscriptions(raw: string | null | undefined): string[] {
  if (!raw) {
    return [ALL_EVENT_TYPES];
  }

  try {
    return normalizeEventSubscriptions(JSON.parse(raw) as string[]);
  } catch {
    return [ALL_EVENT_TYPES];
  }
}

export function serializeEventSubscriptions(value: string[] | null | undefined): string {
  return JSON.stringify(normalizeEventSubscriptions(value));
}

export function matchesEventSubscription(
  subscriptions: string[] | null | undefined,
  eventType?: string | null
): boolean {
  const normalized = normalizeEventSubscriptions(subscriptions ?? undefined);

  if (normalized.includes(ALL_EVENT_TYPES)) {
    return true;
  }

  if (!eventType) {
    return false;
  }

  return normalized.includes(eventType);
}
