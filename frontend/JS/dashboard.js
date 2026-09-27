"use strict";

/* ============================================================
   TRUSTCART DASHBOARD
============================================================ */


/* ============================================================
   ELEMENTS
============================================================ */

const productSearch =
    document.getElementById("productSearch");

const productSuggestions =
    document.getElementById("productSuggestions");

const compareBtn =
    document.getElementById("compareBtn");

const recentProducts =
    document.getElementById("recentProducts");

const themeToggle =
    document.getElementById("themeToggle");

const darkModeSwitch =
    document.getElementById("darkModeSwitch");

const startCompareBtn =
    document.getElementById("startCompareBtn");

const notificationBtn =
    document.getElementById("notificationBtn");

const notificationSwitch =
    document.getElementById("notificationSwitch");

const profileAvatarBtn =
    document.getElementById("profileAvatarBtn");

const accountBtn =
    document.getElementById("accountBtn");

const editProfileBtn =
    document.getElementById("editProfileBtn");

const pasteUrlBtn =
    document.getElementById("pasteUrlBtn");

const clearSearchBtn =
    document.getElementById("clearSearchBtn");

const clearUrlAction =
    document.getElementById("clearUrlAction");

const urlStatus =
    document.getElementById("urlStatus");

const urlStatusText =
    document.getElementById("urlStatusText");


/* ============================================================
   DATA
============================================================ */

const demoProducts = [

    {
        id: 1,
        name: "iPhone 15",
        brand: "Apple",
        category: "Mobiles"
    },

    {
        id: 2,
        name: "Samsung Galaxy S24",
        brand: "Samsung",
        category: "Mobiles"
    },

    {
        id: 3,
        name: "HP Victus Gaming Laptop",
        brand: "HP",
        category: "Laptops"
    },

    {
        id: 4,
        name: "Sony WH-1000XM5",
        brand: "Sony",
        category: "Headphones"
    },

    {
        id: 5,
        name: "Apple Watch Series 9",
        brand: "Apple",
        category: "Smartwatches"
    },

    {
        id: 6,
        name: "Samsung 55 Inch 4K TV",
        brand: "Samsung",
        category: "Televisions"
    }

];


let products = [];

let selectedProduct = null;


/* ============================================================
   LOCAL STORAGE
============================================================ */

let searchHistory =
    getStorageArray("trustcart-history");

let savedProducts =
    getStorageArray("trustcart-saved");

let notificationsEnabled =
    localStorage.getItem(
        "trustcart-notifications"
    ) !== "false";


function getStorageArray(key) {

    try {

        const value =
            localStorage.getItem(key);

        if (!value) {
            return [];
        }

        const parsed =
            JSON.parse(value);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "Storage error:",
            error
        );

        return [];

    }

}


function saveStorage(key, value) {

    localStorage.setItem(
        key,
        JSON.stringify(value)
    );

}


/* ============================================================
   CURRENT USER
============================================================ */

async function loadCurrentUser() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    credentials: "include"
                }
            );


        if (!response.ok) {

            console.warn(
                "Unable to load current user."
            );

            return;

        }


        const data =
            await response.json();


        if (
            !data.success ||
            !data.user
        ) {

            return;

        }


        updateUserUI(
            data.user
        );


        localStorage.setItem(
            "trustcart-user",
            JSON.stringify(data.user)
        );


    } catch (error) {

        console.error(
            "Error loading current user:",
            error
        );


        try {

            const cached =
                localStorage.getItem(
                    "trustcart-user"
                );


            if (!cached) {
                return;
            }


            updateUserUI(
                JSON.parse(cached)
            );

        } catch (fallbackError) {

            console.error(
                "User fallback error:",
                fallbackError
            );

        }

    }

}


