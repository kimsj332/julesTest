// API 엔드포인트
const API_BASE = "/api";

// 전역 상태
let allData = [];
let filteredData = [];
let currentBrand = "favorite";
let currentTimeFilter = "morning";
let currentDevice = "Mobile"; // ✅ 추가
let startDate = null;
let endDate = null;

const deviceButtons = document.querySelectorAll(".device-btn");
const timeButtons = document.querySelectorAll(".time-btn");
const guideText = document.getElementById("guide-text");

// let currentDevice = 'Mobile';
// let currentTime = "morning";

function updateGuideText() {
  const deviceText = currentDevice === "Mobile" ? "모바일" : "피씨";
  const timeText = currentTimeFilter === "morning" ? "오전" : "오후";

  guideText.innerHTML = `💡 <span class="device-highlight">${deviceText}</span> 광고 <span class="time-highlight">${timeText}</span> 시간대 순위가 보여집니다!`;
}

deviceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    deviceButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentDevice = btn.dataset.device;
    updateGuideText();
  });
});

timeButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    currentTimeFilter = e.target.dataset.time;

    timeButtons.forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");

    updateGuideText();
    renderTable();
  });
});

// 초기 표시
updateGuideText();

document.addEventListener("DOMContentLoaded", () => {
  initializeDatePicker();
  initializeEventListeners();

  // 초기 시간 필터를 오전으로 세팅하고 버튼 활성화 업데이트
  document.querySelectorAll(".time-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.time === "morning");
  });

  updateGuideText();

  fetchData().then(() => {
    renderTable();
  });
});

// 날짜 피커 초기화
function initializeDatePicker() {
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 6);

  document.getElementById("startDate").valueAsDate = threeDaysAgo;
  document.getElementById("endDate").valueAsDate = today;

  startDate = formatDate(threeDaysAgo);
  endDate = formatDate(today);

  document.getElementById("endDate").max = formatDate(today);
}

// 이벤트 리스너 초기화
// script.js

// script.js

