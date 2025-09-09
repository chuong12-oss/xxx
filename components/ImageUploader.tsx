/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, DragEvent } from 'react';
import { cn } from '../lib/utils';

interface ImageUploaderProps {
    onUpload: (dataUrl: string) => void;
    uploadedImage: string | null;
    onRemove: () => void;
    title?: string;
}

const ImageUploader = ({ onUpload, uploadedImage, onRemove, title }: ImageUploaderProps) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            onUpload(reader.result as string);
        };
        reader.onerror = () => console.error("Failed to read the image file.");
        reader.readAsDataURL(file);
    };
    
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };
    const handleDrop = (e: DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]); };
    const handleDragEnter = (e: DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
    const handleDragLeave = (e: DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };

    return (
        <div className="flex flex-col gap-2">
            {title && <label className="block text-sm font-medium text-neutral-300">{title}</label>}
            {uploadedImage ? (
                <div className="relative group">
                    <img src={uploadedImage} alt="Uploaded preview" className="w-full rounded-lg object-cover aspect-[4/5]" />
                    <button onClick={onRemove} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-opacity opacity-0 group-hover:opacity-100" aria-label="Remove image">
                        <CloseIcon />
                    </button>
                </div>
            ) : (
                <label htmlFor="image-upload" onDrop={handleDrop} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragEnter} className={cn(
                    'cursor-pointer aspect-[4/5] w-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors p-4',
                    isDragOver ? 'border-neutral-500 bg-neutral-800/50' : 'border-neutral-700 hover:border-neutral-600'
                )}>
                    <UploadIcon />
                    <span className="text-neutral-400 font-semibold text-sm mt-2 text-center">Drop image here</span>
                    <span className="text-neutral-500 text-xs mt-1">or click to upload</span>
                    <input id="image-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                </label>
            )}
        </div>
    );
};

// --- SVG Icons ---
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

export default ImageUploader;