function updateUserUI(user) {

    const name =
        user.name ||
        "User";

    const email =
        user.email ||
        "";

    const initial =
        name
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "U";


    document
        .querySelectorAll(
            "#profileName, " +
            "#userName, " +
            ".profile-name, " +
            ".user-name, " +
            "[data-user-name]"
        )
        .forEach(
            element => {

                element.textContent =
                    name;

            }
        );


    document
        .querySelectorAll(
            "#profileEmail, " +
            "#userEmail, " +
            ".profile-email, " +
            ".user-email, " +
            "[data-user-email]"
        )
        .forEach(
            element => {

                element.textContent =
                    email;

            }
        );


    document
        .querySelectorAll(
            "#profileAvatar, " +
            "#userAvatar, " +
            ".profile-avatar, " +
            ".user-avatar, " +
            "[data-user-avatar]"
        )
        .forEach(
            element => {

                if (
                    element.tagName !== "IMG"
                ) {

                    element.textContent =
                        initial;

                }

            }
        );


    const welcomeName =
        document.getElementById(
            "welcomeName"
        );


    if (welcomeName) {

        welcomeName.textContent =
            name;

    }

}


/* ============================================================
   NAVIGATION
============================================================ */

function showSection(sectionId) {

    const sections =
        document.querySelectorAll(
            ".page-section"
        );

    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );

    const mobileItems =
        document.querySelectorAll(
            ".mobile-nav a"
        );


    let target =
        document.getElementById(
            sectionId
        );


    if (!target) {

        sectionId =
            "dashboard";

        target =
            document.getElementById(
                "dashboard"
            );

    }


    if (!target) {
        return;
    }


    sections.forEach(
        section => {

            section.classList.remove(
                "active-section"
            );

        }
    );


    target.classList.add(
        "active-section"
    );


    navItems.forEach(
        item => {

            item.classList.toggle(
                "active",
                item.dataset.section ===
                sectionId
            );

        }
    );


    mobileItems.forEach(
        item => {

            item.classList.toggle(
                "mobile-active",
                item.dataset.section ===
                sectionId
            );

        }
    );


    hideSuggestions();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    if (
        sectionId === "dashboard" ||
        sectionId === "compare"
    ) {

        setTimeout(
            () => {

                if (productSearch) {

                    productSearch.focus();

                }

            },
            100
        );

    }

}


function handleHash() {

    let hash =
        window.location.hash.replace(
            "#",
            ""
        );


    if (!hash) {

        hash =
            "dashboard";

    }


    showSection(hash);

}


window.addEventListener(
    "hashchange",
    handleHash
);


document.addEventListener(
    "click",
    event => {

        const link =
            event.target.closest(
                "[data-section]"
            );


        if (!link) {
            return;
        }


        const section =
            link.dataset.section;


        if (!section) {
            return;
        }


        event.preventDefault();


        window.location.hash =
            section;

    }
);


document.addEventListener(
    "click",
    event => {

        const link =
            event.target.closest(
                "[data-section-link]"
            );


        if (!link) {
            return;
        }


        event.preventDefault();


        window.location.hash =
            link.dataset.sectionLink;

    }
);


/* ============================================================
   THEME
============================================================ */

function applyTheme(theme) {

    const isDark =
        theme === "dark";


    document.body.classList.toggle(
        "dark",
        isDark
    );


    localStorage.setItem(
        "trustcart-theme",
        isDark
            ? "dark"
            : "light"
    );


    if (themeToggle) {

        themeToggle.textContent =
            isDark
                ? "☀"
                : "☾";

    }


    if (darkModeSwitch) {

        darkModeSwitch.classList.toggle(
            "active",
            isDark
        );

    }

}


const savedTheme =
    localStorage.getItem(
        "trustcart-theme"
    ) || "light";


applyTheme(
    savedTheme
);


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const isDark =
                document.body.classList.contains(
                    "dark"
                );


            applyTheme(
                isDark
                    ? "light"
                    : "dark"
            );

        }
    );

}


if (darkModeSwitch) {

    darkModeSwitch.addEventListener(
        "click",
        () => {

            const isDark =
                document.body.classList.contains(
                    "dark"
                );


            applyTheme(
                isDark
                    ? "light"
                    : "dark"
            );

        }
    );

}


window.addEventListener(
    "storage",
    event => {

        if (
            event.key ===
            "trustcart-theme"
        ) {

            applyTheme(
                event.newValue === "dark"
                    ? "dark"
                    : "light"
            );

        }

    }
);


/* ============================================================
   LOAD PRODUCTS
============================================================ */

