"use strict";

/* =========================================================
   TRUSTCART RESULT PAGE
========================================================= */

let currentPrices = [];
let currentProduct = null;
let currentComparison = null;
let currentProductId = null;
let currentBestDeal = null;
let lastFocusedElement = null;


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $all = (selector) =>
    Array.from(document.querySelectorAll(selector));


/* =========================================================
   DOM
========================================================= */

const loading = $("#loading");
const errorBox = $("#errorBox");
const errorMessage = $("#errorMessage");
const results = $("#results");

const productImage = $("#productImage");
const productImageFallback = $("#productImageFallback");
const productName = $("#productName");
const productBrand = $("#productBrand");
const productCategory = $("#productCategory");
const productSource = $("#productSource");
const comparisonStatus = $("#comparisonStatus");

const quickBestPrice = $("#quickBestPrice");
const quickSavings = $("#quickSavings");
const quickSellerCount = $("#quickSellerCount");
const quickTrustScore = $("#quickTrustScore");

const bestSeller = $("#bestSeller");
const bestWebsite = $("#bestWebsite");
const bestSellerLogo = $("#bestSellerLogo");
const bestPrice = $("#bestPrice");
const savings = $("#savings");
const savingsBadge = $("#savingsBadge");
const dealReason = $("#dealReason");
const dealStatus = $("#dealStatus");

const bestBuyBtn = $("#bestBuyBtn");
const bestAnalyzeBtn = $("#bestAnalyzeBtn");

const smartInsight = $("#smartInsight");
const smartInsightText = $("#smartInsightText");

const trustScore = $("#trustScore");
const trustLevel = $("#trustLevel");

const priceAnalysis = $("#priceAnalysis");
const sellerAnalysis = $("#sellerAnalysis");
const freshnessAnalysis = $("#freshnessAnalysis");
const recommendation = $("#recommendation");

const priceBars = $("#priceBars");

const sellerCount = $("#sellerCount");
const sellerRows = $("#sellerRows");
const sellerEmpty = $("#sellerEmpty");
const sortSelect = $("#sortSelect");

const buyingTip = $("#buyingTip");

const themeToggle = $("#themeToggle");
const topAvatar = $("#topAvatar");
const profileMenu = $("#profileMenu");
const avatarInitial = $("#avatarInitial");
const userName = $("#userName");
const userEmail = $("#userEmail");
const profileLogout = $("#profileLogout");

const copySummaryBtn = $("#copySummaryBtn");
const shareBtn = $("#shareBtn");
const refreshBtn = $("#refreshBtn");
const retryBtn = $("#retryBtn");

const alertBtn = $("#alertBtn");
const alertModal = $("#alertModal");
const closeModal = $("#closeModal");
const targetPrice = $("#targetPrice");
const saveAlert = $("#saveAlert");
const alertMessage = $("#alertMessage");
const existingAlertStatus = $("#existingAlertStatus");


/* =========================================================
   BASIC HELPERS
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
    return escapeHtml(value);
}


function isSafeUrl(url) {
    if (!url || typeof url !== "string") {
        return false;
    }

    try {
        const parsed = new URL(url, window.location.origin);

        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        );
    } catch {
        return false;
    }
}


function formatPrice(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "₹0";
    }

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(number);
}


function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0
    }).format(number);
}


function formatScore(value) {
    const score = Number(value);

    if (!Number.isFinite(score)) {
        return "0";
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}


function marketplaceInitial(name) {
    const value = String(name || "").toLowerCase();

    if (value.includes("amazon")) return "A";
    if (value.includes("flipkart")) return "F";
    if (value.includes("snapdeal")) return "S";
    if (value.includes("croma")) return "C";
    if (value.includes("reliance")) return "R";
    if (value.includes("myntra")) return "M";
    if (value.includes("meesho")) return "M";

    return String(name || "T").trim().charAt(0).toUpperCase() || "T";
}


function cleanSellerName(name) {
    const value = String(name || "").trim();

    if (!value) {
        return "Marketplace";
    }

    const lower = value.toLowerCase();

    if (lower.includes("amazon")) return "Amazon";
    if (lower.includes("flipkart")) return "Flipkart";
    if (lower.includes("snapdeal")) return "Snapdeal";
    if (lower.includes("croma")) return "Croma";
    if (lower.includes("reliance")) return "Reliance Digital";
    if (lower.includes("myntra")) return "Myntra";
    if (lower.includes("meesho")) return "Meesho";

    return value;
}


function formatUpdatedDate(value) {
    if (!value) {
        return "Recently checked";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Recently checked";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}


function getTrustScore(item) {
    const possibleValues = [
        item?.trust_score,
        item?.trustScore,
        item?.score
    ];

    for (const value of possibleValues) {
        const number = Number(value);

        if (Number.isFinite(number)) {
            return Math.max(0, Math.min(100, number));
        }
    }

    return 70;
}


function getRating(item) {
    const possibleValues = [
        item?.rating,
        item?.product_rating,
        item?.seller_rating
    ];

    for (const value of possibleValues) {
        const number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }
    }

    return 0;
}


function getReviews(item) {
    const possibleValues = [
        item?.reviews,
        item?.review_count,
        item?.rating_count
    ];

    for (const value of possibleValues) {
        const number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }
    }

    return 0;
}


/* =========================================================
   PRODUCT IMAGE
========================================================= */

function configureProductImage(product) {

    if (!productImage) {
        return;
    }

    const imageUrl =
        product?.image_url ||
        product?.imageUrl ||
        product?.image ||
        product?.thumbnail ||
        "";

    const name =
        product?.name ||
        product?.title ||
        "Product";

    productImage.onerror = () => {

        productImage.style.display = "none";

        if (productImageFallback) {
            productImageFallback.style.display = "flex";
        }
    };

    if (!isSafeUrl(imageUrl)) {

        productImage.style.display = "none";

        if (productImageFallback) {
            productImageFallback.style.display = "flex";
        }

        return;
    }

    productImage.src = imageUrl;
    productImage.alt = name;

    productImage.style.display = "block";
    productImage.style.visibility = "visible";
    productImage.style.objectFit = "contain";

    if (productImageFallback) {
        productImageFallback.style.display = "none";
    }
}


/* =========================================================
   NORMALIZATION
========================================================= */

function normalizePriceItem(item) {

    if (!item || typeof item !== "object") {
        return null;
    }

    const rawPrice =
        item.price ??
        item.current_price ??
        item.selling_price ??
        item.final_price;

    const price = Number(rawPrice);

    if (!Number.isFinite(price) || price <= 0) {
        return null;
    }

    const seller = cleanSellerName(
        item.seller ||
        item.marketplace ||
        item.platform ||
        item.website ||
        "Marketplace"
    );

    return {
        ...item,

        seller,

        website:
            item.website ||
            seller,

        price,

        product_url:
            item.product_url ||
            item.productUrl ||
            item.url ||
            item.link ||
            "",

        trust_score: getTrustScore(item),

        rating: getRating(item),

        reviews: getReviews(item),

        updated_at:
            item.updated_at ||
            item.updatedAt ||
            item.timestamp ||
            null
    };
}


function extractPriceItems(data) {

    const sources = [
        data?.matching,
        data?.price_comparison,
        data?.prices,
        data?.results,
        data?.products
    ];

    for (const source of sources) {

        if (Array.isArray(source) && source.length) {
            return source;
        }

        if (
            source &&
            Array.isArray(source.products)
        ) {
            return source.products;
        }

        if (
            source &&
            Array.isArray(source.prices)
        ) {
            return source.prices;
        }
    }

    if (Array.isArray(data)) {
        return data;
    }

    return [];
}


function deduplicatePrices(items) {

    const seen = new Set();
    const output = [];

    for (const item of items) {

        const normalized = normalizePriceItem(item);

        if (!normalized) {
            continue;
        }

        const key = [
            normalized.seller.toLowerCase(),
            normalized.product_url || "",
            normalized.price
        ].join("|");

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        output.push(normalized);
    }

    return output;
}


/* =========================================================
   SORTING
========================================================= */

function getSortedPrices(prices, mode) {

    const items = [...prices];

    const cheapest =
        Math.min(
            ...items.map((item) => Number(item.price))
        );

    switch (mode) {

        case "price":
        case "price-asc":
        case "lowest":

            return items.sort(
                (a, b) => a.price - b.price
            );

        case "highest":

            return items.sort(
                (a, b) => b.price - a.price
            );

        case "trust":

            return items.sort(
                (a, b) =>
                    getTrustScore(b) -
                    getTrustScore(a)
            );

        case "rating":

            return items.sort(
                (a, b) =>
                    getRating(b) -
                    getRating(a)
            );

        case "seller":

            return items.sort(
                (a, b) =>
                    a.seller.localeCompare(
                        b.seller
                    )
            );

        case "best":
        default:

            return items.sort((a, b) => {

                const aScore =
                    getTrustScore(a) -
                    ((a.price - cheapest) / Math.max(cheapest, 1)) * 30;

                const bScore =
                    getTrustScore(b) -
                    ((b.price - cheapest) / Math.max(cheapest, 1)) * 30;

                return bScore - aScore;
            });
    }
}


/* =========================================================
   BEST DEAL
========================================================= */

