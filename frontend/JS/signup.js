/* =========================================
   TRUSTCART — SIGNUP
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       MOUSE GLOW
       ========================================= */

    const mouseGlow = document.querySelector(".mouse-glow");

    if (mouseGlow) {

        document.addEventListener("mousemove", function (event) {

            mouseGlow.style.left = event.clientX + "px";
            mouseGlow.style.top = event.clientY + "px";

        });

    }


    /* =========================================
       BACKGROUND VIDEO
       ========================================= */

    const backgroundVideo =
        document.getElementById("signupBackgroundVideo");

    if (backgroundVideo) {

        backgroundVideo.muted = true;
        backgroundVideo.autoplay = true;
        backgroundVideo.loop = true;
        backgroundVideo.playsInline = true;

        function playBackgroundVideo() {

            backgroundVideo.play().catch(function (error) {

                console.warn(
                    "TrustCart: Signup background video autoplay blocked.",
                    error
                );

            });

        }

        playBackgroundVideo();


        backgroundVideo.addEventListener(
            "loadeddata",
            function () {

                console.log(
                    "TrustCart: Signup background video loaded."
                );

                playBackgroundVideo();

            }
        );


        backgroundVideo.addEventListener(
            "error",
            function () {

                console.error(
                    "TrustCart: Signup background video failed to load."
                );

            }
        );


        document.addEventListener(
            "visibilitychange",
            function () {

                if (
                    document.visibilityState === "visible" &&
                    backgroundVideo.paused
                ) {
                    playBackgroundVideo();
                }

            }
        );

    }


    /* =========================================
       PASSWORD TOGGLE
       ========================================= */

    const password =
        document.getElementById("password");

    const passwordToggle =
        document.getElementById("passwordToggle");

    if (password && passwordToggle) {

        passwordToggle.addEventListener(
            "click",
            function () {

                if (password.type === "password") {

                    password.type = "text";

                    passwordToggle.textContent = "🙈";

                } else {

                    password.type = "password";

                    passwordToggle.textContent = "👁";

                }

            }
        );

    }


    /* =========================================
       PASSWORD STRENGTH
       ========================================= */

    const strengthBar =
        document.getElementById("strengthBar");

    const strengthText =
        document.getElementById("strengthText");


    if (password && strengthBar && strengthText) {

        password.addEventListener(
            "input",
            function () {

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

                } else if (strength <= 2) {

                    strengthBar.style.width = "30%";

                    strengthText.textContent =
                        "Weak password";

                } else if (strength === 3) {

                    strengthBar.style.width = "55%";

                    strengthText.textContent =
                        "Medium password";

                } else if (strength === 4) {

                    strengthBar.style.width = "80%";

                    strengthText.textContent =
                        "Strong password";

                } else {

                    strengthBar.style.width = "100%";

                    strengthText.textContent =
                        "Very strong password";

                }

            }
        );

    }


    /* =========================================
       SIGNUP FORM
       ========================================= */

    const signupForm =
        document.getElementById("signupForm");

    const confirmPassword =
        document.getElementById("confirmPassword");


    if (signupForm && password && confirmPassword) {

        signupForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const name =
                    document.getElementById("name")
                        .value
                        .trim();

                const email =
                    document.getElementById("email")
                        .value
                        .trim();

                const passwordValue =
                    password.value;

                const confirmPasswordValue =
                    confirmPassword.value;

                const terms =
                    document.getElementById("terms")
                        .checked;


                if (
                    !name ||
                    !email ||
                    !passwordValue ||
                    !confirmPasswordValue
                ) {

                    alert(
                        "Please fill in all fields."
                    );

                    return;
                }


                if (passwordValue.length < 8) {

                    alert(
                        "Password must contain at least 8 characters."
                    );

                    return;
                }


                if (
                    passwordValue !==
                    confirmPasswordValue
                ) {

                    alert(
                        "Passwords do not match."
                    );

                    return;
                }


                if (!terms) {

                    alert(
                        "Please accept the Terms & Conditions."
                    );

                    return;
                }


                try {

                    const response =
                        await fetch(
                            "/signup",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({
                                    name: name,
                                    email: email,
                                    password:
                                        passwordValue
                                })
                            }
                        );


                    const data =
                        await response.json();


                    if (data.success) {

                        alert(
                            "Account created successfully!"
                        );

                        window.location.href =
                            "login.html";

                    } else {

                        alert(
                            data.message ||
                            "Unable to create account."
                        );

                    }

                } catch (error) {

                    console.error(
                        "TrustCart signup error:",
                        error
                    );

                    alert(
                        "Unable to connect to the server."
                    );

                }

            }
        );

    }


    /* =========================================
       GOOGLE BUTTON
       ========================================= */

    const googleButton =
        document.querySelector(".google-btn");

    if (googleButton) {

        googleButton.addEventListener(
            "click",
            function () {

                alert(
                    "Google authentication will be connected later."
                );

            }
        );

    }


    /* =========================================
       FACEBOOK BUTTON
       ========================================= */

    const facebookButton =
        document.querySelector(".facebook-btn");

    if (facebookButton) {

        facebookButton.addEventListener(
            "click",
            function () {

                alert(
                    "Facebook authentication will be connected later."
                );

            }
        );

    }


    console.log(
        "TrustCart: signup.js loaded successfully."
    );

});