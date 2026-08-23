const sections = document.querySelectorAll(".page-section");
const navItems = document.querySelectorAll(".nav-item");
const mobileItems = document.querySelectorAll(".mobile-nav a");

const themeToggle = document.getElementById("themeToggle");
const darkModeSwitch = document.getElementById("darkModeSwitch");

const notificationBtn = document.getElementById("notificationBtn");
const notificationSwitch = document.getElementById("notificationSwitch");

const compareBtn = document.getElementById("compareBtn");
const startCompareBtn = document.getElementById("startCompareBtn");

const productUrl = document.getElementById("productUrl");
const editProfileBtn = document.getElementById("editProfileBtn");
const accountBtn = document.getElementById("accountBtn");


/* =========================
   SECTION NAVIGATION
========================= */

function switchSection(sectionId) {
    const selected = document.getElementById(sectionId);

    if (!selected) return;

    sections.forEach(section => {
        section.classList.remove("active-section");
    });

    selected.classList.add("active-section");

    navItems.forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.section === sectionId
        );
    });

    mobileItems.forEach(item => {
        item.classList.toggle(
            "mobile-active",
            item.dataset.section === sectionId
        );
    });

    if (window.location.hash !== `#${sectionId}`) {
        history.replaceState(null, "", `#${sectionId}`);
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* SIDEBAR */

navItems.forEach(item => {
    item.addEventListener("click", event => {
        event.preventDefault();
        switchSection(item.dataset.section);
    });
});


/* MOBILE */

mobileItems.forEach(item => {
    item.addEventListener("click", event => {
        event.preventDefault();
        switchSection(item.dataset.section);
    });
});


/* =========================
   DARK MODE
========================= */

function setDarkMode(enabled) {
    document.body.classList.toggle("dark", enabled);

    localStorage.setItem(
        "trustcart-theme",
        enabled ? "dark" : "light"
    );

    themeToggle.textContent = enabled ? "☀" : "☾";

    darkModeSwitch.classList.toggle(
        "active",
        enabled
    );
}


function toggleDarkMode() {
    const enabled = !document.body.classList.contains("dark");
    setDarkMode(enabled);
}


themeToggle.addEventListener(
    "click",
    toggleDarkMode
);


darkModeSwitch.addEventListener(
    "click",
    toggleDarkMode
);


/* LOAD THEME */

const savedTheme =
    localStorage.getItem("trustcart-theme");

setDarkMode(savedTheme === "dark");


/* =========================
   NOTIFICATIONS
========================= */

notificationBtn.addEventListener("click", () => {
    alert("You have no new notifications.");
});


notificationSwitch.addEventListener("click", () => {
    notificationSwitch.classList.toggle("active");

    const enabled =
        notificationSwitch.classList.contains("active");

    localStorage.setItem(
        "trustcart-notifications",
        enabled ? "on" : "off"
    );
});


/* LOAD NOTIFICATION SETTING */

const savedNotifications =
    localStorage.getItem("trustcart-notifications");

if (savedNotifications === "off") {
    notificationSwitch.classList.remove("active");
}


/* =========================
   PRODUCT COMPARISON
========================= */

function startComparison() {
    const url = productUrl.value.trim();

    if (!url) {
        alert("Please enter a product URL.");
        productUrl.focus();
        return;
    }

    try {
        new URL(url);
    } catch {
        alert("Please enter a valid product URL.");
        productUrl.focus();
        return;
    }

    alert(
        "Product comparison will be connected to the TrustCart backend next."
    );
}


compareBtn.addEventListener(
    "click",
    startComparison
);


startCompareBtn.addEventListener(
    "click",
    () => {
        switchSection("dashboard");
        productUrl.focus();
    }
);


/* ENTER KEY */

productUrl.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        startComparison();
    }
});


/* =========================
   EDIT PROFILE
========================= */

editProfileBtn.addEventListener("click", () => {
    alert(
        "Profile editing will be connected to PostgreSQL next."
    );
});


/* =========================
   ACCOUNT
========================= */

accountBtn.addEventListener("click", () => {
    switchSection("profile");
});


/* =========================
   PRODUCT RESULTS
========================= */

document
    .querySelectorAll(".view-result")
    .forEach(button => {

        button.addEventListener("click", () => {

            alert(
                "Product results will be connected to the comparison system."
            );

        });

    });


/* =========================
   HASH NAVIGATION
========================= */

function loadHashSection() {

    const hash =
        window.location.hash.substring(1);

    if (hash && document.getElementById(hash)) {
        switchSection(hash);
    } else {
        switchSection("dashboard");
    }
}


window.addEventListener(
    "load",
    loadHashSection
);


window.addEventListener(
    "hashchange",
    loadHashSection
);