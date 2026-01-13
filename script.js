document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        before: { img: null, y: 0, scale: 1 },
        after: { img: null, y: 0, scale: 1 },
        slash: { ratio: 0.5, isDragging: false }
    };

    // Elements
    const beforeInput = document.getElementById('before-input');
    const afterInput = document.getElementById('after-input');
    const beforeUpload = document.getElementById('before-upload');
    const afterUpload = document.getElementById('after-upload');
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resultSection = document.getElementById('result-section');
    const outputCanvas = document.getElementById('output-canvas');

    // Event Listeners for Uploads
    setupUploadZone('before');
    setupUploadZone('after');

    function setupUploadZone(type) {
        const zone = document.getElementById(`${type}-upload`);
        const input = document.getElementById(`${type}-input`);
        const container = document.getElementById(`${type}-crop-container`);
        const createImg = document.getElementById(`${type}-img`);
        const viewport = document.getElementById(`${type}-viewport`);

        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => handleFileSelect(e, type));

        // Drag and Drop support
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--primary-color)';
        });
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border-color)';
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files.length) {
                handleFileSelect({ target: { files: e.dataTransfer.files } }, type);
            }
        });

        // Image Drag logic for cropping
        let isDragging = false;
        let startY = 0;
        let initialY = 0;

        viewport.addEventListener('mousedown', (e) => {
            if (!state[type].img) return;
            isDragging = true;
            startY = e.clientY;
            initialY = state[type].y;
            viewport.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const deltaY = e.clientY - startY;
            let newY = initialY + deltaY;

            const viewportHeight = viewport.clientHeight;
            const imgHeight = createImg.clientHeight;

            if (imgHeight > viewportHeight) {
                const minY = viewportHeight - imgHeight;
                const maxY = 0;
                newY = Math.max(minY, Math.min(maxY, newY));
            } else {
                newY = 0;
            }

            state[type].y = newY;
            createImg.style.top = `${newY}px`;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            viewport.style.cursor = 'grab';
        });
    }

    function handleFileSelect(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                state[type].img = img;

                // Update UI
                document.getElementById(`${type}-upload`).classList.add('hidden');
                document.getElementById(`${type}-crop-container`).classList.remove('hidden');

                const domImg = document.getElementById(`${type}-img`);
                domImg.src = img.src;

                // Reset Position
                domImg.style.top = '0px';
                state[type].y = 0;

                checkReady();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function checkReady() {
        if (state.before.img && state.after.img) {
            generateBtn.disabled = false;
        }
    }

    // Canvas Drag Interaction for Slash
    outputCanvas.addEventListener('mousedown', (e) => {
        state.slash.isDragging = true;
        outputCanvas.style.cursor = 'ew-resize';
        updateSlashPosition(e);
    });

    window.addEventListener('mouseup', () => {
        if (state.slash.isDragging) {
            state.slash.isDragging = false;
            outputCanvas.style.cursor = 'default';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (state.slash.isDragging) {
            e.preventDefault(); // Prevent selection
            updateSlashPosition(e);
        }
    });

    function updateSlashPosition(e) {
        const rect = outputCanvas.getBoundingClientRect();
        const scaleX = outputCanvas.width / rect.width;
        const canvasX = (e.clientX - rect.left) * scaleX;

        // Update ratio (clamp between 0.1 and 0.9 to prevent losing the handle)
        let newRatio = canvasX / outputCanvas.width;
        newRatio = Math.max(0.1, Math.min(0.9, newRatio));

        state.slash.ratio = newRatio;
        drawCanvas();
    }

    // Generator Logic
    generateBtn.addEventListener('click', () => {
        state.slash.ratio = 0.5; // Reset to center
        resultSection.classList.remove('hidden');
        drawCanvas();
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });

    function drawCanvas() {
        // Output dimensions: 1500 x 1000 (3:2)
        const width = 1500;
        const height = 1000;
        outputCanvas.width = width;
        outputCanvas.height = height;
        const ctx = outputCanvas.getContext('2d');

        // --- Configuration ---
        const centerX = width * state.slash.ratio;
        // Offset determines the tilt.
        const slantOffset = 100;
        const topX = centerX + slantOffset;
        const bottomX = centerX - slantOffset;

        // --- 1. Draw Before Image (Left Side / Background) ---
        drawLayer(ctx, 'before', width, height);

        // --- 2. Draw After Image (Right Side) with Diagonal Clip ---
        ctx.save();
        ctx.beginPath();
        // Define the polygon for the Right side (After)
        ctx.moveTo(topX, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height);
        ctx.lineTo(bottomX, height);
        ctx.closePath();
        ctx.clip(); // Clip subsequent drawings to this shape

        drawLayer(ctx, 'after', width, height);
        ctx.restore();

        // --- 3. Draw Slash Line (with "Natural Blur" / Shadow) ---
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(topX, 0);
        ctx.lineTo(bottomX, height);
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        // Add glow/shadow for a "natural" integrated look
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.stroke();
        ctx.restore();

        // --- 4. Draw Labels ("Before" / "After") with Glassmorphism ---
        const fontSize = 60;
        const font = `800 ${fontSize}px Inter, sans-serif`;

        // Before Label: Center in Left section
        // Approximation: center (width * ratio) / 2
        drawLabel(ctx, "Before",
            centerX * 0.5, height - 100,
            font, 'center');

        // After Label: Center in Right section
        // Approximation: centerX + ((width - centerX) / 2)
        const rightWidth = width - centerX;
        drawLabel(ctx, "After",
            centerX + (rightWidth / 2), height - 100,
            font, 'center');
    }

    function drawLabel(ctx, text, x, y, font, align) {
        ctx.save();
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.textAlign = align;

        // Measure text for background
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const bgPadding = 30;
        const bgHeight = 100;
        const bgWidth = textWidth + (bgPadding * 2);

        let bgX = x - (bgWidth / 2);
        let bgY = y - (bgHeight / 2);

        // Glassmorphism Background
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 15);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Semi-transparent black
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.fill();
        // Add a subtle border
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();
        ctx.restore();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(text, x, y);

        ctx.restore();
    }

    function drawLayer(ctx, type, canvasW, canvasH) {
        // Map DOM crop to Canvas
        const domImg = document.getElementById(`${type}-img`);
        const viewport = document.getElementById(`${type}-viewport`);
        const img = state[type].img;

        if (!img) return;

        const viewportWidth = viewport.clientWidth;

        // Ratio maps Viewport Pixels -> Natural Pixels
        const ratio = img.naturalWidth / viewportWidth;

        // Calculate Source Rect (Standard Fit Width)
        const srcW = img.naturalWidth;

        // Source Height = Derived from Aspect Ratio of the Target Canvas (which is 1500:1000 = 3:2)
        const srcH = srcW / (canvasW / canvasH);

        // Source Y Start
        const offsetY_px = state[type].y; // e.g. -50
        const srcY = Math.abs(offsetY_px) * ratio;

        // Draw to Canvas
        ctx.drawImage(img,
            0, srcY, srcW, srcH, // Source
            0, 0, canvasW, canvasH  // Dest
        );
    }

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'slash-compare.jpg';
        link.href = outputCanvas.toDataURL('image/jpeg', 0.9);
        link.click();
    });
});
