const mouseGlow = document.querySelector(".mouse-glow");

document.addEventListener("mousemove", function (event) {
    mouseGlow.style.left = event.clientX + "px";
    mouseGlow.style.top = event.clientY + "px";
});

const password = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");

passwordToggle.addEventListener("click", function () {
    if (password.type === "password") {
        password.type = "text";
        passwordToggle.textContent = "🙈";
    } else {
        password.type = "password";
        passwordToggle.textContent = "👁";
    }
});

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const passwordValue = password.value;

    if (!email || !passwordValue) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: passwordValue
            })
        });

        const data = await response.json();

        if (data.success) {
            alert("Login successful!");
            window.location.href = "dashboard.html";
        } else {
            alert(data.message);
        }

    } catch (error) {
        console.error(error);
        alert("Unable to connect to the server.");
    }
});

document.querySelector(".google-btn").addEventListener("click", function () {
    alert("Google login will be connected later.");
});

document.querySelector(".facebook-btn").addEventListener("click", function () {
    alert("Facebook login will be connected later.");
});

document.querySelector(".forgot").addEventListener("click", function (event) {
    event.preventDefault();
    alert("Password recovery will be connected later.");
});