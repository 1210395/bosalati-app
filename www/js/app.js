// =============================================
// Bosalati Mobile App - Main Application Logic
// =============================================

// FAL.AI Configuration
const FAL_AI_API_KEY = 'e299769e-3103-43e6-ae21-bcd1b4fb8283:dac09f32773e0be9b2b1d4c1d51def91';
const FAL_AI_ENDPOINT = 'https://queue.fal.run/fal-ai/flux-2-pro/edit';
const FAL_AI_STATUS_BASE = 'https://queue.fal.run/fal-ai/flux-2-pro/edit/requests';

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
// Translations
// =============================================
const TRANSLATIONS = {
    ar: {
        appName: 'بوصلتي',
        appTagline: 'اكتشف مسارك المهني',
        letsStart: 'لنبدأ الرحلة',
        selectGender: 'اختر جنسك',
        selectGenderDesc: 'لتخصيص تجربتك بشكل أفضل',
        male: 'ذكر',
        female: 'أنثى',
        showResult: 'أظهر النتيجة',
        retake: 'إعادة التقاط',
        continue: 'متابعة',
        processingTitle: 'جارٍ تحويل صورتك...',
        tryAgain: 'حاول مرة أخرى',
        palestine2030: 'فلسطين 2030',
        aiImpact: 'تأثير الذكاء الاصطناعي',
        download: 'تحميل',
        share: 'مشاركة',
        startOver: 'ابدأ من جديد',
        step1Title: 'أجب على الأسئلة',
        step1Desc: 'اكتشف ميولك المهنية',
        step2Title: 'اكتشف مهنتك',
        step2Desc: 'تعرّف على المهنة المناسبة لك',
        step3Title: 'التقط صورتك',
        step3Desc: 'شاهد نفسك في مهنتك',
        step4Title: 'شارك رؤيتك',
        step4Desc: 'حمّل وشارك صورتك المهنية',
    },
    en: {
        appName: 'Bosalati',
        appTagline: 'DISCOVER YOUR CAREER PATH',
        letsStart: "Let's Start",
        selectGender: 'Select Your Gender',
        selectGenderDesc: 'To better personalize your experience',
        male: 'Male',
        female: 'Female',
        showResult: 'Show Result',
        retake: 'Retake',
        continue: 'Continue',
        processingTitle: 'Transforming your photo...',
        tryAgain: 'Try Again',
        palestine2030: 'Palestine 2030',
        aiImpact: 'AI Impact',
        download: 'Download',
        share: 'Share',
        startOver: 'Start Over',
        step1Title: 'Answer Questions',
        step1Desc: 'Discover your career interests',
        step2Title: 'Discover Career',
        step2Desc: 'Find the career that suits you',
        step3Title: 'Capture Photo',
        step3Desc: 'See yourself in your career',
        step4Title: 'Share Vision',
        step4Desc: 'Download and share your career photo',
    }
};

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
        _processingInterval: null,
        _msgInterval: null,

        questions: BOSALATI_QUESTIONS,
        careers: BOSALATI_CAREERS,

        steps: [
            { icon: 'quiz', titleKey: 'step1Title', descKey: 'step1Desc' },
            { icon: 'explore', titleKey: 'step2Title', descKey: 'step2Desc' },
            { icon: 'photo_camera', titleKey: 'step3Title', descKey: 'step3Desc' },
            { icon: 'share', titleKey: 'step4Title', descKey: 'step4Desc' },
        ],

        get processingMessages() {
            if (!this.matchedCareer) return [''];
            if (this.locale === 'ar') {
                return [
                    'جارٍ تحليل ملامحك وتحضير صورتك المهنية...',
                    'يتم تصميم زي ' + this.matchedCareer.name_ar + ' خصيصاً لك...',
                    'جارٍ إنشاء بيئة العمل المناسبة...',
                    'اللمسات الأخيرة على صورتك المهنية...',
                    this.matchedCareer.description_ar,
                ];
            }
            return [
                'Analyzing your features and preparing your career portrait...',
                'Designing the ' + this.matchedCareer.name_en + ' outfit for you...',
                'Creating the appropriate work environment...',
                'Final touches on your career portrait...',
                this.matchedCareer.description_en,
            ];
        },

        t(key) {
            return TRANSLATIONS[this.locale]?.[key] || TRANSLATIONS['en'][key] || key;
        },

        toggleLocale() {
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

        selectAnswer(option) {
            BosalatiSounds.confirm();
            this.answers[this.currentQuestion] = option;
            // Auto advance if not last question
            if (this.currentQuestion < this.questions.length - 1) {
                setTimeout(() => {
                    this.currentQuestion++;
                }, 300);
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
            if (this._processingInterval) clearInterval(this._processingInterval);
            if (this._msgInterval) clearInterval(this._msgInterval);
        },

        calculateResult() {
            BosalatiSounds.click();
            // Calculate RIASEC scores
            const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
            Object.values(this.answers).forEach(option => {
                if (scores.hasOwnProperty(option.riasec_code)) {
                    scores[option.riasec_code]++;
                }
            });

            // Get top 2 letters
            const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            const top2 = sorted[0][0] + sorted[1][0];
            const topLetter = sorted[0][0];

            // Find matching career
            let career = this.careers.find(c => c.riasec_code === top2);
            if (!career) career = this.careers.find(c => c.riasec_code === top2.split('').reverse().join(''));
            if (!career) career = this.careers.find(c => c.riasec_code.startsWith(topLetter));
            if (!career) career = this.careers.find(c => c.riasec_code.includes(topLetter));
            if (!career) career = this.careers[Math.floor(Math.random() * this.careers.length)];

            this.matchedCareer = career;
            this.screen = 'capture';
        },

        // ---- AI Image Generation ----
        async startGeneration() {
            this.processingProgress = 5;
            this.processingError = null;
            this.processingMsgIndex = 0;

            // Rotate messages
            this._msgInterval = setInterval(() => {
                this.processingMsgIndex = (this.processingMsgIndex + 1) % this.processingMessages.length;
            }, 4000);

            const career = this.matchedCareer;
            const promptParts = this.gender === 'female' ? career.ai_prompt_female : career.ai_prompt_male;

            const fullPrompt = `maintain the person's exact height, pose, face, beard, glasses, hair, skin tone, headwear. If wearing hijab or headscarf, keep it exactly as is. ONLY change clothing to match this career outfit: ${promptParts}. Change background to: ${career.ai_background}. Keep everything else about the person identical.`;

            try {
                // Submit to queue
                const submitRes = await fetch(FAL_AI_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Key ' + FAL_AI_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image_url: this.capturedPhoto,
                        prompt: fullPrompt,
                        image_size: { width: 768, height: 1024 },
                        num_images: 1,
                        safety_tolerance: 6
                    })
                });

                if (!submitRes.ok) {
                    const errData = await submitRes.json().catch(() => ({}));
                    throw new Error(errData.detail || errData.message || 'API request failed: ' + submitRes.status);
                }

                const submitData = await submitRes.json();

                // Check if result is immediate
                if (submitData.images && submitData.images.length > 0) {
                    this.generatedImageUrl = submitData.images[0].url;
                    this.processingProgress = 100;
                    this.finishGeneration();
                    return;
                }

                // Poll for queue result
                const requestId = submitData.request_id;
                if (!requestId) {
                    throw new Error('No request_id returned from API');
                }

                this.processingProgress = 15;
                this.pollForResult(requestId);

            } catch (err) {
                console.error('Generation error:', err);
                if (this._msgInterval) clearInterval(this._msgInterval);
                this.processingError = err.message;
            }
        },

        async pollForResult(requestId) {
            let polls = 0;
            this._processingInterval = setInterval(async () => {
                polls++;
                this.processingProgress = Math.min(90, 15 + polls * 5);

                try {
                    const statusRes = await fetch(`${FAL_AI_STATUS_BASE}/${requestId}/status`, {
                        headers: { 'Authorization': 'Key ' + FAL_AI_API_KEY }
                    });
                    const statusData = await statusRes.json();

                    if (statusData.status === 'COMPLETED') {
                        clearInterval(this._processingInterval);
                        // Fetch the result
                        const resultRes = await fetch(`${FAL_AI_STATUS_BASE}/${requestId}`, {
                            headers: { 'Authorization': 'Key ' + FAL_AI_API_KEY }
                        });
                        const resultData = await resultRes.json();
                        if (resultData.images && resultData.images.length > 0) {
                            this.generatedImageUrl = resultData.images[0].url;
                        }
                        this.processingProgress = 100;
                        this.finishGeneration();
                    } else if (statusData.status === 'FAILED') {
                        clearInterval(this._processingInterval);
                        if (this._msgInterval) clearInterval(this._msgInterval);
                        this.processingError = 'Image generation failed. Please try again.';
                    }
                } catch (err) {
                    if (polls > 60) {
                        clearInterval(this._processingInterval);
                        if (this._msgInterval) clearInterval(this._msgInterval);
                        this.processingError = 'Timeout - please try again.';
                    }
                }
            }, 2000);
        },

        finishGeneration() {
            if (this._msgInterval) clearInterval(this._msgInterval);
            BosalatiSounds.success();
            setTimeout(() => {
                this.screen = 'result';
            }, 1000);
        },

        // ---- Download / Share ----
        async downloadImage() {
            BosalatiSounds.click();
            const imageUrl = this.generatedImageUrl || this.capturedPhoto;
            try {
                // Try native share for file download on mobile
                if (imageUrl.startsWith('data:')) {
                    // Convert data URL to blob
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
                } else {
                    // Remote URL - fetch and download
                    const res = await fetch(imageUrl);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'bosalati-career-' + Date.now() + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            } catch (e) {
                // Fallback: open in new tab
                window.open(imageUrl, '_blank');
            }
        },

        async shareImage() {
            BosalatiSounds.click();
            const imageUrl = this.generatedImageUrl || this.capturedPhoto;
            const careerName = this.locale === 'ar' ? this.matchedCareer?.name_ar : this.matchedCareer?.name_en;
            const shareText = this.locale === 'ar'
                ? `اكتشفت مهنتي المستقبلية عبر بوصلتي: ${careerName}! 🧭`
                : `I discovered my future career through Bosalati: ${careerName}! 🧭`;

            if (navigator.share) {
                try {
                    let shareData = { title: 'Bosalati - بوصلتي', text: shareText };
                    // Try to share image file
                    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
                        const res = await fetch(imageUrl);
                        const blob = await res.blob();
                        const file = new File([blob], 'bosalati-career.jpg', { type: 'image/jpeg' });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            shareData.files = [file];
                        }
                    }
                    await navigator.share(shareData);
                } catch (e) {
                    // User cancelled or error
                }
            } else {
                // Fallback: copy text
                try {
                    await navigator.clipboard.writeText(shareText);
                    alert(this.locale === 'ar' ? 'تم نسخ النص!' : 'Text copied!');
                } catch (e) {}
            }
        }
    };
}

