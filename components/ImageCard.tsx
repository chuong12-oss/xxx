/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion } from 'framer-motion';

interface GeneratedImage {
  id: number;
  status: 'pending' | 'done' | 'error';
  url?: string;
  error?: string;
}

interface ImageCardProps {
    image: GeneratedImage;
    onDownload: (url: string) => void;
}

const ImageCard = ({ image, onDownload }: ImageCardProps) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="aspect-[4/5] bg-black/20 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-500 relative overflow-hidden group"
        >
            {image.status === 'pending' && <Spinner />}
            {image.status === 'error' && (
                <div className="p-4 text-center text-red-400">
                    <p className="font-semibold text-sm">Generation Failed</p>
                    <p className="text-xs mt-1">{image.error}</p>
                </div>
            )}
            {image.status === 'done' && image.url && (
                <>
                    <img src={image.url} alt={`Generated variation ${image.id}`} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => onDownload(image.url!)} 
                            className="p-2 bg-black/60 rounded-full text-white hover:bg-black/80"
                            aria-label="Download image"
                        >
                            <DownloadIcon />
                        </button>
                    </div>
                </>
            )}
        </motion.div>
    );
};

// --- SVG Icons ---
const Spinner = () => <svg className="animate-spin h-8 w-8 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;

export default ImageCard;
