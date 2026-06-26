import sqlite3
import datetime as dt

# 用站点自己 COS 上的已有图片（hero 视频缩略、wallpaper 池里的图）
COS = "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img"
images = [
    f"{COS}/entrance.webp",
    f"{COS}/hero-1.webp",
    f"{COS}/hero-2.webp",
    f"{COS}/hero-3.webp",
    f"{COS}/hero-4.webp",
]

samples = [
  "赛博朋克雨夜，霓虹灯倒映在湿润的街道，未来感十足",
  "一只在月亮上睡觉的猫，水彩风格，宁静温柔",
  "中式园林，飞檐翘角，云雾缭绕，远山如黛",
  "一个穿着旗袍的少女站在樱花树下，浮世绘风格",
  "机械朋克风格的怀表，齿轮精密咬合，黄铜金属质感",
  "夜晚的星空下一座灯塔，海浪拍打礁石，孤独而美丽",
  "一片金黄的麦田延伸到地平线，夕阳西下，温暖的橙光",
  "精灵公主坐在森林深处的蘑菇上，萤火虫环绕，奇幻插画风",
  "一杯抹茶配和果子，俯视角度，禅意美学，柔和光线",
  "城市天际线在暴风雨中，闪电劈过摩天楼之间",
  "一只北极狐站在雪地里回头看，毛发蓬松，眼神清澈",
  "蒸汽朋克风格的飞行器在云层中翱翔，铜管和气球交织",
  "樱花飘落的鸟居前，神社台阶上铺满花瓣",
  "一只机械蝴蝶停在工程师的手指上，齿轮翅膀闪闪发光",
  "北欧极光下的冰湖，湖面像镜子映出整个星河",
  "雨后的青砖小巷，撑着油纸伞的女子背影，江南水乡",
]

conn = sqlite3.connect("D:/taozhiyy-monorepo/.tmp/acg-data/acg.db")
cur = conn.cursor()
cur.execute("DELETE FROM ai_image_generations WHERE identity_key = 'image:seed'")
now = dt.datetime.utcnow()
for idx, prompt in enumerate(samples):
    img = images[idx % len(images)]
    ts = (now - dt.timedelta(minutes=10 * idx)).strftime("%Y-%m-%dT%H:%M:%SZ")
    cur.execute(
        """INSERT INTO ai_image_generations
           (user_id, identity_key, prompt, model, size, image_url, object_key, provider_request_id, created_at)
           VALUES (NULL, 'image:seed', ?, 'z-image-turbo', ?, ?, '', '', ?)""",
        (prompt, "1024*1024", img, ts),
    )
conn.commit()
cur.execute("SELECT COUNT(*) FROM ai_image_generations")
print("Total rows now:", cur.fetchone()[0])
conn.close()