async function loadProducts() {

    showLoading();


    try {

        const response =
            await fetch(
                "/api/products",
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    credentials:
                        "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                `API error: ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            data &&
            Array.isArray(
                data.products
            )
        ) {

            products =
                data.products;

        } else {

            products =
                [...demoProducts];

        }

    } catch (error) {

        console.warn(
            "Product API unavailable. Using demo products.",
            error
        );


        products =
            [...demoProducts];

    }


    if (
        !products ||
        products.length === 0
    ) {

        products =
            [...demoProducts];

    }


    displayRecentProducts(
        products
    );


    updateStats();

}


function showLoading() {

    if (!recentProducts) {
        return;
    }


    recentProducts.innerHTML = `

        <div class="loading-card">

            <div class="loader"></div>

            Loading products...

        </div>

    `;

}


/* ============================================================
   DISPLAY PRODUCTS
============================================================ */

function displayRecentProducts(
    productList
) {

    if (!recentProducts) {
        return;
    }


    recentProducts.innerHTML =
        "";


    if (
        !productList ||
        productList.length === 0
    ) {

        recentProducts.innerHTML = `

            <div class="loading-card">
                No products available.
            </div>

        `;

        return;

    }


    productList
        .slice(0, 8)
        .forEach(
            product => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "product-card";


                const hasURL =
                    !!(
                        product.source_url ||
                        product.product_url ||
                        product.url
                    );


                card.innerHTML = `

                    <div class="product-card-top">

                        <div class="product-card-icon">
                            🛍️
                        </div>

                        <span class="product-category">
                            ${escapeHTML(
                                product.category ||
                                "Product"
                            )}
                        </span>

                    </div>


                    <div class="product-card-info">

                        <strong>
                            ${escapeHTML(
                                product.name ||
                                "Product"
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                product.brand ||
                                "Unknown Brand"
                            )}
                        </span>

                    </div>


                    <button
                        class="product-compare-btn"
                        type="button"
                        ${hasURL ? "" : "disabled"}
                    >
                        ${
                            hasURL
                                ? "Compare →"
                                : "URL Required"
                        }
                    </button>

                `;


                const button =
                    card.querySelector(
                        ".product-compare-btn"
                    );


                if (hasURL) {

                    button.addEventListener(
                        "click",
                        () => {

                            openComparison(
                                product
                            );

                        }
                    );

                }


                recentProducts.appendChild(
                    card
                );

            }
        );

}


/* ============================================================
   URL VALIDATION
============================================================ */

function isValidProductURL(value) {

    try {

        const url =
            new URL(value);


        return (
            (
                url.protocol === "http:" ||
                url.protocol === "https:"
            ) &&
            !!url.hostname
        );

    } catch {

        return false;

    }

}


/* ============================================================
   MARKETPLACE URL CHECK
============================================================ */

function isMarketplaceURL(value) {

    if (!isValidProductURL(value)) {
        return false;
    }


    try {

        const url =
            new URL(value);


        const hostname =
            url.hostname
                .toLowerCase()
                .replace(
                    /^www\./,
                    ""
                );


        const marketplaceDomains = [

            "amazon.in",
            "amazon.com",
            "amazon.co.uk",
            "amazon.ae",
            "amazon.de",

            "flipkart.com"

        ];


        return marketplaceDomains.some(
            domain =>
                hostname === domain ||
                hostname.endsWith(
                    "." + domain
                )
        );

    } catch {

        return false;

    }

}


function getMarketplaceName(value) {

    if (!isValidProductURL(value)) {
        return "";
    }


    try {

        const hostname =
            new URL(value)
                .hostname
                .toLowerCase();


        if (
            hostname.includes("amazon")
        ) {

            return "Amazon";

        }


        if (
            hostname.includes("flipkart")
        ) {

            return "Flipkart";

        }


        return "";

    } catch {

        return "";

    }

}


/* ============================================================
   URL STATUS
============================================================ */

