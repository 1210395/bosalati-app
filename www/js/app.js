// =============================================
// Bosalati Mobile App - Main Application Logic
// =============================================

// FAL.AI Configuration
const FAL_AI_API_KEY = 'e299769e-3103-43e6-ae21-bcd1b4fb8283:dac09f32773e0be9b2b1d4c1d51def91';
const FAL_AI_ENDPOINT = 'https://fal.run/fal-ai/flux-2-pro/edit';

// =============================================
// Sound Effects (Web Audio API)
// =============================================
const BosalatiSounds = (() => {
    let ctx = null;
    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    function playTone(freq, duration, type = 'sine', volume = 0.3, rampDown = true) {
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, c.currentTime);
            gain.gain.setValueAtTime(volume, c.currentTime);
            if (rampDown) gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
            osc.connect(gain); gain.connect(c.destination);
            osc.start(c.currentTime); osc.stop(c.currentTime + duration);
        } catch (e) {}
    }
    return {
        click() {
            try {
                const c = getCtx();
                const bufferSize = c.sampleRate * 0.04;
                const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8);
                const source = c.createBufferSource(); source.buffer = buffer;
                const gain = c.createGain();
                gain.gain.setValueAtTime(0.15, c.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
                const filter = c.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.setValueAtTime(2000, c.currentTime);
                source.connect(filter); filter.connect(gain); gain.connect(c.destination); source.start();
            } catch (e) {}
        },
        tick() { playTone(600, 0.15, 'sine', 0.25); },
        tickFinal() { playTone(900, 0.3, 'sine', 0.5); },
        shutter() {
            try {
                const c = getCtx();
                const bufferSize = c.sampleRate * 0.15;
                const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
                const source = c.createBufferSource(); source.buffer = buffer;
                const gain = c.createGain();
                gain.gain.setValueAtTime(0.3, c.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
                const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(3000, c.currentTime);
                source.connect(filter); filter.connect(gain); gain.connect(c.destination); source.start();
            } catch (e) {}
        },
        confirm() { playTone(523, 0.1, 'sine', 0.2, false); setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 80); },
        success() { playTone(523, 0.2, 'sine', 0.25, false); setTimeout(() => playTone(659, 0.2, 'sine', 0.25, false), 150); setTimeout(() => playTone(784, 0.35, 'sine', 0.3), 300); }
    };
})();

// =============================================
// Translations (matching original lang files)
// =============================================
const TRANSLATIONS = {
    ar: {
        welcome_heading: 'أهلاً بك في رحلة اكتشاف مستقبلك!',
        welcome_subtitle: "تطبيق 'بوصلتي' سيساعدك في رسم ملامح مهنتك القادمة باستخدام ذكاء المستقبل.",
        lets_start: 'هيا بنا نبدأ!',
        step_answer_questions: 'أجب عن الأسئلة',
        step_discover_career: 'اكتشف مهنتك',
        step_see_yourself: 'شاهد نفسك',
        step_share_vision: 'شارك الرؤية',
        discover_future_male: 'اكتشف مستقبلك',
        discover_future_female: 'اكتشفي مستقبلكِ',
        before: 'قبل',
        after: 'بعد',
    },
    en: {
        welcome_heading: 'Welcome to your future discovery journey!',
        welcome_subtitle: 'Bosalati will help you map your next career using the intelligence of the future.',
        lets_start: "Let's Start!",
        step_answer_questions: 'Answer Questions',
        step_discover_career: 'Discover Career',
        step_see_yourself: 'See Yourself',
        step_share_vision: 'Share Vision',
        discover_future_male: 'Discover Your Future',
        discover_future_female: 'Discover Your Future',
        before: 'Before',
        after: 'After',
    }
};

// Arabic feminine conversion
function arabicFeminine(text) {
    const replacements = {
        'تشعر': 'تشعرين', 'تفضل': 'تفضلين', 'تناسبك': 'تناسبكِ',
        'يمنحك': 'يمنحكِ', 'هدفك': 'هدفكِ', 'أداتك': 'أداتكِ',
    };
    let result = text;
    for (const [from, to] of Object.entries(replacements)) {
        result = result.replace(new RegExp(from, 'g'), to);
    }
    return result;
}

