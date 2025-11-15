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

// [최종 개선 버전] 여러 개의 랭킹 데이터를 배열로 받아 한 번에 처리하는 API
appApi.post("/api/shopping-rankings", async (req, res) => {
  // 1. 요청 본문이 유효한 배열인지 확인합니다.
  const rankings = req.body;
  if (!Array.isArray(rankings) || rankings.length === 0) {
    return res.status(400).json({
      error: "Input data must be a non-empty array of ranking objects.",
    });
  }

  const client = await pool.connect();
  try {
    // 2. 트랜잭션을 시작합니다. (All or Nothing)
    await client.query("BEGIN");

    const insertedRows = [];

    // 3. for...of 루프를 사용하여 각 데이터를 순차적으로 처리합니다. (안정성 및 디버깅 용이)
    for (const ranking of rankings) {
      let {
        brand_name,
        material_name,
        keyword,
        ranking_position,
        is_my_ad,
        image_url,
        category,
        product_value,
        device_type,
      } = ranking;

      // 가격 데이터를 문자열에서 숫자로 안전하게 변환합니다.
      if (typeof product_value === "string") {
        const numericValue = parseInt(product_value.replace(/[^0-9]/g, ""), 10);
        product_value = isNaN(numericValue) ? null : numericValue;
      } else if (typeof product_value !== "number") {
        product_value = null; // 문자열이나 숫자가 아니면 NULL 처리
      }

      // 4. ON CONFLICT DO NOTHING을 사용하여 중복 데이터를 에러 없이 무시합니다.
      const query = `
              INSERT INTO shopping_rankings 
                (brand_name, material_name, keyword, ranking_position, is_my_ad, image_url, category, product_value, device_type) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (device_type, brand_name, keyword, ranking_position, recorded_at, material_name) DO NOTHING
              RETURNING *;
            `;

      const values = [
        brand_name,
        material_name,
        keyword,
        ranking_position,
        is_my_ad,
        image_url,
        category,
        product_value,
        device_type,
      ];
      const result = await client.query(query, values);

      // 5. 실제로 INSERT가 성공한 경우에만 결과 배열에 추가합니다.
      //    (중복으로 무시된 경우 result.rows는 비어있습니다.)
      if (result.rows.length > 0) {
        insertedRows.push(result.rows[0]);
      }
    }

    // 6. 모든 작업이 성공하면 트랜잭션을 커밋합니다.
    await client.query("COMMIT");

    // 7. 성공적으로 삽입된 데이터의 수와 함께 응답합니다.
    console.log(
      `[API] Received ${rankings.length} records, Inserted ${insertedRows.length} new records.`
    );
    res.status(201).json({
      message: `Received ${rankings.length} records, inserted ${insertedRows.length} new records.`,
      data: insertedRows,
    });
  } catch (err) {
    // 8. 루프 중간에 하나라도 에러가 발생하면 트랜잭션을 롤백합니다.
    await client.query("ROLLBACK");
    console.error("[API ERROR] Transaction failed, rolling back.", err);
    res
      .status(500)
      .json({ error: "DB insert transaction failed", details: err.message });
  } finally {
    // 9. 사용한 DB 커넥션을 풀에 반환합니다.
    client.release();
  }
});

