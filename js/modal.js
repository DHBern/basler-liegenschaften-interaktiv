// js/modal.js
import { state } from './state.js';

let currentImages = [];
let currentImgIndex = 0;
let currentZoom = 1;
let isDragging = false;
let startX, startY;
let translateX = 0, translateY = 0;

function updateTransform() {
    document.getElementById('viewer-img').style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
}

export function openModal(docId) {
    const doc = state.documentsData[docId];
    if (!doc) return;

    document.getElementById('modal-text-content').innerHTML = `
        <h2 style="margin:0 0 5px 0; color: #0076ff;">Document: ${doc.y}</h2>
        <p style="font-size: 15px; margin:0; line-height: 1.5; color:#333;">${doc.txt || 'No summary generated yet.'}</p>
        <p style="font-size: 11px; margin-top:5px; color: #888;">ID: ${docId}</p>
    `;

    currentImages = Array.isArray(doc.img) ? doc.img : (doc.img ? [doc.img] : []);
    currentImages = currentImages.filter(url => url.trim() !== ""); 
    
    const viewerArea = document.getElementById('image-viewer-area');
    if (currentImages.length > 0) {
        viewerArea.style.display = 'flex';
        currentImgIndex = 0;
        updateImageViewer();
    } else {
        viewerArea.style.display = 'none';
    }
    document.getElementById('modal-overlay').style.display = 'flex';
}

export function closeModal(event) {
    if (!event || event.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').style.display = 'none';
    }
}

export function changeImage(direction) {
    currentImgIndex += direction;
    if (currentImgIndex >= currentImages.length) currentImgIndex = 0;
    if (currentImgIndex < 0) currentImgIndex = currentImages.length - 1;
    updateImageViewer();
}

function updateImageViewer() {
    document.getElementById('viewer-img').src = currentImages[currentImgIndex];
    currentZoom = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
    document.getElementById('img-counter').innerText = `${currentImgIndex + 1} / ${currentImages.length}`;
    document.getElementById('prev-btn').style.display = currentImages.length > 1 ? 'block' : 'none';
    document.getElementById('next-btn').style.display = currentImages.length > 1 ? 'block' : 'none';
}

export function setupModalInteractions() {
    const viewerArea = document.getElementById('image-viewer-area');
    
    viewerArea.addEventListener('wheel', function(e) {
        e.preventDefault();
        const zoomSpeed = 0.05;
        const delta = e.deltaY > 0 ? -1 : 1;
        currentZoom += delta * (currentZoom * zoomSpeed * 2); 
        currentZoom = Math.min(Math.max(0.2, currentZoom), 10); 
        updateTransform();
    }, { passive: false });

    viewerArea.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
}