function chooseBestDeal(prices) {

    if (!prices.length) {
        return null;
    }

    const cheapest =
        Math.min(
            ...prices.map((item) => item.price)
        );

    return [...prices].sort((a, b) => {

        const aPricePenalty =
            ((a.price - cheapest) /
                Math.max(cheapest, 1)) * 30;

        const bPricePenalty =
            ((b.price - cheapest) /
                Math.max(cheapest, 1)) * 30;

        const aScore =
            getTrustScore(a) -
            aPricePenalty;

        const bScore =
            getTrustScore(b) -
            bPricePenalty;

        return bScore - aScore;

    })[0];
}


/* =========================================================
   TRUST
========================================================= */

function calculateOverallTrust(prices) {

    if (!prices.length) {
        return 0;
    }

    const average =
        prices.reduce(
            (sum, item) =>
                sum + getTrustScore(item),
            0
        ) / prices.length;

    const sellerFactor =
        Math.min(prices.length, 5) * 3;

    return Math.round(
        Math.min(
            100,
            average + sellerFactor
        )
    );
}


function getTrustLevel(score) {

    if (score >= 85) {
        return "Excellent";
    }

    if (score >= 75) {
        return "Good";
    }

    if (score >= 60) {
        return "Fair";
    }

    return "Low";
}


/* =========================================================
   DISPLAY PRODUCT
========================================================= */

function displayProduct(product) {

    const name =
        product?.name ||
        product?.title ||
        product?.product_name ||
        "Product";

    const brand =
        product?.brand ||
        product?.brand_name ||
        "Unknown";

    const category =
        product?.category ||
        "Product";

    if (productName) {
        productName.textContent = name;
    }

    if (productBrand) {
        productBrand.textContent = brand;
    }

    if (productCategory) {
        productCategory.textContent = category;
    }

    if (productSource) {
        productSource.textContent =
            "Multiple marketplace listings analyzed";
    }

    configureProductImage(product);
}


/* =========================================================
   QUICK STATS
========================================================= */

function displayQuickStats(prices, overallTrust) {

    if (!prices.length) {
        return;
    }

    const lowest =
        Math.min(
            ...prices.map((item) => item.price)
        );

    const highest =
        Math.max(
            ...prices.map((item) => item.price)
        );

    const savingsAmount =
        Math.max(0, highest - lowest);

    if (quickBestPrice) {
        quickBestPrice.textContent =
            formatPrice(lowest);
    }

    if (quickSavings) {
        quickSavings.textContent =
            formatPrice(savingsAmount);
    }

    if (quickSellerCount) {
        quickSellerCount.textContent =
            String(prices.length);
    }

    if (quickTrustScore) {
        quickTrustScore.textContent =
            `${formatScore(overallTrust)}/100`;
    }
}


/* =========================================================
   BEST DEAL UI
========================================================= */

function configureBestDeal(deal, prices) {

    currentBestDeal = deal;

    if (!deal) {
        return;
    }

    const lowest =
        Math.min(
            ...prices.map((item) => item.price)
        );

    const savingsAmount =
        Math.max(
            0,
            Math.max(
                ...prices.map((item) => item.price)
            ) - deal.price
        );

    const savingsPercentage =
        savingsAmount > 0
            ? Math.round(
                (savingsAmount /
                    Math.max(
                        ...prices.map(
                            (item) => item.price
                        )
                    )) * 100
            )
            : 0;

    if (bestSeller) {
        bestSeller.textContent =
            deal.seller;
    }

    if (bestWebsite) {
        bestWebsite.textContent =
            deal.website || deal.seller;
    }

    if (bestSellerLogo) {
        bestSellerLogo.textContent =
            marketplaceInitial(deal.seller);
    }

    if (bestPrice) {
        bestPrice.textContent =
            formatPrice(deal.price);
    }

    if (savings) {

        if (deal.price === lowest) {
            savings.textContent =
                "Lowest verified marketplace price";
        } else {
            savings.textContent =
                "Strong price + trust balance";
        }
    }

    if (savingsBadge) {

        if (deal.price === lowest) {
            savingsBadge.textContent =
                "Lowest price";
        } else {
            savingsBadge.textContent =
                "Best overall";
        }
    }

    if (dealReason) {

        if (deal.price === lowest) {
            dealReason.textContent =
                "Lowest available price across checked marketplaces.";
        } else {
            dealReason.textContent =
                "Best balance of price and TrustCart trust signals.";
        }
    }

    if (dealStatus) {
        dealStatus.textContent =
            `✓ ${formatScore(getTrustScore(deal))}/100 trust`;
    }

    configureBuyButton(
        bestBuyBtn,
        deal.product_url
    );

    if (bestAnalyzeBtn) {

        if (deal.product_url) {

            bestAnalyzeBtn.style.display =
                "inline-flex";

            bestAnalyzeBtn.onclick = () =>
                openReviewAnalysis(deal);

        } else {

            bestAnalyzeBtn.style.display =
                "none";
        }
    }
}


function configureBuyButton(button, url) {

    if (!button) {
        return;
    }

    if (!isSafeUrl(url)) {

        button.style.display = "none";

        return;
    }

    button.href = url;
    button.style.display = "inline-flex";
}


/* =========================================================
   SMART INSIGHT
========================================================= */

function displaySmartInsight(prices, deal) {

    if (!prices.length || !deal) {
        return;
    }

    const lowest =
        Math.min(
            ...prices.map((item) => item.price)
        );

    const highest =
        Math.max(
            ...prices.map((item) => item.price)
        );

    const spread =
        highest - lowest;

    if (deal.price === lowest) {

        smartInsight.textContent =
            `${deal.seller} has the lowest checked price.`;

        smartInsightText.textContent =
            `You are currently looking at the strongest price option among ${prices.length} checked marketplace${prices.length > 1 ? "s" : ""}.`;

    } else {

        smartInsight.textContent =
            `${deal.seller} offers the best overall balance.`;

        smartInsightText.textContent =
            `The cheapest listing is ${formatPrice(lowest)}, while the recommended deal scores better on overall trust.`;
    }

    if (spread === 0) {

        smartInsightText.textContent =
            "Prices are currently identical across the checked marketplaces.";
    }
}


/* =========================================================
   TRUST SECTION
========================================================= */

function displayTrustAnalysis(prices, deal, overallTrust) {

    const lowest =
        Math.min(
            ...prices.map((item) => item.price)
        );

    const highest =
        Math.max(
            ...prices.map((item) => item.price)
        );

    const spread =
        highest - lowest;

    if (trustScore) {
        trustScore.textContent =
            formatScore(overallTrust);
    }

    if (trustLevel) {
        trustLevel.textContent =
            getTrustLevel(overallTrust);
    }

    if (priceAnalysis) {

        if (deal.price === lowest) {
            priceAnalysis.textContent =
                "This is the lowest checked price.";
        } else {
            priceAnalysis.textContent =
                "Price is competitive with the market.";
        }
    }

    if (sellerAnalysis) {

        if (prices.length >= 3) {
            sellerAnalysis.textContent =
                `${prices.length} marketplace offers found.`;
        } else if (prices.length === 2) {
            sellerAnalysis.textContent =
                "Two marketplace offers found.";
        } else {
            sellerAnalysis.textContent =
                "Limited marketplace coverage.";
        }
    }

    if (freshnessAnalysis) {
        freshnessAnalysis.textContent =
            "Prices were checked during this comparison.";
    }

    if (recommendation) {

        if (overallTrust >= 85) {
            recommendation.textContent =
                "Strong recommendation.";
        } else if (overallTrust >= 70) {
            recommendation.textContent =
                "Reasonable deal.";
        } else {
            recommendation.textContent =
                "Review carefully before buying.";
        }
    }
}


/* =========================================================
   PRICE BARS
========================================================= */

function renderPriceBars(prices) {

    if (!priceBars) {
        return;
    }

    priceBars.innerHTML = "";

    if (!prices.length) {
        return;
    }

    const maxPrice =
        Math.max(
            ...prices.map((item) => item.price)
        );

    const minPrice =
        Math.min(
            ...prices.map((item) => item.price)
        );

    const sorted =
        [...prices].sort(
            (a, b) => a.price - b.price
        );

    sorted.forEach((item) => {

        const row =
            document.createElement("div");

        row.className =
            "price-bar-item";

        if (item.price === minPrice) {
            row.classList.add(
                "best-price-bar"
            );
        }

        const percentage =
            maxPrice > 0
                ? Math.max(
                    10,
                    Math.round(
                        (item.price / maxPrice) * 100
                    )
                )
                : 0;

        row.innerHTML = `
            <div class="price-bar-seller">
                <div class="price-bar-logo">
                    ${escapeHtml(
                        marketplaceInitial(item.seller)
                    )}
                </div>

                <span>
                    ${escapeHtml(item.seller)}
                </span>
            </div>

            <div class="price-track">
                <div
                    class="price-fill"
                    style="width:${percentage}%"
                ></div>
            </div>

            <div class="price-bar-value">
                ${formatPrice(item.price)}
            </div>
        `;

        priceBars.appendChild(row);
    });
}


/* =========================================================
   SELLER TABLE
========================================================= */

