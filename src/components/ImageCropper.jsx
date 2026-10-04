import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Crop } from 'lucide-react';

export default function ImageCropper({ image, onCropComplete, onCancel }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const extractCroppedImage = async () => {
        try {
            const imageElement = new Image();
            imageElement.src = image;
            await new Promise((resolve) => (imageElement.onload = resolve));

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = croppedAreaPixels.width;
            canvas.height = croppedAreaPixels.height;

            ctx.drawImage(
                imageElement,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                croppedAreaPixels.width,
                croppedAreaPixels.height
            );

            canvas.toBlob((blob) => {
                onCropComplete(blob);
            }, 'image/png');
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: 'white', margin: 0 }}>Crop Image</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onCancel} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #475569', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={extractCroppedImage} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Crop size={16} /> Confirm Crop
                    </button>
                </div>
            </div>
            <div style={{ position: 'relative', flex: 1 }}>
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={undefined}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                />
            </div>
        </div>
    );
}
