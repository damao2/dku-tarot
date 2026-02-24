/* DKU Tarot - Gesture Engine (MediaPipe Hands) */
const GestureEngine = (() => {
  let lastWristX = null;
  let swipeCooldown = 0;

  function handGestureFromLandmarks(landmarks, handedness) {
    if (!landmarks || landmarks.length < 21) return { gesture: '-', fingerCount: 0 };

    const fingerTips = [4, 8, 12, 16, 20];
    const fingerPips = [2, 6, 10, 14, 18];

    const isRight = handedness === 'Right';
    const thumbExtended = isRight
      ? landmarks[4].x > landmarks[3].x
      : landmarks[4].x < landmarks[3].x;

    let extendedCount = thumbExtended ? 1 : 0;
    for (let i = 1; i < 5; i += 1) {
      if (landmarks[fingerTips[i]].y < landmarks[fingerPips[i]].y) {
        extendedCount += 1;
      }
    }

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const isPinch = pinchDist < 0.05;

    const wrist = landmarks[0];
    const tips = [8, 12, 16, 20];
    let avgDist = 0;
    tips.forEach((idx) => {
      const tip = landmarks[idx];
      const d = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
      avgDist += d;
    });
    avgDist /= tips.length;

    const isFist = avgDist < 0.23;
    const isOpenPalm = avgDist > 0.4;

    if (isFist) {
      return { gesture: 'Fist', fingerCount: 0 };
    }
    if (isPinch) {
      return { gesture: 'Pinch', fingerCount: extendedCount };
    }
    if (isOpenPalm) {
      return { gesture: 'Open Palm', fingerCount: 5 };
    }

    return { gesture: 'Hand Pose', fingerCount: extendedCount };
  }

  function detectSwipe(wrist) {
    if (!wrist) return null;
    if (lastWristX === null) {
      lastWristX = wrist.x;
      return null;
    }

    const delta = wrist.x - lastWristX;
    lastWristX = wrist.x;
    if (swipeCooldown > 0) {
      swipeCooldown -= 1;
      return null;
    }

    if (delta > 0.06) {
      swipeCooldown = 10;
      return 'Swipe Right';
    }
    if (delta < -0.06) {
      swipeCooldown = 10;
      return 'Swipe Left';
    }
    return null;
  }

  function init({
    videoEl,
    canvasEl,
    onFrame,
    onStatus,
  }) {
    if (!videoEl || !canvasEl) return;

    const canvasCtx = canvasEl.getContext('2d');

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results) => {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const handedness = results.multiHandedness?.[0]?.label || 'Right';

        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: '#c5a065',
          lineWidth: 2
        });
        drawLandmarks(canvasCtx, landmarks, {
          color: '#ffffff',
          lineWidth: 1,
          radius: 3
        });

        const { gesture, fingerCount } = handGestureFromLandmarks(landmarks, handedness);
        const swipe = detectSwipe(landmarks[0]);
        const palm = landmarks[9];

        if (onFrame) {
          onFrame({
            gesture,
            fingerCount,
            swipe,
            palm: { x: 1 - palm.x, y: palm.y },
          });
        }

        if (onStatus) onStatus('Hand detected');
      } else {
        if (onFrame) onFrame({ gesture: '-', fingerCount: 0, swipe: null, palm: null });
        if (onStatus) onStatus('No hand detected');
      }

      canvasCtx.restore();
    });

    const camera = new Camera(videoEl, {
      onFrame: async () => {
        await hands.send({ image: videoEl });
      },
      width: 1280,
      height: 720,
    });

    camera.start().catch((err) => {
      if (onStatus) onStatus(err?.message || 'Camera failed to start');
    });
  }

  return { init };
})();