function renderSellerRows(prices) {

    if (!sellerRows) {
        return;
    }

    sellerRows.innerHTML = "";

    if (sellerCount) {
        sellerCount.textContent =
            String(prices.length);
    }

    if (!prices.length) {

        if (sellerEmpty) {
            sellerEmpty.style.display =
                "block";
        }

        return;
    }

    if (sellerEmpty) {
        sellerEmpty.style.display =
            "none";
    }

    const lowest =
        Math.min(
            ...prices.map((item) => item.price)
        );

    const sorted =
        getSortedPrices(
            prices,
            sortSelect?.value || "best"
        );

    sorted.forEach((item) => {

        const row =
            document.createElement("div");

        row.className =
            "seller-row";

        const trust =
            formatScore(
                getTrustScore(item)
            );

        const rating =
            getRating(item);

        const reviews =
            getReviews(item);

        let differenceText = "Lowest price";

        if (item.price > lowest) {

            differenceText =
                `+${formatPrice(
                    item.price - lowest
                )} vs lowest`;
        }

        const ratingText =
            rating > 0
                ? `★ ${rating.toFixed(1)}`
                : "Rating unavailable";

        const reviewsText =
            reviews > 0
                ? ` · ${formatNumber(reviews)} reviews`
                : "";

        const safeProductUrl =
            isSafeUrl(item.product_url)
                ? item.product_url
                : "";

        const analyzeButton = `
            <button
                class="analyze-btn seller-analyze-btn"
                type="button"
            >
                Analyze
                <span>→</span>
            </button>
        `;

        const buyButton =
            safeProductUrl
                ? `
                    <a
                        class="buy-btn"
                        href="${escapeAttribute(
                            safeProductUrl
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Buy
                        <span>↗</span>
                    </a>
                `
                : `
                    <span
                        class="link-unavailable"
                    >
                        Link unavailable
                    </span>
                `;

        row.innerHTML = `
            <div class="seller-platform">

                <div class="seller-logo">
                    ${escapeHtml(
                        marketplaceInitial(
                            item.seller
                        )
                    )}
                </div>

                <div>
                    <strong>
                        ${escapeHtml(
                            item.seller
                        )}

                        ${
                            item.price === lowest
                                ? `
                                    <span class="best-badge">
                                        BEST
                                    </span>
                                  `
                                : ""
                        }
                    </strong>

                    <span>
                        ${escapeHtml(
                            item.website ||
                            item.seller
                        )}
                    </span>
                </div>

            </div>


            <div class="seller-price">

                ${formatPrice(item.price)}

                <span class="price-difference">
                    ${escapeHtml(
                        differenceText
                    )}
                </span>

            </div>


            <div class="seller-trust">

                <span class="trust-pill">
                    ${trust}/100
                </span>

                <span class="seller-rating">
                    ${escapeHtml(
                        ratingText
                    )}
                    ${escapeHtml(
                        reviewsText
                    )}
                </span>

            </div>


            <div class="seller-updated">
                ${escapeHtml(
                    formatUpdatedDate(
                        item.updated_at
                    )
                )}
            </div>


            <div class="seller-action">
                ${buyButton}
                ${analyzeButton}
            </div>
        `;

        const analyzeBtn =
            row.querySelector(
                ".seller-analyze-btn"
            );

        if (analyzeBtn) {

            analyzeBtn.addEventListener(
                "click",
                () => openReviewAnalysis(item)
            );
        }

        sellerRows.appendChild(row);
    });
}


/* =========================================================
   REVIEW ANALYSIS
   TEMPORARY FAKE DATA
========================================================= */


