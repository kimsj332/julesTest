const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors");

const appApi = express();
const PORT = 3000;

const corsOptions = {
  origin: "https://manage.searchad.naver.com",
  optionsSuccessStatus: 200,
};
appApi.use(cors(corsOptions));
appApi.use(bodyParser.json({ limit: "10mb" }));

const pool = new Pool({
  user: "cms332",
  host: "pdb",
  database: "hgiDB",
  password: "ss973161",
  port: 5432,
});

// 기존 랭킹 API 엔드포인트
appApi.get("/api/rankings", async (req, res) => {
  try {
    const { start, end, device = "Mobile" } = req.query;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "start and end date parameters are required" });
    }

    const query = `
      SELECT 
          pd.brand_name,
          pd.material_name,
          pd.keyword as definition_keyword,
          pd.bookmark as favorite,
          sr.ranking_position,
          sr.image_url,
          DATE(sr.recorded_at AT TIME ZONE 'Asia/Seoul') as rank_date,
          CASE 
              WHEN EXTRACT(HOUR FROM sr.recorded_at AT TIME ZONE 'Asia/Seoul') < 12 THEN 'morning'
              ELSE 'afternoon'
          END as time_period,
          sr.keyword as actual_keyword,
          CASE 
              WHEN pd.keyword = sr.keyword THEN true
              ELSE false
          END as is_target_keyword
      FROM product_definition pd
      INNER JOIN shopping_rankings sr ON 
          pd.brand_name = sr.brand_name 
          AND pd.material_name = sr.material_name
          AND sr.device_type = $1
          AND sr.is_my_ad = true
          AND (
              pd.keyword = sr.keyword
              OR (
                  NOT EXISTS (
                      SELECT 1 
                      FROM product_definition pd2 
                      WHERE pd2.brand_name = sr.brand_name
                        AND pd2.material_name = sr.material_name
                        AND pd2.keyword = sr.keyword
                        AND pd2.is_active = true
                  )
              )
          )
      WHERE
          pd.is_active = true
          AND sr.recorded_at >= $2::date
          AND sr.recorded_at < ($3::date + interval '1 day')
      ORDER BY pd.brand_name, pd.material_name, pd.keyword, sr.recorded_at;
    `;

    const result = await pool.query(query, [device, start, end]);
    const grouped = groupRankings(result.rows);

    res.json(grouped);
  } catch (err) {
    console.error("[API ERROR] Rankings query failed:", err);
    res.status(500).json({ error: "DB query failed", details: err.message });
  }
});

// 새로 추가한 두 번째 API 엔드포인트
appApi.get("/api/rankings/missing", async (req, res) => {
  try {
    const { start, end, device = "Mobile" } = req.query;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "start and end date parameters are required" });
    }

    const query = `
      SELECT
          pd.brand_name,
          pd.material_name,
          pd.keyword AS definition_keyword,
          pd.bookmark AS favorite,
          NULL AS ranking_position,
          NULL AS image_url,
          NULL AS rank_date,
          'afternoon' AS time_period,
          NULL AS actual_keyword,
          true AS is_target_keyword
      FROM product_definition pd
      WHERE pd.is_active = true
        AND NOT EXISTS (
              SELECT 1
              FROM shopping_rankings sr
              WHERE sr.brand_name = pd.brand_name
                AND sr.material_name = pd.material_name
                AND sr.device_type = $1
                AND sr.is_my_ad = true
                AND sr.recorded_at >= $2::date
                AND sr.recorded_at < ($3::date + interval '1 day')
                AND sr.keyword = pd.keyword
            )
      ORDER BY pd.brand_name, pd.material_name, pd.keyword;
    `;

    const result = await pool.query(query, [device, start, end]);
    // 보통 missing 데이터는 랭킹 데이터가 없으니 groupRankings 안 해도 무방
    const groupedData = groupRankings(result.rows); // 여기 추가

    res.json(groupedData);
  } catch (err) {
    console.error("[API ERROR] Missing rankings query failed:", err);
    res.status(500).json({ error: "DB query failed", details: err.message });
  }
});

function groupRankings(rows) {
  const map = new Map();

  rows.forEach((row) => {
    // actual_keyword 없으면 definition_keyword 사용
    const key = `${row.brand_name}-${row.material_name}-${
      row.actual_keyword || row.definition_keyword
    }`;

    if (!map.has(key)) {
      map.set(key, {
        brand: row.brand_name,
        productName: row.material_name,
        keyword: row.actual_keyword || row.definition_keyword,
        favorite: row.favorite || false,
        imageUrl: row.image_url || null,
        is_target_keyword: row.is_target_keyword || false,
        actual_keyword: row.actual_keyword || null,
        definition_keyword: row.definition_keyword || null,
        rankings: {},
      });
    }

    const item = map.get(key);

    if (row.image_url) {
      item.imageUrl = row.image_url;
    }

    if (row.rank_date && row.time_period && row.ranking_position) {
      const dateStr = row.rank_date;

      if (!item.rankings[dateStr]) {
        item.rankings[dateStr] = { morning: null, afternoon: null };
      }

      item.rankings[dateStr][row.time_period] = row.ranking_position;
    }
  });

  return Array.from(map.values());
}

// appApi.listen(PORT, () => {
//   console.log(`API server listening on port ${PORT}`);
// });

module.exports = appApi;
