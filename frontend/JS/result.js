/* =========================================================
   TRUSTCART - RESULT PAGE JAVASCRIPT
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

const $all = (selector) => [
    ...document.querySelectorAll(selector)
];


/* =========================================================
   DOM REFERENCES
========================================================= */

const loading = $("#loading");
const errorBox = $("#errorBox");
const errorMessage = $("#errorMessage");
const results = $("#results");

const productName = $("#productName");
const productBrand = $("#productBrand");
const productCategory = $("#productCategory");

const bestSeller = $("#bestSeller");
const bestWebsite = $("#bestWebsite");
const bestPrice = $("#bestPrice");
const savings = $("#savings");
const bestBuyBtn = $("#bestBuyBtn");

const trustScore = $("#trustScore");
const trustLevel = $("#trustLevel");

const priceAnalysis = $("#priceAnalysis");
const sellerAnalysis = $("#sellerAnalysis");
const freshnessAnalysis = $("#freshnessAnalysis");

const recommendation = $("#recommendation");

const sellerRows = $("#sellerRows");
const sellerCount = $("#sellerCount");

const themeToggle = $("#themeToggle");

const quickBestPrice = $("#quickBestPrice");
const quickSavings = $("#quickSavings");
const quickSellerCount = $("#quickSellerCount");
const quickTrustScore = $("#quickTrustScore");

const priceBars = $("#priceBars");

const smartInsight = $("#smartInsight");
const smartInsightText = $("#smartInsightText");

const dealReason = $("#dealReason");
const buyingTip = $("#buyingTip");

const sortSelect = $("#sortSelect");

const alertModal = $("#alertModal");
const alertClose = $("#alertClose");
const alertCancel = $("#alertCancel");
const alertSave = $("#alertSave");
const alertPrice = $("#alertPrice");
const alertBtn = $("#alertBtn");

const productImage = $("#productImage");
const productImageWrap = $("#productImageWrap");

const checkedTime = $("#checkedTime");
const savingsPercentage = $("#savingsPercentage");

const refreshBtn = $("#refreshBtn");
const copyBtn = $("#copyBtn");
const shareBtn = $("#shareBtn");

const retryBtn = $("#retryBtn");

const alertMessage = $("#alertMessage");
const existingAlertStatus = $("#existingAlertStatus");

const closeModalFallback = $("#closeModal");
const targetPriceFallback = $("#targetPrice");
const saveAlertFallback = $("#saveAlert");

const avatarName = $("#userName");
const avatarEmail = $("#userEmail");
const avatarInitial = $("#avatarInitial");


/* =========================================================
   PRODUCT ID
========================================================= */

function getProductId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const queryId =
        params.get("id") ||
        params.get("product_id") ||
        params.get("productId");

    if (queryId) {
        return queryId;
    }

    const parts =
        window.location.pathname
            .split("/")
            .filter(Boolean);

    const resultIndex =
        parts.indexOf("result");

    if (
        resultIndex !== -1 &&
        parts[resultIndex + 1]
    ) {
        return parts[resultIndex + 1];
    }

    return null;
}


/* =========================================================
   THEME
========================================================= */

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            "trustcart-theme"
        );

    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark"
        );

        if (themeToggle) {
            themeToggle.textContent = "☀";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to light mode"
            );
        }

    } else {

        document.body.classList.remove(
            "dark"
        );

        if (themeToggle) {
            themeToggle.textContent = "☾";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );
        }
    }
}


function toggleTheme() {

    const isDark =
        document.body.classList.toggle(
            "dark"
        );

    localStorage.setItem(
        "trustcart-theme",
        isDark ? "dark" : "light"
    );

    if (themeToggle) {

        themeToggle.textContent =
            isDark ? "☀" : "☾";

        themeToggle.setAttribute(
            "aria-label",
            isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
        );
    }
}


/* =========================================================
   USER / TOPBAR AVATAR
========================================================= */

async function loadCurrentUser() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
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

        const user =
            data.user;

        const name =
            String(
                user.name || "User"
            ).trim();

        const email =
            user.email || "";

        const initial =
            name.charAt(0).toUpperCase() ||
            "U";


        /* -----------------------------------------
           NORMAL USER ELEMENTS
        ----------------------------------------- */

        if (avatarName) {
            avatarName.textContent =
                name;
        }

        if (avatarEmail) {
            avatarEmail.textContent =
                email;
        }


        /* -----------------------------------------
           IMPORTANT:
           FORCE M INTO TOPBAR AVATAR
        ----------------------------------------- */

        const avatarSelectors = [
            "#avatarInitial",
            "#userInitial",
            ".avatar-initial",
            ".user-initial",
            "[data-user-initial]"
        ];

        avatarSelectors.forEach(
            selector => {

                document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(element => {

                        element.textContent =
                            initial;

                        element.innerText =
                            initial;

                        element.style.display =
                            "flex";

                        element.style.alignItems =
                            "center";

                        element.style.justifyContent =
                            "center";

                        element.style.visibility =
                            "visible";

                        element.style.opacity =
                            "1";
                    });
            }
        );


        /* -----------------------------------------
           FALLBACK:
           IF HTML ONLY HAS THE CIRCLE
        ----------------------------------------- */

        const fallbackSelectors = [
            "#avatar",
            ".avatar",
            ".user-avatar",
            ".profile-avatar"
        ];

        fallbackSelectors.forEach(
            selector => {

                document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(avatar => {

                        /*
                         * Only add M if there is no
                         * existing inner text.
                         */
                        if (
                            !avatar.textContent.trim()
                        ) {
                            avatar.textContent =
                                initial;
                        }

                        avatar.style.display =
                            "flex";

                        avatar.style.alignItems =
                            "center";

                        avatar.style.justifyContent =
                            "center";

                        avatar.style.visibility =
                            "visible";

                        avatar.style.opacity =
                            "1";

                        avatar.style.fontWeight =
                            "700";
                    });
            }
        );


        /* -----------------------------------------
           OTHER USER SELECTORS
        ----------------------------------------- */

        $all(
            "[data-user-name], .user-name"
        ).forEach(element => {
            element.textContent =
                name;
        });

        $all(
            "[data-user-email], .user-email"
        ).forEach(element => {
            element.textContent =
                email;
        });

        $all(
            "[data-user-initial], .user-initial"
        ).forEach(element => {
            element.textContent =
                initial;
        });


        console.log(
            "TrustCart user avatar:",
            initial
        );

    } catch (error) {

        console.warn(
            "Unable to load current user:",
            error
        );
    }
}


/* =========================================================
   ERROR
========================================================= */

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
            message ||
            "Something went wrong while loading the comparison.";
    }
}


function hideError() {

    if (errorBox) {
        errorBox.style.display = "none";
    }
}


/* =========================================================
   LOADING
========================================================= */

function showLoading() {

    hideError();

    if (results) {
        results.style.display = "none";
    }

    if (loading) {
        loading.style.display = "flex";
    }
}


function hideLoading() {

    if (loading) {
        loading.style.display = "none";
    }
}


/* =========================================================
   SAFE URL
========================================================= */

