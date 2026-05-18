export interface BusinessHours {
  mon: { open: string; close: string } | null;
  tue: { open: string; close: string } | null;
  wed: { open: string; close: string } | null;
  thu: { open: string; close: string } | null;
  fri: { open: string; close: string } | null;
  sat: { open: string; close: string } | null;
  sun: { open: string; close: string } | null;
}

export interface TenantBotInfo {
  storeName: string;
  niche: string;
  botName: string;
  tone: string;
  businessHours: BusinessHours;
  deliveryCities: string[];
  paymentMethods: string[];
  acceptsScheduling: boolean;
  extraInstructions: string;
}

export interface ProductInfo {
  id: string;
  name: string;
  description: string | null;
  priceBrl: number;
  stock: number;
}

export interface PromptContext {
  bot: TenantBotInfo;
  products: ProductInfo[];
  currentDateTimeBrt: string; // ISO ou string formatada em Sao Paulo
}