async function openReviewAnalysis(item) {

    /*
     * TRUSTCART REVIEW ANALYSIS
     *
     * Opens the analysis view in the SAME TAB.
     * The comparison page remains alive underneath,
     * so returning to the comparison is instant.
     */

    const productTitle =
        currentProduct?.name ||
        currentProduct?.title ||
        item?.name ||
        item?.title ||
        "Product";

    const productUrl =
        isSafeUrl(item?.product_url)
            ? item.product_url
            : "";

    /*
     * Remove an already-open analysis view.
     */
    const existing =
        document.getElementById("trustcartAnalyzeView");

    if (existing) {
        existing.remove();
    }

    /*
     * Keep browser history useful.
     */
    history.pushState(
        {
            trustcartAnalyze: true
        },
        "",
        window.location.href
    );

    /*
     * ---------------------------------------------------------
     * ANALYSIS VIEW
     * ---------------------------------------------------------
     */

    const analysisView =
        document.createElement("div");

    analysisView.id =
        "trustcartAnalyzeView";

    analysisView.innerHTML = `
        <div class="tc-floating-orb tc-orb-one"></div>
        <div class="tc-floating-orb tc-orb-two"></div>


        <style>

            #trustcartAnalyzeView {
                position: fixed;
                inset: 0;
                z-index: 999999;
                overflow-y: auto;

                --tc-green: #18583d;
                --tc-green-dark: #0d3d29;
                --tc-green-light: #61b487;

                --tc-bg: #f5f8f6;
                --tc-card: #ffffff;
                --tc-text: #173126;
                --tc-muted: #6b7c73;
                --tc-border: #dce8e1;
                --tc-track: #e6eee9;

                background:
                    linear-gradient(
                        180deg,
                        #f5f8f6 0%,
                        #edf5f0 100%
                    );

                color: var(--tc-text);

                font-family:
                    Inter,
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;
            }

            #trustcartAnalyzeView.tc-dark {
                --tc-bg: #0c1712;
                --tc-card: #14231b;
                --tc-text: #edf7f1;
                --tc-muted: #9aafa4;
                --tc-border: #294236;
                --tc-track: #253a2e;

                background:
                    linear-gradient(
                        180deg,
                        #0c1712 0%,
                        #102018 100%
                    );
            }

            #trustcartAnalyzeView * {
                box-sizing: border-box;
            }

            .tc-analysis-shell {
                width: min(1120px, calc(100% - 32px));
                margin: 0 auto;
                padding: 24px 0 60px;
            }

            .tc-analysis-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;

                padding: 12px 0 24px;
            }

            .tc-analysis-brand {
                display: flex;
                align-items: center;
                gap: 10px;

                font-size: 20px;
                font-weight: 800;
                color: var(--tc-text);
            }

            .tc-analysis-logo {
                width: 38px;
                height: 38px;

                display: grid;
                place-items: center;

                border-radius: 11px;

                background:
                    linear-gradient(
                        135deg,
                        var(--tc-green),
                        var(--tc-green-light)
                    );

                color: white;
                font-weight: 900;
            }

            .tc-analysis-actions {
                display: flex;
                gap: 10px;
            }

            .tc-analysis-action {
                border: 1px solid var(--tc-border);
                background: var(--tc-card);
                color: var(--tc-text);

                padding: 10px 15px;
                border-radius: 10px;

                cursor: pointer;

                font-weight: 700;

                transition:
                    transform .18s ease,
                    border-color .18s ease;
            }

            .tc-analysis-action:hover {
                transform: translateY(-1px);
                border-color: var(--tc-green-light);
            }

            .tc-analysis-primary {
                background: var(--tc-green);
                color: white;
                border-color: var(--tc-green);
            }

            .tc-analysis-loading {
                min-height: 70vh;

                display: grid;
                place-items: center;
            }

            .tc-analysis-loader {
                text-align: center;
            }

            .tc-spinner {
                width: 42px;
                height: 42px;

                margin: 0 auto 14px;

                border: 4px solid var(--tc-track);
                border-top-color: var(--tc-green);

                border-radius: 50%;

                animation:
                    tcSpin .8s linear infinite;
            }

            @keyframes tcSpin {
                to {
                    transform: rotate(360deg);
                }
            }

            .tc-hero {
                display: grid;
                grid-template-columns: 230px 1fr;
                gap: 28px;

                padding: 28px;

                background: var(--tc-card);

                border: 1px solid var(--tc-border);
                border-radius: 22px;

                box-shadow:
                    0 16px 45px rgba(20, 70, 45, .08);
            }

            .tc-product-image-wrap {
                min-height: 230px;

                display: grid;
                place-items: center;

                padding: 18px;

                border-radius: 18px;

                background:
                    linear-gradient(
                        135deg,
                        #f1f7f3,
                        #e5f0e9
                    );
            }

            .tc-dark .tc-product-image-wrap {
                background:
                    linear-gradient(
                        135deg,
                        #1a2b22,
                        #20382b
                    );
            }

            .tc-product-image {
                width: 100%;
                height: 200px;

                object-fit: contain;

                border-radius: 12px;
            }

            .tc-no-image {
                font-size: 58px;
                opacity: .25;
            }

            .tc-eyebrow {
                margin: 5px 0 8px;

                color: var(--tc-green-light);

                font-size: 13px;
                font-weight: 800;

                text-transform: uppercase;
                letter-spacing: .08em;
            }

            .tc-hero h1 {
                margin: 0 0 12px;

                font-size: clamp(25px, 4vw, 38px);
                line-height: 1.15;
            }

            .tc-marketplace {
                display: inline-flex;
                align-items: center;

                padding: 7px 11px;

                border-radius: 999px;

                background: rgba(97, 180, 135, .13);
                color: var(--tc-green);

                font-size: 13px;
                font-weight: 800;
            }

            .tc-dark .tc-marketplace {
                color: #91d6b0;
            }

            .tc-hero-price {
                margin-top: 24px;

                font-size: 30px;
                font-weight: 900;
            }

            .tc-section {
                margin-top: 22px;
            }

            .tc-section-title {
                margin: 0 0 13px;

                font-size: 19px;
                font-weight: 850;
            }

            .tc-metrics {
                display: grid;
                grid-template-columns:
                    repeat(4, minmax(0, 1fr));

                gap: 14px;
            }

            .tc-metric {
                padding: 19px;

                background: var(--tc-card);

                border: 1px solid var(--tc-border);
                border-radius: 16px;
            }

            .tc-metric-label {
                color: var(--tc-muted);

                font-size: 13px;
                font-weight: 700;
            }

            .tc-metric-value {
                margin-top: 8px;

                font-size: 22px;
                font-weight: 850;

                word-break: break-word;
            }

            .tc-trust-grid {
                display: grid;
                grid-template-columns: 260px 1fr;

                gap: 20px;
            }

            .tc-trust-score-card,
            .tc-breakdown-card,
            .tc-review-card,
            .tc-price-card {
                background: var(--tc-card);

                border: 1px solid var(--tc-border);
                border-radius: 18px;

                padding: 22px;
            }

            .tc-trust-score-card {
                display: grid;
                place-items: center;
                text-align: center;
            }

            .tc-score-circle {
                width: 155px;
                height: 155px;

                display: grid;
                place-items: center;

                border-radius: 50%;

                background:
                    conic-gradient(
                        var(--tc-green) var(--tc-score, 0%),
                        var(--tc-track) 0
                    );

                position: relative;
            }

            .tc-score-circle::after {
                content: "";

                position: absolute;
                inset: 11px;

                border-radius: 50%;

                background: var(--tc-card);
            }

            .tc-score-content {
                position: relative;
                z-index: 1;

                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .tc-score-number {
                font-size: 34px;
                font-weight: 900;
            }

            .tc-score-label {
                color: var(--tc-muted);

                font-size: 12px;
                font-weight: 700;
            }

            .tc-trust-level {
                margin-top: 14px;

                color: var(--tc-green-light);

                font-weight: 850;
            }

            .tc-score-row {
                margin-bottom: 19px;
            }

            .tc-score-row:last-child {
                margin-bottom: 0;
            }

            .tc-score-head {
                display: flex;
                justify-content: space-between;

                margin-bottom: 7px;

                font-size: 14px;
                font-weight: 750;
            }

            .tc-score-track {
                height: 9px;

                overflow: hidden;

                border-radius: 999px;

                background: var(--tc-track);
            }

            .tc-score-fill {
                height: 100%;

                border-radius: inherit;

                background:
                    linear-gradient(
                        90deg,
                        var(--tc-green-dark),
                        var(--tc-green-light)
                    );

                transition: width .5s ease;
            }

            .tc-review-grid {
                display: grid;
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));

                gap: 14px;
            }

            .tc-review-card h3 {
                margin: 0 0 8px;

                font-size: 15px;
            }

            .tc-review-card p {
                margin: 0;

                color: var(--tc-muted);

                font-size: 13px;
                line-height: 1.55;
            }

            .tc-review-value {
                margin-bottom: 8px;

                font-size: 25px;
                font-weight: 900;
            }

            .tc-price-card {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 20px;
            }

            .tc-price-info {
                min-width: 0;
            }

            .tc-price-main {
                font-size: 31px;
                font-weight: 900;
            }

            .tc-price-sub {
                margin-top: 5px;

                color: var(--tc-muted);

                font-size: 13px;
            }

            .tc-error {
                margin-top: 30px;

                padding: 30px;

                text-align: center;

                background: var(--tc-card);

                border: 1px solid var(--tc-border);
                border-radius: 18px;
            }

            .tc-error h2 {
                margin-top: 0;
            }

            .tc-error p {
                color: var(--tc-muted);
            }

            /* =================================================
               TRUSTCART ANALYZE - VISUAL ENHANCEMENTS
            ================================================= */

            .tc-floating-orb {
                position: fixed;
                width: 180px;
                height: 180px;
                border-radius: 50%;
                pointer-events: none;
                opacity: .18;
                filter: blur(2px);
                background: var(--tc-green-light);
                animation: tcFloat 7s ease-in-out infinite;
            }

            .tc-orb-one {
                top: 12%;
                right: -70px;
            }

            .tc-orb-two {
                bottom: 8%;
                left: -90px;
                width: 220px;
                height: 220px;
                animation-delay: -3s;
            }

            @keyframes tcFloat {
                0%, 100% {
                    transform: translateY(0) scale(1);
                }

                50% {
                    transform: translateY(-25px) scale(1.05);
                }
            }

            .tc-hero {
                position: relative;
                overflow: hidden;
                animation: tcReveal .5s ease both;
            }

            .tc-hero::after {
                content: "";
                position: absolute;
                width: 240px;
                height: 240px;
                right: -110px;
                top: -110px;
                border-radius: 50%;
                background: var(--tc-green-light);
                opacity: .08;
            }

            .tc-product-image {
                animation: tcProductFloat 4s ease-in-out infinite;
            }

            @keyframes tcProductFloat {
                0%, 100% {
                    transform: translateY(0);
                }

                50% {
                    transform: translateY(-8px);
                }
            }

            .tc-metric,
            .tc-trust-score-card,
            .tc-breakdown-card,
            .tc-review-card,
            .tc-price-card,
            .tc-verdict-card,
            .tc-check-card,
            .tc-method-card {
                transition:
                    transform .22s ease,
                    box-shadow .22s ease,
                    border-color .22s ease;
            }

            .tc-metric:hover,
            .tc-review-card:hover,
            .tc-price-card:hover,
            .tc-verdict-card:hover,
            .tc-check-card:hover,
            .tc-method-card:hover {
                transform: translateY(-5px);
                border-color: var(--tc-green-light);
                box-shadow:
                    0 14px 35px rgba(24, 88, 61, .12);
            }

            .tc-verdict-card {
                padding: 24px;
                border-radius: 18px;
                border: 1px solid var(--tc-border);
                background:
                    linear-gradient(
                        135deg,
                        var(--tc-card),
                        rgba(97,180,135,.08)
                    );
            }

            .tc-verdict-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .tc-verdict-title {
                font-size: 22px;
                font-weight: 900;
            }

            .tc-verdict-badge {
                padding: 8px 14px;
                border-radius: 999px;
                background: rgba(97,180,135,.16);
                color: var(--tc-green);
                font-size: 13px;
                font-weight: 900;
            }

            .tc-dark .tc-verdict-badge {
                color: #9be0b8;
            }

            .tc-verdict-text {
                margin: 10px 0 0;
                color: var(--tc-muted);
                line-height: 1.6;
            }

            .tc-verdict-confidence {
                margin-top: 17px;
                color: var(--tc-green-light);
                font-size: 13px;
                font-weight: 850;
            }

            .tc-intelligence-grid {
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap: 16px;
            }

            .tc-intelligence-card {
                padding: 21px;
                border-radius: 18px;
                background: var(--tc-card);
                border: 1px solid var(--tc-border);
            }

            .tc-intelligence-icon {
                font-size: 26px;
                margin-bottom: 9px;
            }

            .tc-intelligence-card h3 {
                margin: 0 0 7px;
                font-size: 17px;
            }

            .tc-intelligence-card p {
                margin: 0;
                color: var(--tc-muted);
                line-height: 1.55;
                font-size: 13px;
            }

            .tc-check-list {
                display: grid;
                gap: 10px;
                margin-top: 14px;
            }

            .tc-check-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 12px 14px;
                border-radius: 12px;
                background: rgba(97,180,135,.08);
                color: var(--tc-text);
                font-size: 13px;
                line-height: 1.4;
            }

            .tc-check-icon {
                flex: 0 0 auto;
                font-weight: 900;
                color: var(--tc-green-light);
            }

            .tc-method-card {
                padding: 22px;
                border-radius: 18px;
                background: var(--tc-card);
                border: 1px solid var(--tc-border);
            }

            .tc-method-flow {
                display: grid;
                grid-template-columns:
                    repeat(4, 1fr);
                gap: 10px;
                margin-top: 17px;
            }

            .tc-method-step {
                text-align: center;
                padding: 15px 10px;
                border-radius: 13px;
                background: rgba(97,180,135,.08);
                font-size: 13px;
                font-weight: 800;
            }

            .tc-method-arrow {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--tc-green-light);
                font-weight: 900;
            }

            .tc-tools {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 16px;
            }

            .tc-copy-status {
                color: var(--tc-green-light);
                font-size: 12px;
                font-weight: 750;
                align-self: center;
            }

            @keyframes tcReveal {
                from {
                    opacity: 0;
                    transform: translateY(12px);
                }

                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .tc-analysis-shell > .tc-section {
                animation: tcReveal .5s ease both;
            }

            .tc-analysis-shell > .tc-section:nth-of-type(2) {
                animation-delay: .05s;
            }

            .tc-analysis-shell > .tc-section:nth-of-type(3) {
                animation-delay: .1s;
            }

            .tc-analysis-shell > .tc-section:nth-of-type(4) {
                animation-delay: .15s;
            }

            .tc-analysis-shell > .tc-section:nth-of-type(5) {
                animation-delay: .2s;
            }

            @media (prefers-reduced-motion: reduce) {

                #trustcartAnalyzeView *,
                #trustcartAnalyzeView *::before,
                #trustcartAnalyzeView *::after {
                    animation-duration: .01ms !important;
                    animation-iteration-count: 1 !important;
                    scroll-behavior: auto !important;
                    transition-duration: .01ms !important;
                }
            }


            @media (max-width: 800px) {

                .tc-hero {
                    grid-template-columns: 1fr;
                }

                .tc-metrics {
                    grid-template-columns:
                        repeat(2, minmax(0, 1fr));
                }

                .tc-trust-grid {
                    grid-template-columns: 1fr;
                }

                .tc-review-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 800px) {

                .tc-intelligence-grid {
                    grid-template-columns: 1fr;
                }

                .tc-method-flow {
                    grid-template-columns:
                        repeat(2, 1fr);
                }

                .tc-verdict-top {
                    align-items: flex-start;
                    flex-direction: column;
                }

            }


            @media (max-width: 520px) {

                .tc-analysis-shell {
                    width: min(
                        100% - 20px,
                        1120px
                    );

                    padding-top: 10px;
                }

                .tc-analysis-header {
                    align-items: flex-start;
                }

                .tc-analysis-brand span {
                    display: none;
                }

                .tc-hero {
                    padding: 18px;
                }

                .tc-metrics {
                    grid-template-columns: 1fr;
                }

                .tc-price-card {
                    align-items: stretch;
                    flex-direction: column;
                }

                .tc-price-card .tc-analysis-action {
                    width: 100%;
                }
            }

        </style>

        <div class="tc-analysis-shell">

            <header class="tc-analysis-header">

                <div class="tc-analysis-brand">
                    <div class="tc-analysis-logo">T</div>
                    <span>TrustCart Analysis</span>
                </div>

                <div class="tc-analysis-actions">

                    <button
                        type="button"
                        class="tc-analysis-action"
                        id="tcAnalysisTheme"
                        title="Toggle theme"
                    >
                        ☾
                    </button>

                    <button
                        type="button"
                        class="tc-analysis-action"
                        id="tcAnalysisBack"
                    >
                        ← Back to Comparison
                    </button>

                </div>

            </header>

            <main id="tcAnalysisRoot">

                <div class="tc-analysis-loading">

                    <div class="tc-analysis-loader">

                        <div class="tc-spinner"></div>

                        <strong>
                            Analyzing product data...
                        </strong>

                        <p style="
                            color:var(--tc-muted);
                            margin-top:7px;
                        ">
                            TrustCart is calculating
                            the available trust signals.
                        </p>

                    </div>

                </div>

            </main>

        </div>
    `;

    document.body.appendChild(
        analysisView
    );

    /*
     * ---------------------------------------------------------
     * THEME
     * ---------------------------------------------------------
     */

    const themeButton =
        document.getElementById(
            "tcAnalysisTheme"
        );

    function applyAnalysisTheme() {

        let theme = "light";

        try {
            theme =
                localStorage.getItem(
                    "trustcart_theme"
                ) || "light";
        } catch {
            theme = "light";
        }

        if (theme === "dark") {

            analysisView.classList.add(
                "tc-dark"
            );

            themeButton.textContent = "☀";

        } else {

            analysisView.classList.remove(
                "tc-dark"
            );

            themeButton.textContent = "☾";
        }
    }

    themeButton.onclick = () => {

        const isDark =
            analysisView.classList.contains(
                "tc-dark"
            );

        const nextTheme =
            isDark ? "light" : "dark";

        try {

            localStorage.setItem(
                "trustcart_theme",
                nextTheme
            );

        } catch {}

        applyAnalysisTheme();
    };

    applyAnalysisTheme();

    /*
     * ---------------------------------------------------------
     * CLOSE / BACK
     * ---------------------------------------------------------
     */

    let closed = false;

    function closeAnalysis() {

        if (closed) {
            return;
        }

        closed = true;

        analysisView.remove();

        /*
         * Return to the state before the
         * analysis view was opened.
         */
        if (
            window.history.state &&
            window.history.state.trustcartAnalyze
        ) {
            history.back();
        }
    }

    document.getElementById(
        "tcAnalysisBack"
    ).onclick = closeAnalysis;

    /*
     * Browser back button.
     */
    const handleAnalysisPopState = () => {

        if (!analysisView.isConnected) {
            return;
        }

        closed = true;

        analysisView.remove();

        window.removeEventListener(
            "popstate",
            handleAnalysisPopState
        );
    };

    window.addEventListener(
        "popstate",
        handleAnalysisPopState
    );

    /*
     * ---------------------------------------------------------
     * HELPERS
     * ---------------------------------------------------------
     */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatNumber(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return number.toLocaleString(
            "en-IN"
        );
    }

    function formatPrice(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return "₹" +
            number.toLocaleString(
                "en-IN",
                {
                    maximumFractionDigits: 2
                }
            );
    }

    function safeScore(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.max(
            0,
            Math.min(100, number)
        );
    }

    function safeRating(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number < 0
        ) {
            return null;
        }

        return number;
    }

    function getMarketplace(data, product, analysis) {

        return (
            analysis.marketplace ||
            product.marketplace ||
            data.marketplace ||
            item.marketplace ||
            "Marketplace"
        );
    }

    /*
     * ---------------------------------------------------------
     * RENDER
     * ---------------------------------------------------------
     */

    function renderAnalysis(data) {

        const product =
            data?.product || {};

        const analysis =
            data?.analysis || {};

        const canonical =
            data?.canonical || {};

        const name =
            product.name ||
            product.title ||
            canonical.product_name ||
            productTitle ||
            "Product";

        const image =
            product.image_url ||
            product.imageUrl ||
            product.image ||
            canonical.image_url ||
            "";

        const marketplace =
            getMarketplace(
                data,
                product,
                analysis
            );

        const price =
            analysis.price ??
            product.price;

        const rating =
            safeRating(
                analysis.rating ??
                product.rating
            );

        const reviews =
            analysis.review_count ??
            product.review_count ??
            product.reviews;

        const seller =
            analysis.seller_name ||
            analysis.seller ||
            product.seller_name ||
            product.seller ||
            item.seller_name ||
            item.seller ||
            "Seller information unavailable";

        const trustScore =
            safeScore(
                analysis.trust_score
            );

        const trustLevel =
            analysis.trust_level ||
            "Unavailable";

        const ratingScore =
            safeScore(
                analysis.rating_score
            );

        const reviewScore =
            safeScore(
                analysis.review_score
            );

        const priceScore =
            safeScore(
                analysis.price_score
            );

        const sellerScore =
            safeScore(
                analysis.seller_score
            );

        const root =
            document.getElementById(
                "tcAnalysisRoot"
            );

        if (!root) {
            return;
        }

        const safeProductUrl =
            typeof productUrl === "string" &&
            /^https?:\/\//i.test(productUrl)
                ? productUrl
                : "";

        const ratingText =
            rating !== null
                ? rating.toFixed(1) + " / 5"
                : "Unavailable";

        const reviewCount =
            Number(reviews);

        const reviewText =
            Number.isFinite(reviewCount)
                ? formatNumber(reviewCount)
                : "Unavailable";

        /*
         * Review insight text is derived only
         * from actual rating/review data.
         */
        let reviewInsight =
            "Review data is limited.";

        if (
            rating !== null &&
            Number.isFinite(reviewCount)
        ) {

            if (
                rating >= 4.3 &&
                reviewCount >= 1000
            ) {

                reviewInsight =
                    "Strong rating combined with a large review volume.";

            } else if (
                rating >= 4.0 &&
                reviewCount >= 100
            ) {

                reviewInsight =
                    "Positive rating with a useful review sample.";

            } else if (
                rating >= 4.0
            ) {

                reviewInsight =
                    "The rating is positive, but the review volume is relatively limited.";

            } else {

                reviewInsight =
                    "Consider checking individual reviews before purchasing.";
            }
        }

        const ratingStrength =
            rating === null
                ? 0
                : Math.min(
                    100,
                    (rating / 5) * 100
                );

        const reviewVolumeStrength =
            !Number.isFinite(reviewCount)
                ? 0
                : Math.min(
                    100,
                    Math.round(
                        (
                            Math.log10(
                                Math.max(
                                    1,
                                    reviewCount
                                )
                            ) / 5
                        ) * 100
                    )
                );

        root.innerHTML = `

            <section class="tc-hero">

                <div class="tc-product-image-wrap">

                    ${
                        image
                            ? `
                                <img
                                    class="tc-product-image"
                                    src="${escapeHtml(image)}"
                                    alt="${escapeHtml(name)}"
                                    onerror="
                                        this.style.display='none';
                                        this.nextElementSibling.style.display='block';
                                    "
                                >
                                <div
                                    class="tc-no-image"
                                    style="display:none;"
                                >
                                    🛒
                                </div>
                            `
                            : `
                                <div class="tc-no-image">
                                    🛒
                                </div>
                            `
                    }

                </div>

                <div>

                    <div class="tc-eyebrow">
                        Product Analysis
                    </div>

                    <h1>
                        ${escapeHtml(name)}
                    </h1>

                    <span class="tc-marketplace">
                        ${escapeHtml(marketplace)}
                    </span>

                    <div class="tc-hero-price">
                        ${formatPrice(price)}
                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    Product Overview
                </h2>

                <div class="tc-metrics">

                    <div class="tc-metric">
                        <div class="tc-metric-label">
                            Price
                        </div>
                        <div class="tc-metric-value">
                            ${formatPrice(price)}
                        </div>
                    </div>

                    <div class="tc-metric">
                        <div class="tc-metric-label">
                            Rating
                        </div>
                        <div class="tc-metric-value">
                            ${escapeHtml(ratingText)}
                        </div>
                    </div>

                    <div class="tc-metric">
                        <div class="tc-metric-label">
                            Reviews
                        </div>
                        <div class="tc-metric-value">
                            ${escapeHtml(reviewText)}
                        </div>
                    </div>

                    <div class="tc-metric">
                        <div class="tc-metric-label">
                            Seller
                        </div>
                        <div class="tc-metric-value"
                             style="font-size:17px;">
                            ${escapeHtml(seller)}
                        </div>
                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    Trust Analysis
                </h2>

                <div class="tc-trust-grid">

                    <div class="tc-trust-score-card">

                        <div
                            class="tc-score-circle"
                            style="--tc-score:${trustScore}%;"
                        >

                            <div class="tc-score-content">

                                <div class="tc-score-number">
                                    ${Math.round(trustScore)}
                                </div>

                                <div class="tc-score-label">
                                    Trust Score
                                </div>

                            </div>

                        </div>

                        <div class="tc-trust-level">
                            ${escapeHtml(trustLevel)}
                        </div>

                    </div>

                    <div class="tc-breakdown-card">

                        <div class="tc-score-row">

                            <div class="tc-score-head">
                                <span>Rating Score</span>
                                <span>${Math.round(ratingScore)}%</span>
                            </div>

                            <div class="tc-score-track">
                                <div
                                    class="tc-score-fill"
                                    style="width:${ratingScore}%"
                                ></div>
                            </div>

                        </div>

                        <div class="tc-score-row">

                            <div class="tc-score-head">
                                <span>Review Score</span>
                                <span>${Math.round(reviewScore)}%</span>
                            </div>

                            <div class="tc-score-track">
                                <div
                                    class="tc-score-fill"
                                    style="width:${reviewScore}%"
                                ></div>
                            </div>

                        </div>

                        <div class="tc-score-row">

                            <div class="tc-score-head">
                                <span>Price Score</span>
                                <span>${Math.round(priceScore)}%</span>
                            </div>

                            <div class="tc-score-track">
                                <div
                                    class="tc-score-fill"
                                    style="width:${priceScore}%"
                                ></div>
                            </div>

                        </div>

                        <div class="tc-score-row">

                            <div class="tc-score-head">
                                <span>Seller Score</span>
                                <span>${Math.round(sellerScore)}%</span>
                            </div>

                            <div class="tc-score-track">
                                <div
                                    class="tc-score-fill"
                                    style="width:${sellerScore}%"
                                ></div>
                            </div>

                        </div>

                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    Review & Rating Insights
                </h2>

                <div class="tc-review-grid">

                    <div class="tc-review-card">

                        <h3>
                            Rating Strength
                        </h3>

                        <div class="tc-review-value">
                            ${
                                rating !== null
                                    ? rating.toFixed(1) + " ★"
                                    : "—"
                            }
                        </div>

                        <p>
                            ${
                                rating !== null
                                    ? "Based on the rating returned for this product."
                                    : "A rating was not available from the analyzed product data."
                            }
                        </p>

                    </div>

                    <div class="tc-review-card">

                        <h3>
                            Review Volume
                        </h3>

                        <div class="tc-review-value">
                            ${escapeHtml(reviewText)}
                        </div>

                        <p>
                            ${
                                Number.isFinite(reviewCount)
                                    ? "Number of reviews currently available to TrustCart."
                                    : "Review count was not available from the analyzed data."
                            }
                        </p>

                    </div>

                    <div class="tc-review-card">

                        <h3>
                            Review Signal
                        </h3>

                        <div class="tc-review-value">
                            ${
                                rating !== null &&
                                Number.isFinite(reviewCount)
                                    ? "Available"
                                    : "Limited"
                            }
                        </div>

                        <p>
                            ${escapeHtml(reviewInsight)}
                        </p>

                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    Review Data Strength
                </h2>

                <div class="tc-breakdown-card">

                    <div class="tc-score-row">

                        <div class="tc-score-head">
                            <span>Rating signal</span>
                            <span>${Math.round(ratingStrength)}%</span>
                        </div>

                        <div class="tc-score-track">
                            <div
                                class="tc-score-fill"
                                style="width:${ratingStrength}%"
                            ></div>
                        </div>

                    </div>

                    <div class="tc-score-row">

                        <div class="tc-score-head">
                            <span>Review volume signal</span>
                            <span>${Math.round(reviewVolumeStrength)}%</span>
                        </div>

                        <div class="tc-score-track">
                            <div
                                class="tc-score-fill"
                                style="width:${reviewVolumeStrength}%"
                            ></div>
                        </div>

                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    TrustCart Verdict
                </h2>

                <div class="tc-verdict-card">

                    <div class="tc-verdict-top">

                        <div class="tc-verdict-title">
                            <span id="tcVerdictIcon">🧠</span>
                            <span id="tcVerdictTitle">
                                Analyzing...
                            </span>
                        </div>

                        <div
                            class="tc-verdict-badge"
                            id="tcVerdictBadge"
                        >
                            —
                        </div>

                    </div>

                    <p
                        class="tc-verdict-text"
                        id="tcVerdictText"
                    >
                        TrustCart is evaluating the available
                        product signals.
                    </p>

                    <div
                        class="tc-verdict-confidence"
                        id="tcVerdictConfidence"
                    >
                        Confidence: —
                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    Smart Product Intelligence
                </h2>

                <div class="tc-intelligence-grid">

                    <div class="tc-intelligence-card">

                        <div class="tc-intelligence-icon">
                            💰
                        </div>

                        <h3>
                            Price Intelligence
                        </h3>

                        <p id="tcPriceInsight">
                            Evaluating price information...
                        </p>

                    </div>

                    <div class="tc-intelligence-card">

                        <div class="tc-intelligence-icon">
                            🏪
                        </div>

                        <h3>
                            Seller Confidence
                        </h3>

                        <p id="tcSellerInsight">
                            Evaluating seller information...
                        </p>

                    </div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    Things to Check
                </h2>

                <div class="tc-check-card"
                     style="
                        padding:21px;
                        border-radius:18px;
                        background:var(--tc-card);
                        border:1px solid var(--tc-border);
                     ">

                    <div
                        class="tc-check-list"
                        id="tcCheckList"
                    ></div>

                </div>

            </section>

            <section class="tc-section">

                <h2 class="tc-section-title">
                    How TrustCart Decides
                </h2>

                <div class="tc-method-card">

                    <p style="
                        margin:0;
                        color:var(--tc-muted);
                        line-height:1.6;
                        font-size:13px;
                    ">
                        TrustCart combines the available product
                        signals into a single trust assessment.
                        It does not invent review or sentiment data.
                    </p>

                    <div class="tc-method-flow">

                        <div class="tc-method-step">
                            ⭐<br>
                            Rating
                        </div>

                        <div class="tc-method-step">
                            💬<br>
                            Reviews
                        </div>

                        <div class="tc-method-step">
                            💰<br>
                            Price
                        </div>

                        <div class="tc-method-step">
                            🏪<br>
                            Seller
                        </div>

                    </div>

                    <div style="
                        text-align:center;
                        margin-top:15px;
                        color:var(--tc-green-light);
                        font-weight:900;
                    ">
                        ↓
                        TrustCart Trust Score
                    </div>

                </div>

            </section>


            <section class="tc-section">

                <h2 class="tc-section-title">
                    Buy From Marketplace
                </h2>

                <div class="tc-price-card">

                    <div class="tc-price-info">

                        <div class="tc-price-main">
                            ${formatPrice(price)}
                        </div>

                        <div class="tc-price-sub">
                            ${escapeHtml(marketplace)}
                        </div>

                    </div>

                    <div class="tc-tools">

                        <button
                            type="button"
                            class="tc-analysis-action"
                            id="tcCopyAnalysis"
                        >
                            📋 Copy Analysis
                        </button>

                        <span
                            class="tc-copy-status"
                            id="tcCopyStatus"
                        ></span>

                    </div>


                    ${
                        safeProductUrl
                            ? `
                                <a
                                    class="tc-analysis-action tc-analysis-primary"
                                    href="${escapeHtml(safeProductUrl)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style="
                                        text-decoration:none;
                                        display:inline-flex;
                                        align-items:center;
                                        justify-content:center;
                                    "
                                >
                                    View Product →
                                </a>
                            `
                            : `
                                <button
                                    class="tc-analysis-action"
                                    type="button"
                                    disabled
                                >
                                    Product Link Unavailable
                                </button>
                            `
                    }

                </div>

            </section>

        `;

        /*
         * ---------------------------------------------
         * TRUSTCART VERDICT
         * ---------------------------------------------
         */

        const verdictTitle =
            document.getElementById(
                "tcVerdictTitle"
            );

        const verdictBadge =
            document.getElementById(
                "tcVerdictBadge"
            );

        const verdictText =
            document.getElementById(
                "tcVerdictText"
            );

        const verdictConfidence =
            document.getElementById(
                "tcVerdictConfidence"
            );

        let verdict =
            "Low Confidence";

        let verdictMessage =
            "There is not enough strong product data to make a confident recommendation.";

        if (trustScore >= 90) {

            verdict =
                "Excellent Choice";

            verdictMessage =
                "The available TrustCart signals are consistently strong for this product.";

        } else if (trustScore >= 75) {

            verdict =
                "Good Choice";

            verdictMessage =
                "The product shows a generally strong combination of trust, pricing and review signals.";

        } else if (trustScore >= 60) {

            verdict =
                "Consider Carefully";

            verdictMessage =
                "Some signals are positive, but it is worth checking the product details before purchasing.";

        }

        if (verdictTitle) {
            verdictTitle.textContent = verdict;
        }

        if (verdictBadge) {
            verdictBadge.textContent =
                Math.round(trustScore) +
                "/100";
        }

        if (verdictText) {
            verdictText.textContent =
                verdictMessage;
        }

        if (verdictConfidence) {
            verdictConfidence.textContent =
                "Confidence: " +
                Math.round(trustScore) +
                "/100";
        }

        /*
         * ---------------------------------------------
         * PRICE INTELLIGENCE
         * ---------------------------------------------
         */

        const priceInsight =
            document.getElementById(
                "tcPriceInsight"
            );

        if (priceInsight) {

            if (
                Number.isFinite(Number(price)) &&
                Number.isFinite(priceScore)
            ) {

                if (priceScore >= 80) {

                    priceInsight.textContent =
                        "TrustCart's available price signal is strong, indicating that this offer is competitively positioned.";

                } else if (priceScore >= 60) {

                    priceInsight.textContent =
                        "The available price signal is moderate. Compare the final checkout price, delivery charges and offers before buying.";

                } else {

                    priceInsight.textContent =
                        "The available price signal is weaker. Check other available sellers before making the final decision.";

                }

            } else {

                priceInsight.textContent =
                    "Price intelligence is limited because complete price data was not available.";
            }
        }

        /*
         * ---------------------------------------------
         * SELLER INTELLIGENCE
         * ---------------------------------------------
         */

        const sellerInsight =
            document.getElementById(
                "tcSellerInsight"
            );

        if (sellerInsight) {

            if (
                sellerScore >= 80
            ) {

                sellerInsight.textContent =
                    "The available seller signal is strong.";

            } else if (
                sellerScore >= 60
            ) {

                sellerInsight.textContent =
                    "The seller signal is moderate. Review seller details and return policies before checkout.";

            } else {

                sellerInsight.textContent =
                    "Seller confidence is limited. Check seller information carefully before purchasing.";
            }
        }

        /*
         * ---------------------------------------------
         * THINGS TO CHECK
         * ---------------------------------------------
         */

        const checkList =
            document.getElementById(
                "tcCheckList"
            );

        if (checkList) {

            const checks = [];

            if (
                rating !== null &&
                rating >= 4
            ) {

                checks.push(
                    "✓ Strong product rating"
                );

            } else {

                checks.push(
                    "⚠ Check the product rating carefully"
                );
            }

            if (
                Number.isFinite(reviewCount) &&
                reviewCount >= 100
            ) {

                checks.push(
                    "✓ Useful review volume is available"
                );

            } else {

                checks.push(
                    "⚠ Review volume is limited"
                );
            }

            if (
                sellerScore >= 70
            ) {

                checks.push(
                    "✓ Seller signal is reasonably strong"
                );

            } else {

                checks.push(
                    "⚠ Seller information deserves extra attention"
                );
            }

            if (
                trustScore >= 75
            ) {

                checks.push(
                    "✓ Overall TrustCart signal is positive"
                );

            } else {

                checks.push(
                    "⚠ Overall trust confidence is not high"
                );
            }

            checkList.innerHTML =
                checks
                    .map(
                        check => `
                            <div class="tc-check-item">
                                <span class="tc-check-icon">
                                    ${check.startsWith("✓") ? "✓" : "⚠"}
                                </span>
                                <span>
                                    ${escapeHtml(
                                        check.replace(
                                            /^[✓⚠]\s*/,
                                            ""
                                        )
                                    )}
                                </span>
                            </div>
                        `
                    )
                    .join("");
        }

        /*
         * ---------------------------------------------
         * COPY ANALYSIS
         * ---------------------------------------------
         */

        const copyButton =
            document.getElementById(
                "tcCopyAnalysis"
            );

        const copyStatus =
            document.getElementById(
                "tcCopyStatus"
            );

        if (copyButton) {

            copyButton.onclick =
                async () => {

                    const summary = [
                        "TrustCart Product Analysis",
                        "",
                        "Product: " + name,
                        "Marketplace: " + marketplace,
                        "Price: " + formatPrice(price),
                        "Rating: " + ratingText,
                        "Reviews: " + reviewText,
                        "Trust Score: " +
                            Math.round(trustScore) +
                            "/100",
                        "Verdict: " + verdict
                    ].join("\n");

                    try {

                        await navigator.clipboard.writeText(
                            summary
                        );

                        if (copyStatus) {
                            copyStatus.textContent =
                                "Copied!";
                        }

                    } catch {

                        if (copyStatus) {
                            copyStatus.textContent =
                                "Copy unavailable";
                        }
                    }

                    setTimeout(
                        () => {

                            if (copyStatus) {
                                copyStatus.textContent =
                                    "";
                            }

                        },
                        2200
                    );
                };
        }

    }

    /*
     * ---------------------------------------------------------
     * LOAD REAL API DATA
     * ---------------------------------------------------------
     */

    async function loadAnalysis() {

        if (!productUrl) {

            document.getElementById(
                "tcAnalysisRoot"
            ).innerHTML = `

                <div class="tc-error">

                    <h2>
                        Product analysis unavailable
                    </h2>

                    <p>
                        A valid product URL was not available
                        for this seller.
                    </p>

                </div>
            `;

            return;
        }

        try {

            const response =
                await fetch(
                    "/api/products/analyze",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        credentials: "include",

                        body: JSON.stringify({
                            url: productUrl
                        })
                    }
                );

            let data = null;

            try {
                data =
                    await response.json();
            } catch {
                data = null;
            }

            if (
                !response.ok ||
                !data ||
                data.success === false
            ) {

                throw new Error(
                    data?.message ||
                    "Unable to analyze this product."
                );
            }

            renderAnalysis(data);

        } catch (error) {

            console.error(
                "TrustCart product analysis error:",
                error
            );

            const root =
                document.getElementById(
                    "tcAnalysisRoot"
                );

            if (!root) {
                return;
            }

            root.innerHTML = `

                <div class="tc-error">

                    <h2>
                        Product analysis unavailable
                    </h2>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "Unable to load product analysis."
                        )}
                    </p>

                    <button
                        type="button"
                        class="tc-analysis-action"
                        id="tcAnalysisRetry"
                        style="margin-top:15px;"
                    >
                        Try Again
                    </button>

                </div>
            `;

            document.getElementById(
                "tcAnalysisRetry"
            )?.addEventListener(
                "click",
                loadAnalysis
            );
        }
    }

    loadAnalysis();
}

