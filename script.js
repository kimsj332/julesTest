document.addEventListener('DOMContentLoaded', () => {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            populateTable(data);
        });
});

function populateTable(data) {
    const tableHead = document.querySelector('table thead tr');
    const tableBody = document.querySelector('table tbody');

    // Populate headers
    data.dates.forEach(date => {
        const th = document.createElement('th');
        th.textContent = date;
        tableHead.appendChild(th);
    });

    // Populate rows
    data.products.forEach(product => {
        const tr = document.createElement('tr');

        // Product Info
        const productTd = document.createElement('td');
        productTd.innerHTML = `
            <div class="product-info">
                <img src="${product.image}" alt="${product.name}">
                <div class="product-details">
                    <span>${product.name}</span>
                    <div class="sku">SKU: ${product.sku}</div>
                </div>
            </div>
        `;
        tr.appendChild(productTd);

        // Rankings
        product.rankings.forEach(rank => {
            const td = document.createElement('td');
            td.textContent = rank;
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}
