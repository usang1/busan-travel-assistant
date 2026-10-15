"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Download, LocateFixed, Plus, Save } from "lucide-react";
import { TravelMap } from "@/components/TravelMap";
import { getCurrentBrowserLocation } from "@/lib/browser-geolocation";
import { placeCityCenters } from "@/lib/city-regions";
import { getPreferredMapProvider } from "@/lib/map-provider";
import { normalizeLatitude, normalizeLongitude } from "@/lib/map-url";
import type { PlaceWithRelations } from "@/types/database";

type Stay = { id: string; slug: string; name: string; stay_type: string; address: string; road_address: string | null; latitude: number; longitude: number; image_url: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; supported_locales: string[]; status: string };
type QrCampaign = { id: string; code: string; stay_id: string; destination_path: string; label: string; status: string };
type StayForm = Omit<Stay, "id" | "latitude" | "longitude"> & { id?: string; latitude: string; longitude: string; recommendationPlaceIds: string[] };

const emptyForm: StayForm = { slug: "", name: "", stay_type: "hotel", address: "", road_address: "", latitude: "", longitude: "", image_url: "", contact_name: "", contact_email: "", contact_phone: "", supported_locales: ["ko", "zh", "en", "ja"], status: "draft", recommendationPlaceIds: [] };
const inputClass = "h-12 w-full rounded-2xl bg-white px-4 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-600";

