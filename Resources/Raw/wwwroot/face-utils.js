/**
 * =====================================================================
 * FACE API UTILITY LIBRARY - LEGO-STYLE MODULAR FUNCTIONS
 * =====================================================================
 * Based on HppscAttendance flow
 * Each function is chainable and returns a result object
 * 
 * FLOW CHAIN:
 * 1. loadModels() → 2. loadImageFromBase64() → 3. extractFaceVector() 
 *    → 4. compareFaceVectors() → 5. Result
 * 
 * OR for live video:
 * 1. loadModels() → 2. startCamera() → 3. detectLoop() 
 *    → 4. detectEyesClosed() → 5. compareFaceVectors() → 6. Result
 * =====================================================================
 */

const FaceUtils = (function() {
    'use strict';

    // ======================== CONFIGURATION ========================
    const CONFIG = {
        MODEL_URL: 'static/models',
        MATCH_THRESHOLD: 0.5,           // euclidean distance < 0.5 = match
        STRICT_THRESHOLD: 0.4,          // for duplicate detection
        EYE_CLOSE_THRESHOLD: 5,         // pixels for eye closure detection
        MIN_CONFIDENCE: 0.3,            // SSD model confidence
        COOLDOWN_MS: 5000               // attendance cooldown
    };

    // ======================== STATE ========================
    let modelsLoaded = false;
    let videoStream = null;
    let facesDb = {};
    let lastAttendanceTime = 0;

    // ======================== RESULT BUILDER ========================
    /**
     * Creates a standardized result object
     * @param {boolean} success - Operation success
     * @param {*} data - Result data
     * @param {string} error - Error message if failed
     * @param {string} nextStep - Suggested next function in chain
     */
    function createResult(success, data, error = null, nextStep = null) {
        return {
            success: success,
            data: data,
            error: error,
            nextStep: nextStep,
            timestamp: Date.now()
        };
    }

    // ======================== STEP 1: LOAD MODELS ========================
    /**
     * LEGO BLOCK 1: Load all face-api.js models
     * @returns {Promise<Result>} Result with nextStep: 'loadImageFromBase64' or 'startCamera'
     */
    async function loadModels(modelPath = CONFIG.MODEL_URL) {
        try {
            if (modelsLoaded) {
                return createResult(true, { cached: true }, null, 'loadImageFromBase64');
            }

            await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
            await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
            await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
            await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);

            modelsLoaded = true;
            return createResult(true, { 
                models: ['tinyFaceDetector', 'faceLandmark68Net', 'faceRecognitionNet', 'ssdMobilenetv1'] 
            }, null, 'loadImageFromBase64');

        } catch (e) {
            return createResult(false, null, 'Failed to load models: ' + e.message, null);
        }
    }

    // ======================== STEP 2A: LOAD IMAGE ========================
    /**
     * LEGO BLOCK 2A: Load image from base64 string
     * @param {string} base64Data - Base64 encoded image (with or without prefix)
     * @returns {Promise<Result>} Result with data.image, nextStep: 'extractFaceVector'
     */
    async function loadImageFromBase64(base64Data) {
        try {
            if (!base64Data) {
                return createResult(false, null, 'No base64 data provided', null);
            }

            // Ensure data URL prefix
            let src = base64Data;
            if (!src.startsWith('data:image')) {
                src = 'data:image/jpeg;base64,' + src;
            }

            const img = new Image();
            img.src = src;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Image failed to load'));
            });

            return createResult(true, { 
                image: img, 
                width: img.width, 
                height: img.height 
            }, null, 'extractFaceVector');

        } catch (e) {
            return createResult(false, null, 'Failed to load image: ' + e.message, null);
        }
    }

    // ======================== STEP 2B: START CAMERA ========================
    /**
     * LEGO BLOCK 2B: Start camera stream
     * @param {HTMLVideoElement} videoElement - Video element to attach stream
     * @param {string} facingMode - 'user' or 'environment'
     * @returns {Promise<Result>} Result with data.stream, nextStep: 'detectLoop'
     */
    async function startCamera(videoElement, facingMode = 'environment') {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode, width: 320, height: 240 }
            });
            videoElement.srcObject = videoStream;

            await new Promise(resolve => {
                videoElement.onloadeddata = resolve;
            });

            return createResult(true, { 
                stream: videoStream,
                width: videoElement.videoWidth,
                height: videoElement.videoHeight
            }, null, 'detectLoop');

        } catch (e) {
            return createResult(false, null, 'Failed to start camera: ' + e.message, null);
        }
    }

    /**
     * LEGO BLOCK 2B-STOP: Stop camera stream
     */
    function stopCamera() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        return createResult(true, { stopped: true }, null, null);
    }

    // ======================== STEP 3: EXTRACT FACE VECTOR ========================
    /**
     * LEGO BLOCK 3: Extract 128D face vector from image or video
     * @param {HTMLImageElement|HTMLVideoElement} source - Image or video element
     * @param {string} detectorType - 'ssd' for static images, 'tiny' for video
     * @returns {Promise<Result>} Result with data.descriptor (128D array), nextStep: 'compareFaceVectors'
     */
    async function extractFaceVector(source, detectorType = 'ssd') {
        try {
            if (!modelsLoaded) {
                return createResult(false, null, 'Models not loaded. Call loadModels() first.', 'loadModels');
            }

            let detection;
            if (detectorType === 'ssd') {
                // For static images - more accurate
                detection = await faceapi.detectSingleFace(source, 
                    new faceapi.SsdMobilenetv1Options({ minConfidence: CONFIG.MIN_CONFIDENCE })
                ).withFaceLandmarks().withFaceDescriptor();
            } else {
                // For live video - faster
                detection = await faceapi.detectSingleFace(source, 
                    new faceapi.TinyFaceDetectorOptions()
                ).withFaceLandmarks().withFaceDescriptor();
            }

            if (!detection) {
                return createResult(false, null, 'No face detected in image', null);
            }

            const descriptor = Array.from(detection.descriptor);

            return createResult(true, {
                descriptor: descriptor,
                landmarks: detection.landmarks,
                detection: detection.detection,
                box: detection.detection.box
            }, null, 'compareFaceVectors');

        } catch (e) {
            return createResult(false, null, 'Failed to extract face vector: ' + e.message, null);
        }
    }

    // ======================== STEP 4: COMPARE VECTORS ========================
    /**
     * LEGO BLOCK 4A: Calculate Euclidean distance between two vectors
     * @param {number[]} vectorA - First 128D vector
     * @param {number[]} vectorB - Second 128D vector
     * @returns {number} Euclidean distance
     */
    function euclideanDistance(vectorA, vectorB) {
        if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
            return Infinity;
        }
        return Math.sqrt(vectorA.reduce((sum, v, i) => sum + Math.pow(v - vectorB[i], 2), 0));
    }

    /**
     * LEGO BLOCK 4B: Compare face vector against reference
     * @param {number[]} vectorA - Vector to check
     * @param {number[]} vectorB - Reference vector
     * @param {number} threshold - Match threshold (default 0.5)
     * @returns {Result} Result with match status and confidence
     */
    function compareFaceVectors(vectorA, vectorB, threshold = CONFIG.MATCH_THRESHOLD) {
        const distance = euclideanDistance(vectorA, vectorB);
        const isMatch = distance < threshold;
        const confidence = Math.max(0, Math.min(100, ((1 - distance) * 100)));

        return createResult(true, {
            isMatch: isMatch,
            distance: distance,
            confidence: confidence.toFixed(2),
            threshold: threshold
        }, null, 'handleResult');
    }

    /**
     * LEGO BLOCK 4C: Find best match in database
     * @param {number[]} descriptor - Vector to match
     * @param {number} threshold - Match threshold
     * @returns {Result} Result with best match info
     */
    function findMatchInDb(descriptor, threshold = CONFIG.MATCH_THRESHOLD) {
        let best = { name: null, distance: Infinity };

        for (const [name, stored] of Object.entries(facesDb)) {
            const dist = euclideanDistance(descriptor, stored);
            if (dist < best.distance) {
                best = { name, distance: dist };
            }
        }

        const isMatch = best.distance < threshold;
        const confidence = Math.max(0, Math.min(100, ((1 - best.distance) * 100)));

        return createResult(true, {
            isMatch: isMatch,
            name: isMatch ? best.name : null,
            distance: best.distance,
            confidence: confidence.toFixed(2),
            threshold: threshold
        }, null, 'handleResult');
    }

    // ======================== STEP 5: LIVENESS DETECTION ========================
    /**
     * LEGO BLOCK 5: Detect if eyes are closed (liveness check)
     * @param {Object} landmarks - Face landmarks from detection
     * @returns {Result} Result with eyesClosed boolean
     */
    function detectEyesClosed(landmarks) {
        try {
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();

            // Vertical distance between upper and lower eyelid points
            const leftDist = Math.abs(leftEye[1].y - leftEye[5].y);
            const rightDist = Math.abs(rightEye[1].y - rightEye[5].y);

            const eyesClosed = (leftDist < CONFIG.EYE_CLOSE_THRESHOLD && 
                               rightDist < CONFIG.EYE_CLOSE_THRESHOLD);

            return createResult(true, {
                eyesClosed: eyesClosed,
                leftEyeOpen: leftDist,
                rightEyeOpen: rightDist,
                threshold: CONFIG.EYE_CLOSE_THRESHOLD
            }, null, eyesClosed ? 'compareFaceVectors' : 'detectLoop');

        } catch (e) {
            return createResult(false, null, 'Failed to detect eyes: ' + e.message, null);
        }
    }

    // ======================== UTILITY FUNCTIONS ========================
    /**
     * Register a face descriptor to database
     * @param {string} name - Name/ID for the face
     * @param {number[]} descriptor - 128D face vector
     * @param {boolean} checkDuplicate - Check for similar faces
     */
    function registerFace(name, descriptor, checkDuplicate = true) {
        if (checkDuplicate) {
            const match = findMatchInDb(descriptor, CONFIG.STRICT_THRESHOLD);
            if (match.data.isMatch) {
                return createResult(false, null, 
                    'Similar face already registered as: ' + match.data.name, null);
            }
        }

        facesDb[name] = descriptor;
        return createResult(true, {
            name: name,
            total: Object.keys(facesDb).length
        }, null, null);
    }

    /**
     * Clear face database
     */
    function clearDatabase() {
        facesDb = {};
        return createResult(true, { cleared: true }, null, null);
    }

    /**
     * Capture frame from video as base64
     * @param {HTMLVideoElement} video - Video element
     * @returns {string} Base64 JPEG image
     */
    function captureFrame(video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Check cooldown for attendance
     */
    function checkCooldown() {
        const now = Date.now();
        if ((now - lastAttendanceTime) > CONFIG.COOLDOWN_MS) {
            lastAttendanceTime = now;
            return createResult(true, { canProceed: true }, null, 'compareFaceVectors');
        }
        return createResult(false, { 
            canProceed: false, 
            remainingMs: CONFIG.COOLDOWN_MS - (now - lastAttendanceTime) 
        }, null, null);
    }

    // ======================== FULL FLOW WRAPPERS ========================
    /**
     * COMPLETE FLOW: Verify image against reference vector
     * @param {string} imageBase64 - Base64 image to verify
     * @param {number[]} referenceVector - Reference 128D vector to compare against
     * @param {number} threshold - Match threshold
     * @returns {Promise<Result>} Complete verification result
     */
    async function verifyImageAgainstVector(imageBase64, referenceVector, threshold = CONFIG.MATCH_THRESHOLD) {
        // Step 1: Ensure models loaded
        const modelsResult = await loadModels();
        if (!modelsResult.success) return modelsResult;

        // Step 2: Load image
        const imageResult = await loadImageFromBase64(imageBase64);
        if (!imageResult.success) return imageResult;

        // Step 3: Extract vector
        const vectorResult = await extractFaceVector(imageResult.data.image, 'ssd');
        if (!vectorResult.success) return vectorResult;

        // Step 4: Compare
        const compareResult = compareFaceVectors(vectorResult.data.descriptor, referenceVector, threshold);

        return createResult(true, {
            ...compareResult.data,
            extractedVector: vectorResult.data.descriptor,
            imageSize: { width: imageResult.data.width, height: imageResult.data.height }
        }, null, 'done');
    }

    /**
     * COMPLETE FLOW: Extract vector from base64 image
     * @param {string} imageBase64 - Base64 image
     * @returns {Promise<Result>} Result with 128D vector
     */
    async function extractVectorFromBase64(imageBase64) {
        const modelsResult = await loadModels();
        if (!modelsResult.success) return modelsResult;

        const imageResult = await loadImageFromBase64(imageBase64);
        if (!imageResult.success) return imageResult;

        return await extractFaceVector(imageResult.data.image, 'ssd');
    }

    // ======================== PUBLIC API ========================
    return {
        // Configuration
        CONFIG: CONFIG,

        // Core Lego Blocks
        loadModels: loadModels,
        loadImageFromBase64: loadImageFromBase64,
        startCamera: startCamera,
        stopCamera: stopCamera,
        extractFaceVector: extractFaceVector,
        euclideanDistance: euclideanDistance,
        compareFaceVectors: compareFaceVectors,
        findMatchInDb: findMatchInDb,
        detectEyesClosed: detectEyesClosed,

        // Utilities
        registerFace: registerFace,
        clearDatabase: clearDatabase,
        captureFrame: captureFrame,
        checkCooldown: checkCooldown,

        // Full Flow Wrappers
        verifyImageAgainstVector: verifyImageAgainstVector,
        extractVectorFromBase64: extractVectorFromBase64,

        // State access
        isModelsLoaded: () => modelsLoaded,
        getDatabase: () => ({ ...facesDb }),
        getDatabaseCount: () => Object.keys(facesDb).length
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceUtils;
}
