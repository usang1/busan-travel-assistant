import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "服务说明",
  "韩国旅行助手 서울·부산·제주 서비스 범위, 데이터 출처와 이용 안내",
  "/service-info",
);

export default function ServiceInfoPage() {
  return (
    <LegalPage
      titleZh="服务说明"
      titleKo="서비스 안내"
      description="韩国旅行助手整理首尔、釜山、济州的公开地点，并分别标注审核状态，帮助自由行游客快速做出决定。"
      sections={[
        {
          title: "服务范围",
          body: "提供首尔、釜山、济州公开地点搜索、点单指南、避坑信息、地图连接、已审核地点推荐和行程整理功能。",
        },
        {
          title: "数据说明",
          body: "公开状态与审核完成状态分别显示；未确认字段会明确标注，不会生成虚假地点或统计。",
        },
        {
          title: "变动信息",
          body: "价格、营业时间、等待时间、座位和寄存可否可能变化，出发前请再次确认。",
        },
      ]}
    />
  );
}