/// /api/favorite-toggle 엔드포인트
appApi.post("/api/favorite-toggle", async (req, res) => {
  try {
    const { brand, productName, keyword, isBonusKeyword, favorite } = req.body;

    if (!brand || !productName || !keyword) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let updatedRecord;

      // 1. ON CONFLICT 대신, 먼저 데이터가 있는지 직접 확인 (SELECT)
      const selectQuery = `
        SELECT * FROM product_definition
        WHERE brand_name = $1 AND material_name = $2 AND keyword = $3;
      `;
      const selectResult = await client.query(selectQuery, [
        brand,
        productName,
        keyword,
      ]);

      if (selectResult.rows.length > 0) {
        // 2. 데이터가 있으면 UPDATE 수행
        const updateQuery = `
          UPDATE product_definition
          SET bookmark = $1
          WHERE brand_name = $2 AND material_name = $3 AND keyword = $4
          RETURNING *;
        `;
        const updateResult = await client.query(updateQuery, [
          favorite,
          brand,
          productName,
          keyword,
        ]);
        updatedRecord = updateResult.rows[0];
      } else if (isBonusKeyword) {
        // 3. 데이터가 없고, isBonusKeyword가 true이면 INSERT 수행
        const tempMaterialId = "BONUS_KEYWORD";
        const tempMallProductId = 0;

        const insertQuery = `
          INSERT INTO product_definition 
            (brand_name, material_name, material_id, mall_product_id, keyword, bookmark, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, false)
          RETURNING *;
        `;
        const insertResult = await client.query(insertQuery, [
          brand,
          productName,
          tempMaterialId,
          tempMallProductId,
          keyword,
          favorite,
        ]);
        updatedRecord = insertResult.rows[0];
      } else {
        // 4. 데이터가 없고, isBonusKeyword가 false이면 업데이트할 대상이 없는 것이므로 404 에러
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Record not found to update" });
      }

      await client.query("COMMIT");
      res.json({ success: true, updatedRecord });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[API ERROR] Favorite toggle failed:", err);
    res
      .status(500)
      .json({ error: "Failed to toggle favorite", details: err.message });
  }
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

    // 수정된 /api/rankings 쿼리
    const query = `
    SELECT 
        sr.brand_name,
        sr.material_name,
        sr.keyword as actual_keyword, -- 순위가 기록된 실제 키워드
        COALESCE(pd.keyword, sr.keyword) as definition_keyword, -- pd에 정의된 키워드 (없으면 실제 키워드)
        COALESCE(pd.bookmark, false) as favorite, -- pd에 정의된 즐겨찾기 (없으면 false)
        sr.ranking_position,
        sr.image_url,
        DATE(sr.recorded_at AT TIME ZONE 'Asia/Seoul') as rank_date,
        CASE 
            WHEN EXTRACT(HOUR FROM sr.recorded_at AT TIME ZONE 'Asia/Seoul') < 12 THEN 'morning'
            ELSE 'afternoon'
        END as time_period,
        (pd.keyword IS NOT NULL) as is_target_keyword -- pd에 정의되어 있으면 타겟 키워드
    FROM 
        shopping_rankings sr
    LEFT JOIN 
        product_definition pd ON 
            sr.brand_name = pd.brand_name
            AND sr.material_name = pd.material_name
            AND sr.keyword = pd.keyword
            AND pd.is_active = true
    WHERE
        sr.is_my_ad = true
        AND sr.device_type = $1
        AND sr.recorded_at >= $2::date
        AND sr.recorded_at < ($3::date + interval '1 day')
    ORDER BY 
        sr.brand_name, sr.material_name, sr.keyword, sr.recorded_at;
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

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function groupRankings(rows) {
  const map = new Map();

  rows.forEach((row) => {
    // ✅ actual_keyword가 null이면 definition_keyword 사용
    const keywordForGrouping = row.actual_keyword || row.definition_keyword;
    const key = `${row.brand_name}-${row.material_name}-${keywordForGrouping}`;

    if (!map.has(key)) {
      map.set(key, {
        brand: row.brand_name,
        productName: row.material_name,
        keyword: keywordForGrouping,
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

    // ✅ 랭킹 정보가 있을 때만 추가
    if (row.rank_date && row.time_period && row.ranking_position) {
      // ✅✅✅ 핵심: rank_date를 문자열로 변환 (YYYY-MM-DD)
      const dateStr =
        typeof row.rank_date === "string"
          ? row.rank_date
          : formatDate(row.rank_date); // rank_date가 Date 객체일 경우 변환

      if (!item.rankings[dateStr]) {
        item.rankings[dateStr] = { morning: null, afternoon: null };
      }

      item.rankings[dateStr][row.time_period] = row.ranking_position;
    }
  });

  return Array.from(map.values());
}

// 랭크 누르면 팝업되며 경쟁사 포함 정보
// 순위 상세 정보 조회 (경쟁사 포함)
appApi.get("/api/rankings/detail", async (req, res) => {
  console.log("=== /api/rankings/detail 호출됨 ===");
  console.log("Query params:", req.query);

  try {
    const { keyword, date, time_period, device_type } = req.query;

    if (!keyword || !date || !time_period || !device_type) {
      console.log("❌ 파라미터 누락");
      return res.status(400).json({
        error: "keyword, date, time_period, device_type are required.",
        received: { keyword, date, time_period, device_type },
      });
    }

    console.log("✅ 파라미터 검증 통과");

    // 시간 범위 설정
    const startTime = time_period === "morning" ? "00:00:00" : "12:00:00";
    const endTime = time_period === "morning" ? "11:59:59" : "23:59:59";
    const startTimestamp = `${date} ${startTime}`;
    const endTimestamp = `${date} ${endTime}`;

    console.log("시간 범위:", startTimestamp, "~", endTimestamp);

    const query = `
SELECT *
FROM (
  SELECT DISTINCT ON (brand_name, material_name, keyword, ranking_position)
    brand_name,
    material_name,
    keyword,
    ranking_position,
    is_my_ad,
    image_url,
    category,
    product_value,
    recorded_at
  FROM
    shopping_rankings
  WHERE
    keyword = $1
    AND device_type = $2
    AND recorded_at AT TIME ZONE 'Asia/Seoul' >= $3::timestamp
    AND recorded_at AT TIME ZONE 'Asia/Seoul' <= $4::timestamp
  ORDER BY
    brand_name,
    material_name,
    keyword,
    ranking_position,
    recorded_at DESC   -- 같은 조합에서는 최신 한 개만 남음
) t
ORDER BY
  ranking_position ASC;   -- ★★★ 결과 전체를 순위 오름차순 정렬로 반환!

    `;

    const result = await pool.query(query, [
      keyword,
      device_type,
      startTimestamp,
      endTimestamp,
    ]);

    console.log(`✅ 조회 결과: ${result.rows.length}건`);
    res.json(result.rows);
  } catch (err) {
    console.error("[API ERROR] Detail rankings query failed:", err);
    res.status(500).json({ error: "DB query failed", details: err.message });
  }
});

// appApi.listen(PORT, () => {
//   console.log(`API server listening on port ${PORT}`);
// });

module.exports = appApi;
