// === MODULE_CONTRACT ===
// FILE: tests/dashboard-currency.test.ts
// VERSION: 1.0.0
// PURPOSE: Verify MAGRA dashboard display currency conversion and exchange-rate loading.
// SCOPE: RUB/USD/CNY cycling, USD-denominated cost formatting, fallback handling, and online rate payload parsing.
// DEPENDS: M-WEB-CURRENCY-DISPLAY
// LINKS: docs/verification/V-M-WEB-CURRENCY-DISPLAY.xml
// ROLE: TEST
// MAP_MODE: LOCALS
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Locals: dashboard currency utility assertions
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added dashboard display currency verification.
// === END_CHANGE_SUMMARY ===

import { describe, expect, it } from "vitest";
import {
  fetchExchangeRates,
  formatCurrencyAmount,
  isDisplayCurrency,
  nextDisplayCurrency,
  symbolForCurrency,
} from "../dashboard/src/currency";

describe("dashboard display currency", () => {
  it("cycles RUB -> USD -> CNY -> RUB", () => {
    // === START_BLOCK_ASSERT_CURRENCY_CYCLE ===
    expect(nextDisplayCurrency("RUB")).toBe("USD");
    expect(nextDisplayCurrency("USD")).toBe("CNY");
    expect(nextDisplayCurrency("CNY")).toBe("RUB");
    // === END_BLOCK_ASSERT_CURRENCY_CYCLE ===
  });

  it("formats USD-denominated costs in RUB, USD, and CNY", () => {
    // === START_BLOCK_ASSERT_FORMAT_COST ===
    const rates = { usdToRub: 91.25, usdToCny: 7.18 };
    expect(formatCurrencyAmount(0.5, "RUB", rates)).toBe("₽ 45.6250");
    expect(formatCurrencyAmount(0.5, "USD", rates)).toBe("$ 0.5000");
    expect(formatCurrencyAmount(0.5, "CNY", rates)).toBe("¥ 3.5900");
    // === END_BLOCK_ASSERT_FORMAT_COST ===
  });

  it("keeps CNY fallback and waits for RUB online rate", () => {
    // === START_BLOCK_ASSERT_RATE_FALLBACKS ===
    expect(formatCurrencyAmount(0.5, "CNY")).toBe("¥ 3.6000");
    expect(formatCurrencyAmount(0.5, "RUB")).toBe("₽ —");
    expect(formatCurrencyAmount(0, "RUB")).toBe("₽ 0.0000");
    expect(symbolForCurrency("RUB")).toBe("₽");
    expect(isDisplayCurrency("RUB")).toBe(true);
    expect(isDisplayCurrency("EUR")).toBe(false);
    // === END_BLOCK_ASSERT_RATE_FALLBACKS ===
  });

  it("parses online exchange-rate payloads through injected fetch", async () => {
    // === START_BLOCK_ASSERT_RATE_FETCH ===
    const rates = await fetchExchangeRates({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          result: "success",
          provider: "test",
          time_last_update_utc: "Tue, 02 Jun 2026 00:02:32 +0000",
          rates: { RUB: 71.811965, CNY: 6.780899 },
        }),
      }),
    });

    expect(rates).toMatchObject({
      usdToRub: 71.811965,
      usdToCny: 6.780899,
      source: "test",
      updatedAt: "Tue, 02 Jun 2026 00:02:32 +0000",
    });
    expect(typeof rates.fetchedAt).toBe("string");
    // === END_BLOCK_ASSERT_RATE_FETCH ===
  });
});