function isSafeUrl(value) {

    if (!value) {
        return false;
    }

    try {

        const url =
            new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch {
        return false;
    }
}


function safeUrl(value) {

    return isSafeUrl(value)
        ? value
        : "#";
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeAttribute(value) {

    return escapeHtml(value);
}


/* =========================================================
   LOAD COMPARISON
========================================================= */

async function loadComparison() {

    currentProductId =
        getProductId();

    showLoading();


    /* -----------------------------------------
       SESSION STORAGE FIRST
    ----------------------------------------- */

    try {

        const stored =
            sessionStorage.getItem(
                "trustcart_compare_result"
            );

        if (stored) {

            const parsed =
                JSON.parse(stored);

            if (
                parsed &&
                (
                    parsed.success ||
                    parsed.canonical ||
                    parsed.matching ||
                    parsed.price_comparison ||
                    parsed.trust_analysis
                )
            ) {

                displayComparisonResults(
                    parsed
                );

                return;
            }
        }

    } catch (error) {

        console.warn(
            "Invalid stored comparison:",
            error
        );
    }


    /* -----------------------------------------
       BACKEND FALLBACK
    ----------------------------------------- */

    if (!currentProductId) {

        showError(
            "No product comparison was found. Please return to the dashboard and compare a product again."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `/api/products/${encodeURIComponent(currentProductId)}/prices`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {

            throw new Error(
                `Unable to load comparison (${response.status}).`
            );
        }

        const data =
            await response.json();

        displayComparisonResults(
            data
        );

    } catch (error) {

        console.error(
            "Comparison loading failed:",
            error
        );

        showError(
            error.message ||
            "Unable to load comparison results."
        );
    }
}


/* =========================================================
   DISPLAY COMPARISON RESULTS
========================================================= */

function displayComparisonResults(data) {

    currentComparison =
        data;

    hideError();
    hideLoading();


    const canonical =
        data?.canonical || {};

    const sourceProduct =
        data?.source_product ||
        data?.sourceProduct ||
        data?.product ||
        {};

    const matching =
        data?.matching || {};

    const priceComparison =
        data?.price_comparison ||
        data?.priceComparison ||
        {};

    const trustAnalysis =
        data?.trust_analysis ||
        data?.trustAnalysis ||
        {};

    const recommendationData =
        data?.recommendation ||
        data?.recommendation_data ||
        {};


    currentProduct = {
        ...sourceProduct,
        ...canonical
    };


    /* -----------------------------------------
       BUILD SELLER PRICES
    ----------------------------------------- */

    let prices =
        buildPricesFromMatching(
            matching
        );

    if (!prices.length) {

        prices =
            buildPricesFromComparison(
                priceComparison
            );
    }

    if (!prices.length) {

        prices =
            buildPricesFromDirectData(
                data
            );
    }

    prices =
        normalizePrices(
            prices
        );

    prices =
        applyTrustScores(
            prices,
            trustAnalysis
        );

    prices =
        deduplicatePrices(
            prices
        );

    currentPrices =
        prices;


    /* -----------------------------------------
       DISPLAY
    ----------------------------------------- */

    displayComparisonData({
        data,
        canonical,
        sourceProduct,
        matching,
        priceComparison,
        trustAnalysis,
        recommendationData,
        prices
    });
}


/* =========================================================
   BUILD FROM MATCHING
========================================================= */

function buildPricesFromMatching(
    matching
) {

    const list = [];

    if (!matching) {
        return list;
    }

    const candidates =
        matching.candidates ||
        matching.matches ||
        matching.products ||
        matching.results ||
        matching.matched_products ||
        [];

    if (Array.isArray(candidates)) {

        candidates.forEach(
            candidate => {

                const price =
                    extractPrice(
                        candidate
                    );

                if (
                    price === null
                ) {
                    return;
                }

                list.push({
                    ...candidate,
                    price,
                    match_score:
                        candidate.match_score ??
                        candidate.matchScore ??
                        candidate.score
                });
            }
        );
    }

    return list;
}


/* =========================================================
   BUILD FROM PRICE COMPARISON
========================================================= */

function buildPricesFromComparison(
    priceComparison
) {

    const list = [];

    if (!priceComparison) {
        return list;
    }

    const candidates =
        priceComparison.prices ||
        priceComparison.results ||
        priceComparison.sellers ||
        priceComparison.comparison ||
        priceComparison.offers ||
        [];

    if (Array.isArray(candidates)) {

        candidates.forEach(
            item => {

                const price =
                    extractPrice(
                        item
                    );

                if (
                    price === null
                ) {
                    return;
                }

                list.push({
                    ...item,
                    price
                });
            }
        );
    }

    return list;
}


/* =========================================================
   BUILD DIRECT
========================================================= */

function buildPricesFromDirectData(
    data
) {

    const list = [];

    if (!data) {
        return list;
    }

    const arrays = [
        data.prices,
        data.sellers,
        data.results,
        data.products,
        data.offers,
        data.comparison
    ];

    arrays.forEach(
        array => {

            if (!Array.isArray(array)) {
                return;
            }

            array.forEach(
                item => {

                    const price =
                        extractPrice(
                            item
                        );

                    if (
                        price === null
                    ) {
                        return;
                    }

                    list.push({
                        ...item,
                        price
                    });
                }
            );
        }
    );

    return list;
}


/* =========================================================
   PRICE EXTRACTION
========================================================= */

function extractPrice(item) {

    if (
        item === null ||
        item === undefined
    ) {
        return null;
    }

    const candidates = [
        item.price,
        item.selling_price,
        item.sellingPrice,
        item.current_price,
        item.currentPrice,
        item.amount,
        item.offer_price,
        item.offerPrice
    ];

    for (
        const value of candidates
    ) {

        const number =
            parsePrice(value);

        if (
            number !== null &&
            number >= 0
        ) {
            return number;
        }
    }

    return null;
}


function parsePrice(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : null;
    }

    const cleaned =
        String(value)
            .replace(
                /[₹$€£,\s]/g,
                ""
            )
            .replace(
                /[^\d.-]/g,
                ""
            );

    const number =
        parseFloat(
            cleaned
        );

    return Number.isFinite(number)
        ? number
        : null;
}


/* =========================================================
   NORMALIZE
========================================================= */

function normalizePrices(
    prices
) {

    if (!Array.isArray(prices)) {
        return [];
    }

    return prices
        .map(item => {

            const price =
                extractPrice(
                    item
                );

            if (
                price === null
            ) {
                return null;
            }

            const seller =
                cleanSellerName(
                    item.seller ||
                    item.marketplace ||
                    item.platform ||
                    item.website ||
                    item.source ||
                    item.store ||
                    "Seller"
                );

            const website =
                cleanWebsiteName(
                    item.website ||
                    item.marketplace ||
                    item.platform ||
                    item.source ||
                    seller
                );

            const productUrl =
                item.product_url ||
                item.productUrl ||
                item.url ||
                item.link ||
                item.source_url ||
                item.sourceUrl ||
                "";

            return {
                ...item,

                price,

                seller,

                website,

                product_url:
                    isSafeUrl(productUrl)
                        ? productUrl
                        : "",

                rating:
                    parseNumber(
                        item.rating ??
                        item.stars ??
                        item.product_rating
                    ),

                review_count:
                    parseNumber(
                        item.review_count ??
                        item.reviewCount ??
                        item.reviews
                    ),

                match_score:
                    parseNumber(
                        item.match_score ??
                        item.matchScore ??
                        item.score
                    ),

                trust_score:
                    parseNumber(
                        item.trust_score ??
                        item.trustScore
                    ),

                trust_level:
                    item.trust_level ||
                    item.trustLevel ||
                    "",

                updated_at:
                    item.updated_at ||
                    item.updatedAt ||
                    item.last_updated ||
                    item.lastUpdated ||
                    null
            };
        })
        .filter(Boolean);
}


/* =========================================================
   APPLY TRUST SCORES
========================================================= */

function applyTrustScores(
    prices,
    trustAnalysis
) {

    if (!Array.isArray(prices)) {
        return [];
    }

    return prices.map(
        item => {

            const trust =
                findTrustForSeller(
                    item.seller,
                    item.website,
                    trustAnalysis
                );

            if (!trust) {
                return item;
            }

            const score =
                parseNumber(
                    trust.trust_score ??
                    trust.trustScore ??
                    trust.score
                );

            return {
                ...item,

                trust_score:
                    score,

                trust_level:
                    trust.trust_level ||
                    trust.trustLevel ||
                    trust.level ||
                    trustLevelFromScore(
                        score
                    )
            };
        }
    );
}


/* =========================================================
   TRUST LOOKUP
========================================================= */

function findTrustForSeller(
    seller,
    website,
    trustAnalysis
) {

    if (!trustAnalysis) {
        return null;
    }

    const sellerText =
        String(
            seller || ""
        ).toLowerCase();

    const websiteText =
        String(
            website || ""
        ).toLowerCase();


    const sources = [
        trustAnalysis,
        trustAnalysis.sellers,
        trustAnalysis.marketplaces,
        trustAnalysis.platforms,
        trustAnalysis.trust_scores
    ];


    for (
        const source of sources
    ) {

        if (
            !source ||
            typeof source !== "object" ||
            Array.isArray(source)
        ) {
            continue;
        }

        for (
            const [key, value]
            of Object.entries(source)
        ) {

            if (
                !value ||
                typeof value !== "object"
            ) {
                continue;
            }

            const keyText =
                key.toLowerCase();

            if (
                sellerText.includes(
                    keyText
                ) ||
                keyText.includes(
                    sellerText
                ) ||
                websiteText.includes(
                    keyText
                ) ||
                keyText.includes(
                    websiteText
                )
            ) {
                return value;
            }
        }
    }


    const arrays = [
        trustAnalysis.sellers,
        trustAnalysis.results,
        trustAnalysis.marketplaces,
        trustAnalysis.platforms,
        trustAnalysis.breakdown
    ];


    for (
        const array of arrays
    ) {

        if (!Array.isArray(array)) {
            continue;
        }

        const found =
            array.find(
                item => {

                    const itemSeller =
                        String(
                            item.seller ||
                            item.website ||
                            item.marketplace ||
                            item.platform ||
                            item.name ||
                            ""
                        ).toLowerCase();

                    return (
                        itemSeller === sellerText ||
                        itemSeller.includes(sellerText) ||
                        sellerText.includes(itemSeller) ||
                        itemSeller === websiteText ||
                        itemSeller.includes(websiteText) ||
                        websiteText.includes(itemSeller)
                    );
                }
            );

        if (found) {
            return found;
        }
    }

    return null;
}


/* =========================================================
   DEDUPLICATE
========================================================= */

function deduplicatePrices(
    prices
) {

    const map =
        new Map();

    prices.forEach(
        item => {

            const key =
                `${String(
                    item.seller
                ).toLowerCase()}-${item.price}`;

            if (!map.has(key)) {
                map.set(
                    key,
                    item
                );
            }
        }
    );

    return [
        ...map.values()
    ];
}


/* =========================================================
   MAIN DISPLAY
========================================================= */

function displayComparisonData({
    data,
    canonical,
    sourceProduct,
    matching,
    priceComparison,
    trustAnalysis,
    recommendationData,
    prices
}) {

    const product = {
        ...sourceProduct,
        ...canonical
    };

    currentProduct =
        product;


    /* =====================================================
       PRODUCT INFORMATION
    ===================================================== */

    const name =
        product.product_name ||
        product.productName ||
        product.name ||
        product.title ||
        "Product Comparison";

    const brand =
        product.brand ||
        "";

    const category =
        product.category ||
        "Product";


    if (productName) {
        productName.textContent =
            name;
    }

    if (productBrand) {
        productBrand.textContent =
            brand
                ? `Brand: ${brand}`
                : "";
    }

    if (productCategory) {
        productCategory.textContent =
            category;
    }


    /* =====================================================
       PRODUCT IMAGE
       FIXED LEFT-SIDE POSITION
    ===================================================== */

    const imageUrl =
        product.image_url ||
        product.imageUrl ||
        product.image ||
        product.thumbnail ||
        "";


    if (
        productImage &&
        isSafeUrl(imageUrl)
    ) {

        productImage.src =
            imageUrl;

        productImage.alt =
            name;

        productImage.style.display =
            "block";

        productImage.style.visibility =
            "visible";

        productImage.style.objectFit =
            "contain";

        productImage.style.width =
            "100%";

        productImage.style.height =
            "100%";


        if (productImageWrap) {

            productImageWrap.style.display =
                "flex";

            productImageWrap.style.alignItems =
                "center";

            productImageWrap.style.justifyContent =
                "center";

            productImageWrap.style.flexShrink =
                "0";

            productImageWrap.style.overflow =
                "hidden";
        }


        productImage.onerror =
            () => {

                productImage.style.display =
                    "none";
            };
    }


    /* =====================================================
       FORCE HERO LAYOUT
    ===================================================== */

    const productHero =
        $(".product-hero");

    if (productHero) {

        productHero.style.display =
            "grid";

        productHero.style.gridTemplateColumns =
            "260px minmax(0, 1fr)";

        productHero.style.alignItems =
            "center";

        productHero.style.gap =
            "32px";
    }


    if (productImageWrap) {

        productImageWrap.style.width =
            "260px";

        productImageWrap.style.height =
            "260px";

        productImageWrap.style.minWidth =
            "260px";

        productImageWrap.style.maxWidth =
            "260px";

        productImageWrap.style.margin =
            "0";

        productImageWrap.style.position =
            "relative";
    }


    const productInfo =
        $(".product-info");

    if (productInfo) {

        productInfo.style.minWidth =
            "0";

        productInfo.style.width =
            "100%";
    }


    if (productName) {

        productName.style.maxWidth =
            "100%";

        productName.style.overflowWrap =
            "anywhere";

        productName.style.wordBreak =
            "normal";
    }


    /* =====================================================
       SORT
    ===================================================== */

    prices.sort(
        (a, b) =>
            a.price - b.price
    );

    currentPrices =
        prices;


    if (!prices.length) {

        showError(
            "No comparable seller prices were found for this product."
        );

        return;
    }


    /* =====================================================
       BEST DEAL
    ===================================================== */

    const backendBestDeal =
        priceComparison.best_deal ??
        priceComparison.bestDeal ??
        recommendationData.best_deal ??
        recommendationData.bestDeal ??
        data.best_deal ??
        data.bestDeal;

    const backendBestSeller =
        priceComparison.best_seller ??
        priceComparison.bestSeller ??
        recommendationData.best_seller ??
        recommendationData.bestSeller ??
        data.best_seller ??
        data.bestSeller;


    const best =
        findBestDeal(
            prices,
            backendBestDeal,
            backendBestSeller
        );

    currentBestDeal =
        best;


    /* =====================================================
       PRICE METRICS
    ===================================================== */

    const cheapestPrice =
        Math.min(
            ...prices.map(
                item => item.price
            )
        );

    const highestPrice =
        Math.max(
            ...prices.map(
                item => item.price
            )
        );

    const savingsAmount =
        Math.max(
            0,
            highestPrice -
            cheapestPrice
        );

    const savingsPercent =
        highestPrice > 0
            ? (
                savingsAmount /
                highestPrice
            ) * 100
            : 0;


    /* =====================================================
       BEST DEAL CARD
    ===================================================== */

    if (bestSeller) {
        bestSeller.textContent =
            best.seller;
    }

    if (bestWebsite) {
        bestWebsite.textContent =
            best.website;
    }

    if (bestPrice) {
        bestPrice.textContent =
            formatPrice(
                best.price
            );
    }

    if (savings) {
        savings.textContent =
            `Save ${formatPrice(
                savingsAmount
            )}`;
    }

    if (savingsPercentage) {
        savingsPercentage.textContent =
            `${savingsPercent.toFixed(1)}%`;
    }


    /* =====================================================
       BUY BUTTON
    ===================================================== */

    configureBuyButton(
        bestBuyBtn,
        best.product_url
    );


    /* =====================================================
       QUICK STATS
    ===================================================== */

    if (quickBestPrice) {
        quickBestPrice.textContent =
            formatPrice(
                cheapestPrice
            );
    }

    if (quickSavings) {
        quickSavings.textContent =
            savingsPercent > 0
                ? `${savingsPercent.toFixed(1)}%`
                : "—";
    }

    if (quickSellerCount) {
        quickSellerCount.textContent =
            prices.length;
    }

    if (sellerCount) {
        sellerCount.textContent =
            prices.length;
    }


    /* =====================================================
       TRUST
    ===================================================== */

    const overallTrust =
        getOverallTrust(
            trustAnalysis,
            recommendationData,
            prices
        );


    if (quickTrustScore) {

        quickTrustScore.textContent =
            overallTrust !== null
                ? formatScore(
                    overallTrust
                )
                : "—";
    }


    if (trustScore) {

        trustScore.textContent =
            overallTrust !== null
                ? formatScore(
                    overallTrust
                )
                : "—";
    }


    if (trustLevel) {

        trustLevel.textContent =
            trustLevelFromScore(
                overallTrust
            );
    }


    updateTrustCircle(
        overallTrust
    );


    /* =====================================================
       ANALYSIS
    ===================================================== */

    if (priceAnalysis) {

        priceAnalysis.textContent =
            buildPriceAnalysis(
                prices,
                cheapestPrice,
                highestPrice
            );
    }


    if (sellerAnalysis) {

        sellerAnalysis.textContent =
            buildSellerAnalysis(
                prices
            );
    }


    if (freshnessAnalysis) {

        freshnessAnalysis.textContent =
            buildFreshnessAnalysis(
                prices
            );
    }


    /* =====================================================
       RECOMMENDATION
    ===================================================== */

    if (recommendation) {

        recommendation.textContent =
            extractRecommendation(
                recommendationData,
                best,
                savingsPercent
            );
    }


    /* =====================================================
       DEAL REASON
    ===================================================== */

    if (dealReason) {

        dealReason.textContent =
            buildDealReason(
                best,
                cheapestPrice,
                highestPrice,
                savingsPercent
            );
    }


    /* =====================================================
       SMART INSIGHT
    ===================================================== */

    const insight =
        generateSmartInsight(
            best,
            prices,
            savingsPercent,
            overallTrust
        );


    if (smartInsightText) {
        smartInsightText.textContent =
            insight;
    }


    if (smartInsight) {
        smartInsight.style.display =
            "flex";
    }


    /* =====================================================
       PRICE BARS
    ===================================================== */

    renderPriceBars(
        prices
    );


    /* =====================================================
       SELLER ROWS
    ===================================================== */

    renderSellerRows(
        prices,
        best
    );


    /* =====================================================
       BUYING TIP
    ===================================================== */

    if (buyingTip) {

        buyingTip.textContent =
            buildBuyingTip(
                best,
                prices,
                overallTrust
            );
    }


    /* =====================================================
       LAST CHECKED
    ===================================================== */

    updateCheckedTime(
        prices,
        data
    );


    /* =====================================================
       PRICE ALERT
    ===================================================== */

    loadExistingAlert();


    /* =====================================================
       SHOW RESULT
    ===================================================== */

    if (results) {
        results.style.display =
            "block";
    }
}


/* =========================================================
   BEST DEAL
========================================================= */

function findBestDeal(
    prices,
    backendBestDeal,
    backendBestSeller
) {

    if (!prices.length) {
        return null;
    }

    const backendStrings = [];

    collectBackendStrings(
        backendBestDeal,
        backendStrings
    );

    collectBackendStrings(
        backendBestSeller,
        backendStrings
    );


    for (
        const text of backendStrings
    ) {

        const normalized =
            text.toLowerCase();

        const found =
            prices.find(
                item => {

                    const seller =
                        String(
                            item.seller || ""
                        ).toLowerCase();

                    const website =
                        String(
                            item.website || ""
                        ).toLowerCase();

                    return (
                        seller.includes(
                            normalized
                        ) ||
                        normalized.includes(
                            seller
                        ) ||
                        website.includes(
                            normalized
                        ) ||
                        normalized.includes(
                            website
                        )
                    );
                }
            );

        if (found) {
            return found;
        }
    }


    return [...prices].sort(
        (a, b) =>
            a.price - b.price
    )[0];
}


function collectBackendStrings(
    value,
    output
) {

    if (
        value === null ||
        value === undefined
    ) {
        return;
    }

    if (
        typeof value === "string" ||
        typeof value === "number"
    ) {

        const text =
            String(value).trim();

        if (text) {
            output.push(text);
        }

        return;
    }


    if (Array.isArray(value)) {

        value.forEach(
            item =>
                collectBackendStrings(
                    item,
                    output
                )
        );

        return;
    }


    if (
        typeof value === "object"
    ) {

        const keys = [
            "seller",
            "seller_name",
            "sellerName",
            "platform",
            "marketplace",
            "website",
            "store",
            "name"
        ];

        keys.forEach(
            key => {

                if (
                    value[key] !==
                    undefined
                ) {

                    collectBackendStrings(
                        value[key],
                        output
                    );
                }
            }
        );
    }
}


/* =========================================================
   BUY BUTTON
========================================================= */

function configureBuyButton(
    button,
    url
) {

    if (!button) {
        return;
    }

    if (isSafeUrl(url)) {

        button.href =
            url;

        button.target =
            "_blank";

        button.rel =
            "noopener noreferrer";

        button.removeAttribute(
            "aria-disabled"
        );

        button.classList.remove(
            "disabled"
        );

        button.style.pointerEvents =
            "auto";

        button.style.opacity =
            "1";

    } else {

        button.href =
            "#";

        button.removeAttribute(
            "target"
        );

        button.removeAttribute(
            "rel"
        );

        button.setAttribute(
            "aria-disabled",
            "true"
        );

        button.classList.add(
            "disabled"
        );

        button.style.pointerEvents =
            "none";

        button.style.opacity =
            "0.55";
    }
}


/* =========================================================
   OVERALL TRUST
========================================================= */

function getOverallTrust(
    trustAnalysis,
    recommendationData,
    prices
) {

    const directValues = [
        trustAnalysis?.trust_score,
        trustAnalysis?.trustScore,
        trustAnalysis?.overall_score,
        trustAnalysis?.overallScore,
        trustAnalysis?.score,
        recommendationData?.trust_score,
        recommendationData?.trustScore
    ];


    for (
        const value of directValues
    ) {

        const score =
            parseNumber(value);

        if (
            score !== null &&
            score >= 0
        ) {

            return clamp(
                score,
                0,
                100
            );
        }
    }


    const scores =
        prices
            .map(
                item =>
                    parseNumber(
                        item.trust_score
                    )
            )
            .filter(
                value =>
                    value !== null &&
                    value >= 0
            );


    if (scores.length) {

        return clamp(
            scores.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / scores.length,
            0,
            100
        );
    }


    if (prices.length) {

        const fallback =
            prices.map(
                calculateTrust
            );

        return clamp(
            fallback.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / fallback.length,
            0,
            100
        );
    }

    return null;
}


/* =========================================================
   TRUST CALCULATION
========================================================= */

function calculateTrust(item) {

    const backend =
        parseNumber(
            item.trust_score
        );

    if (
        backend !== null &&
        backend >= 0
    ) {

        return clamp(
            backend,
            0,
            100
        );
    }

    let score = 65;

    const rating =
        parseNumber(
            item.rating
        );

    const reviews =
        parseNumber(
            item.review_count
        );

    const match =
        parseNumber(
            item.match_score
        );


    if (rating !== null) {

        score +=
            (rating - 3) * 8;
    }


    if (reviews !== null) {

        if (reviews >= 1000) {
            score += 8;

        } else if (reviews >= 500) {
            score += 6;

        } else if (reviews >= 100) {
            score += 4;

        } else if (reviews < 20) {
            score -= 5;
        }
    }


    if (match !== null) {

        score +=
            (match - 70) * 0.15;
    }


    return clamp(
        score,
        0,
        100
    );
}


function trustLevelFromScore(
    score
) {

    if (
        score === null ||
        score === undefined ||
        Number.isNaN(
            Number(score)
        )
    ) {
        return "Unavailable";
    }

    const value =
        Number(score);

    if (value >= 85) {
        return "Excellent";
    }

    if (value >= 70) {
        return "Good";
    }

    if (value >= 55) {
        return "Fair";
    }

    return "Low";
}


function updateTrustCircle(
    score
) {

    const circle =
        $(".score-circle");

    if (!circle) {
        return;
    }

    const value =
        score === null
            ? 0
            : clamp(
                Number(score),
                0,
                100
            );


    circle.style.setProperty(
        "--trust-progress",
        `${value}%`
    );


    circle.setAttribute(
        "aria-label",
        `Trust score ${formatScore(value)} out of 100`
    );
}


/* =========================================================
   PRICE BARS
========================================================= */

function renderPriceBars(
    prices
) {

    if (!priceBars) {
        return;
    }

    priceBars.innerHTML =
        "";

    if (!prices.length) {
        return;
    }


    const maxPrice =
        Math.max(
            ...prices.map(
                item => item.price
            )
        );

    const minPrice =
        Math.min(
            ...prices.map(
                item => item.price
            )
        );


    const sorted =
        [...prices].sort(
            (a, b) =>
                a.price - b.price
        );


    sorted.forEach(
        item => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "price-bar-item";


            if (
                item.price ===
                minPrice
            ) {

                row.classList.add(
                    "best-price-bar"
                );
            }


            const width =
                maxPrice > 0
                    ? Math.max(
                        5,
                        (
                            item.price /
                            maxPrice
                        ) * 100
                    )
                    : 5;


            row.innerHTML = `
                <div class="price-bar-seller">

                    <div class="price-bar-logo">
                        ${escapeHtml(
                            marketplaceInitial(
                                item.seller
                            )
                        )}
                    </div>

                    <span>
                        ${escapeHtml(
                            item.seller
                        )}
                    </span>

                </div>

                <div class="price-track">

                    <div
                        class="price-fill"
                        style="width:${width}%"
                    ></div>

                </div>

                <div class="price-bar-value">
                    ${formatPrice(
                        item.price
                    )}
                </div>
            `;


            priceBars.appendChild(
                row
            );
        }
    );
}


/* =========================================================
   SELLER ROWS
========================================================= */

function renderSellerRows(
    prices,
    best
) {

    if (!sellerRows) {
        return;
    }

    sellerRows.innerHTML =
        "";

    if (!prices.length) {
        return;
    }


    const lowest =
        Math.min(
            ...prices.map(
                item => item.price
            )
        );


    const sorted =
        getSortedPrices(
            prices
        );


    sorted.forEach(
        (item, index) => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "seller-row";


            if (
                best &&
                item.seller ===
                    best.seller &&
                item.price ===
                    best.price
            ) {

                row.classList.add(
                    "best-row"
                );
            }


            const trust =
                item.trust_score !==
                    null &&
                item.trust_score !==
                    undefined
                    ? item.trust_score
                    : calculateTrust(
                        item
                    );


            const level =
                item.trust_level ||
                trustLevelFromScore(
                    trust
                );


            const ratingText =
                item.rating !==
                    null &&
                item.rating !==
                    undefined
                    ? `★ ${formatNumber(
                        item.rating,
                        1
                    )}`
                    : "Rating unavailable";


            const reviewsText =
                item.review_count !==
                    null &&
                item.review_count !==
                    undefined
                    ? ` • ${formatCompactNumber(
                        item.review_count
                    )} reviews`
                    : "";


            const difference =
                item.price -
                lowest;


            const differenceText =
                difference > 0
                    ? `+${formatPrice(
                        difference
                    )} vs best`
                    : "Best available price";


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
                                item.price ===
                                lowest
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
                                item.website
                            )}
                        </span>

                    </div>

                </div>


                <div class="seller-price">

                    ${formatPrice(
                        item.price
                    )}

                    <span class="price-difference">
                        ${escapeHtml(
                            differenceText
                        )}
                    </span>

                </div>


                <div class="seller-trust">

                    <span class="trust-pill">
                        ${formatScore(
                            trust
                        )}/100
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

                    ${
                        isSafeUrl(
                            item.product_url
                        )
                            ? `
                                <a
                                    class="buy-btn"
                                    href="${escapeAttribute(
                                        item.product_url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Buy
                                </a>
                              `
                            : `
                                <span>
                                    Link unavailable
                                </span>
                              `
                    }

                </div>
            `;


            row.style.animationDelay =
                `${index * 40}ms`;


            sellerRows.appendChild(
                row
            );
        }
    );
}


/* =========================================================
   SORTING
========================================================= */

function getSortedPrices(
    prices
) {

    const sorted =
        [...prices];

    const value =
        sortSelect?.value ||
        "price-asc";


    switch (value) {

        case "price":
        case "price-asc":
        case "lowest":

            return sorted.sort(
                (a, b) =>
                    a.price - b.price
            );


        case "price-desc":
        case "highest":

            return sorted.sort(
                (a, b) =>
                    b.price - a.price
            );


        case "trust-desc":
        case "trust":

            return sorted.sort(
                (a, b) =>
                    getSellerTrust(b) -
                    getSellerTrust(a)
            );


        case "rating-desc":
        case "rating":

            return sorted.sort(
                (a, b) =>
                    (
                        b.rating ??
                        -1
                    ) -
                    (
                        a.rating ??
                        -1
                    )
            );


        case "seller":
        case "seller-name":

            return sorted.sort(
                (a, b) =>
                    String(
                        a.seller
                    ).localeCompare(
                        String(
                            b.seller
                        )
                    )
            );


        default:

            return sorted.sort(
                (a, b) =>
                    a.price - b.price
            );
    }
}


function getSellerTrust(
    item
) {

    const value =
        parseNumber(
            item.trust_score
        );

    return value !== null
        ? value
        : calculateTrust(
            item
        );
}


function handleSortChange() {

    renderSellerRows(
        currentPrices,
        currentBestDeal
    );
}


/* =========================================================
   SMART INSIGHT
========================================================= */

function generateSmartInsight(
    best,
    prices,
    savingsPercent,
    overallTrust
) {

    if (
        !best ||
        !prices.length
    ) {

        return "TrustCart could not generate an insight for this comparison.";
    }


    const trustText =
        overallTrust !== null
            ? ` The overall trust score is ${formatScore(
                overallTrust
            )}/100.`
            : "";


    if (savingsPercent >= 40) {

        return `${best.seller} offers a significantly lower price, with about ${savingsPercent.toFixed(
            1
        )}% potential savings compared with the highest listed price.${trustText}`;
    }


    if (savingsPercent >= 20) {

        return `${best.seller} currently has a strong price advantage, saving about ${savingsPercent.toFixed(
            1
        )}% versus the highest listed offer.${trustText}`;
    }


    if (savingsPercent > 0) {

        return `${best.seller} has the lowest listed price, although the difference between sellers is relatively small.${trustText}`;
    }


    return `${best.seller} currently has the lowest comparable price.${trustText}`;
}


/* =========================================================
   ANALYSIS
========================================================= */

function buildPriceAnalysis(
    prices,
    lowest,
    highest
) {

    if (!prices.length) {
        return "No price information is available.";
    }

    if (
        lowest === highest
    ) {

        return `All compared sellers are currently listed at ${formatPrice(
            lowest
        )}.`;
    }


    return `Prices currently range from ${formatPrice(
        lowest
    )} to ${formatPrice(
        highest
    )} across ${prices.length} seller${
        prices.length === 1
            ? ""
            : "s"
    }.`;
}


function buildSellerAnalysis(
    prices
) {

    if (!prices.length) {
        return "No seller information is available.";
    }

    const trusted =
        prices.filter(
            item =>
                getSellerTrust(
                    item
                ) >= 70
        ).length;


    return `${trusted} of ${prices.length} compared seller${
        prices.length === 1
            ? ""
            : "s"
    } currently have a trust score of 70 or above.`;
}


function buildFreshnessAnalysis(
    prices
) {

    const dates =
        prices
            .map(
                item =>
                    item.updated_at
            )
            .filter(Boolean);


    if (!dates.length) {

        return "Seller update timestamps were not provided by the source.";
    }


    const latest =
        dates
            .map(
                value =>
                    new Date(value)
            )
            .filter(
                date =>
                    !Number.isNaN(
                        date.getTime()
                    )
            )
            .sort(
                (a, b) =>
                    b - a
            )[0];


    if (!latest) {

        return "Seller update timestamps were not available in a usable format.";
    }


    return `Latest available seller data was updated ${formatUpdatedDate(
        latest.toISOString()
    )}.`;
}


/* =========================================================
   RECOMMENDATION
========================================================= */

function extractRecommendation(
    recommendationData,
    best,
    savingsPercent
) {

    const text =
        recommendationData?.reason ||
        recommendationData?.message ||
        recommendationData?.recommendation ||
        recommendationData?.summary ||
        recommendationData?.description;


    if (
        typeof text === "string" &&
        text.trim()
    ) {

        return text.trim();
    }


    if (!best) {

        return "Compare the available sellers before purchasing.";
    }


    if (savingsPercent >= 20) {

        return `TrustCart recommends checking ${best.seller} first because it currently provides the strongest price advantage.`;
    }


    return `TrustCart recommends ${best.seller} as the current best-priced comparable seller.`;
}


/* =========================================================
   DEAL REASON
========================================================= */

function buildDealReason(
    best,
    lowest,
    highest,
    savingsPercent
) {

    if (!best) {
        return "Best comparable offer";
    }


    if (savingsPercent >= 30) {

        return `Lowest price • ${savingsPercent.toFixed(
            1
        )}% below the highest offer`;
    }


    if (
        best.price === lowest
    ) {

        return "Lowest comparable price";
    }


    return "Recommended comparable offer";
}


/* =========================================================
   BUYING TIP
========================================================= */

function buildBuyingTip(
    best,
    prices,
    overallTrust
) {

    if (!best) {

        return "Always verify the final price, delivery charges and seller information before purchasing.";
    }


    const trust =
        getSellerTrust(
            best
        );


    if (trust >= 85) {

        return `${best.seller} combines the current best price with a strong trust score. Still verify the final checkout price before buying.`;
    }


    if (trust >= 70) {

        return `${best.seller} currently has a good trust score and the lowest comparable price. Check delivery, warranty and final checkout charges before buying.`;
    }


    return `${best.seller} has the lowest listed price, but its trust score is lower. Review seller details, ratings, warranty and return policy before purchasing.`;
}


/* =========================================================
   LAST CHECKED
========================================================= */

function updateCheckedTime(
    prices,
    data
) {

    if (!checkedTime) {
        return;
    }


    const dates =
        prices
            .map(
                item =>
                    item.updated_at
            )
            .filter(Boolean)
            .map(
                value =>
                    new Date(value)
            )
            .filter(
                date =>
                    !Number.isNaN(
                        date.getTime()
                    )
            );


    if (dates.length) {

        const latest =
            dates.sort(
                (a, b) =>
                    b - a
            )[0];


        checkedTime.textContent =
            `Last checked ${formatDate(
                latest
            )}`;

        return;
    }


    const stored =
        localStorage.getItem(
            "trustcart_last_compare_time"
        );


    if (stored) {

        const date =
            new Date(stored);

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            checkedTime.textContent =
                `Last checked ${formatDate(
                    date
                )}`;

            return;
        }
    }


    checkedTime.textContent =
        "Comparison completed just now";
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshComparison() {

    const url =
        getSourceProductUrl();


    if (!isSafeUrl(url)) {

        showToast(
            "Original product URL is not available for rechecking."
        );

        return;
    }


    if (refreshBtn) {

        refreshBtn.disabled =
            true;

        refreshBtn.classList.add(
            "loading"
        );
    }


    showLoading();


    try {

        const response =
            await fetch(
                "/api/products/compare",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({
                            url
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.message ||
                data?.error ||
                `Refresh failed (${response.status}).`
            );
        }


        sessionStorage.setItem(
            "trustcart_compare_result",
            JSON.stringify(
                data
            )
        );


        localStorage.setItem(
            "trustcart_last_compare_time",
            new Date().toISOString()
        );


        displayComparisonResults(
            data
        );


        showToast(
            "Comparison refreshed successfully."
        );


    } catch (error) {

        console.error(
            "Refresh failed:",
            error
        );


        showError(
            error.message ||
            "Unable to refresh the comparison."
        );


    } finally {

        if (refreshBtn) {

            refreshBtn.disabled =
                false;

            refreshBtn.classList.remove(
                "loading"
            );
        }
    }
}


function getSourceProductUrl() {

    const product =
        currentProduct ||
        {};


    const candidates = [
        product.product_url,
        product.productUrl,
        product.source_url,
        product.sourceUrl,
        product.url
    ];


    for (
        const value of candidates
    ) {

        if (
            isSafeUrl(value)
        ) {

            return value;
        }
    }


    return "";
}


/* =========================================================
   COPY
========================================================= */

async function copyComparison() {

    if (!currentPrices.length) {

        showToast(
            "There is no comparison data to copy."
        );

        return;
    }


    const product =
        currentProduct?.product_name ||
        currentProduct?.name ||
        currentProduct?.title ||
        "Product";


    const best =
        currentBestDeal;


    const trust =
        getOverallTrust(
            currentComparison?.trust_analysis ||
            currentComparison?.trustAnalysis ||
            {},
            currentComparison?.recommendation ||
            {},
            currentPrices
        );


    const cheapest =
        Math.min(
            ...currentPrices.map(
                item => item.price
            )
        );


    const highest =
        Math.max(
            ...currentPrices.map(
                item => item.price
            )
        );


    const savingsPercent =
        highest > 0
            ? (
                (
                    highest -
                    cheapest
                ) /
                highest
            ) * 100
            : 0;


    const text = [
        "TrustCart Comparison",
        "",
        `Product: ${product}`,
        `Best Seller: ${
            best?.seller ||
            "Unavailable"
        }`,
        `Best Price: ${
            best
                ? formatPrice(
                    best.price
                )
                : "Unavailable"
        }`,
        `Savings: ${savingsPercent.toFixed(
            1
        )}%`,
        `Sellers Compared: ${
            currentPrices.length
        }`,
        `Trust Score: ${
            trust !== null
                ? `${formatScore(
                    trust
                )}/100`
                : "Unavailable"
        }`,
        "",
        "Compared using TrustCart."
    ].join("\n");


    try {

        await navigator.clipboard.writeText(
            text
        );


        showToast(
            "Comparison copied to clipboard."
        );


    } catch (error) {

        console.error(
            "Clipboard failed:",
            error
        );


        showToast(
            "Unable to copy comparison."
        );
    }
}


/* =========================================================
   SHARE
========================================================= */

async function shareComparison() {

    const product =
        currentProduct?.product_name ||
        currentProduct?.name ||
        currentProduct?.title ||
        "Product";


    const best =
        currentBestDeal;


    const text =
        best
            ? `TrustCart found ${best.seller} with the best comparable price of ${formatPrice(
                best.price
            )} for ${product}.`
            : `Check this comparison on TrustCart for ${product}.`;


    if (
        navigator.share
    ) {

        try {

            await navigator.share({
                title:
                    `TrustCart - ${product}`,

                text,

                url:
                    window.location.href
            });

            return;

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {
                return;
            }
        }
    }


    await copyComparison();
}


/* =========================================================
   PRICE ALERT
========================================================= */

function getAlertStorageKey() {

    return `trustcart-alert-${
        currentProductId ||
        "current"
    }`;
}


function loadExistingAlert() {

    const stored =
        localStorage.getItem(
            getAlertStorageKey()
        );


    if (!stored) {

        updateAlertButton(
            false
        );

        return;
    }


    try {

        const alertData =
            JSON.parse(
                stored
            );


        if (
            alertData &&
            alertData.targetPrice !==
                undefined
        ) {

            if (alertPrice) {

                alertPrice.value =
                    alertData.targetPrice;
            }


            if (
                existingAlertStatus
            ) {

                existingAlertStatus.textContent =
                    `Active alert: target price ₹${alertData.targetPrice}.`;

                existingAlertStatus.style.display =
                    "block";
            }


            updateAlertButton(
                true
            );
        }


    } catch {

        localStorage.removeItem(
            getAlertStorageKey()
        );

        updateAlertButton(
            false
        );
    }
}


function openAlertModal() {

    if (!alertModal) {
        return;
    }


    lastFocusedElement =
        document.activeElement;


    loadExistingAlert();


    alertModal.classList.add(
        "active"
    );


    alertModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";


    setTimeout(
        () => {

            if (alertPrice) {
                alertPrice.focus();
            }

        },
        100
    );
}


function closeAlertModal() {

    if (!alertModal) {
        return;
    }


    alertModal.classList.remove(
        "active"
    );


    alertModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";


    if (
        lastFocusedElement &&
        typeof lastFocusedElement.focus ===
            "function"
    ) {

        lastFocusedElement.focus();
    }
}


function savePriceAlert() {

    const input =
        alertPrice ||
        targetPriceFallback;


    if (!input) {
        return;
    }


    const target =
        parsePrice(
            input.value
        );


    if (
        target === null ||
        target <= 0
    ) {

        showAlertMessage(
            "Please enter a valid target price."
        );

        return;
    }


    const alertData = {

        targetPrice:
            target,

        productId:
            currentProductId,

        productName:
            currentProduct?.product_name ||
            currentProduct?.name ||
            currentProduct?.title ||
            "Product",

        createdAt:
            new Date().toISOString()
    };


    localStorage.setItem(
        getAlertStorageKey(),
        JSON.stringify(
            alertData
        )
    );


    updateAlertButton(
        true
    );


    if (
        existingAlertStatus
    ) {

        existingAlertStatus.textContent =
            `Active alert: target price ₹${formatNumber(
                target,
                0
            )}.`;

        existingAlertStatus.style.display =
            "block";
    }


    showAlertMessage(
        "Price alert saved in this browser."
    );


    showToast(
        "Price alert saved."
    );


    setTimeout(
        closeAlertModal,
        900
    );
}


function deletePriceAlert() {

    localStorage.removeItem(
        getAlertStorageKey()
    );


    updateAlertButton(
        false
    );


    if (alertPrice) {
        alertPrice.value =
            "";
    }


    if (
        existingAlertStatus
    ) {

        existingAlertStatus.textContent =
            "";

        existingAlertStatus.style.display =
            "none";
    }


    showAlertMessage(
        "Price alert removed."
    );


    showToast(
        "Price alert removed."
    );
}


function updateAlertButton(
    active
) {

    if (!alertBtn) {
        return;
    }


    if (active) {

        alertBtn.textContent =
            "Price Alert Active";

        alertBtn.classList.add(
            "alert-active"
        );

        alertBtn.setAttribute(
            "aria-label",
            "Update price alert"
        );

    } else {

        alertBtn.textContent =
            "Set Price Alert";

        alertBtn.classList.remove(
            "alert-active"
        );

        alertBtn.setAttribute(
            "aria-label",
            "Set price alert"
        );
    }
}


function showAlertMessage(
    message
) {

    if (alertMessage) {
        alertMessage.textContent =
            message;
    }
}


/* =========================================================
   MODAL
========================================================= */

function handleModalBackdropClick(
    event
) {

    if (
        alertModal &&
        event.target ===
            alertModal
    ) {

        closeAlertModal();
    }
}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;


function showToast(
    message
) {

    let toast =
        $(".toast");


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.className =
            "toast";

        toast.setAttribute(
            "role",
            "status"
        );

        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2800
        );
}


/* =========================================================
   FORMATTING
========================================================= */

function formatPrice(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {
        return "₹—";
    }


    return new Intl.NumberFormat(
        "en-IN",
        {
            style:
                "currency",

            currency:
                "INR",

            maximumFractionDigits:
                0
        }
    ).format(number);
}


function formatNumber(
    value,
    decimals = 0
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {
        return "—";
    }


    return number.toFixed(
        decimals
    );
}


function formatScore(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {
        return "—";
    }


    return Number.isInteger(
        number
    )
        ? String(number)
        : number.toFixed(1);
}


function formatCompactNumber(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {
        return "—";
    }


    if (
        number >= 1000000
    ) {

        return `${(
            number /
            1000000
        ).toFixed(1)}M`;
    }


    if (
        number >= 1000
    ) {

        return `${(
            number /
            1000
        ).toFixed(1)}K`;
    }


    return String(
        Math.round(
            number
        )
    );
}


function formatDate(
    value
) {

    const date =
        value instanceof Date
            ? value
            : new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "recently";
    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            dateStyle:
                "medium",

            timeStyle:
                "short"
        }
    ).format(date);
}


function formatUpdatedDate(
    value
) {

    if (!value) {
        return "Update time unavailable";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return formatDate(
        date
    );
}


/* =========================================================
   SELLER HELPERS
========================================================= */

function cleanSellerName(
    value
) {

    const text =
        String(
            value || ""
        ).trim();


    if (!text) {
        return "Seller";
    }


    const lower =
        text.toLowerCase();


    if (
        lower.includes(
            "amazon"
        )
    ) {
        return "Amazon";
    }


    if (
        lower.includes(
            "flipkart"
        )
    ) {
        return "Flipkart";
    }


    if (
        lower.includes(
            "croma"
        )
    ) {
        return "Croma";
    }


    if (
        lower.includes(
            "reliance"
        )
    ) {
        return "Reliance Digital";
    }


    if (
        lower.includes(
            "myntra"
        )
    ) {
        return "Myntra";
    }


    if (
        lower.includes(
            "meesho"
        )
    ) {
        return "Meesho";
    }


    if (
        lower.includes(
            "snapdeal"
        )
    ) {
        return "Snapdeal";
    }


    return text;
}


function cleanWebsiteName(
    value
) {

    return cleanSellerName(
        value
    );
}


function marketplaceInitial(
    seller
) {

    const name =
        cleanSellerName(
            seller
        );


    const lower =
        name.toLowerCase();


    if (
        lower.includes(
            "amazon"
        )
    ) {
        return "A";
    }


    if (
        lower.includes(
            "flipkart"
        )
    ) {
        return "F";
    }


    if (
        lower.includes(
            "reliance"
        )
    ) {
        return "R";
    }


    if (
        lower.includes(
            "croma"
        )
    ) {
        return "C";
    }


    if (
        lower.includes(
            "myntra"
        )
    ) {
        return "M";
    }


    if (
        lower.includes(
            "meesho"
        )
    ) {
        return "M";
    }


    return (
        name
            .replace(
                /[^a-zA-Z0-9]/g,
                ""
            )
            .charAt(0)
            .toUpperCase() ||
        "S"
    );
}


/* =========================================================
   GENERIC HELPERS
========================================================= */

function parseNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    const number =
        Number(
            String(value)
                .replace(
                    /[^\d.-]/g,
                    ""
                )
        );


    return Number.isFinite(number)
        ? number
        : null;
}


function clamp(
    value,
    min,
    max
) {

    return Math.min(
        max,
        Math.max(
            min,
            Number(value)
        )
    );
}


/* =========================================================
   EVENTS
========================================================= */

function initializeEvents() {


    /* Theme */

    if (themeToggle) {

        themeToggle.addEventListener(
            "click",
            toggleTheme
        );
    }


    /* Sorting */

    if (sortSelect) {

        sortSelect.addEventListener(
            "change",
            handleSortChange
        );
    }


    /* Refresh */

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            refreshComparison
        );
    }


    /* Copy */

    if (copyBtn) {

        copyBtn.addEventListener(
            "click",
            copyComparison
        );
    }


    /* Share */

    if (shareBtn) {

        shareBtn.addEventListener(
            "click",
            shareComparison
        );
    }


    /* Retry */

    if (retryBtn) {

        retryBtn.addEventListener(
            "click",
            loadComparison
        );
    }


    /* Price alert */

    if (alertBtn) {

        alertBtn.addEventListener(
            "click",
            openAlertModal
        );
    }


    if (alertClose) {

        alertClose.addEventListener(
            "click",
            closeAlertModal
        );
    }


    if (closeModalFallback) {

        closeModalFallback.addEventListener(
            "click",
            closeAlertModal
        );
    }


    if (alertCancel) {

        alertCancel.addEventListener(
            "click",
            closeAlertModal
        );
    }


    if (alertSave) {

        alertSave.addEventListener(
            "click",
            savePriceAlert
        );
    }


    if (saveAlertFallback) {

        saveAlertFallback.addEventListener(
            "click",
            savePriceAlert
        );
    }


    /* Modal */

    if (alertModal) {

        alertModal.addEventListener(
            "click",
            handleModalBackdropClick
        );
    }


    /* Keyboard */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                if (
                    alertModal?.classList.contains(
                        "active"
                    )
                ) {

                    closeAlertModal();
                }
            }
        }
    );


    /* Enter in alert */

    if (alertPrice) {

        alertPrice.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    savePriceAlert();
                }
            }
        );
    }
}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initializeTheme();

        initializeEvents();

        await loadCurrentUser();

        await loadComparison();
    }
);