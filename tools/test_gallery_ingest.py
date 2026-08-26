"""gallery_ingest 的纯逻辑部分：id、条目渲染、去重、插入位置。

真正的图片编码交给 Pillow，这里只守住写进 galleryPhotos.js 的那部分——
它必须和 acg-api 里 Go 发布器写出来的格式一致，两条加图路径才不会打架。
"""

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from gallery_ingest import (
    ARRAY_DECL,
    Photo,
    existing_sources,
    insert_entries,
    photo_id_for,
    render_entry,
)

ROOT = Path(__file__).resolve().parent.parent

EMPTY_DATA = ARRAY_DECL + "];\n"

ONE_PHOTO_DATA = (
    ARRAY_DECL
    + """
  {
    id: "20260101-000000-aaaaaa",
    src: "/cos/gallery/2026/01/old.jpg",
    width: 1600,
    height: 1200,
    thumb: "/cos/gallery/2026/01/old-thumb.jpg",
    publishedAt: "2026-01-01T00:00:00Z",
  },
];
"""
)


def make_photo(name="new", when=None):
    when = when or datetime(2026, 8, 26, 14, 30, 12, tzinfo=timezone.utc)
    src = f"/cos/gallery/2026/08/{name}.jpg"
    return Photo(
        photo_id=photo_id_for(src, when),
        src=src,
        thumb=f"/cos/gallery/2026/08/{name}-thumb.jpg",
        width=4000,
        height=3000,
        published_at=when.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


class PhotoIDTests(unittest.TestCase):
    def test_id_is_timestamp_prefixed_and_stable(self):
        when = datetime(2026, 8, 26, 14, 30, 12, tzinfo=timezone.utc)
        first = photo_id_for("/cos/gallery/a.jpg", when)

        self.assertTrue(first.startswith("20260826-143012-"))
        self.assertEqual(first, photo_id_for("/cos/gallery/a.jpg", when))
        self.assertNotEqual(first, photo_id_for("/cos/gallery/b.jpg", when))


class RenderEntryTests(unittest.TestCase):
    def test_matches_the_field_order_the_go_publisher_writes(self):
        entry = render_entry(make_photo())
        fields = [line.strip().split(":")[0] for line in entry.splitlines()[1:-1]]

        self.assertEqual(fields, ["id", "src", "width", "height", "thumb", "publishedAt"])

    def test_omits_the_thumb_field_when_there_is_none(self):
        photo = make_photo()
        entry = render_entry(Photo(**{**photo.__dict__, "thumb": ""}))

        self.assertNotIn("thumb:", entry)

    def test_escapes_values_into_valid_js_strings(self):
        # 不硬编码转义结果，直接验真正在意的性质：写出来的字面量解回来还是原值。
        tricky = '/cos/a"b\\c.jpg'
        photo = make_photo()
        entry = render_entry(Photo(**{**photo.__dict__, "src": tricky}))

        rendered = entry.splitlines()[2].strip()[len("src: "):].rstrip(",")
        self.assertEqual(json.loads(rendered), tricky)


class ExistingSourcesTests(unittest.TestCase):
    def test_collects_both_full_and_thumb_urls(self):
        found = existing_sources(ONE_PHOTO_DATA)

        self.assertIn("/cos/gallery/2026/01/old.jpg", found)
        self.assertIn("/cos/gallery/2026/01/old-thumb.jpg", found)

    def test_empty_gallery_has_no_sources(self):
        self.assertEqual(existing_sources(EMPTY_DATA), set())


class InsertEntriesTests(unittest.TestCase):
    def test_inserts_into_a_single_line_empty_array(self):
        updated = insert_entries(EMPTY_DATA, [make_photo()])

        self.assertNotIn("galleryPhotos = [];", updated)
        self.assertTrue(updated.startswith(ARRAY_DECL + "\n  {"))
        self.assertTrue(updated.rstrip().endswith("];"))

    def test_new_photos_land_above_the_existing_ones(self):
        updated = insert_entries(ONE_PHOTO_DATA, [make_photo()])

        self.assertLess(
            updated.index("/cos/gallery/2026/08/new.jpg"),
            updated.index("/cos/gallery/2026/01/old.jpg"),
        )

    def test_keeps_the_given_order_within_one_batch(self):
        updated = insert_entries(EMPTY_DATA, [make_photo("first"), make_photo("second")])

        self.assertLess(updated.index("first.jpg"), updated.index("second.jpg"))

    def test_no_photos_leaves_the_file_untouched(self):
        self.assertEqual(insert_entries(ONE_PHOTO_DATA, []), ONE_PHOTO_DATA)


class RealDataFileTests(unittest.TestCase):
    def test_the_live_data_file_still_has_the_array_the_tool_writes_into(self):
        data = (ROOT / "main" / "src" / "data" / "galleryPhotos.js").read_text(encoding="utf-8")

        self.assertIn(ARRAY_DECL, data)
        # 插入位置靠这个声明定位，改名了就得同时改工具和 Go 发布器。
        self.assertEqual(data.count(ARRAY_DECL), 1)


if __name__ == "__main__":
    unittest.main()