function updateURLStatus(value) {

    if (!urlStatus || !urlStatusText) {
        return;
    }


    const raw =
        String(value || "").trim();


    urlStatus.classList.remove(
        "valid",
        "invalid",
        "marketplace"
    );


    if (!raw) {

        urlStatusText.textContent =
            "Paste a product URL to begin";

        return;

    }


    if (!isValidProductURL(raw)) {

        urlStatus.classList.add(
            "invalid"
        );

        urlStatusText.textContent =
            "Enter a valid product URL";

        return;

    }


    const marketplace =
        getMarketplaceName(raw);


    if (marketplace) {

        urlStatus.classList.add(
            "marketplace"
        );

        urlStatusText.textContent =
            `${marketplace} product URL detected`;

    } else {

        urlStatus.classList.add(
            "valid"
        );

        urlStatusText.textContent =
            "Valid product URL";

    }

}


/* ============================================================
   PRODUCT SEARCH / URL INPUT
============================================================ */

if (productSearch) {

    productSearch.addEventListener(
        "input",
        () => {

            selectedProduct =
                null;

            updateURLStatus(
                productSearch.value
            );

            hideSuggestions();

        }
    );


    productSearch.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                compareProduct();

            }


            if (
                event.key === "Escape"
            ) {

                hideSuggestions();

            }

        }
    );

}


/* ============================================================
   PASTE URL
============================================================ */

async function pasteProductURL() {

    if (!productSearch) {
        return;
    }


    try {

        const text =
            await navigator.clipboard.readText();


        if (!text) {

            showTemporaryStatus(
                "Clipboard is empty."
            );

            return;

        }


        productSearch.value =
            text.trim();


        updateURLStatus(
            productSearch.value
        );


        productSearch.focus();


        if (
            isValidProductURL(
                productSearch.value
            )
        ) {

            showTemporaryStatus(
                "URL pasted successfully."
            );

        }

    } catch (error) {

        console.warn(
            "Clipboard access failed:",
            error
        );


        productSearch.focus();


        showTemporaryStatus(
            "Paste using Ctrl + V."
        );

    }

}


if (pasteUrlBtn) {

    pasteUrlBtn.addEventListener(
        "click",
        pasteProductURL
    );

}


/* ============================================================
   CLEAR URL
============================================================ */

function clearProductURL() {

    if (!productSearch) {
        return;
    }


    productSearch.value =
        "";

    selectedProduct =
        null;

    hideSuggestions();

    updateURLStatus(
        ""
    );

    productSearch.focus();

}


if (clearSearchBtn) {

    clearSearchBtn.addEventListener(
        "click",
        clearProductURL
    );

}


if (clearUrlAction) {

    clearUrlAction.addEventListener(
        "click",
        clearProductURL
    );

}


/* ============================================================
   TEMPORARY STATUS
============================================================ */

function showTemporaryStatus(message) {

    if (!urlStatusText) {
        return;
    }


    const previous =
        urlStatusText.textContent;


    urlStatusText.textContent =
        message;


    setTimeout(
        () => {

            if (
                productSearch
            ) {

                updateURLStatus(
                    productSearch.value
                );

            } else {

                urlStatusText.textContent =
                    previous;

            }

        },
        1800
    );

}


/* ============================================================
   SUGGESTIONS
============================================================ */

function showSuggestions(matches) {

    if (!productSuggestions) {
        return;
    }


    productSuggestions.innerHTML =
        "";


    productSuggestions.style.display =
        "block";


    if (!matches.length) {

        productSuggestions.innerHTML = `

            <div class="suggestion-item no-result">

                <span>
                    No product found
                </span>

            </div>

        `;

        return;

    }


    matches.forEach(
        product => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "suggestion-item";


            item.innerHTML = `

                <div class="suggestion-left">

                    <div class="suggestion-icon">
                        🛍️
                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(
                                product.name
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                product.brand ||
                                ""
                            )}
                        </span>

                    </div>

                </div>

                <small>
                    URL required
                </small>

            `;


            item.addEventListener(
                "click",
                () => {

                    showTemporaryStatus(
                        "Paste the marketplace URL for this product."
                    );

                }
            );


            productSuggestions.appendChild(
                item
            );

        }
    );

}


function hideSuggestions() {

    if (!productSuggestions) {
        return;
    }


    productSuggestions.innerHTML =
        "";


    productSuggestions.style.display =
        "none";

}


/* ============================================================
   COMPARE BUTTON
============================================================ */

