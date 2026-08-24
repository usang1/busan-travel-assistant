import { addDays, type PaymentProvider, type PaymentRequest, type PaymentResult } from "@/lib/payment/provider";

export class MockPaymentProvider implements PaymentProvider {
  id = "mock" as const;
  label = "Mock Payment";

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => window.setTimeout(resolve, 600));

    const paidAt = new Date();

    return {
      ok: true,
      provider: this.id,
      transactionId: `mock_${request.product.id}_${Date.now()}`,
      paidAt: paidAt.toISOString(),
      expirationAt: addDays(paidAt, request.product.durationDays).toISOString(),
    };
  }
}