// 이벤트 리스너 초기화 (이 함수 전체를 교체하세요)
function initializeEventListeners() {
  // --- 다른 요소들에 대한 이벤트 리스너 (변경 없음) ---
  document.getElementById("startDate").addEventListener("change", (e) => {
    startDate = e.target.value;
    clearQuickButtonActive();
    fetchData();
  });
  document.getElementById("endDate").addEventListener("change", (e) => {
    endDate = e.target.value;
    clearQuickButtonActive();
    fetchData();
  });
  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const days = parseInt(e.target.dataset.days);
      setQuickDateRange(days);
      document
        .querySelectorAll(".quick-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
    });
  });
  document.querySelectorAll(".device-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentDevice = e.target.dataset.device;
      document
        .querySelectorAll(".device-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      fetchData();
    });
  });
  document.querySelectorAll(".time-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentTimeFilter = e.target.dataset.time;
      document
        .querySelectorAll(".time-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      renderTable();
    });
  });

  // --- 모달 관련 요소 및 닫기 이벤트 (변경 없음) ---
  const modal = document.getElementById("detailModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const closeModalBtn = document.getElementById("closeModalBtn");

  closeModalBtn.addEventListener("click", () => (modal.style.display = "none"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ✨ 즐겨찾기와 상세보기를 통합한 단일 이벤트 핸들러 ✨
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  const tbody = document.querySelector("#rankingTable tbody");
  tbody.addEventListener("click", async (e) => {
    const clickedElement = e.target;

    // --- 분기 1: 즐겨찾기 버튼(.favorite-btn) 클릭 시 ---
    if (clickedElement.matches(".favorite-btn")) {
      e.stopPropagation();
      const btn = clickedElement;

      const tr = btn.closest("tr");
      if (!tr) return;

      const brand = tr.dataset.brand;
      const productName = tr.dataset.productName;
      const keywordCell = tr.querySelector(".keyword-cell");
      const keywordRaw = keywordCell ? keywordCell.textContent.trim() : "";
      const isBonusKeyword = keywordRaw.includes("(보)");
      const keyword = keywordRaw.replace(/^\(보\)\s*/, "");
      const newFavorite = !btn.classList.contains("active");

      const payload = {
        brand,
        productName,
        keyword,
        isBonusKeyword,
        favorite: newFavorite,
      };

      try {
        const res = await fetch("/api/favorite-toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (result.success) {
          const targetItem = allData.find(
            (item) =>
              item.brand === brand &&
              item.productName === productName &&
              item.keyword === keyword
          );
          if (targetItem) targetItem.favorite = newFavorite;
          applyFilters();
        } else {
          alert("즐겨찾기 저장에 실패했습니다.");
        }
      } catch (err) {
        console.error("API 호출 실패:", err);
        alert("통신 오류가 발생했습니다.");
      }
    }

    // --- 분기 2: 순위 배지(.rank-badge) 클릭 시 ---
    else if (clickedElement.matches(".rank-badge[data-keyword]")) {
      e.stopPropagation();
      const btn = clickedElement;

      const { date, keyword } = btn.dataset;

      modalTitle.textContent = `"${keyword}" 키워드 순위 상세 (${date} ${
        currentTimeFilter === "morning" ? "오전" : "오후"
      })`;
      modalBody.innerHTML = `<div class="loading-spinner">🔄 데이터 로딩 중...</div>`;
      modal.style.display = "flex";

      try {
        const encodedKeyword = encodeURIComponent(keyword);
        const res = await fetch(
          `${API_BASE}/rankings/detail?keyword=${encodedKeyword}&date=${date}&time_period=${currentTimeFilter}&device_type=${currentDevice}`
        );
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const detailData = await res.json();
        renderDetailModal(detailData);
      } catch (err) {
        console.error("상세 순위 데이터 로딩 실패:", err);
        modalBody.innerHTML = `<p style="color: red;">데이터를 불러오는 데 실패했습니다.</p>`;
      }
    }
  });
}

// script.js 파일 하단 (formatDate, formatDateHeader 함수 등과 함께)

function renderDetailModal(data) {
  // modalBody를 이 함수 안에서 찾도록 수정하여 안정성 확보
  const modalBody = document.getElementById("modalBody");

  if (!data || data.length === 0) {
    modalBody.innerHTML = "<p>해당 시점의 순위 데이터가 없습니다.</p>";
    return;
  }

  let tableHtml = `
  <table class="detail-rank-table">
    <thead>
      <tr>
        <th class="rank-col">순위</th>
        <th class="prodname-col">상품명</th>
        <th class="price-col">가격</th>
      </tr>
    </thead>
    <tbody>
`;

  data.forEach((item) => {
    const isMyAdClass = item.is_my_ad ? "my-ad-row" : "";
    const price = item.product_value
      ? `${item.product_value.toLocaleString()}원`
      : "N/A";
    tableHtml += `
        <tr class="${isMyAdClass}">
          <td class="rank-col">${item.ranking_position}</td>
          <td class="prodname-col">
              <div style="display: flex; align-items: center;">
                  <img src="${item.image_url}" object-fit: cover; border-radius: 4px;" onerror="this.style.display='none';"/>
                  <span class="popup-product-name">${item.material_name}</span>
              </div>
          </td>
          <td class="price-col">${price}</td>
        </tr>
      `;
  });

  tableHtml += `</tbody></table>`;
  modalBody.innerHTML = tableHtml;
}
//---------

// 빠른 날짜 범위 설정
function setQuickDateRange(days) {
  const today = new Date();
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - days + 1);

  document.getElementById("startDate").valueAsDate = startDay;
  document.getElementById("endDate").valueAsDate = today;

  startDate = formatDate(startDay);
  endDate = formatDate(today);

  fetchData();
}

function adjustStickyColumnPositions() {
  const stickyCol = document.querySelector(".sticky-col");
  const stickyCol2Elements = document.querySelectorAll(".sticky-col-2");

  if (stickyCol && stickyCol2Elements.length > 0) {
    const stickyColWidth = stickyCol.getBoundingClientRect().width; // offsetWidth 대신 사용 권장

    stickyCol2Elements.forEach((el) => {
      el.style.left = stickyColWidth + "px";
    });
  }
}

// 페이지 로드 시 실행
window.addEventListener("load", adjustStickyColumnPositions);

// 리사이즈 시 재조정
window.addEventListener("resize", adjustStickyColumnPositions);

// 빠른 선택 버튼 활성화 상태 제거
function clearQuickButtonActive() {
  document
    .querySelectorAll(".quick-btn")
    .forEach((btn) => btn.classList.remove("active"));
}

function mergeRankings(data1, data2) {
  const map = new Map();

  data1.concat(data2).forEach((item) => {
    const key = `${item.brand}-${item.productName}-${item.keyword}`;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      // 병합 로직, 예: ranking 등 조건부 업데이트 필요시 적용
      // 간단히는 중복 무시 가능
    }
  });

  return Array.from(map.values());
}