if (compareBtn) {

    compareBtn.addEventListener(
        "click",
        compareProduct
    );

}


/* ============================================================
   COMPARE PRODUCT
============================================================ */

async function compareProduct() {

    if (!productSearch) {
        return;
    }


    const rawValue =
        productSearch.value.trim();


    if (!rawValue) {

        alert(
            "Please paste an Amazon or Flipkart product URL."
        );

        productSearch.focus();

        return;

    }


    /*
     * URL is now required.
     */

    if (
        !isValidProductURL(
            rawValue
        )
    ) {

        updateURLStatus(
            rawValue
        );


        alert(
            "Please enter a valid Amazon or Flipkart product URL."
        );

        productSearch.focus();

        return;

    }


    /*
     * Existing comparison pipeline.
     */

    const urlProduct = {

        id: null,

        name:
            "Product from marketplace",

        brand: "",

        category:
            "Product",

        source_url:
            rawValue

    };


    await openComparison(
        urlProduct
    );

}


/* ============================================================
   OPEN COMPARISON
============================================================ */

async function openComparison(
    product
) {

    if (!product) {

        alert(
            "Unable to identify this product."
        );

        return;

    }


    const sourceURL =
        product.source_url ||
        product.product_url ||
        product.url ||
        product.sourceUrl ||
        "";


    if (!sourceURL) {

        alert(
            "This product does not have a marketplace URL yet.\n\n" +
            "Please paste an Amazon or Flipkart product URL."
        );

        console.warn(
            "TrustCart: product has no source URL:",
            product
        );

        return;

    }


    if (
        !isValidProductURL(
            sourceURL
        )
    ) {

        alert(
            "Please provide a valid product URL."
        );

        return;

    }


    if (compareBtn) {

        compareBtn.disabled =
            true;

        compareBtn.classList.add(
            "loading"
        );

        compareBtn.dataset.originalText =
            compareBtn.innerHTML;

        compareBtn.innerHTML = `

            <span class="button-spinner"></span>
            Comparing...

        `;

    }


    hideSuggestions();


    updateURLStatus(
        sourceURL
    );


    try {

        console.log(
            "TrustCart: starting comparison:",
            sourceURL
        );


        const response =
            await fetch(
                "/api/products/compare",
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            url:
                                sourceURL

                        })

                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                "The comparison server returned an invalid response."
            );

        }


        console.log(
            "TrustCart comparison response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data?.message ||
                `Comparison failed (${response.status}).`
            );

        }


        if (
            data?.success === false
        ) {

            throw new Error(
                data.message ||
                "Unable to compare this product."
            );

        }


        sessionStorage.setItem(
            "trustcart_compare_result",
            JSON.stringify(data)
        );


        sessionStorage.setItem(
            "trustcart_compare_timestamp",
            String(Date.now())
        );


        const productId =
            data.product_id ||
            data.product?.id ||
            data.canonical?.id ||
            product.id ||
            product.product_id;


        if (
            productId === undefined ||
            productId === null
        ) {

            throw new Error(
                "Comparison succeeded but no product ID was returned."
            );

        }


        const canonical =
            data.canonical || {};


        const historyProduct = {

            id:
                productId,

            name:
                canonical.product_name ||
                data.product?.name ||
                product.name ||
                "Compared Product",

            brand:
                canonical.brand ||
                data.product?.brand ||
                product.brand ||
                "",

            category:
                canonical.category ||
                data.product?.category ||
                product.category ||
                "Product",

            source_url:
                sourceURL

        };


        addToHistory(
            historyProduct
        );


        window.location.href =
            `/result/${encodeURIComponent(
                productId
            )}`;

    } catch (error) {

        console.error(
            "TrustCart comparison error:",
            error
        );


        alert(
            error.message ||
            "Unable to compare this product. Please try again."
        );

    } finally {

        if (compareBtn) {

            compareBtn.disabled =
                false;

            compareBtn.classList.remove(
                "loading"
            );

            compareBtn.innerHTML =
                compareBtn.dataset.originalText ||
                `<span class="button-icon">⚡</span>
                 Compare Prices
                 <span class="button-arrow">→</span>`;

        }

    }

}


