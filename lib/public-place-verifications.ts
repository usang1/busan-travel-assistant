import "server-only";
import { createServerAnonClient } from "@/lib/server-supabase";
import type { PublicPlaceFieldVerification } from "@/lib/place-field-verification";

export async function getPublicPlaceFieldVerifications(placeId: string): Promise<PublicPlaceFieldVerification[]> {
  try {
    const client = createServerAnonClient();
    const { data, error } = await client
      .from("public_place_field_verifications")
      .select("place_id,field_name,source_type,verification_status,verified_at,provider,collected_at")
      .eq("place_id", placeId)
      .order("field_name");
    if (error) return [];
    return (data ?? []) as PublicPlaceFieldVerification[];
  } catch {
    return [];
  }
}
