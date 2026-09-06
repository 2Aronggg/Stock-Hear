import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import type { MarketTrade } from "../market/types.js";

const SAMPLE_SCHEMA_VERSION = 1;
const DEFAULT_SAMPLE_DIRECTORY = fileURLToPath(
  new URL("../../data/replay/", import.meta.url)
);

const marketTradeSchema = z.object({
  market: z.enum(["KR", "US"]),
  exchange: z.string().min(1),
  symbol: z.string().min(1),
  stockName: z.string().min(1),
  currency: z.enum(["KRW", "USD"]),
  currentPrice: z.number().finite(),
  changePrice: z.number().finite(),
  changeRate: z.number().finite(),
  tradeVolume: z.number().finite().nonnegative(),
  accumulatedVolume: z.number().finite().nonnegative(),
  tradeTime: z.string().min(1),
  receivedAt: z.string().datetime()
});

const replaySampleSchema = z
  .object({
    schemaVersion: z.literal(SAMPLE_SCHEMA_VERSION),
    symbol: z.string().min(1),
    market: z.enum(["KR", "US"]),
    capturedAt: z.string().datetime(),
    trades: z.array(marketTradeSchema).min(1)
  })
  .superRefine((sample, context) => {
    for (const [index, trade] of sample.trades.entries()) {
      if (trade.symbol.toUpperCase() !== sample.symbol.toUpperCase()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Trade symbol does not match the sample symbol.",
          path: ["trades", index, "symbol"]
        });
      }

      if (trade.market !== sample.market) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Trade market does not match the sample market.",
          path: ["trades", index, "market"]
        });
      }
    }
  });

export interface ReplaySample {
  schemaVersion: typeof SAMPLE_SCHEMA_VERSION;
  symbol: string;
  market: MarketTrade["market"];
  capturedAt: string;
  trades: MarketTrade[];
}

export interface SavedReplaySample {
  fileName: string;
  tradeCount: number;
  capturedAt: string;
}

export class ReplaySampleExistsError extends Error {
  constructor(symbol: string) {
    super(`Replay sample already exists for ${symbol}.`);
    this.name = "ReplaySampleExistsError";
  }
}

export class ReplaySampleStore {
  constructor(
    private readonly directory = DEFAULT_SAMPLE_DIRECTORY
  ) {}

  async save(
    symbol: string,
    trades: MarketTrade[]
  ): Promise<SavedReplaySample> {
    const normalizedSymbol = this.normalizeSymbol(symbol);

    if (trades.length === 0) {
      throw new Error("Cannot save an empty replay sample.");
    }

    if (
      trades.some(
        (trade) =>
          this.normalizeSymbol(trade.symbol) !== normalizedSymbol
      )
    ) {
      throw new Error("Replay sample contains a different symbol.");
    }

    const capturedAt = new Date().toISOString();
    const sample: ReplaySample = {
      schemaVersion: SAMPLE_SCHEMA_VERSION,
      symbol: normalizedSymbol,
      market: trades[0]!.market,
      capturedAt,
      trades
    };
    const fileName = `${normalizedSymbol}.json`;
    const filePath = join(this.directory, fileName);

    await mkdir(this.directory, { recursive: true });

    try {
      await writeFile(
        filePath,
        `${JSON.stringify(sample, null, 2)}\n`,
        {
          encoding: "utf8",
          flag: "wx"
        }
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        throw new ReplaySampleExistsError(normalizedSymbol);
      }

      throw error;
    }

    return {
      fileName,
      tradeCount: trades.length,
      capturedAt
    };
  }

  async loadAll(): Promise<Map<string, ReplaySample>> {
    let entries;

    try {
      entries = await readdir(this.directory, {
        withFileTypes: true
      });
    } catch (error) {
      if (this.hasErrorCode(error, "ENOENT")) {
        return new Map();
      }

      throw error;
    }

    const samples = new Map<string, ReplaySample>();
    const sampleFileNames = entries
      .filter(
        (entry) =>
          entry.isFile() && extname(entry.name).toLowerCase() === ".json"
      )
      .map((entry) => entry.name)
      .sort();

    for (const fileName of sampleFileNames) {
      const sample = await this.loadFile(fileName);

      if (samples.has(sample.symbol)) {
        throw new Error(
          `Duplicate replay sample symbol: ${sample.symbol}.`
        );
      }

      samples.set(sample.symbol, sample);
    }

    return samples;
  }

  async load(symbol: string): Promise<ReplaySample | null> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const fileName = `${normalizedSymbol}.json`;

    try {
      return await this.loadFile(fileName);
    } catch (error) {
      if (this.hasErrorCode(error, "ENOENT")) {
        return null;
      }

      throw error;
    }
  }

  private async loadFile(fileName: string): Promise<ReplaySample> {
    const filePath = join(this.directory, fileName);
    const rawSample = await readFile(filePath, "utf8");
    let parsedSample: unknown;

    try {
      parsedSample = JSON.parse(rawSample);
    } catch {
      throw new Error(`Replay sample is not valid JSON: ${fileName}.`);
    }

    const result = replaySampleSchema.safeParse(parsedSample);

    if (!result.success) {
      const invalidFields = result.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ");

      throw new Error(
        `Replay sample has invalid fields (${invalidFields}): ${fileName}.`
      );
    }

    const normalizedSymbol = this.normalizeSymbol(result.data.symbol);
    const fileSymbol = this.normalizeSymbol(
      basename(fileName, extname(fileName))
    );

    if (normalizedSymbol !== fileSymbol) {
      throw new Error(
        `Replay sample filename does not match its symbol: ${fileName}.`
      );
    }

    return {
      ...result.data,
      symbol: normalizedSymbol,
      trades: result.data.trades.map((trade) => ({
        ...trade,
        symbol: normalizedSymbol
      }))
    };
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private hasErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === code
    );
  }
}
