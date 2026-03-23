import type { DestinationConfig, RetryConfig } from "@/lib/destinations/types";

export interface DeliveryMessage {
  id: string;
  endpointId: string;
  eventType?: string;
  eventId?: string;
  payload: unknown | null;
  payloadKey?: string | null;
  timestamp: string;
  idempotencyKey?: string;
  retryConfig: RetryConfig;
  destination: DestinationConfig;
  isManualRetry?: boolean;
  originalMessageId?: string;
}