/* ============================================================
   HISTORY
============================================================ */

function addToHistory(
    product
) {

    const productId =
        product.id ??
        product.product_id;


    searchHistory =
        searchHistory.filter(
            item => {

                const itemId =
                    item.id ??
                    item.product_id;


                if (
                    productId !== null &&
                    productId !== undefined
                ) {

                    return (
                        String(itemId) !==
                        String(productId)
                    );

                }


                return (
                    String(
                        item.source_url ||
                        ""
                    ) !==
                    String(
                        product.source_url ||
                        ""
                    )
                );

            }
        );


    searchHistory.unshift({

        id:
            productId,

        name:
            product.name ||
            "Compared Product",

        brand:
            product.brand ||
            "",

        category:
            product.category ||
            "Product",

        source_url:
            product.source_url ||
            product.product_url ||
            product.url ||
            "",

        timestamp:
            new Date().toISOString()

    });


    searchHistory =
        searchHistory.slice(
            0,
            10
        );


    saveStorage(
        "trustcart-history",
        searchHistory
    );


    renderHistory();

    updateStats();

}


function renderHistory() {

    const historyList =
        document.getElementById(
            "historyList"
        );

    const historyEmpty =
        document.getElementById(
            "historyEmpty"
        );


    if (
        !historyList ||
        !historyEmpty
    ) {

        return;

    }


    historyList.innerHTML =
        "";


    if (
        searchHistory.length === 0
    ) {

        historyEmpty.style.display =
            "flex";

        return;

    }


    historyEmpty.style.display =
        "none";


    searchHistory.forEach(
        product => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "history-item";


            item.innerHTML = `

                <div class="history-product">

                    <div class="history-icon">
                        🔗
                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(
                                product.name ||
                                "Compared Product"
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                product.brand ||
                                "Product comparison"
                            )}
                        </span>

                    </div>

                </div>


                <button
                    type="button"
                    class="history-open-btn"
                >
                    Compare →
                </button>

            `;


            item
                .querySelector(
                    ".history-open-btn"
                )
                .addEventListener(
                    "click",
                    () => {

                        if (
                            product.source_url
                        ) {

                            openComparison(
                                product
                            );

                        } else {

                            alert(
                                "This history item does not contain a product URL."
                            );

                        }

                    }
                );


            historyList.appendChild(
                item
            );

        }
    );

}


/* ============================================================
   SAVED PRODUCTS
============================================================ */

function toggleSaved(
    product
) {

    const productId =
        product.id ??
        product.product_id;


    const index =
        savedProducts.findIndex(
            item =>
                String(
                    item.id ??
                    item.product_id
                ) ===
                String(productId)
        );


    if (index >= 0) {

        savedProducts.splice(
            index,
            1
        );

    } else {

        savedProducts.push({

            id:
                productId,

            name:
                product.name,

            brand:
                product.brand,

            category:
                product.category,

            source_url:
                product.source_url ||
                product.product_url ||
                product.url ||
                ""

        });

    }


    saveStorage(
        "trustcart-saved",
        savedProducts
    );


    renderSavedProducts();

    updateStats();

}


function renderSavedProducts() {

    const container =
        document.getElementById(
            "savedProducts"
        );

    const empty =
        document.getElementById(
            "savedEmpty"
        );


    if (
        !container ||
        !empty
    ) {

        return;

    }


    container.innerHTML =
        "";


    if (
        savedProducts.length === 0
    ) {

        empty.style.display =
            "flex";

        return;

    }


    empty.style.display =
        "none";


    savedProducts.forEach(
        product => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "saved-item";


            item.innerHTML = `

                <div class="saved-item-info">

                    <div class="saved-icon">
                        🛍️
                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(
                                product.name ||
                                "Saved Product"
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                product.brand ||
                                "Product"
                            )}
                        </span>

                    </div>

                </div>


                <div class="saved-actions">

                    <button
                        class="saved-compare"
                        type="button"
                    >
                        Compare
                    </button>

                    <button
                        class="saved-remove"
                        type="button"
                    >
                        Remove
                    </button>

                </div>

            `;


            item
                .querySelector(
                    ".saved-compare"
                )
                .addEventListener(
                    "click",
                    () => {

                        openComparison(
                            product
                        );

                    }
                );


            item
                .querySelector(
                    ".saved-remove"
                )
                .addEventListener(
                    "click",
                    () => {

                        toggleSaved(
                            product
                        );

                    }
                );


            container.appendChild(
                item
            );

        }
    );

}