function displayComparisonData(product, prices) {

    currentProduct = product;
    currentPrices = prices;

    displayProduct(product);

    if (!prices.length) {

        if (comparisonStatus) {
            comparisonStatus.textContent =
                "No sellers found";
        }

        if (sellerEmpty) {
            sellerEmpty.style.display =
                "block";
        }

        return;
    }

    const overallTrust =
        calculateOverallTrust(prices);

    const deal =
        chooseBestDeal(prices);

    displayQuickStats(
        prices,
        overallTrust
    );

    configureBestDeal(
        deal,
        prices
    );

    displaySmartInsight(
        prices,
        deal
    );

    displayTrustAnalysis(
        prices,
        deal,
        overallTrust
    );

    renderPriceBars(prices);

    renderSellerRows(prices);

    if (comparisonStatus) {
        comparisonStatus.textContent =
            `✓ ${prices.length} seller${prices.length === 1 ? "" : "s"} compared`;
    }

    if (buyingTip) {

        if (prices.length >= 3) {

            buyingTip.textContent =
                "You have several offers to compare. Check delivery charges, return policy and seller reviews before checkout.";

        } else {

            buyingTip.textContent =
                "Only a limited number of marketplaces were available. Compare the final checkout price before buying.";
        }
    }
}


/* =========================================================
   API LOADING
========================================================= */

