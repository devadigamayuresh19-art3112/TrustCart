import * as THREE from "three";

/* =========================================================
   TRUSTCART — 3D INTRO EXPERIENCE (ENHANCED UI/UX)
   ========================================================= */

const container =
    document.getElementById("introThreeScene");

const visualFrame =
    document.getElementById("visualFrame");

const loader =
    document.getElementById("sceneLoader") ||
    document.getElementById("introLoader");


/* =========================================================
   SAFETY CHECK
   ========================================================= */

if (!container) {

    console.error(
        "TrustCart: #introThreeScene not found."
    );

} else {


    /* =====================================================
       3D CURSOR TILT EFFECT FOR VISUAL FRAME
       ===================================================== */

    if (visualFrame) {
        visualFrame.addEventListener("mousemove", (e) => {
            const rect = visualFrame.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const xc = rect.width / 2;
            const yc = rect.height / 2;
            
            const dx = (x - xc) / xc;
            const dy = (y - yc) / yc;
            
            visualFrame.style.transform = `perspective(1000px) rotateY(${dx * 6}deg) rotateX(${-dy * 6}deg) translateZ(10px)`;
        });

        visualFrame.addEventListener("mouseleave", () => {
            visualFrame.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg) translateZ(0px)";
            visualFrame.style.transition = "transform 0.5s ease-out";
        });

        visualFrame.addEventListener("mouseenter", () => {
            visualFrame.style.transition = "transform 0.1s ease-out";
        });
    }


    /* =====================================================
       MOTION PREFERENCE
       ===================================================== */

    const prefersReducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

    const motionScale =
        prefersReducedMotion ? 0.25 : 1;


    /* =====================================================
       SCENE
       ===================================================== */

    const scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x010d0b
        );

    scene.fog =
        new THREE.Fog(
            0x010d0b,
            22,
            45
        );


    /* =====================================================
       CAMERA
       ===================================================== */

    const camera =
        new THREE.PerspectiveCamera(
            30,
            1,
            0.1,
            100
        );

    camera.position.set(
        0,
        0,
        11.5
    );


    /* =====================================================
       RENDERER
       ===================================================== */

    const renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference:
                "high-performance"
        });

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
        1.25;

    renderer.shadowMap.enabled =
        !prefersReducedMotion;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );

    renderer.setSize(
        container.clientWidth,
        container.clientHeight
    );

    renderer.domElement.style.display =
        "block";

    container.appendChild(
        renderer.domElement
    );


    /* =====================================================
       LIGHTING
       ===================================================== */

    const ambientLight =
        new THREE.AmbientLight(
            0x7dffe0,
            1.6
        );

    scene.add(
        ambientLight
    );


    const hemisphereLight =
        new THREE.HemisphereLight(
            0x8affdf,
            0x00150f,
            2.0
        );

    scene.add(
        hemisphereLight
    );


    /* =====================================================
       KEY LIGHT
       ===================================================== */

    const keyLight =
        new THREE.DirectionalLight(
            0xffffff,
            3.5
        );

    keyLight.position.set(
        5,
        7,
        8
    );

    keyLight.castShadow =
        !prefersReducedMotion;

    scene.add(
        keyLight
    );


    /* =====================================================
       GREEN LIGHT
       ===================================================== */

    const greenLight =
        new THREE.PointLight(
            0x35ffc1,
            20,
            18
        );

    greenLight.position.set(
        -5,
        2,
        5
    );

    scene.add(
        greenLight
    );


    /* =====================================================
       CYAN LIGHT
       ===================================================== */

    const cyanLight =
        new THREE.PointLight(
            0x16dfff,
            18,
            20
        );

    cyanLight.position.set(
        5,
        0,
        5
    );

    scene.add(
        cyanLight
    );


    /* =====================================================
       TOP LIGHT
       ===================================================== */

    const topLight =
        new THREE.PointLight(
            0x9affd8,
            12,
            18
        );

    topLight.position.set(
        0,
        7,
        2
    );

    scene.add(
        topLight
    );


    /* =====================================================
       AMBIENT MOVING LIGHTS
       ===================================================== */

    const ambientPulseLight =
        new THREE.PointLight(
            0x35ffc1,
            8,
            14
        );

    ambientPulseLight.position.set(
        0,
        1,
        -2
    );

    scene.add(
        ambientPulseLight
    );


    const ambientCyanLight =
        new THREE.PointLight(
            0x16dfff,
            6,
            12
        );

    ambientCyanLight.position.set(
        0,
        -1,
        1
    );

    scene.add(
        ambientCyanLight
    );


    /* =====================================================
       WORLD
       ===================================================== */

    const world =
        new THREE.Group();

    scene.add(
        world
    );


    /* =====================================================
       TV GROUP (GEOMETRY PRESERVED)
       ===================================================== */

    const display =
        new THREE.Group();

    display.position.set(
        0,
        0.05,
        0.55
    );

    display.scale.setScalar(
        1.12
    );

    world.add(
        display
    );


    /* =====================================================
       TV BODY
       ===================================================== */

    const tvBody =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                7.8,
                5.15,
                0.55
            ),
            new THREE.MeshStandardMaterial({
                color: 0x021410,
                metalness: 0.85,
                roughness: 0.18
            })
        );

    tvBody.castShadow = true;
    tvBody.receiveShadow = true;

    display.add(
        tvBody
    );


    /* =====================================================
       OUTER FRAME
       ===================================================== */

    const outerFrame =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                7.98,
                5.33,
                0.12
            ),
            new THREE.MeshStandardMaterial({
                color: 0x08241d,
                metalness: 0.8,
                roughness: 0.15
            })
        );

    outerFrame.position.z =
        0.31;

    display.add(
        outerFrame
    );


    /* =====================================================
       INNER SCREEN FRAME
       ===================================================== */

    const innerFrame =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                7.60,
                4.82,
                0.10
            ),
            new THREE.MeshStandardMaterial({
                color: 0x001712,
                metalness: 0.6,
                roughness: 0.12
            })
        );

    innerFrame.position.z =
        0.39;

    display.add(
        innerFrame
    );


    /* =====================================================
       SCREEN CANVAS
       ===================================================== */

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = 1600;
    canvas.height = 1000;

    const ctx =
        canvas.getContext(
            "2d"
        );


    /* =====================================================
       SCREEN BACKGROUND
       ===================================================== */

    const background =
        ctx.createLinearGradient(
            0,
            0,
            1600,
            1000
        );

    background.addColorStop(
        0,
        "#021812"
    );

    background.addColorStop(
        0.5,
        "#042b22"
    );

    background.addColorStop(
        1,
        "#010f0a"
    );

    ctx.fillStyle =
        background;

    ctx.fillRect(
        0,
        0,
        1600,
        1000
    );


    /* =====================================================
       SCREEN GRID
       ===================================================== */

    ctx.strokeStyle =
        "rgba(67,255,201,0.1)";

    ctx.lineWidth =
        2;


    for (
        let x = 0;
        x <= 1600;
        x += 80
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            1000
        );

        ctx.stroke();
    }


    for (
        let y = 0;
        y <= 1000;
        y += 80
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            1600,
            y
        );

        ctx.stroke();
    }


    /* =====================================================
       SCREEN HEADER
       ===================================================== */

    ctx.fillStyle =
        "#b3ffec";

    ctx.font =
        "bold 44px Arial";

    ctx.fillText(
        "TRUSTCART",
        75,
        85
    );


    ctx.fillStyle =
        "#4af2c2";

    ctx.font =
        "26px Arial";

    ctx.fillText(
        "LIVE PRICE COMPARISON ENGINE",
        75,
        125
    );


    /* =====================================================
       LIVE INDICATOR
       ===================================================== */

    ctx.fillStyle =
        "#35ffc1";

    ctx.beginPath();

    ctx.arc(
        1425,
        82,
        11,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.fillStyle =
        "#c7fff2";

    ctx.font =
        "bold 25px Arial";

    ctx.fillText(
        "LIVE",
        1455,
        91
    );


    /* =====================================================
       MAIN SCREEN TEXT
       ===================================================== */

    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "bold 92px Arial";

    ctx.fillText(
        "COMPARE",
        75,
        270
    );


    ctx.fillStyle =
        "#35ffc1";

    ctx.fillText(
        "SAVE",
        75,
        370
    );


    /* =====================================================
       PRODUCT CARDS
       ===================================================== */

    drawProductCard(
        ctx,
        70,
        470,
        690,
        310,
        "AMAZON",
        "₹1,199",
        "AVAILABLE"
    );


    drawProductCard(
        ctx,
        840,
        470,
        690,
        310,
        "FLIPKART",
        "₹999",
        "BEST PRICE"
    );


    /* =====================================================
       BOTTOM SCREEN INFORMATION
       ===================================================== */

    ctx.fillStyle =
        "#9affd8";

    ctx.font =
        "bold 32px Arial";

    ctx.fillText(
        "✓ VERIFIED PRICE",
        75,
        880
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "bold 30px Arial";

    ctx.fillText(
        "TRUST SCORE 98%",
        1180,
        880
    );


    /* =====================================================
       SCREEN TEXTURE
       ===================================================== */

    const screenTexture =
        new THREE.CanvasTexture(
            canvas
        );

    screenTexture.colorSpace =
        THREE.SRGBColorSpace;

    screenTexture.anisotropy =
        renderer
            .capabilities
            .getMaxAnisotropy();


    /* =====================================================
       SCREEN MESH
       ===================================================== */

    const screen =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                7.40,
                4.65
            ),
            new THREE.MeshBasicMaterial({
                map: screenTexture,
                toneMapped: false
            })
        );

    screen.position.set(
        0,
        0,
        0.47
    );

    display.add(
        screen
    );


    /* =====================================================
       SCREEN GLOW
       ===================================================== */

    const screenGlow =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                7.52,
                4.76
            ),
            new THREE.MeshBasicMaterial({
                color: 0x35ffc1,
                transparent: true,
                opacity: 0.06,
                side: THREE.DoubleSide
            })
        );

    screenGlow.position.z =
        0.44;

    display.add(
        screenGlow
    );


    /* =====================================================
       TV SIDE LIGHTS
       ===================================================== */

    const sideLightMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x35ffc1
        });


    const leftLight =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.05,
                4.5,
                0.04
            ),
            sideLightMaterial
        );

    leftLight.position.set(
        -3.79,
        0,
        0.50
    );

    display.add(
        leftLight
    );


    const rightLight =
        leftLight.clone();

    rightLight.position.x =
        3.79;

    display.add(
        rightLight
    );


    /* =====================================================
       TV STAND
       ===================================================== */

    const standMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x041a14,
            metalness: 0.75,
            roughness: 0.2
        });


    const standStem =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.65,
                0.70,
                0.30
            ),
            standMaterial
        );

    standStem.position.y =
        -2.76;

    display.add(
        standStem
    );


    const standBase =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3.0,
                0.20,
                0.90
            ),
            standMaterial
        );

    standBase.position.y =
        -3.08;

    standBase.castShadow = true;

    display.add(
        standBase
    );


    /* =====================================================
       FLOOR PLATFORM
       ===================================================== */

    const platform =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                4.35,
                4.75,
                0.15,
                96
            ),
            new THREE.MeshStandardMaterial({
                color: 0x021711,
                metalness: 0.75,
                roughness: 0.22
            })
        );

    platform.position.set(
        0,
        -3.40,
        0
    );

    platform.receiveShadow =
        true;

    world.add(
        platform
    );


    /* =====================================================
       GLOWING FLOOR RINGS
       ===================================================== */

    function createRing(
        radius,
        color,
        thickness,
        opacity
    ) {

        return new THREE.Mesh(
            new THREE.TorusGeometry(
                radius,
                thickness,
                20,
                100
            ),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent:
                    opacity < 1,
                opacity: opacity
            })
        );
    }


    const ringOne =
        createRing(
            4.35,
            0x35ffc1,
            0.035,
            0.98
        );

    ringOne.rotation.x =
        Math.PI / 2;

    ringOne.position.y =
        -3.28;

    world.add(
        ringOne
    );


    const ringTwo =
        createRing(
            4.65,
            0x16dfff,
            0.025,
            0.78
        );

    ringTwo.rotation.x =
        Math.PI / 2;

    ringTwo.position.y =
        -3.30;

    world.add(
        ringTwo
    );


    const ringThree =
        createRing(
            4.98,
            0x9affd8,
            0.018,
            0.48
        );

    ringThree.rotation.x =
        Math.PI / 2;

    ringThree.position.y =
        -3.32;

    world.add(
        ringThree
    );


    /* =====================================================
       FLOATING OBJECTS
       ===================================================== */

    function createFloatingBox(
        x,
        y,
        z,
        size,
        color
    ) {

        const mesh =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    size,
                    size,
                    size
                ),
                new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.6,
                    roughness: 0.2,
                    emissive: color,
                    emissiveIntensity: 0.18
                })
            );

        mesh.position.set(
            x,
            y,
            z
        );

        mesh.castShadow =
            !prefersReducedMotion;

        world.add(
            mesh
        );

        return mesh;
    }


    const boxLeft =
        createFloatingBox(
            -5.0,
            1.9,
            -0.6,
            0.58,
            0x35ffc1
        );


    const boxRight =
        createFloatingBox(
            5.0,
            1.7,
            -0.5,
            0.54,
            0x16dfff
        );


    const boxBottom =
        createFloatingBox(
            -4.8,
            -1.25,
            0,
            0.46,
            0x9affd8
        );


    /* =====================================================
       COINS
       ===================================================== */

    function createCoin(
        x,
        y,
        z,
        color
    ) {

        const coin =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.25,
                    0.25,
                    0.08,
                    32
                ),
                new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.95,
                    roughness: 0.14,
                    emissive: color,
                    emissiveIntensity: 0.35
                })
            );

        coin.position.set(
            x,
            y,
            z
        );

        coin.rotation.x =
            Math.PI / 2;

        world.add(
            coin
        );

        return coin;
    }


    const coinLeft =
        createCoin(
            -4.75,
            0.3,
            0,
            0x16dfff
        );


    const coinRight =
        createCoin(
            4.75,
            -0.35,
            0,
            0x35ffc1
        );


    /* =====================================================
       SHIELD
       ===================================================== */

    const shield =
        new THREE.Group();

    shield.position.set(
        4.65,
        2.65,
        -0.2
    );

    world.add(
        shield
    );


    const shieldShape =
        new THREE.Shape();

    shieldShape.moveTo(
        0,
        1
    );

    shieldShape.lineTo(
        0.82,
        0.55
    );

    shieldShape.lineTo(
        0.64,
        -0.65
    );

    shieldShape.lineTo(
        0,
        -1
    );

    shieldShape.lineTo(
        -0.64,
        -0.65
    );

    shieldShape.lineTo(
        -0.82,
        0.55
    );

    shieldShape.closePath();


    const shieldMesh =
        new THREE.Mesh(
            new THREE.ExtrudeGeometry(
                shieldShape,
                {
                    depth: 0.16,
                    bevelEnabled: true,
                    bevelSegments: 3,
                    bevelSize: 0.04,
                    bevelThickness: 0.04
                }
            ),
            new THREE.MeshStandardMaterial({
                color: 0x35ffc1,
                metalness: 0.6,
                roughness: 0.15,
                emissive: 0x0a5941,
                emissiveIntensity: 0.7
            })
        );

    shield.add(
        shieldMesh
    );


    /* =====================================================
       SHIELD CHECK
       ===================================================== */

    const checkCurve =
        new THREE.CatmullRomCurve3([
            new THREE.Vector3(
                -0.42,
                0,
                0.12
            ),
            new THREE.Vector3(
                -0.10,
                -0.34,
                0.12
            ),
            new THREE.Vector3(
                0.50,
                0.40,
                0.12
            )
        ]);


    const check =
        new THREE.Mesh(
            new THREE.TubeGeometry(
                checkCurve,
                20,
                0.07,
                8,
                false
            ),
            new THREE.MeshBasicMaterial({
                color: 0x010d0b
            })
        );

    shield.add(
        check
    );


    /* =====================================================
       PRICE TAG
       ===================================================== */

    const priceTag =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.1,
                0.68,
                0.12
            ),
            new THREE.MeshStandardMaterial({
                color: 0x16dfff,
                metalness: 0.5,
                roughness: 0.18,
                emissive: 0x063e4a,
                emissiveIntensity: 0.6
            })
        );

    priceTag.position.set(
        -4.65,
        -1.65,
        0
    );

    world.add(
        priceTag
    );


    /* =====================================================
       FLOATING CORE
       ===================================================== */

    const core =
        new THREE.Group();

    core.position.set(
        0,
        3.65,
        -1
    );

    world.add(
        core
    );


    const coreSphere =
        new THREE.Mesh(
            new THREE.IcosahedronGeometry(
                0.38,
                2
            ),
            new THREE.MeshStandardMaterial({
                color: 0x35ffc1,
                emissive: 0x16a878,
                emissiveIntensity: 2.0,
                metalness: 0.4,
                roughness: 0.1
            })
        );

    core.add(
        coreSphere
    );


    const coreRing =
        new THREE.Mesh(
            new THREE.TorusGeometry(
                0.70,
                0.025,
                12,
                64
            ),
            new THREE.MeshBasicMaterial({
                color: 0x16dfff
            })
        );

    coreRing.rotation.x =
        Math.PI / 2;

    core.add(
        coreRing
    );


    /* =====================================================
       PARTICLES
       ===================================================== */

    const particleCount =
        prefersReducedMotion
            ? 180
            : 480;


    const positions =
        new Float32Array(
            particleCount * 3
        );


    const particleData = [];


    for (
        let i = 0;
        i < particleCount;
        i++
    ) {

        const index =
            i * 3;


        positions[index] =
            (Math.random() - 0.5) * 18;

        positions[index + 1] =
            (Math.random() - 0.5) * 12;

        positions[index + 2] =
            (Math.random() - 0.5) * 10 - 2;


        particleData.push({
            x: positions[index],
            y: positions[index + 1],
            z: positions[index + 2],

            speed:
                0.08 +
                Math.random() * 0.16,

            phase:
                Math.random() *
                Math.PI *
                2,

            drift:
                0.08 +
                Math.random() * 0.14
        });
    }


    const particleGeometry =
        new THREE.BufferGeometry();

    particleGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );


    const particleMaterial =
        new THREE.PointsMaterial({
            color: 0x66ffdb,
            size:
                prefersReducedMotion
                    ? 0.018
                    : 0.025,
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });


    const particles =
        new THREE.Points(
            particleGeometry,
            particleMaterial
        );

    world.add(
        particles
    );


    /* =====================================================
       TV ROTATION
       ===================================================== */

    let nextTVRotation =
        prefersReducedMotion
            ? Infinity
            : 5;

    let tvRotationStart = 0;

    let tvRotationFrom = 0;

    let tvRotationTo = 0;

    let tvRotationActive = false;

    let tvRotationDirection = 1;


    const TV_ROTATION_INTERVAL =
        5;

    const TV_ROTATION_AMOUNT =
        THREE.MathUtils.degToRad(
            18
        );

    const TV_ROTATION_DURATION =
        1.25;


    function easeInOutCubic(
        t
    ) {

        return t < 0.5
            ? 4 * t * t * t
            : 1 -
              Math.pow(
                  -2 * t + 2,
                  3
              ) / 2;
    }


    function updateTVRotation(
        time
    ) {

        if (
            !prefersReducedMotion &&
            !tvRotationActive &&
            time >= nextTVRotation
        ) {

            tvRotationActive =
                true;

            tvRotationStart =
                time;

            tvRotationFrom =
                display.rotation.y;

            tvRotationDirection *=
                -1;

            tvRotationTo =
                TV_ROTATION_AMOUNT *
                tvRotationDirection;

            nextTVRotation =
                time +
                TV_ROTATION_INTERVAL;
        }


        if (
            !tvRotationActive
        ) {
            return;
        }


        const elapsed =
            time -
            tvRotationStart;


        let progress =
            elapsed /
            TV_ROTATION_DURATION;


        progress =
            THREE.MathUtils.clamp(
                progress,
                0,
                1
            );


        const eased =
            easeInOutCubic(
                progress
            );


        display.rotation.y =
            THREE.MathUtils.lerp(
                tvRotationFrom,
                tvRotationTo,
                eased
            );


        if (
            progress >= 1
        ) {

            tvRotationActive =
                false;
        }
    }


    /* =====================================================
       RESPONSIVE CAMERA
       ===================================================== */

    function resize() {

        const width =
            container.clientWidth;

        const height =
            container.clientHeight;


        if (
            !width ||
            !height
        ) {
            return;
        }


        camera.aspect =
            width / height;


        if (
            width < 700
        ) {

            camera.fov =
                40;

            camera.position.z =
                14.5;

            world.scale.setScalar(
                0.72
            );

        } else if (
            width < 1100
        ) {

            camera.fov =
                33;

            camera.position.z =
                12.8;

            world.scale.setScalar(
                0.88
            );

        } else {

            camera.fov =
                30;

            camera.position.z =
                11.5;

            world.scale.setScalar(
                1
            );
        }


        camera.updateProjectionMatrix();


        renderer.setSize(
            width,
            height
        );


        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                2
            )
        );
    }


    /* =====================================================
       RESIZE OBSERVER
       ===================================================== */

    const resizeObserver =
        new ResizeObserver(
            () => {
                resize();
            }
        );


    resizeObserver.observe(
        container
    );


    resize();


    /* =====================================================
       ANIMATION
       ===================================================== */

    const clock =
        new THREE.Clock();

    let isPageVisible =
        document.visibilityState ===
        "visible";


    function animate() {

        if (
            !isPageVisible
        ) {
            return;
        }


        requestAnimationFrame(
            animate
        );


        const time =
            clock.getElapsedTime();


        updateTVRotation(
            time
        );


        display.position.y =
            0.05 +
            Math.sin(
                time *
                0.8 *
                motionScale
            ) *
            0.035;


        display.position.z =
            0.55 +
            Math.sin(
                time *
                0.7 *
                motionScale
            ) *
            0.02;


        boxLeft.rotation.x =
            time *
            0.65 *
            motionScale;

        boxLeft.rotation.y =
            time *
            0.85 *
            motionScale;

        boxLeft.position.y =
            1.9 +
            Math.sin(
                time *
                1.3 *
                motionScale
            ) *
            0.22;


        boxRight.rotation.x =
            time *
            0.55 *
            motionScale;

        boxRight.rotation.y =
            -time *
            0.8 *
            motionScale;

        boxRight.position.y =
            1.7 +
            Math.sin(
                time *
                1.1 *
                motionScale +
                1
            ) *
            0.22;


        boxBottom.rotation.x =
            time *
            0.75 *
            motionScale;

        boxBottom.rotation.z =
            time *
            0.6 *
            motionScale;


        coinLeft.rotation.z =
            time *
            1.8 *
            motionScale;

        coinRight.rotation.z =
            -time *
            1.6 *
            motionScale;


        shield.rotation.y =
            Math.sin(
                time *
                0.8 *
                motionScale
            ) *
            0.16;

        shield.position.y =
            2.65 +
            Math.sin(
                time *
                0.9 *
                motionScale
            ) *
            0.08;


        priceTag.rotation.y =
            Math.sin(
                time *
                1.0 *
                motionScale
            ) *
            0.22;

        priceTag.position.y =
            -1.65 +
            Math.sin(
                time *
                1.15 *
                motionScale
            ) *
            0.10;


        core.rotation.y =
            time *
            0.8 *
            motionScale;

        core.position.y =
            3.65 +
            Math.sin(
                time *
                1.0 *
                motionScale
            ) *
            0.16;

        coreRing.rotation.z =
            time *
            1.7 *
            motionScale;


        ringOne.rotation.z =
            time *
            0.16 *
            motionScale;

        ringTwo.rotation.z =
            -time *
            0.12 *
            motionScale;

        ringThree.rotation.z =
            time *
            0.08 *
            motionScale;


        particles.rotation.y =
            time *
            0.015 *
            motionScale;


        const particlePosition =
            particleGeometry
                .attributes
                .position;


        for (
            let i = 0;
            i < particleCount;
            i++
        ) {

            const data =
                particleData[i];

            const index =
                i * 3;


            particlePosition.array[
                index
            ] =
                data.x +
                Math.sin(
                    time *
                    data.speed +
                    data.phase
                ) *
                data.drift;


            particlePosition.array[
                index + 1
            ] =
                data.y +
                Math.sin(
                    time *
                    data.speed *
                    0.8 +
                    data.phase
                ) *
                data.drift;
        }


        particlePosition.needsUpdate =
            true;


        renderer.render(
            scene,
            camera
        );
    }


    document.addEventListener(
        "visibilitychange",
        () => {

            isPageVisible =
                document.visibilityState ===
                "visible";


            if (
                isPageVisible
            ) {

                clock.start();

                animate();
            }
        }
    );


    animate();


    if (loader) {

        requestAnimationFrame(
            () => {

                setTimeout(
                    () => {

                        loader.style.opacity =
                            "0";

                        loader.style.pointerEvents =
                            "none";


                        setTimeout(
                            () => {

                                loader.style.display =
                                    "none";

                            },
                            500
                        );

                    },
                    900
                );
            }
        );
    }


    function drawProductCard(
        ctx,
        x,
        y,
        width,
        height,
        store,
        price,
        status
    ) {

        ctx.fillStyle =
            "rgba(5, 52, 40, 0.95)";

        ctx.beginPath();

        ctx.roundRect(
            x,
            y,
            width,
            height,
            30
        );

        ctx.fill();

        ctx.strokeStyle =
            "rgba(53,255,193,0.35)";

        ctx.lineWidth =
            3;

        ctx.stroke();

        ctx.fillStyle =
            "#76ffe0";

        ctx.font =
            "bold 30px Arial";

        ctx.fillText(
            store,
            x + 35,
            y + 55
        );

        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "bold 70px Arial";

        ctx.fillText(
            price,
            x + 35,
            y + 150
        );

        ctx.fillStyle =
            "#35ffc1";

        ctx.font =
            "26px Arial";

        ctx.fillText(
            "● " + status,
            x + 35,
            y + 215
        );

        ctx.fillStyle =
            "#8abfb0";

        ctx.font =
            "22px Arial";

        ctx.fillText(
            "Price checked by TrustCart",
            x + 35,
            y + 265
        );
    }
}