export function AdminStayManager({ accessToken, places }: { accessToken: string; places: PlaceWithRelations[] }) {
  const [stays, setStays] = useState<Stay[]>([]);
  const [qrs, setQrs] = useState<QrCampaign[]>([]);
  const [recommendations, setRecommendations] = useState<Array<{ stay_id: string; place_id: string }>>([]);
  const [form, setForm] = useState<StayForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const coordinates = useMemo(() => { const latitude = normalizeLatitude(form.latitude); const longitude = normalizeLongitude(form.longitude); return latitude === null || longitude === null ? null : { latitude, longitude }; }, [form.latitude, form.longitude]);
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }), [accessToken]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/stays", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "숙소 정보를 불러오지 못했습니다.");
      setStays(body.stays || []); setQrs(body.qrCampaigns || []); setRecommendations(body.recommendations || []); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "숙소 정보를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { void load(); }, [load]);

  function selectStay(stay: Stay) { setForm({ ...stay, latitude: String(stay.latitude), longitude: String(stay.longitude), road_address: stay.road_address || "", image_url: stay.image_url || "", contact_name: stay.contact_name || "", contact_email: stay.contact_email || "", contact_phone: stay.contact_phone || "", recommendationPlaceIds: recommendations.filter((item) => item.stay_id === stay.id).map((item) => item.place_id) }); }
  function update<Key extends keyof StayForm>(key: Key, value: StayForm[Key]) { setForm((current) => ({ ...current, [key]: value })); }
  async function reverse(latitude: number, longitude: number) { const response = await fetch("/api/location", { method: "POST", headers, body: JSON.stringify({ mode: "reverse", latitude, longitude }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "주소 확인에 실패했습니다."); if (body.result) setForm((current) => ({ ...current, latitude: latitude.toFixed(7), longitude: longitude.toFixed(7), address: body.result.jibunAddress || body.result.address || current.address, road_address: body.result.roadAddress || current.road_address })); }
  async function useCurrentLocation() { setMessage("현재 위치를 확인하는 중입니다."); try { const result = await getCurrentBrowserLocation(); setForm((current) => ({ ...current, latitude: result.coordinates.latitude.toFixed(7), longitude: result.coordinates.longitude.toFixed(7) })); await reverse(result.coordinates.latitude, result.coordinates.longitude); setMessage(result.lowAccuracy ? "현재 위치를 입력했습니다. 정확도가 낮아 지도에서 다시 확인해 주세요." : "현재 위치와 주소를 입력했습니다."); } catch (error) { setMessage(`${error instanceof Error ? error.message : "현재 위치를 확인하지 못했습니다."} 주소 검색 또는 지도 선택을 이용해 주세요.`); } }
  async function geocodeAddress() { if (!form.address.trim()) return setMessage("주소를 먼저 입력해 주세요."); setMessage("주소의 좌표를 확인하는 중입니다."); try { const response = await fetch("/api/location", { method: "POST", headers, body: JSON.stringify({ mode: "forward", query: form.road_address || form.address }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "주소 검색에 실패했습니다."); const result = body.results?.[0]; if (!result) throw new Error("주소 검색 결과가 없습니다."); setForm((current) => ({ ...current, latitude: result.latitude.toFixed(7), longitude: result.longitude.toFixed(7), address: result.jibunAddress || current.address, road_address: result.roadAddress || current.road_address })); setMessage("주소와 좌표를 확인했습니다."); } catch (error) { setMessage(error instanceof Error ? error.message : "주소 검색에 실패했습니다."); } }
  async function save() { setSaving(true); setMessage(""); try { const response = await fetch("/api/admin/stays", { method: "POST", headers, body: JSON.stringify(form) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "숙소 저장에 실패했습니다."); setMessage(body.qrWarning || "숙소 정보와 추천 장소를 저장했습니다."); await load(); if (!form.id) selectStay(body.stay); } catch (error) { setMessage(error instanceof Error ? error.message : "숙소 저장에 실패했습니다."); } finally { setSaving(false); } }

  return <section id="stay-management" className="scroll-mt-24 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Stay partners</p><h2 className="mt-1 text-2xl font-black">숙소·QR 관리</h2></div><button type="button" onClick={() => setForm(emptyForm)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={17} />새 숙소</button></div>
    {message ? <p role="status" className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{message}</p> : null}
    {loading ? <p className="mt-4 text-sm font-bold text-slate-500">숙소 정보를 불러오는 중입니다.</p> : <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-2">{stays.map((stay) => <button key={stay.id} type="button" onClick={() => selectStay(stay)} className="block w-full rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-200"><span className="font-black">{stay.name}</span><span className="mt-1 block text-xs text-slate-500">{stay.status} · {stay.slug}</span></button>)}{!stays.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">등록된 숙소가 없습니다.</p> : null}</aside>
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="숙소명"><input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} /></Field><Field label="URL slug"><input className={inputClass} value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></Field><Field label="숙소 유형"><select className={inputClass} value={form.stay_type} onChange={(e) => update("stay_type", e.target.value)}>{["hotel", "hostel", "guesthouse", "residence", "pension", "other"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="제휴 상태"><select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>{["draft", "pending_review", "active", "suspended", "rejected"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="지번 주소"><input className={inputClass} value={form.address} onChange={(e) => update("address", e.target.value)} /></Field><Field label="도로명 주소"><input className={inputClass} value={form.road_address || ""} onChange={(e) => update("road_address", e.target.value)} /></Field></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void geocodeAddress()} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-black text-white">주소로 좌표 찾기</button><button type="button" onClick={() => void useCurrentLocation()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-teal-800 ring-1 ring-teal-200"><LocateFixed size={16} />현재 위치</button></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="위도"><input className={inputClass} inputMode="decimal" value={form.latitude} onChange={(e) => update("latitude", e.target.value)} /></Field><Field label="경도"><input className={inputClass} inputMode="decimal" value={form.longitude} onChange={(e) => update("longitude", e.target.value)} /></Field></div>
        <TravelMap center={coordinates || placeCityCenters.busan} markers={[]} userLocation={coordinates} provider={getPreferredMapProvider()} locale="ko" onSelectPosition={(position) => { setForm((current) => ({ ...current, latitude: position.latitude.toFixed(7), longitude: position.longitude.toFixed(7) })); void reverse(position.latitude, position.longitude); }} className="h-[340px]" />
        <div className="grid gap-3 sm:grid-cols-2"><Field label="대표 이미지 HTTPS URL"><input className={inputClass} value={form.image_url || ""} onChange={(e) => update("image_url", e.target.value)} /></Field><Field label="담당자"><input className={inputClass} value={form.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} /></Field><Field label="담당자 이메일"><input className={inputClass} type="email" value={form.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} /></Field><Field label="담당자 전화"><input className={inputClass} value={form.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} /></Field></div>
        <div><p className="text-sm font-black">추천 장소</p><div className="mt-2 grid max-h-64 gap-2 overflow-auto rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">{places.map((place) => <label key={place.id} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm font-bold"><input type="checkbox" checked={form.recommendationPlaceIds.includes(place.id)} onChange={(e) => update("recommendationPlaceIds", e.target.checked ? [...form.recommendationPlaceIds, place.id] : form.recommendationPlaceIds.filter((id) => id !== place.id))} />{place.name_ko}</label>)}</div></div>
        {form.id ? <div className="flex flex-wrap gap-2">{qrs.filter((qr) => qr.stay_id === form.id).map((qr) => <a key={qr.id} href={`/api/qr/${qr.code}?download=1`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-50 px-4 text-sm font-black text-indigo-800 ring-1 ring-indigo-200"><Download size={16} />{qr.label} 다운로드</a>)}<a href={`/ko/stays/${form.slug}`} target="_blank" className="inline-flex min-h-11 items-center rounded-xl bg-slate-50 px-4 text-sm font-black ring-1 ring-slate-200">랜딩 미리보기</a></div> : null}
        <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50"><Save size={17} />{saving ? "저장 중" : "숙소 저장"}</button>
      </div>
    </div>}
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">{label}</span>{children}</label>; }