// =============================================
// Main App Component
// =============================================
function bosalatiApp() {
    return {
        screen: 'welcome',
        locale: 'ar',
        gender: null,
        currentQuestion: 0,
        answers: {},
        matchedCareer: null,
        capturedPhoto: null,
        generatedImageUrl: null,
        processingProgress: 0,
        processingError: null,
        processingMsgIndex: 0,
        processingStatus: 'idle',
        // Dual completion flags — match web behavior
        generationDone: false,
        videoDone: false,
        // Modal state
        showRetake: false,
        showRestart: false,
        _processingInterval: null,
        _msgInterval: null,

        questions: BOSALATI_QUESTIONS,
        careers: BOSALATI_CAREERS,

        get processingMessages() {
            if (!this.matchedCareer) return [''];
            if (this.locale === 'ar') {
                return [
                    this.gender === 'female' ? 'يجري تحليل إجاباتِك...' : 'يجري تحليل إجاباتك...',
                    this.gender === 'female' ? 'نحتسب توافقِك المهني...' : 'نحتسب توافقك المهني...',
                    this.gender === 'female' ? 'لحظات وستظهر النتيجة...' : 'لحظات وستظهر النتيجة...',
                    'الذكاء الاصطناعي يعمل على معالجة الصورة...',
                ];
            }
            return [
                'Analyzing your answers...',
                'Calculating your career match...',
                'AI is crafting your transformation...',
            ];
        },

        t(key) {
            return TRANSLATIONS[this.locale]?.[key] || TRANSLATIONS['en'][key] || key;
        },

        toggleLocale() {
            BosalatiSounds.click();
            this.locale = this.locale === 'ar' ? 'en' : 'ar';
            document.documentElement.lang = this.locale;
            document.documentElement.dir = this.locale === 'ar' ? 'rtl' : 'ltr';
        },

        goTo(screen) {
            BosalatiSounds.click();
            this.screen = screen;
        },

        selectGender(g) {
            BosalatiSounds.confirm();
            this.gender = g;
            this.currentQuestion = 0;
            this.answers = {};
            this.screen = 'quiz';
        },

        getQuestionText() {
            const q = this.questions[this.currentQuestion];
            if (this.locale === 'ar') {
                return this.gender === 'female' ? arabicFeminine(q.question_ar) : q.question_ar;
            }
            return q.question_en;
        },

        selectAnswer(option) {
            BosalatiSounds.confirm();
            this.answers[this.currentQuestion] = option;
            if (this.currentQuestion < this.questions.length - 1) {
                setTimeout(() => { this.currentQuestion++; }, 300);
            }
        },

        prevQuestion() {
            BosalatiSounds.click();
            if (this.currentQuestion > 0) {
                this.currentQuestion--;
            } else {
                this.screen = 'home';
            }
        },

        resetQuiz() {
            this.gender = null;
            this.currentQuestion = 0;
            this.answers = {};
            this.matchedCareer = null;
            this.capturedPhoto = null;
            this.generatedImageUrl = null;
            this.processingProgress = 0;
            this.processingError = null;
            this.processingStatus = 'idle';
            this.generationDone = false;
            this.videoDone = false;
            this.showRetake = false;
            this.showRestart = false;
            if (this._processingInterval) clearInterval(this._processingInterval);
            if (this._msgInterval) clearInterval(this._msgInterval);
        },

        calculateResult() {
            BosalatiSounds.click();
            const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
            Object.values(this.answers).forEach(option => {
                if (scores.hasOwnProperty(option.riasec_code)) scores[option.riasec_code]++;
            });
            const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            const top2 = sorted[0][0] + sorted[1][0];
            const topLetter = sorted[0][0];

            let career = this.careers.find(c => c.riasec_code === top2);
            if (!career) career = this.careers.find(c => c.riasec_code === top2.split('').reverse().join(''));
            if (!career) career = this.careers.find(c => c.riasec_code.startsWith(topLetter));
            if (!career) career = this.careers.find(c => c.riasec_code.includes(topLetter));
            if (!career) career = this.careers[Math.floor(Math.random() * this.careers.length)];

            this.matchedCareer = career;
            this.screen = 'capture';
        },

        // ---- AI Image Generation (matches web dual-completion) ----
        async startGeneration() {
            this.processingProgress = 5;
            this.processingError = null;
            this.processingStatus = 'processing';
            this.processingMsgIndex = 0;
            this.generationDone = false;
            this.videoDone = false;

            this._msgInterval = setInterval(() => {
                this.processingMsgIndex = (this.processingMsgIndex + 1) % this.processingMessages.length;
            }, 2500);

            const career = this.matchedCareer;
            const promptParts = this.gender === 'female' ? career.ai_prompt_female : career.ai_prompt_male;
            const fullPrompt = `maintain the person's exact height, pose, face, beard, glasses, hair, skin tone, headwear. If wearing hijab or headscarf, keep it exactly as is. ONLY change clothing to match this career outfit: ${promptParts}. Change background to: ${career.ai_background}. Keep everything else about the person identical.`;

            // Simulate progress while waiting for sync API
            let fakeProgress = 10;
            this._processingInterval = setInterval(() => {
                fakeProgress = Math.min(85, fakeProgress + 3);
                this.processingProgress = fakeProgress;
            }, 2000);

            try {
                const response = await fetch(FAL_AI_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Key ' + FAL_AI_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image_urls: [this.capturedPhoto],
                        prompt: fullPrompt,
                        aspect_ratio: '3:4'
                    })
                });

                clearInterval(this._processingInterval);

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.detail || errData.message || 'API request failed: ' + response.status);
                }

                const data = await response.json();
                console.log('Fal.ai response:', data);

                if (data.images && data.images.length > 0 && data.images[0].url) {
                    this.generatedImageUrl = data.images[0].url;
                    this.generationDone = true;
                    this.checkAllDone();
                } else {
                    throw new Error('No image in response: ' + JSON.stringify(data));
                }
            } catch (err) {
                clearInterval(this._processingInterval);
                console.error('Generation error:', err);
                if (this._msgInterval) clearInterval(this._msgInterval);
                this.processingError = err.message;
            }
        },

        // Called when the processing video finishes playing
        onVideoEnded() {
            this.videoDone = true;
            this.checkAllDone();
        },

        // Transition to allDone only when BOTH video and generation complete (matches web)
        checkAllDone() {
            if (this.generationDone && this.videoDone) {
                this.processingProgress = 100;
                if (this._msgInterval) clearInterval(this._msgInterval);
                BosalatiSounds.success();
                this.processingStatus = 'allDone';
            } else if (this.generationDone && !this.videoDone) {
                // Generation done but video still playing
                this.processingProgress = 90;
            }
        },

        async downloadImage() {
            BosalatiSounds.click();
            const imageUrl = this.generatedImageUrl || this.capturedPhoto;
            try {
                const res = await fetch(imageUrl);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'bosalati-career-' + Date.now() + '.jpg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (e) {
                window.open(imageUrl, '_blank');
            }
        },

        async shareImage() {
            BosalatiSounds.click();
            const careerName = this.locale === 'ar' ? this.matchedCareer?.name_ar : this.matchedCareer?.name_en;
            const shareText = this.locale === 'ar'
                ? `اكتشفت مهنتي المستقبلية عبر بوصلتي: ${careerName}!`
                : `I discovered my future career through Bosalati: ${careerName}!`;
            if (navigator.share) {
                try {
                    const imageUrl = this.generatedImageUrl || this.capturedPhoto;
                    let shareData = { title: 'Bosalati', text: shareText };
                    if (imageUrl) {
                        const res = await fetch(imageUrl);
                        const blob = await res.blob();
                        const file = new File([blob], 'bosalati-career.jpg', { type: 'image/jpeg' });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            shareData.files = [file];
                        }
                    }
                    await navigator.share(shareData);
                } catch (e) {}
            } else {
                try { await navigator.clipboard.writeText(shareText); } catch (e) {}
            }
        }
    };
}

