import type { PassProduct } from "@/config/monetization";

export type PaymentProviderId = "mock" | "alipay" | "alipay_plus" | "wechat_pay" | "card";

export type PaymentRequest = {
  product: PassProduct;
  anonymousSessionId: string;
};

export type PaymentResult = {
  ok: boolean;
  provider: PaymentProviderId;
  transactionId: string;
  paidAt: string;
  expirationAt: string;
};

export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
