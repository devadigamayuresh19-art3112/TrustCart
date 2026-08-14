/* =========================================
   TRUSTCART LOGIN JAVASCRIPT
   ========================================= */


/* =========================================
   MOUSE FOLLOWING GLOW
   ========================================= */

const mouseGlow = document.querySelector(".mouse-glow");

document.addEventListener("mousemove", function (event) {

    mouseGlow.style.left = event.clientX + "px";
    mouseGlow.style.top = event.clientY + "px";

});


/* =========================================
   PASSWORD SHOW / HIDE
   ========================================= */

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


/* =========================================
   LOGIN FORM
   ========================================= */

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const passwordValue = password.value.trim();

    if (email === "" || passwordValue === "") {

        alert("Please fill in all fields.");

        return;
    }

    /*
       Firebase authentication will be added later.
    */

    alert("Login successful! Authentication will be connected later.");

});


/* =========================================
   SOCIAL BUTTONS
   ========================================= */

const googleButton = document.querySelector(".google-btn");
const facebookButton = document.querySelector(".facebook-btn");

googleButton.addEventListener("click", function () {

    alert("Google login will be connected later.");

});

facebookButton.addEventListener("click", function () {

    alert("Facebook login will be connected later.");

});


/* =========================================
   FORGOT PASSWORD
   ========================================= */

const forgotPassword = document.querySelector(".forgot");

forgotPassword.addEventListener("click", function (event) {

    event.preventDefault();

    alert("Password recovery will be connected later.");

});