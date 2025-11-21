import * as THREE from 'https://unpkg.com/three@0.126.0/build/three.module.js';

const CONFIG = {
    imagePath: './images/background.jpg',
    lensSize: 0.4,
    lensBulge: 0.5,
    aberrationStrength: 0.03
};

class App {
    constructor() {
        this.container = document.body;
        this.canvas = document.querySelector('#canvas');
        
        this.init();
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createMesh();
        this.addEventListeners();
        this.loadTexture();
        this.animate();
        this.setupPreloader();
    }

    init() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.mouse = new THREE.Vector2(0.5, 0.5);
        this.targetMouse = new THREE.Vector2(0.5, 0.5);
    }

    createScene() {
        this.scene = new THREE.Scene();
    }

    createCamera() {
        this.camera = new THREE.OrthographicCamera(
            -1, 1, 1, -1, 0, 1
        );
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    getShader() {
        return {
            vertex: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                uniform sampler2D uTexture;
                uniform vec2 uMouse;
                uniform vec2 uResolution;
                uniform float uTime;
                uniform float uHover;
                varying vec2 vUv;

                // Config params (could be uniforms)
                float lensSize = ${CONFIG.lensSize}; 
                float bulge = ${CONFIG.lensBulge};
                float abStr = ${CONFIG.aberrationStrength};

                void main() {
                    vec2 uv = vUv;
                    
                    // Correct aspect ratio for the lens circle
                    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
                    vec2 mousePos = uMouse;
                    
                    // Distance from mouse to current pixel
                    float dist = distance(uv * aspect, mousePos * aspect);
                    
                    // Lens Effect Math
                    float lensMask = 1.0 - smoothstep(lensSize * 0.8, lensSize, dist);
                    
                    // Distortion (Bulge)
                    vec2 distortedUv = uv;
                    // Only distort inside the lens
                    if (dist < lensSize) {
                        // Calculate displacement based on distance from center of lens
                        float displacement = pow(dist / lensSize, bulge); // Non-linear
                        vec2 dir = normalize(uv - mousePos);
                        
                        // Interpolate between original and magnified
                        // This creates the "fisheye" look
                        distortedUv = mousePos + dir * (dist * (1.0 - bulge * 0.5)); 
                    }

                    // Chromatic Aberration (RGB Split)
                    // Stronger at the edges of the lens
                    float aberration = lensMask * abStr * (dist / lensSize);
                    
                    vec4 color;
                    color.r = texture2D(uTexture, distortedUv + vec2(aberration, 0.0)).r;
                    color.g = texture2D(uTexture, distortedUv).g;
                    color.b = texture2D(uTexture, distortedUv - vec2(aberration, 0.0)).b;
                    color.a = 1.0;

                    // Vignette / Darken outside lens (Optional, cinematic feel)
                    // color.rgb *= mix(0.7, 1.0, lensMask); 

                    gl_FragColor = color;
                }
            `
        };
    }

    createMesh() {
        const shader = this.getShader();
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: null },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uResolution: { value: new THREE.Vector2(this.width, this.height) },
                uTime: { value: 0 },
                uHover: { value: 0 }
            },
            vertexShader: shader.vertex,
            fragmentShader: shader.fragment
        });

        this.geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    loadTexture() {
        const loader = new THREE.TextureLoader();
        loader.load(CONFIG.imagePath, (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            this.material.uniforms.uTexture.value = texture;
            this.hidePreloader();
        }, 
        undefined, 
        (err) => {
            console.error("Error loading image. Check path!", err);
        });
    }

    addEventListeners() {
        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        
        const btn = document.getElementById('enableBtn');
        if(btn) {
            btn.addEventListener('click', () => {
                document.querySelector('.audio-enable').style.opacity = '0';
                setTimeout(() => document.querySelector('.audio-enable').remove(), 1000);
                const audio = document.getElementById('backgroundMusic');
                if(audio) audio.play().catch(e => console.log("Audio blocked"));
            });
        }

        const buttons = document.querySelectorAll('.halo-btn');
        const clickSound = document.getElementById('startClickSound');

        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if(clickSound) {
                    clickSound.currentTime = 0;
                    clickSound.volume = 0.2; 
                    clickSound.play().catch(() => {});
                }
            });
            
            btn.addEventListener('click', () => {
                if(clickSound) {
                    clickSound.currentTime = 0;
                    clickSound.volume = 1.0;
                    clickSound.play();
                }
                console.log("Protocol Initiated");
            });
        });

        const navLinks = document.querySelectorAll('.nav-links a');
        
        navLinks.forEach(link => {
            link.addEventListener('mouseenter', () => {
                const audio = document.getElementById('startClickSound');
                if(audio) {
                    audio.currentTime = 0;
                    audio.volume = 0.2;
                    audio.play().catch(() => {});
                }
            });
        });
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.renderer.setSize(this.width, this.height);
        this.material.uniforms.uResolution.value.set(this.width, this.height);
    }

    onMouseMove(e) {
        const x = e.clientX / this.width;
        const y = 1.0 - (e.clientY / this.height); 
        
        this.targetMouse.set(x, y);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.mouse.lerp(this.targetMouse, 0.1);
        
        if (this.material) {
            this.material.uniforms.uMouse.value.copy(this.mouse);
            this.material.uniforms.uTime.value += 0.01;
        }

        this.renderer.render(this.scene, this.camera);
    }
    
    setupPreloader() {
        let count = 0;
        const el = document.getElementById('counter');
        const interval = setInterval(() => {
            count += Math.floor(Math.random() * 5);
            if(count > 100) count = 100;
            if(el) el.innerText = `[${count.toString().padStart(3, '0')}]`;
            if(count === 100) clearInterval(interval);
        }, 50);
    }
    
    hidePreloader() {
        const p = document.getElementById('preloader');
        if(p) {
            if(window.gsap) {
                gsap.to(p, { opacity: 0, duration: 1, onComplete: () => p.style.display = 'none' });
            } else {
                p.style.opacity = '0';
                setTimeout(() => p.style.display = 'none', 1000);
            }
        }
    }
}

new App();
