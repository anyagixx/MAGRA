// === MODULE_CONTRACT ===
// FILE: dashboard/src/currency.ts
// VERSION: 1.0.0
// PURPOSE: Format dashboard USD-denominated costs in selectable display currencies.
// SCOPE: RUB/USD/CNY display currency selection, online USD exchange-rate loading, and safe formatting fallbacks.
// DEPENDS: M-REASONIX-BASE
// LINKS: docs/modules/M-WEB-CURRENCY-DISPLAY.xml
// ROLE: UTILITY
// MAP_MODE: EXPORTS
// START_MODULE_CONTRACT
// END_MODULE_CONTRACT
// === END_MODULE_CONTRACT ===
//
// === MODULE_MAP ===
// Exports: DisplayCurrency, ExchangeRates, DISPLAY_CURRENCIES, isDisplayCurrency, nextDisplayCurrency, symbolForCurrency, formatCurrencyAmount, fetchExchangeRates
// Locals: parseExchangeRatePayload, numericRate, withTimeoutSignal
// === END_MODULE_MAP ===
//
// === CHANGE_SUMMARY ===
// Added RUB/USD/CNY dashboard display currency formatting and online rate loading.
// === END_CHANGE_SUMMARY ===

export type DisplayCurrency = "RUB" | "USD" | "CNY";

export interface ExchangeRates {
  usdToRub?: number;
  usdToCny?: number;
  source?: string;
  updatedAt?: string;
  fetchedAt?: string;
  error?: string;
}

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["RUB", "USD", "CNY"];
export const DEFAULT_USD_TO_CNY = 7.2;
export const EXCHANGE_RATE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// === START_CONTRACT: isDisplayCurrency ===
// PURPOSE: Validate a stored display currency value.
// INPUTS: value: unknown
// OUTPUTS: value is DisplayCurrency
// SIDE_EFFECTS: none
// === END_CONTRACT: isDisplayCurrency ===
export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  // === START_BLOCK_VALIDATE_CURRENCY ===
  return value === "RUB" || value === "USD" || value === "CNY";
  // === END_BLOCK_VALIDATE_CURRENCY ===
}

// === START_CONTRACT: nextDisplayCurrency ===
// PURPOSE: Cycle dashboard display currency in the order requested by the operator.
// INPUTS: currency: DisplayCurrency
// OUTPUTS: DisplayCurrency
// SIDE_EFFECTS: none
// === END_CONTRACT: nextDisplayCurrency ===
export function nextDisplayCurrency(currency: DisplayCurrency): DisplayCurrency {
  // === START_BLOCK_CYCLE_CURRENCY ===
  if (currency === "RUB") return "USD";
  if (currency === "USD") return "CNY";
  return "RUB";
  // === END_BLOCK_CYCLE_CURRENCY ===
}

// === START_CONTRACT: symbolForCurrency ===
// PURPOSE: Return the UI symbol for a supported dashboard display currency.
// INPUTS: currency: DisplayCurrency
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: symbolForCurrency ===
export function symbolForCurrency(currency: DisplayCurrency): string {
  // === START_BLOCK_SYMBOL_FOR_CURRENCY ===
  if (currency === "RUB") return "₽";
  if (currency === "USD") return "$";
  return "¥";
  // === END_BLOCK_SYMBOL_FOR_CURRENCY ===
}

// === START_CONTRACT: formatCurrencyAmount ===
// PURPOSE: Format a USD-denominated cost in the requested dashboard display currency.
// INPUTS: amountUsd: number; currency: DisplayCurrency; rates?: ExchangeRates; fractionDigits?: number
// OUTPUTS: string
// SIDE_EFFECTS: none
// === END_CONTRACT: formatCurrencyAmount ===
export function formatCurrencyAmount(
  amountUsd: number,
  currency: DisplayCurrency,
  rates: ExchangeRates = {},
  fractionDigits = 4,
): string {
  // === START_BLOCK_FORMAT_CURRENCY_AMOUNT ===
  const symbol = symbolForCurrency(currency);
  const rate = usdRateForCurrency(currency, rates);
  if (amountUsd === 0) return `${symbol} ${(0).toFixed(fractionDigits)}`;
  if (rate === undefined) return `${symbol} —`;
  return `${symbol} ${(amountUsd * rate).toFixed(fractionDigits)}`;
  // === END_BLOCK_FORMAT_CURRENCY_AMOUNT ===
}

// === START_CONTRACT: usdRateForCurrency ===
// PURPOSE: Resolve a USD conversion multiplier for a supported display currency.
// INPUTS: currency: DisplayCurrency; rates?: ExchangeRates
// OUTPUTS: number | undefined
// SIDE_EFFECTS: none
// === END_CONTRACT: usdRateForCurrency ===
export function usdRateForCurrency(
  currency: DisplayCurrency,
  rates: ExchangeRates = {},
): number | undefined {
  // === START_BLOCK_RATE_FOR_CURRENCY ===
  if (currency === "USD") return 1;
  if (currency === "CNY") return rates.usdToCny ?? DEFAULT_USD_TO_CNY;
  return rates.usdToRub;
  // === END_BLOCK_RATE_FOR_CURRENCY ===
}

// === START_CONTRACT: fetchExchangeRates ===
// PURPOSE: Load current online USD conversion rates used by dashboard cost display.
// INPUTS: options?: { fetchImpl?: FetchLike; endpoint?: string; timeoutMs?: number }
// OUTPUTS: Promise<ExchangeRates>
// SIDE_EFFECTS: performs an HTTP GET unless fetchImpl is injected
// === END_CONTRACT: fetchExchangeRates ===
export async function fetchExchangeRates(
  options: { fetchImpl?: FetchLike; endpoint?: string; timeoutMs?: number } = {},
): Promise<ExchangeRates> {
  // === START_BLOCK_FETCH_EXCHANGE_RATES ===
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  if (!fetchImpl) throw new Error("fetch unavailable");
  const { signal, cleanup } = withTimeoutSignal(options.timeoutMs ?? 3000);
  try {
    const response = await fetchImpl(options.endpoint ?? EXCHANGE_RATE_ENDPOINT, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`exchange-rate status ${response.status}`);
    return parseExchangeRatePayload(await response.json());
  } finally {
    cleanup();
  }
  // === END_BLOCK_FETCH_EXCHANGE_RATES ===
}

function parseExchangeRatePayload(payload: unknown): ExchangeRates {
  const body = payload as {
    result?: unknown;
    provider?: unknown;
    time_last_update_utc?: unknown;
    rates?: Record<string, unknown>;
  };
  if (body.result && body.result !== "success") {
    throw new Error(`exchange-rate result ${String(body.result)}`);
  }
  const usdToRub = numericRate(body.rates?.RUB);
  const usdToCny = numericRate(body.rates?.CNY);
  if (usdToRub === undefined && usdToCny === undefined) {
    throw new Error("exchange-rate payload missing RUB/CNY rates");
  }
  return {
    ...(usdToRub !== undefined ? { usdToRub } : {}),
    ...(usdToCny !== undefined ? { usdToCny } : {}),
    source: typeof body.provider === "string" ? body.provider : EXCHANGE_RATE_ENDPOINT,
    updatedAt:
      typeof body.time_last_update_utc === "string" ? body.time_last_update_utc : undefined,
    fetchedAt: new Date().toISOString(),
  };
}

function numericRate(value: unknown): number | undefined {
  const rate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

function withTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => globalThis.clearTimeout(timer),
  };
}
