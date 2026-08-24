insert into public.tags (slug, label_zh, label_ko) values
  ('local', '当地人常去', '현지인이 자주 감'),
  ('solo', '一个人也可以', '혼자 가능'),
  ('photo', '适合拍照', '사진 찍기 좋음'),
  ('night', '晚上营业', '늦게까지 영업'),
  ('cheap', '价格便宜', '가성비'),
  ('luggage-ok', '行李OK', '캐리어 가능'),
  ('cn-menu', '中文菜单', '중국어 메뉴')
on conflict (slug) do update set
  label_zh = excluded.label_zh,
  label_ko = excluded.label_ko;

insert into public.places (
  slug,
  name_zh,
  name_ko,
  category,
  short_description_zh,
  short_description_ko,
  address_ko,
  address_zh,
  latitude,
  longitude,
  nearest_station,
  nearest_exit,
  walking_minutes,
  price_min,
  price_max,
  opening_hours,
  waiting_info_zh,
  waiting_info_ko,
  solo_friendly,
  luggage_friendly,
  chinese_menu,
  card_payment,
  recommended_order_zh,
  recommended_order_ko,
  tips_zh,
  tips_ko,
  thumbnail_url,
  is_featured,
  is_active
) values
  ('demo-gwangalli-bbq-a', '广安里烤肉店 A（Demo）', '광안리 고깃집 A (Demo)', 'restaurant', '开发用示例店铺。适合两个人吃烤肉，点五花肉最稳。', '개발용 예시 장소입니다. 2인이 고기 식사를 하기 좋은 demo 데이터입니다.', '부산 수영구 광안해변로 Demo 1', '釜山 水营区 广安海边路 Demo 1', 35.1532, 129.1187, '광안역', '3번 출구', 8, 15000, 25000, '17:00-23:00', '周五、周六晚上可能需要等 20-30 分钟。', '금요일과 토요일 저녁에는 20-30분 대기할 수 있습니다.', false, false, false, true, '两个人可以点五花肉 2 人份，再加一份大酱汤。', '2인 기준 삼겹살 2인분과 된장찌개를 추천합니다.', '先问有没有两人座。肉烤好后可以包生菜吃。', '2인 좌석이 있는지 먼저 물어보면 좋습니다.', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=1200&q=80', true, true),
  ('demo-ocean-view-cafe-a', '广安里海景咖啡 A（Demo）', '광안리 오션뷰 카페 A (Demo)', 'cafe', '开发用示例咖啡店。窗边可以拍海和广安大桥。', '개발용 예시 카페입니다. 창가에서 바다와 광안대교를 볼 수 있습니다.', '부산 수영구 민락수변로 Demo 2', '釜山 水营区 民乐水边路 Demo 2', 35.1540, 129.1240, '광안역', '5번 출구', 10, 5500, 12000, '10:00-22:00', '下午窗边座位可能满座。', '오후에는 창가 좌석이 찰 수 있습니다.', true, true, false, true, '冰美式和草莓蛋糕比较适合拍照。', '아이스 아메리카노와 딸기 케이크가 사진용으로 좋습니다.', '下午四点后光线更柔和，适合拍人物照。', '오후 4시 이후 빛이 부드러워 인물 사진에 좋습니다.', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80', true, true),
  ('demo-gwangalli-photo-a', '广安大桥拍照点 A（Demo）', '광안대교 사진스팟 A (Demo)', 'photo_spot', '开发用示例拍照点。晚上桥灯亮起后最漂亮。', '개발용 예시 사진스팟입니다. 밤에 다리 조명이 켜진 뒤 좋습니다.', '부산 수영구 광안해변로 Demo 3', '釜山 水营区 广安海边路 Demo 3', 35.1537, 129.1198, '광안역', '3번 출구', 7, 0, 0, '24시간', '周末晚上人很多，但不需要排队。', '주말 저녁에는 사람이 많지만 줄을 서지는 않습니다.', true, true, false, false, '这里不需要点餐。适合日落后拍照。', '주문은 없고 일몰 후 촬영에 적합합니다.', '手机 0.5x 广角更容易拍到整座桥。', '휴대폰 0.5x 광각이면 다리 전체를 담기 쉽습니다.', 'https://images.unsplash.com/photo-1578637387939-43c525550085?auto=format&fit=crop&w=1200&q=80', true, true),
  ('demo-luggage-storage-a', '广安里行李寄存 A（Demo）', '광안리 짐 보관 A (Demo)', 'luggage', '开发用示例寄存点。退房后可以先放行李。', '개발용 예시 짐 보관 장소입니다. 체크아웃 후 이용하는 흐름입니다.', '부산 수영구 광안동 Demo 4', '釜山 水营区 广安洞 Demo 4', 35.1570, 129.1140, '광안역', '1번 출구', 5, 3000, 7000, '09:00-21:00', '通常不需要等待。', '대부분 대기 없이 이용 가능합니다.', true, true, false, true, '给店员看：我想寄存一个行李箱，大概三个小时。', '직원에게 캐리어 1개를 3시간 맡기고 싶다고 보여주세요.', '领取时需要保管好收据或照片。', '찾을 때 영수증이나 사진을 잘 보관하세요.', 'https://images.unsplash.com/photo-1553531384-397c80973a0b?auto=format&fit=crop&w=1200&q=80', false, true),
  ('demo-pork-soup-b', '广安里汤饭店 B（Demo）', '광안리 국밥집 B (Demo)', 'restaurant', '开发用示例餐厅。一个人也可以吃的热汤饭。', '개발용 예시 음식점입니다. 혼자 먹기 좋은 따뜻한 국밥입니다.', '부산 수영구 광안동 Demo 5', '釜山 水营区 广安洞 Demo 5', 35.1590, 129.1160, '광안역', '2번 출구', 11, 9000, 12000, '08:00-21:00', '午餐时间可能需要等 10 分钟。', '점심 시간에는 10분 정도 대기할 수 있습니다.', true, false, false, true, '第一次来可以点猪肉汤饭，不太辣。', '처음이라면 맵지 않은 돼지국밥을 추천합니다.', '先尝原味，再加虾酱或辣椒酱。', '기본 맛을 본 뒤 새우젓이나 양념장을 넣으세요.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=1200&q=80', false, true),
  ('demo-gwangalli-bar-a', '广安里小酒吧 A（Demo）', '광안리 바 A (Demo)', 'bar', '开发用示例酒吧。适合晚饭后简单喝一杯。', '개발용 예시 바입니다. 저녁 후 가볍게 한 잔 하는 흐름입니다.', '부산 수영구 민락동 Demo 6', '釜山 水营区 民乐洞 Demo 6', 35.1550, 129.1260, '광안역', '5번 출구', 13, 9000, 18000, '18:00-01:00', '周末晚上座位可能很快满。', '주말 밤에는 좌석이 빨리 찰 수 있습니다.', true, false, false, true, '可以点一杯本地啤酒或无酒精饮料。', '로컬 맥주나 논알코올 음료를 주문할 수 있습니다.', '韩国酒吧有时需要每人点一杯。', '바에서는 1인 1잔 주문이 필요한 경우가 있습니다.', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80', false, true),
  ('demo-souvenir-shop-a', '广安里纪念品店 A（Demo）', '광안리 기념품샵 A (Demo)', 'shopping', '开发用示例购物点。可以买明信片、小礼物。', '개발용 예시 쇼핑 장소입니다. 엽서와 작은 선물을 사는 흐름입니다.', '부산 수영구 광안동 Demo 7', '釜山 水营区 广安洞 Demo 7', 35.1560, 129.1170, '광안역', '3번 출구', 6, 3000, 30000, '11:00-20:00', '不需要等待。', '대기 없이 이용 가능합니다.', true, true, false, true, '可以买海边主题明信片和小钥匙扣。', '바다 테마 엽서와 작은 키링을 살 수 있습니다.', '如果需要退税，请先问店员是否支持。', '택스 리펀이 필요하면 지원 여부를 먼저 물어보세요.', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80', false, true),
  ('demo-beach-walk-a', '广安里海边散步 A（Demo）', '광안리 해변 산책 A (Demo)', 'attraction', '开发用示例景点。适合饭后沿海边慢慢走。', '개발용 예시 관광지입니다. 식사 후 바닷가 산책에 좋습니다.', '부산 수영구 광안해변로 Demo 8', '釜山 水营区 广安海边路 Demo 8', 35.1530, 129.1200, '광안역', '3번 출구', 9, 0, 0, '24시간', '不需要等待。', '대기 없이 이용 가능합니다.', true, true, false, false, '这里不需要点餐，适合散步和看海。', '주문은 없고 산책과 바다 감상에 적합합니다.', '晚上风大，建议带外套。', '밤에는 바람이 강해 겉옷을 챙기면 좋습니다.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', false, true),
  ('demo-seafood-c', '广安里海鲜店 C（Demo）', '광안리 해산물집 C (Demo)', 'restaurant', '开发用示例餐厅。适合想吃海鲜的游客。', '개발용 예시 음식점입니다. 해산물을 먹고 싶은 여행자용입니다.', '부산 수영구 민락동 Demo 9', '釜山 水营区 民乐洞 Demo 9', 35.1544, 129.1270, '광안역', '5번 출구', 14, 18000, 35000, '12:00-22:00', '晚餐时间可能需要等位。', '저녁 시간에는 대기할 수 있습니다.', false, false, true, true, '可以先点一份海鲜拼盘，再加一份面。', '해산물 모둠과 면 메뉴를 함께 주문하는 흐름입니다.', '点海鲜前先确认价格和份量。', '해산물 주문 전 가격과 양을 확인하세요.', 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=1200&q=80', false, true),
  ('demo-dessert-cafe-b', '广安里甜品咖啡 B（Demo）', '광안리 디저트 카페 B (Demo)', 'cafe', '开发用示例甜品店。适合下雨天休息。', '개발용 예시 디저트 카페입니다. 비 오는 날 쉬어가기 좋습니다.', '부산 수영구 광안동 Demo 10', '釜山 水营区 广安洞 Demo 10', 35.1580, 129.1150, '광안역', '2번 출구', 7, 6000, 14000, '11:00-22:00', '周末下午可能没有大桌。', '주말 오후에는 큰 테이블이 없을 수 있습니다.', true, true, true, true, '推荐点一杯拿铁和一份季节蛋糕。', '라떼와 시즌 케이크를 추천합니다.', '如果想安静休息，避开下午两点到四点。', '조용히 쉬고 싶다면 오후 2-4시는 피하세요.', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80', true, true)
on conflict (slug) do update set
  name_zh = excluded.name_zh,
  name_ko = excluded.name_ko,
  category = excluded.category,
  short_description_zh = excluded.short_description_zh,
  short_description_ko = excluded.short_description_ko,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active;

insert into public.place_tags (place_id, tag_id)
select p.id, t.id
from public.places p
join public.tags t on t.slug in ('local', 'night')
where p.slug = 'demo-gwangalli-bbq-a'
on conflict do nothing;

insert into public.place_tags (place_id, tag_id)
select p.id, t.id
from public.places p
join public.tags t on t.slug in ('photo', 'luggage-ok')
where p.slug in ('demo-ocean-view-cafe-a', 'demo-gwangalli-photo-a', 'demo-luggage-storage-a')
on conflict do nothing;

insert into public.place_tags (place_id, tag_id)
select p.id, t.id
from public.places p
join public.tags t on t.slug in ('solo', 'cheap', 'cn-menu')
where p.slug in ('demo-pork-soup-b', 'demo-dessert-cafe-b', 'demo-seafood-c')
on conflict do nothing;

delete from public.place_menu_items
where place_id in (
  select id from public.places where slug like 'demo-%'
);

insert into public.place_menu_items (place_id, name_ko, name_zh, description_zh, price, is_recommended, sort_order)
select p.id, '삼겹살', '五花肉', '韩国烤肉里最常见、最容易点的菜单。', 15000, true, 1
from public.places p
where p.slug = 'demo-gwangalli-bbq-a'
union all
select p.id, '된장찌개', '大酱汤', '适合和烤肉一起吃的热汤。', 7000, false, 2
from public.places p
where p.slug = 'demo-gwangalli-bbq-a'
union all
select p.id, '아이스 아메리카노', '冰美式', '最常见的咖啡菜单。', 5500, true, 1
from public.places p
where p.slug = 'demo-ocean-view-cafe-a'
union all
select p.id, '돼지국밥', '猪肉汤饭', '釜山常见的热汤饭。', 10000, true, 1
from public.places p
where p.slug = 'demo-pork-soup-b'
union all
select p.id, '해산물 모둠', '海鲜拼盘', '多人分享更合适。', 28000, true, 1
from public.places p
where p.slug = 'demo-seafood-c'
union all
select p.id, '라떼', '拿铁', '甜品店里最稳定的咖啡选择。', 6000, true, 1
from public.places p
where p.slug = 'demo-dessert-cafe-b';

insert into public.photo_spots (
  slug,
  name_zh,
  name_ko,
  latitude,
  longitude,
  best_time,
  camera_position,
  subject_position,
  recommended_zoom,
  portrait_tip_zh,
  lighting_tip_zh,
  thumbnail_url,
  sample_image_url,
  free_or_pro,
  is_active
) values
  ('demo-gwangalli-bridge-center', '广安大桥正面点 A（Demo）', '광안대교 정면 포인트 A (Demo)', 35.1537, 129.1199, '日落后 20-40 分钟', '海边栏杆前 2 米', '桥正中线下方，离相机 3-4 米', '0.5x - 1x', '人物站在画面下方三分之一处，身体稍微侧一点。', '桥灯亮起后脸会偏暗，可以让朋友用手机补光。', 'https://images.unsplash.com/photo-1578637387939-43c525550085?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80', 'free', true),
  ('demo-minlak-waterfront', '民乐水边夜景点（Demo）', '민락수변 야경 포인트 (Demo)', 35.1547, 129.1282, '蓝调时间', '水边步道靠海一侧', '人站在栏杆内侧，背后留出桥和城市灯光', '1x - 2x', '适合半身照，人物不要离栏杆太近。', '背景很亮时，先点人物脸部对焦再拍。', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80', 'free', true),
  ('demo-gwangalli-cafe-street', '海边咖啡街转角（Demo）', '광안리 카페거리 코너 (Demo)', 35.1539, 129.1212, '下午 15:30-17:00', '店铺招牌斜对面', '站在白色墙面旁边，不要挡住入口', '1x', '适合拍全身穿搭，脚下留一点地面会更自然。', '下午侧光比较好，避免正午强光。', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80', 'pro', true)
on conflict (slug) do update set
  name_zh = excluded.name_zh,
  name_ko = excluded.name_ko,
  best_time = excluded.best_time,
  camera_position = excluded.camera_position,
  subject_position = excluded.subject_position,
  recommended_zoom = excluded.recommended_zoom,
  portrait_tip_zh = excluded.portrait_tip_zh,
  lighting_tip_zh = excluded.lighting_tip_zh,
  thumbnail_url = excluded.thumbnail_url,
  sample_image_url = excluded.sample_image_url,
  free_or_pro = excluded.free_or_pro,
  is_active = excluded.is_active;
