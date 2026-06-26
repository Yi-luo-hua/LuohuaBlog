import sqlite3
import time
import datetime as dt

samples = [
  ("赛博朋克雨夜，霓虹灯倒映在湿润的街道，未来感十足", "https://picsum.photos/seed/cyber1/800/1100", "1024*1024", 0),
  ("一只在月亮上睡觉的猫，水彩风格，宁静温柔", "https://picsum.photos/seed/cat1/900/900", "1024*1024", 1),
  ("中式园林，飞檐翘角，云雾缭绕，远山如黛", "https://picsum.photos/seed/garden1/800/600", "1280*720", 2),
  ("一个穿着旗袍的少女站在樱花树下，浮世绘风格", "https://picsum.photos/seed/girl1/800/1200", "720*1280", 3),
  ("机械朋克风格的怀表，齿轮精密咬合，黄铜金属质感，复古而精致", "https://picsum.photos/seed/clock1/900/700", "1024*1024", 4),
  ("夜晚的星空下一座灯塔，海浪拍打礁石，孤独而美丽", "https://picsum.photos/seed/light1/800/1000", "1024*1024", 5),
  ("一片金黄的麦田延伸到地平线，夕阳西下，温暖的橙光", "https://picsum.photos/seed/wheat1/1200/800", "1280*720", 6),
  ("精灵公主坐在森林深处的蘑菇上，萤火虫环绕，奇幻插画风", "https://picsum.photos/seed/elf1/800/1100", "720*1280", 7),
  ("一杯抹茶配和果子，俯视角度，禅意美学，柔和光线", "https://picsum.photos/seed/tea1/900/900", "1024*1024", 8),
  ("城市天际线在暴风雨中，闪电劈过摩天楼之间", "https://picsum.photos/seed/storm1/1100/700", "1280*720", 9),
  ("一只北极狐站在雪地里回头看，毛发蓬松，眼神清澈", "https://picsum.photos/seed/fox1/800/900", "1024*1024", 10),
  ("蒸汽朋克风格的飞行器在云层中翱翔，铜管和气球交织", "https://picsum.photos/seed/ship1/1000/700", "1280*720", 11),
  ("樱花飘落的鸟居前，神社台阶上铺满花瓣", "https://picsum.photos/seed/shrine1/800/1100", "720*1280", 12),
  ("一只机械蝴蝶停在工程师的手指上，齿轮翅膀闪闪发光", "https://picsum.photos/seed/butterfly1/900/900", "1024*1024", 13),
  ("北欧极光下的冰湖，湖面像镜子映出整个星河", "https://picsum.photos/seed/aurora1/1200/800", "1280*720", 14),
  ("雨后的青砖小巷，撑着油纸伞的女子背影，江南水乡", "https://picsum.photos/seed/lane1/800/1200", "720*1280", 15),
]

conn = sqlite3.connect("D:/taozhiyy-monorepo/.tmp/acg-data/acg.db")
cur = conn.cursor()
now = dt.datetime.utcnow()
for prompt, url, size, idx in samples:
    ts = (now - dt.timedelta(minutes=10 * idx)).strftime("%Y-%m-%dT%H:%M:%SZ")
    cur.execute(
        """INSERT INTO ai_image_generations
           (user_id, identity_key, prompt, model, size, image_url, object_key, provider_request_id, created_at)
           VALUES (NULL, 'image:seed', ?, 'z-image-turbo', ?, ?, '', '', ?)""",
        (prompt, size, url, ts),
    )
conn.commit()
print(f"Seeded {len(samples)} rows.")
cur.execute("SELECT COUNT(*) FROM ai_image_generations")
print("Total rows:", cur.fetchone()[0])
conn.close()
