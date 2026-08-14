/* =========================================
   TRUSTCART SIGNUP JAVASCRIPT
   ========================================= */


/* =========================================
   MOUSE GLOW
   ========================================= */

const mouseGlow = document.querySelector(".mouse-glow");

document.addEventListener("mousemove", function (event) {

    mouseGlow.style.left = event.clientX + "px";
    mouseGlow.style.top = event.clientY + "px";

});


/* =========================================
   PASSWORD
   ========================================= */

const password = document.getElementById("password");

const passwordToggle =
    document.getElementById("passwordToggle");

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
   PASSWORD STRENGTH
   ========================================= */

const strengthBar =
    document.getElementById("strengthBar");

const strengthText =
    document.getElementById("strengthText");


password.addEventListener("input", function () {

    const value = password.value;

    let strength = 0;


    if (value.length >= 8) {
        strength++;
    }

    if (/[A-Z]/.test(value)) {
        strength++;
    }

    if (/[a-z]/.test(value)) {
        strength++;
    }

    if (/[0-9]/.test(value)) {
        strength++;
    }

    if (/[^A-Za-z0-9]/.test(value)) {
        strength++;
    }


    if (strength === 0) {

        strengthBar.style.width = "0%";

        strengthText.textContent =
            "Password strength";

    }

    else if (strength <= 2) {

        strengthBar.style.width = "30%";

        strengthText.textContent =
            "Weak password";

    }

    else if (strength === 3) {

        strengthBar.style.width = "55%";

        strengthText.textContent =
            "Medium password";

    }

    else if (strength === 4) {

        strengthBar.style.width = "80%";

        strengthText.textContent =
            "Strong password";

    }

    else {

        strengthBar.style.width = "100%";

        strengthText.textContent =
            "Very strong password";

    }

});


/* =========================================
   SIGNUP FORM
   ========================================= */

const signupForm =
    document.getElementById("signupForm");

const confirmPassword =
    document.getElementById("confirmPassword");


signupForm.addEventListener("submit", function (event) {

    event.preventDefault();


    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const passwordValue =
        password.value;

    const confirmPasswordValue =
        confirmPassword.value;

    const terms =
        document.getElementById("terms").checked;


    /* Empty fields */

    if (
        name === "" ||
        email === "" ||
        passwordValue === "" ||
        confirmPasswordValue === ""
    ) {

        alert("Please fill in all fields.");

        return;
    }


    /* Password length */

    if (passwordValue.length < 8) {

        alert(
            "Password must contain at least 8 characters."
        );

        return;
    }


    /* Confirm password */

    if (passwordValue !== confirmPasswordValue) {

        alert(
            "Passwords do not match."
        );

        return;
    }


    /* Terms */

    if (!terms) {

        alert(
            "Please accept the Terms & Conditions."
        );

        return;
    }


    /*
       Firebase authentication will be added later.
    */

    alert(
        "Account created successfully! Authentication will be connected later."
    );

});


/* =========================================
   GOOGLE
   ========================================= */

const googleButton =
    document.querySelector(".google-btn");

googleButton.addEventListener("click", function () {

    alert(
        "Google authentication will be connected later."
    );

});


/* =========================================
   FACEBOOK
   ========================================= */

const facebookButton =
    document.querySelector(".facebook-btn");

facebookButton.addEventListener("click", function () {

    alert(
        "Facebook authentication will be connected later."
    );

});