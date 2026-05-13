export interface CreateSubscriptionInput {
  tenantId: string;
  customerEmail: string;
  customerName: string;
  customerCpfCnpj?: string;
  plan: "starter" | "pro";
  monthlyPriceBrl: number;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
}

export interface SubscriptionResult {
  providerSubId: string;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: Date | null;
  paymentLink?: string;
}

export type WebhookEventType =
  | "subscription.created"
  | "subscription.activated"
  | "subscription.payment_received"
  | "subscription.payment_failed"
  | "subscription.canceled";

export interface WebhookEvent {
  type: WebhookEventType;
  providerSubId: string;
  occurredAt: Date;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult>;
  cancelSubscription(providerSubId: string): Promise<void>;
  parseWebhook(payload: unknown): WebhookEvent | null;
}