async function loadComparison() {

    showLoading();

    hideError();

    try {

        let storedResult = null;

        try {

            const raw =
                sessionStorage.getItem(
                    "trustcart_compare_result"
                );

            if (raw) {
                storedResult =
                    JSON.parse(raw);
            }

        } catch {
            storedResult = null;
        }


        if (storedResult) {

            currentComparison =
                storedResult;

            currentProductId =
                storedResult.product_id ||
                storedResult.productId ||
                storedResult.id ||
                null;

            const product =
                storedResult.product ||
                storedResult.source_product ||
                storedResult;

            if (currentProductId) {

                const response =
                    await fetch(
                        `/api/products/${encodeURIComponent(currentProductId)}/prices`,
                        {
                            credentials: "include"
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `Failed to load current prices (${response.status})`
                    );
                }

                const data =
                    await response.json();

                currentComparison = {
                    ...storedResult,
                    prices: data.prices || []
                };

                const rawPrices =
                    extractPriceItems(data);

                const prices =
                    deduplicatePrices(
                        rawPrices
                    );

                displayComparisonData(
                    product,
                    prices
                );

                showResults();

                return;
            }

            const rawPrices =
                extractPriceItems(
                    storedResult
                );

            const prices =
                deduplicatePrices(
                    rawPrices
                );

            displayComparisonData(
                product,
                prices
            );

            showResults();

            return;
        }


        const urlParts =
            window.location.pathname
                .split("/")
                .filter(Boolean);

        const possibleId =
            urlParts[urlParts.length - 1];

        if (
            possibleId &&
            possibleId !== "result"
        ) {
            currentProductId =
                possibleId;
        }


        if (!currentProductId) {

            throw new Error(
                "Comparison data could not be found."
            );
        }


        const response =
            await fetch(
                `/api/products/${encodeURIComponent(
                    currentProductId
                )}/prices`,
                {
                    method: "GET",
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (!response.ok) {

            throw new Error(
                `Request failed (${response.status}).`
            );
        }

        const data =
            await response.json();

        currentComparison = data;

        const product =
            data.product ||
            data.source_product ||
            data;

        const rawPrices =
            extractPriceItems(data);

        const prices =
            deduplicatePrices(rawPrices);

        displayComparisonData(
            product,
            prices
        );

        showResults();

    } catch (error) {

        console.error(
            "TrustCart comparison error:",
            error
        );

        showError(
            error?.message ||
            "Unable to load comparison."
        );
    }
}


/* =========================================================
   LOADING / ERROR STATES
========================================================= */

function showLoading() {

    if (loading) {
        loading.style.display = "block";
    }

    if (results) {
        results.style.display = "none";
    }

    if (errorBox) {
        errorBox.style.display = "none";
    }
}


function showResults() {

    if (loading) {
        loading.style.display = "none";
    }

    if (errorBox) {
        errorBox.style.display = "none";
    }

    if (results) {
        results.style.display = "block";
    }
}


function hideError() {

    if (errorBox) {
        errorBox.style.display = "none";
    }
}


function showError(message) {

    if (loading) {
        loading.style.display = "none";
    }

    if (results) {
        results.style.display = "none";
    }

    if (errorBox) {
        errorBox.style.display = "block";
    }

    if (errorMessage) {
        errorMessage.textContent =
            message;
    }
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshComparison() {

    if (refreshBtn) {

        refreshBtn.disabled = true;

        refreshBtn.innerHTML =
            `<span>↻</span><span>Refreshing...</span>`;
    }

    try {

        sessionStorage.removeItem(
            "trustcart_compare_result"
        );

        await loadComparison();

    } finally {

        if (refreshBtn) {

            refreshBtn.disabled = false;

            refreshBtn.innerHTML =
                `<span>↻</span><span>Refresh</span>`;
        }
    }
}


/* =========================================================
   SORT
========================================================= */

if (sortSelect) {

    sortSelect.addEventListener(
        "change",
        () => {

            renderSellerRows(
                currentPrices
            );
        }
    );
}


/* =========================================================
   COPY SUMMARY
========================================================= */

function createSummaryText() {

    const product =
        currentProduct?.name ||
        currentProduct?.title ||
        "Product";

    if (!currentPrices.length) {
        return `TrustCart comparison: ${product}\nNo comparable sellers found.`;
    }

    const sorted =
        [...currentPrices].sort(
            (a, b) => a.price - b.price
        );

    const lines = [
        `TrustCart Comparison`,
        ``,
        product,
        ``
    ];

    sorted.forEach((item, index) => {

        lines.push(
            `${index + 1}. ${item.seller} — ${formatPrice(item.price)}`
        );
    });

    if (currentBestDeal) {

        lines.push(
            ``,
            `Recommended: ${currentBestDeal.seller} — ${formatPrice(currentBestDeal.price)}`
        );
    }

    return lines.join("\n");
}


async function copySummary() {

    const text =
        createSummaryText();

    try {

        await navigator.clipboard.writeText(
            text
        );

        showToast(
            "Comparison copied to clipboard."
        );

    } catch {

        showToast(
            "Could not copy the comparison."
        );
    }
}


/* =========================================================
   SHARE
========================================================= */

async function shareComparison() {

    const text =
        createSummaryText();

    if (
        navigator.share
    ) {

        try {

            await navigator.share({
                title:
                    "TrustCart Comparison",
                text
            });

        } catch {
            // User cancelled.
        }

        return;
    }

    await copySummary();

    showToast(
        "Sharing isn't available here. Summary copied instead."
    );
}


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {

    const isDark =
        theme === "dark";

    document.documentElement.classList.toggle(
        "dark",
        isDark
    );

    document.documentElement.dataset.theme =
        isDark
            ? "dark"
            : "light";

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

}


function initTheme() {

    const savedTheme =
        localStorage.getItem(
            "trustcart-theme"
        ) || "light";

    applyTheme(
        savedTheme
    );

}


initTheme();


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const isDark =
                document.documentElement.classList.contains(
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


/* =========================================================
   PROFILE
========================================================= */

function toggleProfileMenu() {

    if (!profileMenu) {
        return;
    }

    const isOpen =
        profileMenu.getAttribute(
            "aria-hidden"
        ) === "false";

    profileMenu.setAttribute(
        "aria-hidden",
        isOpen ? "true" : "false"
    );

    profileMenu.style.display =
        isOpen ? "none" : "block";
}


if (topAvatar) {

    topAvatar.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            toggleProfileMenu();
        }
    );
}


document.addEventListener(
    "click",
    (event) => {

        if (
            profileMenu &&
            !profileMenu.contains(event.target) &&
            event.target !== topAvatar
        ) {

            profileMenu.setAttribute(
                "aria-hidden",
                "true"
            );

            profileMenu.style.display =
                "none";
        }
    }
);


/* =========================================================
   USER
========================================================= */

async function loadCurrentUser() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const user =
            data.user ||
            data;

        const name =
            user?.name ||
            user?.full_name ||
            user?.username ||
            "User";

        const email =
            user?.email ||
            "";

        const initial =
            String(name)
                .trim()
                .charAt(0)
                .toUpperCase() ||
            "U";

        if (userName) {
            userName.textContent =
                name;
        }

        if (userEmail) {
            userEmail.textContent =
                email;
        }

        if (topAvatar) {
            topAvatar.textContent =
                initial;
        }

        if (avatarInitial) {
            avatarInitial.textContent =
                initial;
        }

    } catch (error) {

        console.warn(
            "Could not load user:",
            error
        );
    }
}