async function fetchData() {
  try {
    const resRankings = await fetch(
      `${API_BASE}/rankings?start=${startDate}&end=${endDate}&device=${currentDevice}`
    );
    const dataRankings = await resRankings.json();

    const resMissing = await fetch(
      `${API_BASE}/rankings/missing?start=${startDate}&end=${endDate}&device=${currentDevice}`
    );
    const dataMissing = await resMissing.json();

    allData = mergeRankings(dataRankings, dataMissing);
    filteredData = [...allData];

    renderBrandFilters();
    filterByBrand(currentBrand);
  } catch (error) {
    console.error("❌ 데이터 로딩 실패:", error);
    loadSampleData();
  }
}

// 샘플 데이터 로드 (개발용)
function loadSampleData() {
  allData = generateSampleData();

  renderBrandFilters();
  filterByBrand(currentBrand);
}

// 샘플 데이터 생성
function generateSampleData() {
  const products = [
    {
      name: "르제바바수겔",
      brand: "르제",
      keywords: ["르제바바수", "르제겔", "바바수하이드레이팅겔"],
    },
    {
      name: "시바산크림dddddddddx테스트 100ml",
      brand: "시바산",
      keywords: ["시바산", "시바산크림", "시바산재생크림"],
    },
    {
      name: "레노덤쿠션",
      brand: "레노덤",
      keywords: ["레노덤", "레노덤쿠션", "레노덤비비쿠션"],
    },
    {
      name: "트리티스세럼",
      brand: "트리티스",
      keywords: ["트리티스", "트리티스EGF세럼", "트리티스펩타이드세럼"],
    },
  ];

  const data = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  products.forEach((product) => {
    product.keywords.forEach((keyword) => {
      const rankings = {};

      for (let i = 0; i < daysDiff; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dateStr = formatDate(date);

        rankings[dateStr] = {
          morning:
            Math.random() > 0.2 ? Math.floor(Math.random() * 50) + 1 : null,
          afternoon:
            Math.random() > 0.2 ? Math.floor(Math.random() * 50) + 1 : null,
        };
      }

      data.push({
        productName: product.name,
        brand: product.brand,
        keyword: keyword,
        rankings: rankings,
        favorite: Math.random() > 0.5,
        imageUrl: null,
      });
    });
  });

  return data;
}

// 브랜드 필터 렌더링
function renderBrandFilters() {
  const brands = [...new Set(allData.map((item) => item.brand))].sort((a, b) =>
    a.localeCompare(b, "ko-KR")
  );

  const container = document.querySelector(".brand-filters");

  // 기존 브랜드 버튼 제거 (즐겨찾기, 전체 버튼 제외)
  container
    .querySelectorAll(
      '.brand-btn:not([data-brand="favorite"]):not([data-brand="all"])'
    )
    .forEach((btn) => btn.remove());

  // '전체' 버튼 찾기
  const allBtn = container.querySelector('[data-brand="all"]');

  // 브랜드 버튼을 '전체' 앞에 삽입
  brands.forEach((brand) => {
    const btn = document.createElement("button");
    btn.className = "brand-btn";
    btn.dataset.brand = brand;
    btn.textContent = brand;
    btn.addEventListener("click", () => filterByBrand(brand));
    container.insertBefore(btn, allBtn);
  });

  // 즐겨찾기 버튼 이벤트
  container
    .querySelector('[data-brand="favorite"]')
    .addEventListener("click", () => filterByBrand("favorite"));

  // 전체 버튼 이벤트
  container
    .querySelector('[data-brand="all"]')
    .addEventListener("click", () => filterByBrand("all"));
}

