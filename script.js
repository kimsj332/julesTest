// API 엔드포인트
const API_BASE = "/api";

// 전역 상태
let allData = [];
let filteredData = [];
let currentBrand = "favorite";
let currentTimeFilter = "afternoon";
let currentDevice = "Mobile"; // ✅ 추가
let startDate = null;
let endDate = null;

const deviceButtons = document.querySelectorAll(".device-btn");
const timeButtons = document.querySelectorAll(".time-btn");
const guideText = document.getElementById("guide-text");

// let currentDevice = 'Mobile';
let currentTime = "afternoon";

function updateGuideText() {
  const deviceText = currentDevice === "Mobile" ? "모바일" : "피씨";
  const timeText = currentTime === "morning" ? "오전" : "오후";

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
  btn.addEventListener("click", () => {
    timeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTime = btn.dataset.time;
    updateGuideText();
  });
});

// 초기 표시
updateGuideText();

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  initializeDatePicker();
  initializeEventListeners();
  fetchData();
});

// 날짜 피커 초기화
function initializeDatePicker() {
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);

  document.getElementById("startDate").valueAsDate = threeDaysAgo;
  document.getElementById("endDate").valueAsDate = today;

  startDate = formatDate(threeDaysAgo);
  endDate = formatDate(today);

  document.getElementById("endDate").max = formatDate(today);
}

// 이벤트 리스너 초기화
function initializeEventListeners() {
  // 날짜 입력 변경
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

  // 빠른 선택 버튼들
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

  // ✅ 디바이스 선택 버튼 (새로 추가)
  document.querySelectorAll(".device-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentDevice = e.target.dataset.device;

      // 활성화 상태 업데이트
      document
        .querySelectorAll(".device-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");

      fetchData();
    });
  });

  // 오전/오후 버튼
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
}

// 빠른 날짜 범위 설정
function setQuickDateRange(days) {
  const today = new Date();
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - days);

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

  // 날짜 집합(전체 고유 날짜 set, 모든 행에 적용)
  let dateList = [];
  if (filteredData.length > 0) {
    // 모든 제품에 걸쳐 unique 날짜 수집
    const dateSet = new Set();
    filteredData.forEach((item) => {
      Object.keys(item.rankings).forEach((date) => dateSet.add(date));
    });
    dateList = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
    dateList.forEach((date) => {
      const th = document.createElement("th");
      th.textContent = formatDateHeader(date);
      th.style.textAlign = "center";
      th.style.minWidth = "80px";
      th.style.maxWidth = "100px";
      thead.appendChild(th);
    });
  }

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

    // 기존 키워드 텍스트
    const keyword = item.keyword;
    // 타겟 키워드 여부
    const isTarget =
      item.is_target_keyword === true ||
      item.is_target_keyword === "true" ||
      item.is_target_keyword === 1;

    // 표시할 키워드 결정 (보너스 키워드는 '(보)' 붙임)
    const displayKeyword = isTarget ? keyword : `(보) ${keyword}`;

    keywordTd.textContent = displayKeyword;
    tr.appendChild(keywordTd);

    // 날짜별 순위: 항상 dateList 배열을 루프
    dateList.forEach((date) => {
      const td = document.createElement("td");
      td.className = groupClass;
      td.style.textAlign = "center";
      td.style.minWidth = "80px";
      td.style.maxWidth = "100px";
      const ranking = item.rankings[date];
      if (ranking) {
        const rank =
          currentTimeFilter === "morning" ? ranking.morning : ranking.afternoon;
        td.innerHTML = rank
          ? createRankBadge(rank)
          : `<span class="rank-badge rank-none">--</span>`;
      } else {
        td.innerHTML = `<span class="rank-badge rank-none">--</span>`;
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // 테이블 렌더링 완료 후 sticky 칼럼 위치 조정
  adjustStickyColumnPositions();

  // 즐겨찾기 버튼 이벤트 리스너 추가
  document.querySelectorAll(".favorite-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const brand = btn.dataset.brand;
      const product = btn.dataset.product;
      // allData에서 해당 항목 찾아서 favorite 토글
      allData.forEach((item) => {
        if (item.brand === brand && item.productName === product) {
          item.favorite = !item.favorite;
        }
      });

      // UI 업데이트
      btn.classList.toggle("active");

      // 서버에 저장하는 API 호출 (필요시)
      // updateFavoriteStatus(brand, product, item.favorite);
    });
  });
}

// 순위 배지 생성
function createRankBadge(rank) {
  if (!rank || rank === "-") {
    return `<span class="rank-badge rank-none">--</span>`;
  }

  // 숫자를 2자리로 포맷팅
  const formattedRank = rank.toString().padStart(2, "0");

  let className = "rank-none";
  if (rank <= 5) className = "rank-top";
  else if (rank <= 20) className = "rank-good";
  else if (rank <= 50) className = "rank-fair";
  else className = "rank-low";

  return `<span class="rank-badge ${className}">${rank}</span>`;
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
