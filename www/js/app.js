// =============================================
// Bosalati Mobile App - Main Application Logic
// =============================================

// FAL.AI Configuration
const FAL_AI_API_KEY = 'e299769e-3103-43e6-ae21-bcd1b4fb8283:dac09f32773e0be9b2b1d4c1d51def91';
const FAL_AI_ENDPOINT = 'https://fal.run/fal-ai/flux-2-pro/edit';

// =============================================
// DEBUG LOGGER — visible on-screen overlay
// =============================================
const DebugLog = (() => {
    const logs = [];
    let overlay = null;
    let logEl = null;
    let visible = false;

    function createOverlay() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.id = 'debug-overlay';
        overlay.style.cssText = `
            position:fixed; top:0; left:0; right:0; bottom:0; z-index:99999;
            background:rgba(0,0,0,0.92); color:#0f0; font-family:monospace;
            font-size:11px; padding:10px; overflow-y:auto; display:none;
            white-space:pre-wrap; word-break:break-all; line-height:1.5;
            -webkit-user-select:text; user-select:text;
        `;
        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
            position:sticky; top:0; background:#333; color:#ff0; padding:8px 16px;
            text-align:center; cursor:pointer; font-size:14px; border-radius:4px;
            margin-bottom:8px; z-index:1;
        `;
        closeBtn.textContent = '[ CLOSE DEBUG LOG ] — tap to close';
        closeBtn.onclick = () => { overlay.style.display = 'none'; visible = false; };
        overlay.appendChild(closeBtn);

        // Copy button
        const copyBtn = document.createElement('div');
        copyBtn.style.cssText = `
            position:sticky; top:40px; background:#060; color:#fff; padding:6px 12px;
            text-align:center; cursor:pointer; font-size:12px; border-radius:4px;
            margin-bottom:8px;
        `;
        copyBtn.textContent = '[ COPY ALL LOGS ]';
        copyBtn.onclick = () => {
            const text = logs.map(l => l.text).join('\n');
            try {
                navigator.clipboard.writeText(text);
                copyBtn.textContent = '[ COPIED! ]';
                setTimeout(() => { copyBtn.textContent = '[ COPY ALL LOGS ]'; }, 1500);
            } catch(e) {
                // fallback: select text
                const range = document.createRange();
                range.selectNodeContents(logEl);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }
        };
        overlay.appendChild(copyBtn);

        logEl = document.createElement('div');
        logEl.id = 'debug-log-content';
        overlay.appendChild(logEl);
        document.body.appendChild(overlay);
    }

    function show() {
        createOverlay();
        overlay.style.display = 'block';
        visible = true;
    }

    function addEntry(level, ...args) {
        const ts = new Date().toISOString().substr(11, 12);
        const msg = args.map(a => {
            if (typeof a === 'object') {
                try { return JSON.stringify(a, null, 0); }
                catch(e) { return String(a); }
            }
            return String(a);
        }).join(' ');

        const colors = { INFO: '#0f0', WARN: '#ff0', ERROR: '#f44', STEP: '#0af', OK: '#4f4' };
        const entry = { text: `[${ts}] ${level}: ${msg}`, level };
        logs.push(entry);

        // Also save to localStorage for persistence
        try {
            localStorage.setItem('bosalati_debug_log', logs.map(l => l.text).join('\n'));
        } catch(e) {}

        // Update overlay if it exists
        if (logEl) {
            const line = document.createElement('div');
            line.style.color = colors[level] || '#fff';
            line.textContent = entry.text;
            logEl.appendChild(line);
            logEl.scrollTop = logEl.scrollHeight;
        }

        // Also console.log
        const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
        fn(`[DebugLog:${level}]`, ...args);
    }

    return {
        info: (...args) => addEntry('INFO', ...args),
        warn: (...args) => addEntry('WARN', ...args),
        error: (...args) => addEntry('ERROR', ...args),
        step: (...args) => addEntry('STEP', ...args),
        ok: (...args) => addEntry('OK', ...args),
        show,
        hide: () => { if (overlay) overlay.style.display = 'none'; visible = false; },
        toggle: () => { visible ? DebugLog.hide() : DebugLog.show(); },
        isVisible: () => visible,
        getLogs: () => logs.map(l => l.text).join('\n'),
    };
})();

// Make globally accessible
window.DebugLog = DebugLog;

// =============================================
// Global error catchers
// =============================================
window.onerror = function(msg, url, line, col, error) {
    DebugLog.error('UNCAUGHT:', msg, 'at', url + ':' + line + ':' + col);
    if (error && error.stack) DebugLog.error('Stack:', error.stack);
    DebugLog.show(); // Auto-show on crash
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    DebugLog.error('UNHANDLED PROMISE:', event.reason);
    if (event.reason && event.reason.stack) DebugLog.error('Stack:', event.reason.stack);
    DebugLog.show(); // Auto-show on crash
});

DebugLog.info('App script loaded. UserAgent:', navigator.userAgent);
DebugLog.info('Protocol:', window.location.protocol, 'Host:', window.location.host);
DebugLog.info('Screen:', screen.width + 'x' + screen.height, 'DPR:', window.devicePixelRatio);

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
            DebugLog.info('Navigate to:', screen);
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
            DebugLog.info('Career matched:', career.name_en, '(' + career.riasec_code + ')');
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
                DebugLog.step('Starting Fal.ai generation...');
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
                DebugLog.ok('Fal.ai response received');

                if (data.images && data.images.length > 0 && data.images[0].url) {
                    this.generatedImageUrl = data.images[0].url;
                    this.generationDone = true;
                    this.checkAllDone();
                } else {
                    throw new Error('No image in response: ' + JSON.stringify(data));
                }
            } catch (err) {
                clearInterval(this._processingInterval);
                DebugLog.error('Generation error:', err.message);
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
// Camera Component — with full debug logging
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
            DebugLog.step('=== CAMERA INIT START ===');

            try {
                // Step 1: Wait for DOM
                DebugLog.step('Step 1: Waiting 300ms for DOM...');
                await new Promise(r => setTimeout(r, 300));
                DebugLog.ok('Step 1: DOM wait done');

                // Step 2: Check APIs
                DebugLog.step('Step 2: Checking mediaDevices API...');
                DebugLog.info('navigator.mediaDevices exists:', !!navigator.mediaDevices);
                DebugLog.info('getUserMedia exists:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
                DebugLog.info('enumerateDevices exists:', !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices));

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    DebugLog.error('Step 2: FAILED — getUserMedia not available');
                    DebugLog.info('window.location.protocol:', window.location.protocol);
                    DebugLog.info('Is HTTPS needed? Capacitor uses:', window.location.protocol);
                    this.cameraError = 'Camera API not available (getUserMedia missing). Protocol: ' + window.location.protocol;
                    DebugLog.show();
                    return;
                }
                DebugLog.ok('Step 2: mediaDevices API available');

                // Step 3: Enumerate devices first
                DebugLog.step('Step 3: Enumerating video devices...');
                let videoDevices = [];
                try {
                    const allDevices = await navigator.mediaDevices.enumerateDevices();
                    videoDevices = allDevices.filter(d => d.kind === 'videoinput');
                    DebugLog.info('Total devices found:', allDevices.length);
                    DebugLog.info('Video devices found:', videoDevices.length);
                    videoDevices.forEach((d, i) => {
                        DebugLog.info(`  Camera ${i}: "${d.label || '(no label)'}" id=${d.deviceId.substr(0, 16)}...`);
                    });
                } catch (enumErr) {
                    DebugLog.warn('Step 3: enumerateDevices failed:', enumErr.name, enumErr.message);
                }

                // Step 4: Try to get camera stream
                DebugLog.step('Step 4: Requesting camera stream...');
                let stream = null;

                const constraintSets = [
                    { label: 'facingMode:user + 1280x720', constraints: { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false } },
                    { label: 'generic 1280x720', constraints: { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false } },
                    { label: 'video:true (minimal)', constraints: { video: true, audio: false } },
                ];

                // If we found devices, also add deviceId-specific attempts
                videoDevices.forEach((d, i) => {
                    constraintSets.push({
                        label: `deviceId[${i}]: "${d.label || d.deviceId.substr(0, 16)}"`,
                        constraints: { video: { deviceId: { exact: d.deviceId } }, audio: false }
                    });
                });

                for (let i = 0; i < constraintSets.length; i++) {
                    const { label, constraints } = constraintSets[i];
                    DebugLog.step(`  Attempt ${i + 1}/${constraintSets.length}: ${label}`);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraints);
                        const tracks = stream.getVideoTracks();
                        DebugLog.ok(`  SUCCESS! Got stream with ${tracks.length} video track(s)`);
                        tracks.forEach((t, ti) => {
                            const settings = t.getSettings ? t.getSettings() : {};
                            DebugLog.info(`    Track ${ti}: "${t.label}" state=${t.readyState} enabled=${t.enabled}`);
                            DebugLog.info(`    Settings: ${settings.width}x${settings.height} facing=${settings.facingMode || 'n/a'} fps=${settings.frameRate || 'n/a'}`);
                        });
                        break;
                    } catch (e) {
                        DebugLog.warn(`  FAILED: ${e.name}: ${e.message}`);
                        stream = null;
                    }
                }

                if (!stream) {
                    DebugLog.error('Step 4: ALL camera attempts failed!');
                    this.cameraError = 'No camera could be accessed after ' + constraintSets.length + ' attempts. Check debug log.';
                    DebugLog.show();
                    return;
                }

                this.stream = stream;
                DebugLog.ok('Step 4: Camera stream acquired');

                // Step 5: Attach to video element
                DebugLog.step('Step 5: Attaching stream to video element...');
                const video = this.$refs.video;
                DebugLog.info('video element exists:', !!video);
                if (video) {
                    DebugLog.info('video element tag:', video.tagName);
                    DebugLog.info('video dimensions:', video.clientWidth + 'x' + video.clientHeight);
                    DebugLog.info('video display:', window.getComputedStyle(video).display);
                    DebugLog.info('video visibility:', window.getComputedStyle(video).visibility);

                    video.srcObject = stream;
                    DebugLog.ok('srcObject assigned');

                    video.setAttribute('autoplay', '');
                    video.setAttribute('playsinline', '');
                    video.setAttribute('muted', '');

                    // Listen for video events
                    video.onloadedmetadata = () => {
                        DebugLog.ok('Video metadata loaded: ' + video.videoWidth + 'x' + video.videoHeight);
                    };
                    video.onplaying = () => {
                        DebugLog.ok('Video is PLAYING: ' + video.videoWidth + 'x' + video.videoHeight);
                    };
                    video.onerror = (e) => {
                        DebugLog.error('Video element error:', e);
                        DebugLog.show();
                    };

                    DebugLog.step('Step 5b: Calling video.play()...');
                    try {
                        await video.play();
                        DebugLog.ok('video.play() resolved. videoWidth=' + video.videoWidth + ' videoHeight=' + video.videoHeight);
                    } catch (playErr) {
                        DebugLog.warn('video.play() rejected:', playErr.name, playErr.message);
                        DebugLog.info('This may be OK if autoplay attribute handles it.');
                    }
                } else {
                    DebugLog.error('Step 5: video $refs.video is NULL! Alpine template may not have rendered.');
                    this.cameraError = 'Video element not found in DOM. Ref is null.';
                    DebugLog.show();
                    return;
                }

                this.isCameraReady = true;
                DebugLog.ok('=== CAMERA INIT COMPLETE ===');

                // Log video state after a delay to check if it's actually rendering
                setTimeout(() => {
                    if (video) {
                        DebugLog.info('Video state after 2s: readyState=' + video.readyState +
                            ' paused=' + video.paused + ' ended=' + video.ended +
                            ' videoWidth=' + video.videoWidth + ' videoHeight=' + video.videoHeight +
                            ' currentTime=' + video.currentTime.toFixed(2));
                        if (video.videoWidth === 0 || video.videoHeight === 0) {
                            DebugLog.warn('VIDEO DIMENSIONS ARE 0 — camera feed is BLACK');
                            DebugLog.warn('This usually means: permission denied at WebView level, or stream has no active video track');
                            const tracks = this.stream ? this.stream.getVideoTracks() : [];
                            tracks.forEach((t, i) => {
                                DebugLog.info(`Track ${i} state: readyState=${t.readyState} enabled=${t.enabled} muted=${t.muted}`);
                            });
                        }
                    }
                }, 2000);

            } catch (err) {
                DebugLog.error('=== CAMERA INIT CRASHED ===');
                DebugLog.error('Error:', err.name, err.message);
                if (err.stack) DebugLog.error('Stack:', err.stack);
                DebugLog.show();

                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    this.cameraError = 'Camera permission denied. Error: ' + err.message;
                } else {
                    this.cameraError = 'Camera failed: ' + err.name + ': ' + err.message;
                }
            }
        },

        captureWithCountdown() {
            DebugLog.step('Capture countdown started');
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
            DebugLog.step('Capturing photo...');
            BosalatiSounds.shutter();
            const video = this.$refs.video;

            if (!video) {
                DebugLog.error('CAPTURE FAILED: video ref is null');
                DebugLog.show();
                return;
            }

            DebugLog.info('Video state at capture: videoWidth=' + video.videoWidth + ' videoHeight=' + video.videoHeight +
                ' readyState=' + video.readyState + ' paused=' + video.paused);

            if (!video.videoWidth || !video.videoHeight) {
                DebugLog.error('CAPTURE FAILED: videoWidth or videoHeight is 0 — no camera feed');
                DebugLog.show();
                this.cameraError = 'Cannot capture: camera feed has no video data (videoWidth=' + video.videoWidth + ')';
                return;
            }

            try {
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
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 768, 1024);
                this.photo = canvas.toDataURL('image/jpeg', 0.85);
                DebugLog.ok('Photo captured, dataURL length: ' + this.photo.length);
            } catch (captureErr) {
                DebugLog.error('CAPTURE EXCEPTION:', captureErr.name, captureErr.message);
                if (captureErr.stack) DebugLog.error('Stack:', captureErr.stack);
                DebugLog.show();
                this.cameraError = 'Capture error: ' + captureErr.message;
            }
        },

        retake() {
            this.photo = null;
            DebugLog.info('Photo cleared (retake)');
        },

        submitPhoto() {
            DebugLog.step('Submitting photo...');
            BosalatiSounds.click();
            const app = Alpine.closestDataStack(this.$el).find(d => d.capturedPhoto !== undefined);
            if (app) {
                app.capturedPhoto = this.photo;
                this.stopCamera();
                app.screen = 'processing';
                setTimeout(() => { app.startGeneration(); }, 500);
            } else {
                DebugLog.error('submitPhoto: could not find parent app data');
            }
        },

        stopCamera() {
            DebugLog.info('Stopping camera...');
            if (this._countdownInterval) {
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
            }
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    DebugLog.info('Stopping track:', track.label, 'kind:', track.kind);
                    track.stop();
                });
                this.stream = null;
            }
        }
    };
}