// 브랜드 필터링
function filterByBrand(brand) {
  currentBrand = brand;

  // 버튼 활성화 상태 업데이트
  document.querySelectorAll(".brand-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.brand === brand);
  });

  applyFilters();
}

/// 필터 적용
function applyFilters() {
  filteredData = allData.filter((item) => {
    if (currentBrand === "favorite") {
      return item.favorite === true;
    } else if (currentBrand === "all") {
      return true;
    } else {
      return item.brand === currentBrand;
    }
  });

  filteredData.sort((a, b) => {
    // 보너스 키워드 여부에 따라 (보) 접두어 임시 추가
    const aKeyword = !a.is_target_keyword ? "(보)" + a.keyword : a.keyword;
    const bKeyword = !b.is_target_keyword ? "(보)" + b.keyword : b.keyword;

    // 1. 브랜드명 길이순 (짧은 것부터)
    const brandLengthDiff = a.brand.length - b.brand.length;
    if (brandLengthDiff !== 0) return brandLengthDiff;

    // 2. 브랜드명 가나다순
    const brandCompare = a.brand.localeCompare(b.brand, "ko-KR");
    if (brandCompare !== 0) return brandCompare;

    // 3. 제품명 길이순 (짧은 것부터)
    const productLengthDiff = a.productName.length - b.productName.length;
    if (productLengthDiff !== 0) return productLengthDiff;

    // 4. 제품명 가나다순
    const productCompare = a.productName.localeCompare(b.productName, "ko-KR");
    if (productCompare !== 0) return productCompare;

    // 5. 키워드 길이순 (짧은 것부터), 고려할 때 (보) 포함해서 계산
    const keywordLengthDiff = aKeyword.length - bKeyword.length;
    if (keywordLengthDiff !== 0) return keywordLengthDiff;

    // 6. 키워드 가나다순 (접두사 포함)
    return aKeyword.localeCompare(bKeyword, "ko-KR");
  });

  renderTable();
}