// =============================================
// Camera Component
// =============================================
function cameraComponent() {
    return {
        stream: null,
        photo: null,
        isCameraReady: false,
        cameraError: null,
        countdown: 0,

        async initCamera() {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    this.cameraError = this.locale === 'ar'
                        ? 'الكاميرا غير متوفرة في هذا المتصفح'
                        : 'Camera not supported in this browser';
                    return;
                }
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                this.$refs.video.srcObject = this.stream;
                this.isCameraReady = true;
            } catch (err) {
                this.cameraError = this.locale === 'ar'
                    ? 'فشل الوصول إلى الكاميرا: ' + err.message
                    : 'Camera access failed: ' + err.message;
            }
        },

        captureWithCountdown() {
            this.countdown = 5;
            BosalatiSounds.tick();
            const interval = setInterval(() => {
                this.countdown--;
                if (this.countdown <= 0) {
                    clearInterval(interval);
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
            const canvas = document.createElement('canvas');

            const targetRatio = 3 / 4;
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
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 768, 1024);

            this.photo = canvas.toDataURL('image/jpeg', 0.85);
        },

        retake() {
            this.photo = null;
        },

        submitPhoto() {
            BosalatiSounds.click();
            // Store photo in parent scope
            this.$data.capturedPhoto = this.photo;
            this.stopCamera();
            this.$data.screen = 'processing';
            // Start AI generation after a brief delay
            setTimeout(() => {
                this.$data.startGeneration();
            }, 500);
        },

        stopCamera() {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
        }
    };
}

// =============================================
// Global click sound
// =============================================
document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (target && !target.closest('[x-data="cameraComponent()"]')) {
        // Sound already handled in specific handlers
    }
}, true);
