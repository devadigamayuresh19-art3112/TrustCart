/* =========================================
   TRUSTCART - LOGIN JAVASCRIPT
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("TrustCart: login.js loaded successfully.");


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
        document.getElementById("loginBackgroundVideo");

    if (backgroundVideo) {

        backgroundVideo.muted = true;
        backgroundVideo.autoplay = true;
        backgroundVideo.loop = true;
        backgroundVideo.playsInline = true;

        function playBackgroundVideo() {

            backgroundVideo.play().catch(function (error) {

                console.warn(
                    "TrustCart: Background video autoplay was blocked.",
                    error
                );

            });

        }

        playBackgroundVideo();

        backgroundVideo.addEventListener(
            "loadeddata",
            function () {

                console.log(
                    "TrustCart: Background video loaded successfully."
                );

                playBackgroundVideo();
            }
        );

        backgroundVideo.addEventListener(
            "canplay",
            function () {
                playBackgroundVideo();
            }
        );

        backgroundVideo.addEventListener(
            "error",
            function () {

                console.error(
                    "TrustCart: Background video failed to load."
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
       PASSWORD SHOW / HIDE
       ========================================= */

    const passwordInput =
        document.getElementById("password");

    const passwordToggle =
        document.getElementById("passwordToggle");

    if (passwordInput && passwordToggle) {

        passwordToggle.addEventListener(
            "click",
            function () {

                if (passwordInput.type === "password") {

                    passwordInput.type = "text";

                    passwordToggle.textContent = "🙈";

                    passwordToggle.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    passwordInput.type = "password";

                    passwordToggle.textContent = "👁";

                    passwordToggle.setAttribute(
                        "aria-label",
                        "Show password"
                    );
                }

            }
        );
    }


    /* =========================================
       LOGIN FORM
       ========================================= */

    const loginForm =
        document.getElementById("loginForm");

    const loginButton =
        document.getElementById("loginButton");


    if (!loginForm) {

        console.error(
            "TrustCart: #loginForm not found."
        );

        return;
    }


    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            /* -------------------------------------
               GET INPUTS
               ------------------------------------- */

            const emailInput =
                document.getElementById("email");

            const passwordField =
                document.getElementById("password");


            if (!emailInput || !passwordField) {

                console.error(
                    "TrustCart: Email or password field missing."
                );

                alert(
                    "Login form is not configured correctly."
                );

                return;
            }


            const email =
                emailInput.value.trim();

            const password =
                passwordField.value;


            /* -------------------------------------
               VALIDATION
               ------------------------------------- */

            if (!email || !password) {

                alert(
                    "Please enter your email and password."
                );

                return;
            }


            /* -------------------------------------
               SAVE ORIGINAL BUTTON
               ------------------------------------- */

            let originalButtonHTML = "";

            if (loginButton) {

                originalButtonHTML =
                    loginButton.innerHTML;

                loginButton.disabled = true;

                loginButton.style.opacity = "0.7";

                loginButton.style.cursor =
                    "not-allowed";

                loginButton.innerHTML =
                    `
                    <span>LOGGING IN...</span>
                    <span class="arrow">→</span>
                    `;
            }


            try {

                console.log(
                    "TrustCart: Sending login request..."
                );


                /* =================================
                   SEND LOGIN REQUEST
                   ================================= */

                const response =
                    await fetch(
                        "/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                email: email,
                                password: password
                            }),

                            credentials: "same-origin"
                        }
                    );


                console.log(
                    "TrustCart: Login response status:",
                    response.status
                );

                console.log(
                    "TrustCart: Final response URL:",
                    response.url
                );


                /* =================================
                   READ RESPONSE TYPE
                   ================================= */

                const contentType =
                    response.headers.get(
                        "content-type"
                    ) || "";


                /* =================================
                   JSON RESPONSE
                   ================================= */

                if (
                    contentType.includes(
                        "application/json"
                    )
                ) {

                    const data =
                        await response.json();

                    console.log(
                        "TrustCart: Login response:",
                        data
                    );


                    /* -----------------------------
                       SUCCESS
                       ----------------------------- */

                    if (
                        response.ok &&
                        data &&
                        (
                            data.success === true ||
                            data.success === "true"
                        )
                    ) {

                        console.log(
                            "TrustCart: Login successful."
                        );

                        window.location.href =
                            "/dashboard";

                        return;
                    }


                    /* -----------------------------
                       FAILURE
                       ----------------------------- */

                    alert(
                        data?.message ||
                        "Invalid email or password."
                    );

                    return;
                }


                /* =================================
                   NON-JSON RESPONSE
                   ================================= */

                const responseText =
                    await response.text();

                console.log(
                    "TrustCart: Non-JSON server response."
                );

                console.log(
                    "TrustCart: Response URL:",
                    response.url
                );


                /* =================================
                   SUCCESSFUL REDIRECT / HTML
                   ================================= */

                if (response.ok) {

                    /*
                     * If Flask redirected the request
                     * or returned the dashboard page,
                     * treat it as successful login.
                     */

                    if (
                        response.url.includes(
                            "/dashboard"
                        )
                    ) {

                        window.location.href =
                            "/dashboard";

                        return;
                    }


                    /*
                     * Some Flask routes return the
                     * login page again when credentials
                     * are invalid.
                     */

                    if (
                        response.url.includes(
                            "/login"
                        ) &&
                        responseText.includes(
                            "Invalid"
                        )
                    ) {

                        alert(
                            "Invalid email or password."
                        );

                        return;
                    }


                    /*
                     * Otherwise check whether the
                     * response looks like dashboard HTML.
                     */

                    if (
                        responseText.includes(
                            "dashboard"
                        ) ||
                        responseText.includes(
                            "Dashboard"
                        )
                    ) {

                        window.location.href =
                            "/dashboard";

                        return;
                    }
                }


                /* =================================
                   SERVER ERROR
                   ================================= */

                console.error(
                    "TrustCart: Server returned:",
                    responseText
                );

                alert(
                    "Login failed. Please check your email and password."
                );


            } catch (error) {

                console.error(
                    "TrustCart: Login request failed:",
                    error
                );

                alert(
                    "Unable to connect to the server. Please make sure Flask is running."
                );


            } finally {

                /* =================================
                   RESTORE BUTTON
                   ================================= */

                if (loginButton) {

                    loginButton.disabled = false;

                    loginButton.style.opacity = "";

                    loginButton.style.cursor =
                        "pointer";

                    loginButton.innerHTML =
                        originalButtonHTML;
                }
            }

        }
    );


    /* =========================================
       GOOGLE LOGIN
       ========================================= */

    const googleButton =
        document.querySelector(".google-btn");

    if (googleButton) {

        googleButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                window.location.href = "/auth/google";

            }
        );
    }


    /* =========================================
       FACEBOOK LOGIN
       ========================================= */

    const facebookButton =
        document.querySelector(".facebook-btn");

    if (facebookButton) {

        facebookButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                window.location.href = "/auth/facebook";

            }
        );
    }


    /* =========================================
       FORGOT PASSWORD
       ========================================= */

    const forgotButton =
        document.querySelector(".forgot");

    if (forgotButton) {

        forgotButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                alert(
                    "Password recovery will be connected later."
                );

            }
        );
    }

});