function renderTable() {
  const table = document.getElementById("rankingTable");
  const thead = table.querySelector("thead tr");
  const tbody = table.querySelector("tbody");

  // 헤더 - 날짜 컬럼 동적 생성
  thead
    .querySelectorAll("th:not(.sticky-col):not(.sticky-col-2)")
    .forEach((th) => th.remove());

  // ✅ startDate ~ endDate 사이의 모든 날짜 생성
  let dateList = [];
  if (startDate && endDate) {
    const start = new Date(startDate + "T00:00:00"); // 시간 정보 추가로 타임존 문제 방지
    const end = new Date(endDate + "T00:00:00");

    // ✅ 현재 날짜를 복사해서 사용
    let current = new Date(start);
    while (current <= end) {
      dateList.push(formatDate(current));
      current.setDate(current.getDate() + 1);
    }
  }

  //   // renderTable 함수 시작 부분에 추가
  //   console.log("startDate:", startDate, "endDate:", endDate);
  //   console.log("dateList:", dateList);
  //   console.log("Sample item.rankings:", filteredData[0]?.rankings);

  //   console.log("Generated dateList:", dateList); // 디버깅용
  //   if (filteredData.length > 0) {
  //     console.log("Sample rankings keys:", Object.keys(filteredData[0].rankings)); // 디버깅용
  //   }

  // 헤더에 날짜 추가
  dateList.forEach((date) => {
    const th = document.createElement("th");
    th.textContent = formatDateHeader(date);
    th.style.textAlign = "center";
    th.style.minWidth = "80px";
    th.style.maxWidth = "100px";
    thead.appendChild(th);
  });

  // 바디
  tbody.innerHTML = "";

  if (filteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="100" style="text-align: center; padding: 60px; color: #64748b;">
          데이터가 없습니다
        </td>
      </tr>
    `;
    return;
  }

  let lastProductName = "";
  let groupFlag = false;
  filteredData.forEach((item) => {
    if (item.productName !== lastProductName) {
      groupFlag = !groupFlag;
      lastProductName = item.productName;
    }
    const groupClass = groupFlag ? "product-group-even" : "product-group-odd";
    const tr = document.createElement("tr");
    tr.className = groupClass;
    tr.dataset.brand = item.brand;
    tr.dataset.productName = item.productName;

    // 제품 정보
    const productTd = document.createElement("td");
    productTd.className = `sticky-col ${groupClass}`;
    const imageHtml = item.imageUrl
      ? `<img src="${item.imageUrl}" alt="${item.productName}" class="product-image" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="product-image-fallback" style="display:none;">📦</div>`
      : `<div class="product-image-fallback">📦</div>`;
    productTd.innerHTML = `
  <div class="product-info">
    ${imageHtml}
    <div class="product-details">
      <div class="product-brand">${item.productName}</div>
    </div>
    <button class="favorite-btn ${item.favorite ? "active" : ""}" 
            data-brand="${item.brand}" 
            data-product="${item.productName}">
      ☆
    </button>
  </div>
`;
    tr.appendChild(productTd);

    const keywordTd = document.createElement("td");
    keywordTd.className = `sticky-col-2 keyword-cell ${groupClass}`;

    const keyword = item.keyword;
    const isTarget =
      item.is_target_keyword === true ||
      item.is_target_keyword === "true" ||
      item.is_target_keyword === 1;

    const displayKeyword = isTarget ? keyword : `(보) ${keyword}`;

    keywordTd.textContent = displayKeyword;
    tr.appendChild(keywordTd);

    // ✅ dateList의 모든 날짜에 대해 셀 생성
    dateList.forEach((date) => {
      const td = document.createElement("td");
      td.className = groupClass;
      td.style.textAlign = "center";
      td.style.minWidth = "80px";
      td.style.maxWidth = "100px";

      // ✅ 날짜 형식 정규화 (item.rankings의 키와 정확히 매칭)
      const ranking = item.rankings[date];

      if (ranking) {
        const rank =
          currentTimeFilter === "morning" ? ranking.morning : ranking.afternoon;

        td.innerHTML = rank
          ? createRankBadge(rank, date, item.keyword)
          : `<span class="rank-badge rank-none">--</span>`;
      } else {
        td.innerHTML = `<span class="rank-badge rank-none">--</span>`;
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  adjustStickyColumnPositions();
}

// createRankBadge 함수 수정: 클릭 가능한 버튼으로 변경
// script.js

// createRankBadge 함수를 이 코드로 교체
function createRankBadge(rank, date, keyword) {
  if (!rank || rank === "-") {
    return `<span class="rank-badge rank-none">--</span>`;
  }

  let className = "rank-none";
  if (rank <= 5) className = "rank-top";
  else if (rank <= 20) className = "rank-good";
  else if (rank <= 50) className = "rank-fair";
  else className = "rank-low";

  // ★★★ 수정: button 대신 span 사용, 클릭 가능하도록 스타일과 속성 추가 ★★★
  return `<span class="rank-badge ${className}" 
                style="cursor: pointer;"
                title="클릭하여 상세 순위 보기"
                data-date="${date}" 
                data-keyword="${keyword}">
            ${rank}
          </span>`;
}

// 날짜 포맷 (YYYY-MM-DD)
function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

// 헤더용 날짜 포맷 (YY-MM-DD)
function formatDateHeader(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 로딩 표시
function showLoading() {
  document.querySelector("tbody").innerHTML = `
    <tr class="loading-row">
      <td colspan="100">
        <div class="loading-spinner">🔄 데이터 로딩 중...</div>
      </td>
    </tr>
  `;
}
