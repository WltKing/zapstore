import type {
  CreateSubscriptionInput,
  PaymentProvider,
  SubscriptionResult,
  WebhookEvent,
  WebhookEventType,
} from "../types.js";

// Asaas API v3 — https://docs.asaas.com/

const BASE = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  production: "https://www.asaas.com/api/v3",
};

interface AsaasCustomer {
  id: string;
  email?: string;
  name?: string;
}

interface AsaasSubscription {
  id: string;
  status: string;
  nextDueDate: string;
  value: number;
  cycle: string;
  paymentLink?: string;
}

export class AsaasProvider implements PaymentProvider {
  readonly name = "asaas";
  private apiKey: string;
  private apiUrl: string;

  constructor(opts: { apiKey: string; env: "sandbox" | "production" }) {
    this.apiKey = opts.apiKey;
    this.apiUrl = BASE[opts.env];
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asaas ${method} ${path}: ${res.status} ${text}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : ({} as T)) as T;
  }

  private async findOrCreateCustomer(input: CreateSubscriptionInput): Promise<AsaasCustomer> {
    // Busca por email
    const search = await this.request<{ data: AsaasCustomer[] }>(
      "GET",
      `/customers?email=${encodeURIComponent(input.customerEmail)}`,
    );
    if (search.data?.length > 0) return search.data[0]!;

    const created = await this.request<AsaasCustomer>("POST", "/customers", {
      name: input.customerName,
      email: input.customerEmail,
      cpfCnpj: input.customerCpfCnpj,
    });
    return created;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    const customer = await this.findOrCreateCustomer(input);

    // Primeira cobranca 7 dias a partir de hoje (trial)
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 7);
    const yyyy = nextDueDate.getFullYear();
    const mm = String(nextDueDate.getMonth() + 1).padStart(2, "0");
    const dd = String(nextDueDate.getDate()).padStart(2, "0");

    const sub = await this.request<AsaasSubscription>("POST", "/subscriptions", {
      customer: customer.id,
      billingType: input.billingType,
      value: input.monthlyPriceBrl,
      nextDueDate: `${yyyy}-${mm}-${dd}`,
      cycle: "MONTHLY",
      description: `Zapstore — assinatura ${input.plan}`,
      externalReference: input.tenantId,
    });

    return {
      providerSubId: sub.id,
      status: "trialing", // primeiros 7 dias antes da primeira cobranca
      currentPeriodEnd: nextDueDate,
      paymentLink: sub.paymentLink,
    };
  }

  async cancelSubscription(providerSubId: string): Promise<void> {
    await this.request("DELETE", `/subscriptions/${providerSubId}`);
  }

  parseWebhook(payload: unknown): WebhookEvent | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    const eventName = String(p.event ?? "");

    const map: Record<string, WebhookEventType> = {
      SUBSCRIPTION_CREATED: "subscription.created",
      SUBSCRIPTION_INACTIVATED: "subscription.canceled",
      SUBSCRIPTION_DELETED: "subscription.canceled",
      PAYMENT_CREATED: "subscription.created",
      PAYMENT_RECEIVED: "subscription.payment_received",
      PAYMENT_CONFIRMED: "subscription.payment_received",
      PAYMENT_OVERDUE: "subscription.payment_failed",
      PAYMENT_REFUNDED: "subscription.payment_failed",
    };
    const type = map[eventName];
    if (!type) return null;

    // Pra eventos de pagamento, o subscriptionId vem dentro de payment.subscription.
    const payment = p.payment as Record<string, unknown> | undefined;
    const subscription = p.subscription as Record<string, unknown> | undefined;
    const subId =
      (payment?.subscription as string | undefined) ??
      (subscription?.id as string | undefined) ??
      "";
    if (!subId) return null;

    return {
      type,
      providerSubId: subId,
      occurredAt: new Date(),
      raw: payload,
    };
  }
}
