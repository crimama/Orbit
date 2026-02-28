import { deflateSync, inflateSync } from "zlib";
import {
  DELTA_MIN_PAYLOAD_BYTES,
  DELTA_FLUSH_INTERVAL_MS,
  DELTA_FLUSH_THRESHOLD_BYTES,
} from "@/lib/constants";

export interface CompressResult {
  compressed: boolean;
  payload: Buffer | string;
}

/**
 * Compress terminal data if it exceeds the minimum payload threshold.
 * Used for SSH terminal relay to reduce bandwidth on large outputs.
 */
export function compressIfNeeded(data: string): CompressResult {
  if (Buffer.byteLength(data, "utf-8") >= DELTA_MIN_PAYLOAD_BYTES) {
    const deflated = deflateSync(Buffer.from(data, "utf-8"));
    return { compressed: true, payload: deflated };
  }
  return { compressed: false, payload: data };
}

/**
 * Decompress a previously compressed terminal data buffer.
 */
export function decompress(data: Buffer): string {
  return inflateSync(data).toString("utf-8");
}

/**
 * Batches small PTY data chunks and applies delta compression before emitting.
 *
 * PTY output arrives as many tiny chunks (a few bytes each). Emitting each one
 * individually wastes bandwidth and prevents effective compression. DeltaBatcher
 * accumulates data and flushes when either:
 *   - the buffer reaches DELTA_FLUSH_THRESHOLD_BYTES (immediate flush for large outputs)
 *   - DELTA_FLUSH_INTERVAL_MS elapses (keeps latency ≤16ms for interactive use)
 */
type EmitFn = (payload: string | Buffer, compressed: boolean) => void;

export class DeltaBatcher {
  private buffer = "";
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly emitFn: EmitFn,
    private readonly flushIntervalMs = DELTA_FLUSH_INTERVAL_MS,
    private readonly flushThresholdBytes = DELTA_FLUSH_THRESHOLD_BYTES,
  ) {}

  push(data: string): void {
    this.buffer += data;
    if (Buffer.byteLength(this.buffer, "utf-8") >= this.flushThresholdBytes) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.buffer) return;
    const { compressed, payload } = compressIfNeeded(this.buffer);
    this.buffer = "";
    this.emitFn(payload, compressed);
  }

  destroy(): void {
    this.flush();
  }
}