/* =========================================================
   LOGOUT
========================================================= */

if (profileLogout) {

    profileLogout.addEventListener(
        "click",
        async () => {

            try {

                await fetch(
                    "/logout",
                    {
                        method: "GET"
                    }
                );

            } catch {
                // Redirect regardless.
            }

            window.location.href =
                "/login";
        }
    );
}


/* =========================================================
   PRICE ALERT
========================================================= */

function openAlertModal() {

    if (!alertModal) {
        return;
    }

    lastFocusedElement =
        document.activeElement;

    alertModal.style.display =
        "flex";

    alertModal.setAttribute(
        "aria-hidden",
        "false"
    );

    if (targetPrice) {

        if (
            currentBestDeal &&
            Number(currentBestDeal.price) > 0 &&
            !targetPrice.value
        ) {

            targetPrice.value =
                Math.round(
                    Number(
                        currentBestDeal.price
                    ) * 0.9
                );
        }

        setTimeout(
            () => targetPrice.focus(),
            50
        );
    }
}


function closeAlertModal() {

    if (!alertModal) {
        return;
    }

    alertModal.style.display =
        "none";

    alertModal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (
        lastFocusedElement &&
        typeof lastFocusedElement.focus ===
            "function"
    ) {

        lastFocusedElement.focus();
    }
}


