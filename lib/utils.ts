/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fix: Add loadImage helper function
// Helper to load an image from a data URL
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
}

// Fix: Add and export resizeImageToAspectRatio function
/**
 * Resizes an image to a target aspect ratio by padding it with black bars.
 * @param dataUrl The data URL of the image to resize.
 * @param aspectRatioString The target aspect ratio as a string (e.g., "16:9").
 * @returns A promise that resolves to the data URL of the resized image.
 */
export async function resizeImageToAspectRatio(dataUrl: string, aspectRatioString: string): Promise<string> {
    const [width, height] = aspectRatioString.split(':').map(Number);
    if (!width || !height) {
        throw new Error("Invalid aspect ratio format. Expected 'width:height'.");
    }
    const targetAspectRatio = width / height;
    
    const image = await loadImage(dataUrl);
    const originalAspectRatio = image.naturalWidth / image.naturalHeight;

    // If aspect ratios are very close, no need to resize
    if (Math.abs(originalAspectRatio - targetAspectRatio) < 0.01) {
        return dataUrl;
    }

    const canvas = document.createElement('canvas');
    let newWidth, newHeight, x, y;

    if (originalAspectRatio > targetAspectRatio) {
        // Original image is wider than target
        newWidth = image.naturalWidth;
        newHeight = image.naturalWidth / targetAspectRatio;
        x = 0;
        y = (newHeight - image.naturalHeight) / 2;
    } else {
        // Original image is taller than target
        newHeight = image.naturalHeight;
        newWidth = image.naturalHeight * targetAspectRatio;
        y = 0;
        x = (newWidth - image.naturalWidth) / 2;
    }

    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");
    
    ctx.fillStyle = 'black'; // Padding color
    ctx.fillRect(0, 0, newWidth, newHeight);
    ctx.drawImage(image, x, y, image.naturalWidth, image.naturalHeight);

    return canvas.toDataURL('image/png');
}

// Fix: Add and export cropImageToAspectRatio function
/**
 * Crops an image to a target aspect ratio from the center.
 * @param dataUrl The data URL of the image to crop.
 * @param targetAspectRatio The target aspect ratio as a number (width / height).
 * @returns A promise that resolves to the data URL of the cropped image.
 */
export async function cropImageToAspectRatio(dataUrl: string, targetAspectRatio: number): Promise<string> {
    const image = await loadImage(dataUrl);
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    const originalAspectRatio = originalWidth / originalHeight;

    let cropWidth, cropHeight, x, y;

    if (originalAspectRatio > targetAspectRatio) {
        // Original image is wider than target, crop width
        cropHeight = originalHeight;
        cropWidth = originalHeight * targetAspectRatio;
        x = (originalWidth - cropWidth) / 2;
        y = 0;
    } else {
        // Original image is taller than target, crop height
        cropWidth = originalWidth;
        cropHeight = originalWidth / targetAspectRatio;
        y = (originalHeight - cropHeight) / 2;
        x = 0;
    }

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.drawImage(image, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    return canvas.toDataURL('image/png');
}