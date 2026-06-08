# ============================================================
#  台灣鬼事地圖 — Flask 後端
#  故事資料從 ghost_story/ 資料夾讀取（每個故事一個 .json 檔）
#
#  執行方式:
#    pip install flask flask-cors
#    python app.py
#  接著在瀏覽器開啟 http://localhost:5000
#
#  新增故事：在 ghost_story/ 裡新增一個 .json 檔即可，格式參考：
#    {
#      "id": "my-story",
#      "countyId": "taipei-city",
#      "title": "故事標題",
#      "tag": "都市傳說",
#      "scaryLevel": 3,
#      "summary": "一句話摘要",
#      "location": {
#        "display": "台北市中正區某處",
#        "district": "中正區",
#        "lat": null,
#        "lng": null
#      },
#      "content": "故事內文..."
#    }
# ============================================================

import json
from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ── 故事資料夾路徑 ───────────────────────────────────────────
STORY_DIR = Path("ghost_story")

# ── 台灣地圖 SVG 路徑資料（固定地理資料，不需外部化）──────────
MAP_DATA = json.loads(Path("map_data/taiwan_map.json").read_text(encoding="utf-8"))

# ── 縣市中文名稱對照表 ───────────────────────────────────────
COUNTY_NAMES = {c["id"]: c["name"] for c in MAP_DATA}


# ── 故事讀取函式 ─────────────────────────────────────────────

def load_story(filepath: Path) -> dict | None:
    """讀取並解析單一故事 JSON 檔，失敗時回傳 None 並印出警告。"""
    try:
        return json.loads(filepath.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"⚠  無法讀取 {filepath.name}: {e}")
        return None


def load_all_stories() -> dict[str, list]:
    """
    讀取 ghost_story/ 內所有 .json 檔，依 countyId 分組。
    回傳格式：{ "taipei-city": [...], "kaohsiung-city": [...], ... }
    """
    result: dict[str, list] = {}

    if not STORY_DIR.exists():
        print(f"⚠  找不到故事資料夾 {STORY_DIR}/，請建立後重啟伺服器。")
        return result

    for f in sorted(STORY_DIR.glob("*.json")):
        story = load_story(f)
        if not story:
            continue
        county_id = story.get("countyId", "")
        if not county_id:
            print(f"⚠  {f.name} 缺少 countyId 欄位，已跳過。")
            continue
        result.setdefault(county_id, []).append(story)

    return result


# ── API 路由 ─────────────────────────────────────────────────

@app.route("/")
def index():
    """提供前端 HTML 頁面"""
    return send_from_directory(".", "index.html")

@app.route("/audio/<path:filename>")
def serve_audio(filename):
    return send_from_directory(".", filename)


@app.route("/api/map-data")
def get_map_data():
    """回傳台灣地圖 SVG 路徑資料（22 縣市）"""
    return jsonify(MAP_DATA)


@app.route("/api/counties")
def get_counties():
    """回傳縣市清單（id + 中文名）"""
    return jsonify([{"id": c["id"], "name": c["name"]} for c in MAP_DATA])


@app.route("/api/stories")
def get_all_stories():
    """回傳全台所有故事"""
    stories = load_all_stories()
    result = []
    for county_id, story_list in stories.items():
        for s in story_list:
            result.append({**s, "countyName": COUNTY_NAMES.get(county_id, county_id)})
    return jsonify(result)


@app.route("/api/stories/<county_id>")
def get_stories_by_county(county_id):
    """回傳指定縣市的故事清單"""
    stories = load_all_stories()
    return jsonify(stories.get(county_id, []))


@app.route("/api/stats")
def get_stats():
    """回傳統計資訊：故事總數、分類計數、各縣市故事數"""
    stories = load_all_stories()
    all_stories = [s for sl in stories.values() for s in sl]

    tag_counts: dict[str, int] = {}
    for s in all_stories:
        tag_counts[s.get("tag", "未分類")] = tag_counts.get(s.get("tag", "未分類"), 0) + 1

    return jsonify({
        "total":          len(all_stories),
        "tag_counts":     tag_counts,
        "county_count":   len(stories),
        "county_counts":  {cid: len(sl) for cid, sl in stories.items()},
    })


# ── 啟動 ─────────────────────────────────────────────────────
if __name__ == "__main__":
    stories = load_all_stories()
    total = sum(len(v) for v in stories.values())
    print("🕯  台灣鬼事地圖後端啟動中...")
    print(f"📂  故事資料夾：{STORY_DIR.resolve()}")
    print(f"📖  已載入 {total} 則靈異傳說（{len(stories)} 個縣市）")
    print("🌐  請在瀏覽器開啟 http://localhost:5000")
    app.run(debug=True, port=5000)