if (alertBtn) {

    alertBtn.addEventListener(
        "click",
        openAlertModal
    );
}


if (closeModal) {

    closeModal.addEventListener(
        "click",
        closeAlertModal
    );
}


if (alertModal) {

    alertModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === alertModal
            ) {
                closeAlertModal();
            }
        }
    );
}


if (saveAlert) {

    saveAlert.addEventListener(
        "click",
        () => {

            const value =
                Number(
                    targetPrice?.value
                );

            if (
                !Number.isFinite(value) ||
                value <= 0
            ) {

                if (alertMessage) {
                    alertMessage.textContent =
                        "Enter a valid target price.";
                }

                return;
            }

            const product =
                currentProduct?.name ||
                currentProduct?.title ||
                "Product";

            localStorage.setItem(
                `trustcart_alert_${product}`,
                String(value)
            );

            if (existingAlertStatus) {
                existingAlertStatus.style.display =
                    "block";
            }

            if (alertMessage) {
                alertMessage.textContent =
                    `Alert set for ${formatPrice(value)}.`;
            }

            showToast(
                `Price alert set for ${formatPrice(value)}.`
            );
        }
    );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    let toast =
        document.getElementById(
            "trustcartToast"
        );

    if (!toast) {

        toast =
            document.createElement("div");

        toast.id =
            "trustcartToast";

        toast.style.position =
            "fixed";

        toast.style.left =
            "50%";

        toast.style.bottom =
            "28px";

        toast.style.transform =
            "translateX(-50%) translateY(15px)";

        toast.style.zIndex =
            "2000";

        toast.style.padding =
            "11px 16px";

        toast.style.borderRadius =
            "11px";

        toast.style.background =
            "#0d3d29";

        toast.style.color =
            "#ffffff";

        toast.style.fontSize =
            "12px";

        toast.style.fontWeight =
            "700";

        toast.style.boxShadow =
            "0 12px 30px rgba(0,0,0,.18)";

        toast.style.opacity =
            "0";

        toast.style.transition =
            "opacity .2s ease, transform .2s ease";

        document.body.appendChild(toast);
    }

    toast.textContent =
        message;

    requestAnimationFrame(() => {

        toast.style.opacity =
            "1";

        toast.style.transform =
            "translateX(-50%) translateY(0)";
    });

    clearTimeout(
        toast._timeout
    );

    toast._timeout =
        setTimeout(() => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateX(-50%) translateY(15px)";

        }, 2600);
}


/* =========================================================
   EVENTS
========================================================= */

if (copySummaryBtn) {

    copySummaryBtn.addEventListener(
        "click",
        copySummary
    );
}


if (shareBtn) {

    shareBtn.addEventListener(
        "click",
        shareComparison
    );
}


if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        refreshComparison
    );
}


if (retryBtn) {

    retryBtn.addEventListener(
        "click",
        loadComparison
    );
}


document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape" &&
            alertModal?.style.display === "flex"
        ) {

            closeAlertModal();
        }
    }
);


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initTheme();

        if (profileMenu) {
            profileMenu.style.display =
                "none";
        }

        loadCurrentUser();

        loadComparison();
    }
);