// =============================================
// Camera Component — robust USB/external camera support
// =============================================
function cameraComponent() {
    return {
        stream: null,
        photo: null,
        isCameraReady: false,
        cameraError: null,
        countdown: 0,
        _countdownInterval: null,

        async initCamera() {
            try {
                // Wait for DOM to be fully ready (prevents null $refs in x-if templates)
                await new Promise(r => setTimeout(r, 100));

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    this.cameraError = this.$data?.locale === 'ar'
                        ? 'الكاميرا غير متوفرة في هذا المتصفح'
                        : 'Camera not supported in this browser';
                    return;
                }

                let stream = null;

                // Try multiple constraint sets — crucial for USB/external cameras (Fantech on TV)
                const constraintSets = [
                    // 1. Front camera (phones)
                    { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
                    // 2. Any camera without facingMode (USB/external cameras)
                    { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
                    // 3. Minimal constraints (fallback)
                    { video: true, audio: false }
                ];

                for (const constraints of constraintSets) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraints);
                        console.log('Camera acquired with constraints:', JSON.stringify(constraints));
                        break;
                    } catch (e) {
                        console.log('Camera constraint failed:', e.name, e.message);
                        continue;
                    }
                }

                // Last resort: enumerate devices and try the first video input by deviceId
                if (!stream) {
                    try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const videoDevices = devices.filter(d => d.kind === 'videoinput');
                        console.log('Available video devices:', videoDevices.map(d => d.label || d.deviceId));
                        if (videoDevices.length > 0) {
                            stream = await navigator.mediaDevices.getUserMedia({
                                video: { deviceId: { exact: videoDevices[0].deviceId } },
                                audio: false
                            });
                        }
                    } catch (e) {
                        console.error('Device enumeration fallback failed:', e);
                    }
                }

                if (!stream) {
                    throw new Error('No camera could be accessed');
                }

                this.stream = stream;

                // Safely attach to video element
                const video = this.$refs.video;
                if (video) {
                    video.srcObject = stream;
                    video.setAttribute('autoplay', '');
                    video.setAttribute('playsinline', '');
                    video.setAttribute('muted', '');
                    try {
                        await video.play();
                    } catch (playErr) {
                        console.warn('Video play() failed (autoplay may handle it):', playErr.message);
                    }
                } else {
                    console.warn('Video ref not available yet, stream is attached but not playing');
                }

                this.isCameraReady = true;
            } catch (err) {
                console.error('Camera init error:', err);
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    this.cameraError = this.$data?.locale === 'ar'
                        ? 'يرجى السماح بالوصول إلى الكاميرا من إعدادات التطبيق'
                        : 'Please allow camera access in app settings';
                } else {
                    this.cameraError = this.$data?.locale === 'ar'
                        ? 'فشل الوصول إلى الكاميرا: ' + err.message
                        : 'Camera access failed: ' + err.message;
                }
            }
        },

        captureWithCountdown() {
            if (this._countdownInterval) clearInterval(this._countdownInterval);
            this.countdown = 5;
            BosalatiSounds.tick();
            this._countdownInterval = setInterval(() => {
                this.countdown--;
                if (this.countdown <= 0) {
                    clearInterval(this._countdownInterval);
                    this._countdownInterval = null;
                    BosalatiSounds.tickFinal();
                    this.capture();
                } else {
                    BosalatiSounds.tick();
                }
            }, 1000);
        },

        capture() {
            BosalatiSounds.shutter();
            const video = this.$refs.video;
            if (!video || !video.videoWidth) return;

            const canvas = document.createElement('canvas');
            const targetRatio = 2 / 3;
            const videoRatio = video.videoWidth / video.videoHeight;
            let sx, sy, sw, sh;
            if (videoRatio > targetRatio) {
                sh = video.videoHeight; sw = sh * targetRatio;
                sx = (video.videoWidth - sw) / 2; sy = 0;
            } else {
                sw = video.videoWidth; sh = sw / targetRatio;
                sx = 0; sy = (video.videoHeight - sh) / 2;
            }
            canvas.width = 768;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            // Mirror the image (front camera style)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 768, 1024);
            this.photo = canvas.toDataURL('image/jpeg', 0.85);
        },

        retake() { this.photo = null; },

        submitPhoto() {
            BosalatiSounds.click();
            const app = Alpine.closestDataStack(this.$el).find(d => d.capturedPhoto !== undefined);
            if (app) {
                app.capturedPhoto = this.photo;
                this.stopCamera();
                app.screen = 'processing';
                setTimeout(() => { app.startGeneration(); }, 500);
            }
        },

        stopCamera() {
            if (this._countdownInterval) {
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
            }
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
        }
    };
}