/* ============================================================
   STATS
============================================================ */

function updateStats() {

    const comparedCount =
        document.getElementById(
            "comparedCount"
        );

    const savedCount =
        document.getElementById(
            "savedCount"
        );

    const profileCompared =
        document.getElementById(
            "profileCompared"
        );

    const profileSaved =
        document.getElementById(
            "profileSaved"
        );

    const dealsCount =
        document.getElementById(
            "dealsCount"
        );


    const compared =
        searchHistory.length;

    const saved =
        savedProducts.length;


    if (comparedCount) {

        comparedCount.textContent =
            compared;

    }


    if (savedCount) {

        savedCount.textContent =
            saved;

    }


    if (profileCompared) {

        profileCompared.textContent =
            compared;

    }


    if (profileSaved) {

        profileSaved.textContent =
            saved;

    }


    if (dealsCount) {

        dealsCount.textContent =
            products.length;

    }


    /*
     * Potential savings is kept safe.
     * It can later be populated from comparison results.
     */

    const moneySaved =
        document.getElementById(
            "moneySaved"
        );


    if (moneySaved) {

        let totalSavings = 0;


        searchHistory.forEach(
            item => {

                if (
                    typeof item.savings ===
                    "number"
                ) {

                    totalSavings +=
                        item.savings;

                }

            }
        );


        moneySaved.textContent =
            `₹${Math.round(
                totalSavings
            ).toLocaleString("en-IN")}`;

    }

}


/* ============================================================
   START COMPARING
============================================================ */

if (startCompareBtn) {

    startCompareBtn.addEventListener(
        "click",
        () => {

            window.location.hash =
                "dashboard";


            setTimeout(
                () => {

                    if (productSearch) {

                        productSearch.focus();

                    }

                },
                150
            );

        }
    );

}


/* ============================================================
   NOTIFICATIONS
============================================================ */

function updateNotificationState() {

    if (notificationSwitch) {

        notificationSwitch.classList.toggle(
            "active",
            notificationsEnabled
        );

    }


    const dot =
        document.getElementById(
            "notificationDot"
        );


    if (dot) {

        dot.style.display =
            notificationsEnabled
                ? "block"
                : "none";

    }

}


if (notificationSwitch) {

    notificationSwitch.addEventListener(
        "click",
        () => {

            notificationsEnabled =
                !notificationsEnabled;


            localStorage.setItem(
                "trustcart-notifications",
                notificationsEnabled
            );


            updateNotificationState();

        }
    );

}


if (notificationBtn) {

    notificationBtn.addEventListener(
        "click",
        () => {

            if (
                notificationsEnabled
            ) {

                alert(
                    "You have no new notifications."
                );

            } else {

                alert(
                    "Notifications are currently disabled."
                );

            }

        }
    );

}


/* ============================================================
   PROFILE
============================================================ */

if (profileAvatarBtn) {

    profileAvatarBtn.addEventListener(
        "click",
        () => {

            window.location.hash =
                "profile";

        }
    );

}


if (accountBtn) {

    accountBtn.addEventListener(
        "click",
        () => {

            window.location.hash =
                "profile";

        }
    );

}


if (editProfileBtn) {

    editProfileBtn.addEventListener(
        "click",
        () => {

            alert(
                "Profile editing will be connected to the account API."
            );

        }
    );

}


/* ============================================================
   CLICK OUTSIDE SEARCH
============================================================ */

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".url-box"
            ) &&
            !event.target.closest(
                ".product-suggestions"
            )
        ) {

            hideSuggestions();

        }

    }
);


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


/* ============================================================
   INITIALIZE
============================================================ */

async function initializeDashboard() {

    await loadCurrentUser();

    handleHash();

    renderHistory();

    renderSavedProducts();

    updateNotificationState();

    updateStats();

    await loadProducts();

}


initializeDashboard();