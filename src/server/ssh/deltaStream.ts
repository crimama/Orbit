import { deflateSync, inflateSync } from "zlib";
import { DELTA_MIN_PAYLOAD_BYTES } from "@/lib/constants";

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
