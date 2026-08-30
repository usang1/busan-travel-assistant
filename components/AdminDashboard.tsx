import { Camera, Clock3, MapPinned, Star, Tags, type LucideIcon } from "lucide-react";
import { isPublicPlace } from "@/lib/place-publishing";
import { categoryLabels, type PhotoSpotRecord, type PlaceWithRelations } from "@/types/database";

type AdminDashboardProps = {
  places: PlaceWithRelations[];
  photoSpots: PhotoSpotRecord[];
};

export function AdminDashboard({ places, photoSpots }: AdminDashboardProps) {
  const activePlaces = places.filter(isPublicPlace);
  const featuredPlaces = places.filter((place) => place.is_featured);
  const proPhotoSpots = photoSpots.filter((spot) => spot.free_or_pro === "pro");
  const categoryCounts = places.reduce<Record<string, number>>((acc, place) => {
    acc[place.category] = (acc[place.category] ?? 0) + 1;
    return acc;
  }, {});
  const recentPlaces = [...places]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <section className="mt-8 space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={MapPinned} label="전체 장소" value={places.length.toString()} />
        <Stat icon={Tags} label="활성 장소" value={activePlaces.length.toString()} />
        <Stat icon={Star} label="추천 장소" value={featuredPlaces.length.toString()} />
        <Stat icon={Camera} label="PRO 사진스팟" value={proPhotoSpots.length.toString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-black text-slate-950">카테고리별 장소</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(categoryCounts).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-bold text-slate-700">{categoryLabels[category as keyof typeof categoryLabels].ko}</span>
                <span className="font-black text-slate-950">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-black text-slate-950">최근 수정 장소</h2>
          <div className="mt-4 space-y-3">
            {recentPlaces.map((place) => (
              <div key={place.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{place.name_ko}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{place.name_zh}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
                    {isPublicPlace(place) ? "공개" : place.status ?? "DRAFT"}
                  </span>
                </div>
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                  <Clock3 size={13} aria-hidden="true" />
                  {new Date(place.updated_at).toLocaleString("ko-KR")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Icon size={22} className="text-teal-700" aria-hidden="true" />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}
