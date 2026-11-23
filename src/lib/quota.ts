export const LIMITS = {
  image: Number(process.env.DAILY_IMAGE_LIMIT || 6),
  text: Number(process.env.DAILY_TEXT_LIMIT || 300),
};
export type Kind = "image" | "text";
export async function consume(sb: any, kind: Kind): Promise<number> {
  const { data, error } = await sb.rpc("consume_quota", { p_kind: kind, p_limit: LIMITS[kind] });
  if (error) throw new Error("Quota check failed: " + error.message);
  return data as number; // remaining, or -1 if exhausted
}
export async function refund(sb: any, kind: Kind) { await sb.rpc("refund_quota", { p_kind: kind }); }
export async function status(sb: any) {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("usage_daily").select("kind,count").eq("day", day);
  const used = (k: Kind) => data?.find((r: any) => r.kind === k)?.count ?? 0;
  return {
    image: { used: used("image"), limit: LIMITS.image, remaining: Math.max(LIMITS.image - used("image"), 0) },
    text: { used: used("text"), limit: LIMITS.text, remaining: Math.max(LIMITS.text - used("text"), 0) },
    resetsAtUtc: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
  };
}
