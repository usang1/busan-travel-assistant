import type { Locale } from "@/lib/i18n";

export const photoSpotCopy = {
  ko: { title: "사진스팟", original: "한국어 원문명", bestTime: "추천 시간", zoom: "추천 배율", subject: "인물 위치", camera: "카메라 위치", tips: "촬영 팁", portrait: "인물", lighting: "조명", location: "위치", pending: "번역된 정보 준비 중", unavailable: "사진스팟을 불러오지 못했습니다.", locked: "Pro 사진스팟", lockedDescription: "이 사진스팟의 상세 정보는 Pro에서 확인할 수 있습니다.", contact: "문의하기", free: "무료" },
  zh: { title: "拍照地图", original: "韩文原名", bestTime: "最佳时间", zoom: "推荐倍率", subject: "人物位置", camera: "相机位置", tips: "拍照提示", portrait: "人物", lighting: "光线", location: "位置", pending: "翻译信息准备中", unavailable: "无法加载拍照地点。", locked: "Pro 拍照地点", lockedDescription: "Pro 可查看此拍照地点的详细信息。", contact: "联系我们", free: "免费" },
  en: { title: "Photo spots", original: "Korean original name", bestTime: "Best time", zoom: "Recommended zoom", subject: "Subject position", camera: "Camera position", tips: "Photo tips", portrait: "Portrait", lighting: "Lighting", location: "Location", pending: "Translated information pending", unavailable: "Photo spots could not be loaded.", locked: "Pro photo spot", lockedDescription: "Details for this photo spot are available with Pro.", contact: "Contact us", free: "Free" },
  ja: { title: "フォトスポット", original: "韓国語原名", bestTime: "おすすめ時間", zoom: "おすすめ倍率", subject: "人物の位置", camera: "カメラの位置", tips: "撮影のヒント", portrait: "人物", lighting: "光", location: "場所", pending: "翻訳情報を準備中", unavailable: "撮影スポットを読み込めませんでした。", locked: "Pro フォトスポット", lockedDescription: "この撮影スポットの詳細はProで確認できます。", contact: "お問い合わせ", free: "無料" },
} satisfies Record<Locale, Record<string, string>>;
