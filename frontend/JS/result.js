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

    const productTitle =
        currentProduct?.name ||
        currentProduct?.title ||
        item?.name ||
        "Product";

    const productUrl =
        isSafeUrl(item?.product_url)
            ? item.product_url
            : "#";

    const reviewWindow =
        window.open(
            "",
            "_blank"
        );

    if (!reviewWindow) {

        showToast(
            "Please allow pop-ups to open product analysis."
        );

        return;
    }

    /*
     * Open the window immediately so browser popup blockers
     * do not block it while the API request is running.
     */
    reviewWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >
            <title>TrustCart | Product Analysis</title>

            <style>
                :root {
                    --green: #18583d;
                    --green-dark: #0d3d29;
                    --green-light: #61b487;
                    --green-soft: #e8f5ee;
                    --green-pale: #f5faf7;
                    --text: #17231e;
                    --muted: #718078;
                    --border: rgba(24,88,61,.11);
                    --page-bg: #f4f8f6;
                    --surface: #ffffff;
                    --track: #edf2ef;
                    --notice-bg: #fff9eb;
                    --notice-text: #765d20;
                }

                html.dark {
                    --green: #61b487;
                    --green-dark: #b9e6cb;
                    --green-light: #86d6a9;
                    --green-soft: #17352a;
                    --green-pale: #12231c;
                    --text: #edf7f1;
                    --muted: #9bb2a6;
                    --border: rgba(97,180,135,.18);
                    --page-bg: #0b1410;
                    --surface: #111d17;
                    --track: #22352c;
                    --notice-bg: #302817;
                    --notice-text: #e5c978;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    min-height: 100vh;
                    font-family:
                        Inter,
                        system-ui,
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                    color: var(--text);
                    background:
                        radial-gradient(
                            circle at 10% 0%,
                            rgba(97,180,135,.14),
                            transparent 30%
                        ),
                        var(--page-bg);
                }

                .page {
                    width: min(1080px, calc(100% - 36px));
                    margin: 0 auto;
                    padding: 36px 0 70px;
                }

                .top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 28px;
                }

                .logo {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--green-dark);
                    font-weight: 900;
                    font-size: 18px;
                }

                .logo-mark {
                    width: 38px;
                    height: 38px;
                    display: grid;
                    place-items: center;
                    border-radius: 11px;
                    background: var(--green);
                    color: white;
                }

                .top-actions {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                }

                .theme-toggle,
                .back {
                    min-width: 38px;
                    height: 38px;
                    display: grid;
                    place-items: center;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--surface);
                    color: var(--text);
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 800;
                }

                .back {
                    padding: 0 14px;
                }

                .theme-toggle:hover,
                .back:hover {
                    border-color: var(--green-light);
                }

                .hero {
                    display: grid;
                    grid-template-columns: 220px 1fr;
                    gap: 30px;
                    align-items: center;
                    padding: 28px;
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    background: var(--surface);
                    box-shadow: 0 14px 45px rgba(24,88,61,.08);
                }

                .product-image-wrap {
                    width: 100%;
                    height: 220px;
                    display: grid;
                    place-items: center;
                    padding: 15px;
                    border-radius: 16px;
                    background: var(--green-pale);
                    border: 1px solid var(--border);
                }

                .product-image {
                    max-width: 100%;
                    max-height: 190px;
                    object-fit: contain;
                }

                .eyebrow {
                    margin-bottom: 8px;
                    color: var(--green);
                    font-size: 13px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                }

                h1 {
                    margin: 0 0 12px;
                    font-size: clamp(25px, 4vw, 38px);
                    line-height: 1.12;
                }

                .marketplace {
                    display: inline-flex;
                    padding: 7px 11px;
                    border-radius: 999px;
                    background: var(--green-soft);
                    color: var(--green-dark);
                    font-size: 13px;
                    font-weight: 800;
                }

                .section {
                    margin-top: 22px;
                    padding: 24px;
                    border: 1px solid var(--border);
                    border-radius: 18px;
                    background: var(--surface);
                }

                .section-title {
                    margin: 0 0 18px;
                    font-size: 18px;
                }

                .metrics {
                    display: grid;
                    grid-template-columns:
                        repeat(4, minmax(0, 1fr));
                    gap: 14px;
                }

                .metric {
                    padding: 18px;
                    border-radius: 14px;
                    background: var(--green-pale);
                    border: 1px solid var(--border);
                }

                .metric-label {
                    color: var(--muted);
                    font-size: 12px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: .05em;
                }

                .metric-value {
                    margin-top: 7px;
                    font-size: 24px;
                    font-weight: 900;
                }

                .trust-card {
                    display: grid;
                    grid-template-columns: 190px 1fr;
                    gap: 26px;
                    align-items: center;
                }

                .trust-score {
                    width: 170px;
                    height: 170px;
                    margin: auto;
                    display: grid;
                    place-items: center;
                    text-align: center;
                    border-radius: 50%;
                    border: 12px solid var(--green-soft);
                    background: var(--surface);
                }

                .trust-number {
                    font-size: 42px;
                    font-weight: 950;
                    color: var(--green);
                    line-height: 1;
                }

                .trust-label {
                    margin-top: 5px;
                    color: var(--muted);
                    font-size: 12px;
                    font-weight: 800;
                }

                .trust-level {
                    margin-bottom: 18px;
                    font-size: 22px;
                    font-weight: 900;
                    color: var(--green);
                }

                .score-row {
                    margin: 13px 0;
                }

                .score-head {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 6px;
                    font-size: 13px;
                    font-weight: 800;
                }

                .score-track {
                    height: 9px;
                    overflow: hidden;
                    border-radius: 999px;
                    background: var(--track);
                }

                .score-fill {
                    height: 100%;
                    border-radius: inherit;
                    background: var(--green-light);
                }

                .price-box {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    padding: 20px;
                    border-radius: 14px;
                    background: var(--green-soft);
                }

                .price {
                    color: var(--green-dark);
                    font-size: 32px;
                    font-weight: 950;
                }

                .buy-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 44px;
                    padding: 0 18px;
                    border: 0;
                    border-radius: 10px;
                    background: var(--green);
                    color: white;
                    text-decoration: none;
                    font-weight: 900;
                }

                .buy-button:hover {
                    background: var(--green-dark);
                }

                .note {
                    margin-top: 14px;
                    color: var(--muted);
                    font-size: 13px;
                    line-height: 1.6;
                }

                .error {
                    padding: 30px;
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    background: var(--surface);
                    text-align: center;
                }

                @media (max-width: 760px) {
                    .hero,
                    .trust-card {
                        grid-template-columns: 1fr;
                    }

                    .product-image-wrap {
                        height: 190px;
                    }

                    .metrics {
                        grid-template-columns:
                            repeat(2, minmax(0, 1fr));
                    }

                    .price-box {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                }

                @media (max-width: 460px) {
                    .metrics {
                        grid-template-columns: 1fr;
                    }

                    .page {
                        width: min(100% - 22px, 1080px);
                        padding-top: 18px;
                    }
                }
            </style>
        </head>

        <body>
            <main class="page">

                <header class="top">
                    <div class="logo">
                        <div class="logo-mark">T</div>
                        <span>TrustCart</span>
                    </div>

                    <div class="top-actions">
                        <button
                            class="theme-toggle"
                            id="reviewThemeToggle"
                            type="button"
                            aria-label="Toggle dark mode"
                        >☾</button>

                        <button
                            class="back"
                            type="button"
                            onclick="window.close()"
                        >← Back</button>
                    </div>
                </header>

                <div id="analysisRoot">
                    <div class="section">
                        Loading real product analysis...
                    </div>
                </div>

            </main>

            <script>
                const productUrl =
                    ${JSON.stringify(productUrl)};

                const fallbackTitle =
                    ${JSON.stringify(productTitle)};

                function escapeHtml(value) {
                    return String(value ?? "")
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                function formatNumber(value) {
                    if (
                        value === null ||
                        value === undefined ||
                        value === "" ||
                        Number.isNaN(Number(value))
                    ) {
                        return "—";
                    }

                    return Number(value).toLocaleString("en-IN");
                }

                function formatPrice(value) {
                    if (
                        value === null ||
                        value === undefined ||
                        value === "" ||
                        Number.isNaN(Number(value))
                    ) {
                        return "Price unavailable";
                    }

                    return "₹" +
                        Number(value).toLocaleString(
                            "en-IN",
                            {
                                maximumFractionDigits: 2
                            }
                        );
                }

                function scorePercent(value) {
                    const number = Number(value);

                    if (!Number.isFinite(number)) {
                        return 0;
                    }

                    return Math.max(
                        0,
                        Math.min(100, number)
                    );
                }

                function applyReviewTheme(theme) {
                    const isDark =
                        theme === "dark";

                    document.documentElement
                        .classList
                        .toggle(
                            "dark",
                            isDark
                        );

                    const toggle =
                        document.getElementById(
                            "reviewThemeToggle"
                        );

                    if (toggle) {
                        toggle.textContent =
                            isDark ? "☀" : "☾";

                        toggle.setAttribute(
                            "aria-label",
                            isDark
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        );
                    }
                }

                function initReviewTheme() {
                    applyReviewTheme(
                        localStorage.getItem(
                            "trustcart-theme"
                        ) || "light"
                    );

                    const toggle =
                        document.getElementById(
                            "reviewThemeToggle"
                        );

                    if (toggle) {
                        toggle.addEventListener(
                            "click",
                            function () {
                                const isDark =
                                    document.documentElement
                                        .classList
                                        .contains("dark");

                                const next =
                                    isDark
                                        ? "light"
                                        : "dark";

                                localStorage.setItem(
                                    "trustcart-theme",
                                    next
                                );

                                applyReviewTheme(
                                    next
                                );
                            }
                        );
                    }

                    window.addEventListener(
                        "storage",
                        function (event) {
                            if (
                                event.key ===
                                "trustcart-theme"
                            ) {
                                applyReviewTheme(
                                    event.newValue ===
                                    "dark"
                                        ? "dark"
                                        : "light"
                                );
                            }
                        }
                    );
                }

                function renderAnalysis(data) {

                    const product =
                        data.product || {};

                    const analysis =
                        data.analysis || {};

                    const canonical =
                        data.canonical || {};

                    const name =
                        product.name ||
                        product.title ||
                        canonical.product_name ||
                        fallbackTitle ||
                        "Product";

                    const image =
                        product.image_url ||
                        product.imageUrl ||
                        product.image ||
                        canonical.image_url ||
                        "";

                    const marketplace =
                        analysis.marketplace ||
                        product.marketplace ||
                        "Marketplace";

                    const price =
                        analysis.price ??
                        product.price;

                    const rating =
                        analysis.rating ??
                        product.rating;

                    const reviews =
                        analysis.review_count ??
                        product.review_count;

                    const trustScore =
                        Number(
                            analysis.trust_score
                        );

                    const trustLevel =
                        analysis.trust_level ||
                        "Unavailable";

                    const ratingScore =
                        Number(
                            analysis.rating_score
                        );

                    const reviewScore =
                        Number(
                            analysis.review_score
                        );

                    const priceScore =
                        Number(
                            analysis.price_score
                        );

                    const sellerScore =
                        Number(
                            analysis.seller_score
                        );

                    const safeUrl =
                        /^https?:\\/\\//i.test(
                            product.product_url ||
                            productUrl
                        )
                            ? (
                                product.product_url ||
                                productUrl
                            )
                            : "#";

                    const imageHtml =
                        image
                            ? \`
                                <img
                                    class="product-image"
                                    src="\${escapeHtml(image)}"
                                    alt="\${escapeHtml(name)}"
                                    onerror="this.style.display='none'"
                                >
                              \`
                            : \`
                                <div>
                                    Product image unavailable
                                </div>
                              \`;

                    const scores = [
                        [
                            "Rating Score",
                            ratingScore
                        ],
                        [
                            "Review Score",
                            reviewScore
                        ],
                        [
                            "Price Score",
                            priceScore
                        ],
                        [
                            "Seller Score",
                            sellerScore
                        ]
                    ];

                    const scoreRows =
                        scores.map(
                            ([label, value]) => \`
                                <div class="score-row">
                                    <div class="score-head">
                                        <span>
                                            \${escapeHtml(label)}
                                        </span>
                                        <span>
                                            \${Number.isFinite(value)
                                                ? value
                                                : "—"}
                                        </span>
                                    </div>

                                    <div class="score-track">
                                        <div
                                            class="score-fill"
                                            style="width:\${scorePercent(value)}%"
                                        ></div>
                                    </div>
                                </div>
                            \`
                        ).join("");

                    document.getElementById(
                        "analysisRoot"
                    ).innerHTML = \`

                        <section class="hero">

                            <div class="product-image-wrap">
                                \${imageHtml}
                            </div>

                            <div>
                                <div class="eyebrow">
                                    Product Analysis
                                </div>

                                <h1>
                                    \${escapeHtml(name)}
                                </h1>

                                <span class="marketplace">
                                    \${escapeHtml(marketplace)}
                                </span>
                            </div>

                        </section>

                        <section class="section">

                            <h2 class="section-title">
                                Product Overview
                            </h2>

                            <div class="metrics">

                                <div class="metric">
                                    <div class="metric-label">
                                        Price
                                    </div>
                                    <div class="metric-value">
                                        \${escapeHtml(
                                            formatPrice(price)
                                        )}
                                    </div>
                                </div>

                                <div class="metric">
                                    <div class="metric-label">
                                        Rating
                                    </div>
                                    <div class="metric-value">
                                        \${escapeHtml(
                                            rating ?? "—"
                                        )} ★
                                    </div>
                                </div>

                                <div class="metric">
                                    <div class="metric-label">
                                        Reviews
                                    </div>
                                    <div class="metric-value">
                                        \${escapeHtml(
                                            formatNumber(reviews)
                                        )}
                                    </div>
                                </div>

                                <div class="metric">
                                    <div class="metric-label">
                                        Marketplace
                                    </div>
                                    <div class="metric-value">
                                        \${escapeHtml(
                                            marketplace
                                        )}
                                    </div>
                                </div>

                            </div>

                        </section>

                        <section class="section">

                            <h2 class="section-title">
                                Trust Analysis
                            </h2>

                            <div class="trust-card">

                                <div class="trust-score">
                                    <div>
                                        <div class="trust-number">
                                            \${Number.isFinite(
                                                trustScore
                                            )
                                                ? trustScore
                                                : "—"}
                                        </div>

                                        <div class="trust-label">
                                            Trust Score
                                        </div>
                                    </div>
                                </div>

                                <div>

                                    <div class="trust-level">
                                        \${escapeHtml(
                                            trustLevel
                                        )}
                                    </div>

                                    \${scoreRows}

                                </div>

                            </div>

                        </section>

                        <section class="section">

                            <h2 class="section-title">
                                Price & Marketplace
                            </h2>

                            <div class="price-box">

                                <div>
                                    <div
                                        style="
                                            color:var(--muted);
                                            font-size:13px;
                                            font-weight:800;
                                        "
                                    >
                                        Listed price
                                    </div>

                                    <div class="price">
                                        \${escapeHtml(
                                            formatPrice(price)
                                        )}
                                    </div>
                                </div>

                                <a
                                    class="buy-button"
                                    href="\${escapeHtml(safeUrl)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View on \${escapeHtml(
                                        marketplace
                                    )}
                                </a>

                            </div>

                            <div class="note">
                                Trust Score is calculated by
                                TrustCart using rating, review
                                count, price and marketplace
                                trust signals.
                            </div>

                        </section>
                    \`;
                }

                async function loadAnalysis() {

                    if (
                        !productUrl ||
                        productUrl === "#"
                    ) {
                        document.getElementById(
                            "analysisRoot"
                        ).innerHTML = \`
                            <div class="error">
                                Product URL is unavailable.
                            </div>
                        \`;

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

                        const data =
                            await response.json();

                        if (!response.ok ||
                            !data.success) {

                            throw new Error(
                                data.message ||
                                "Unable to analyze this product."
                            );
                        }

                        renderAnalysis(data);

                    } catch (error) {

                        console.error(
                            "TrustCart product analysis error:",
                            error
                        );

                        document.getElementById(
                            "analysisRoot"
                        ).innerHTML = \`
                            <div class="error">
                                <h2>
                                    Product analysis unavailable
                                </h2>

                                <p>
                                    \${escapeHtml(
                                        error?.message ||
                                        "Unable to load product analysis."
                                    )}
                                </p>
                            </div>
                        \`;
                    }
                }

                initReviewTheme();
                loadAnalysis();
            <\/script>
        </body>
        </html>
    `);
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