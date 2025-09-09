/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generatePosedVariation } from './services/geminiService';
import ImageUploader from './components/ImageUploader';
import ImageCard from './components/ImageCard';
import { cn } from './lib/utils';

// --- Type Definitions ---
type PoseGuidanceMode = 'text' | 'reference' | 'sketch';
interface GeneratedImage {
  id: number;
  status: 'pending' | 'done' | 'error';
  url?: string;
  error?: string;
}

// --- Predefined Pose Variations (for when text prompt is empty) ---
const RANDOM_POSES = [
    "A full-body shot, walking confidently towards the camera.",
    "A portrait taken from a side profile.",
    "A three-quarter portrait, looking thoughtfully away.",
    "A medium shot with arms crossed, looking at the camera.",
    "A dynamic full-body shot captured mid-jump.",
    "A photo taken from a high angle, looking down.",
    "A close-up, glancing over their shoulder.",
    "A full-body shot in a crouching pose.",
    "A candid-style photo, captured in an unposed moment.",
    "A professional headshot from the chest up with a friendly smile."
];

// --- Main App Component ---
function App() {
    const [modelImage, setModelImage] = useState<string | null>(null);
    const [poseReferenceImage, setPoseReferenceImage] = useState<string | null>(null);
    const [poseSketchImage, setPoseSketchImage] = useState<string | null>(null);
    const [poseGuidanceMode, setPoseGuidanceMode] = useState<PoseGuidanceMode>('text');
    
    const [numVariations, setNumVariations] = useState<number>(5);
    const [customPrompt, setCustomPrompt] = useState<string>('');
    
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const handleGenerate = async () => {
        if (!modelImage) {
            setError("Please upload a model image first.");
            return;
        }
        if (poseGuidanceMode === 'reference' && !poseReferenceImage) {
            setError("Please upload a reference image for pose extraction.");
            return;
        }
        if (poseGuidanceMode === 'sketch' && !poseSketchImage) {
            setError("Please upload a sketch for pose guidance.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress(0);

        const prompts: string[] = customPrompt.trim() !== ''
            ? Array(numVariations).fill(customPrompt)
            : Array.from({ length: numVariations }, () => RANDOM_POSES[Math.floor(Math.random() * RANDOM_POSES.length)]);
        
        setGeneratedImages(prompts.map((_, i) => ({ id: i, status: 'pending' })));

        const concurrencyLimit = 5;
        let completedCount = 0;
        
        const processQueue = async () => {
            const queue = [...prompts.entries()];
            
            const processNext = async () => {
                if (queue.length === 0) return;

                const [index, promptText] = queue.shift()!;
                
                try {
                    const url = await generatePosedVariation(modelImage, {
                        text: poseGuidanceMode === 'text' ? promptText : customPrompt, // Use custom prompt for refinement with image poses
                        referenceImage: poseGuidanceMode === 'reference' ? poseReferenceImage! : undefined,
                        sketchImage: poseGuidanceMode === 'sketch' ? poseSketchImage! : undefined,
                    });
                    setGeneratedImages(prev => prev.map(img => img.id === index ? { ...img, status: 'done', url } : img));
                } catch (e) {
                    const message = e instanceof Error ? e.message : "An unknown error occurred during generation.";
                    setGeneratedImages(prev => prev.map(img => img.id === index ? { ...img, status: 'error', error: message } : img));
                } finally {
                    completedCount++;
                    setProgress(completedCount);
                }
            };
            
            const workers = Array(concurrencyLimit).fill(null).map(async () => {
                while(queue.length > 0) {
                    await processNext();
                }
            });
            
            await Promise.all(workers);
        };

        await processQueue();
        setIsLoading(false);
    };

    const handleDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-model-variation-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const isGenerateDisabled = isLoading || !modelImage || (poseGuidanceMode === 'reference' && !poseReferenceImage) || (poseGuidanceMode === 'sketch' && !poseSketchImage);

    const TabButton = ({ mode, children }: { mode: PoseGuidanceMode, children: React.ReactNode }) => (
        <button
            onClick={() => setPoseGuidanceMode(mode)}
            className={cn(
                "flex-1 text-center text-sm font-semibold py-2 px-3 rounded-md transition-colors duration-200",
                poseGuidanceMode === mode ? 'bg-neutral-200 text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            )}
        >
            {children}
        </button>
    );

    return (
        <main className="bg-neutral-900 text-neutral-200 min-h-screen w-full flex flex-col p-4 sm:p-8 overflow-x-hidden">
            <header className="w-full max-w-6xl mx-auto text-center mb-8">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-white to-neutral-400 tracking-tight">AI Model Generator</h1>
                <p className="text-lg md:text-xl text-neutral-400 mt-2">Create stunning model variations using text, photos, or sketches.</p>
            </header>

            <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 flex-1">
                {/* --- Controls Column --- */}
                <aside className="w-full lg:w-1/3 lg:max-w-sm flex-shrink-0 bg-black/20 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-6 self-start lg:sticky lg:top-8">
                    <ImageUploader title="1. Upload Model Image" onUpload={setModelImage} uploadedImage={modelImage} onRemove={() => setModelImage(null)} />
                    
                    <div className="flex flex-col gap-3">
                        <label className="text-sm font-medium text-neutral-300">2. Choose Pose Guidance</label>
                        <div className="flex bg-neutral-900 border border-neutral-700 rounded-lg p-1 gap-1">
                            <TabButton mode="text">Text Prompt</TabButton>
                            <TabButton mode="reference">Reference</TabButton>
                            <TabButton mode="sketch">Sketch</TabButton>
                        </div>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={poseGuidanceMode}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {poseGuidanceMode === 'text' && (
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="e.g., side profile, dramatic lighting..."
                                        rows={4}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-md p-2 text-neutral-200 focus:ring-2 focus:ring-neutral-500 transition"
                                    />
                                )}
                                {poseGuidanceMode === 'reference' && <ImageUploader onUpload={setPoseReferenceImage} uploadedImage={poseReferenceImage} onRemove={() => setPoseReferenceImage(null)} />}
                                {poseGuidanceMode === 'sketch' && <ImageUploader onUpload={setPoseSketchImage} uploadedImage={poseSketchImage} onRemove={() => setPoseSketchImage(null)} />}
                            </motion.div>
                        </AnimatePresence>
                         {(poseGuidanceMode === 'reference' || poseGuidanceMode === 'sketch') && (
                             <div className="flex flex-col gap-2">
                                <label htmlFor="refinement-prompt" className="text-xs font-medium text-neutral-400">Refinement (Optional)</label>
                                 <input
                                    id="refinement-prompt"
                                    type="text"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="e.g., add dramatic lighting"
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-md p-2 text-neutral-200 text-sm focus:ring-2 focus:ring-neutral-500 transition"
                                />
                             </div>
                         )}
                    </div>
                    
                    <div>
                        <label htmlFor="num-variations" className="block text-sm font-medium text-neutral-300 mb-2">3. Number of Variations</label>
                        <select
                            id="num-variations"
                            value={numVariations}
                            onChange={(e) => setNumVariations(Number(e.target.value))}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-md p-2 text-neutral-200 focus:ring-2 focus:ring-neutral-500 transition"
                        >
                            {[1, 5, 10, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerateDisabled}
                        className="w-full text-lg flex items-center justify-center gap-2 text-black font-bold py-3 px-6 rounded-lg bg-neutral-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                    >
                        {isLoading ? 'Generating...' : 'Generate'}
                    </button>
                    
                    {isLoading && (
                         <div className="text-center text-neutral-400">
                             <div className="w-full bg-neutral-700 rounded-full h-2.5">
                                 <div className="bg-neutral-300 h-2.5 rounded-full" style={{ width: `${(progress / numVariations) * 100}%` }}></div>
                             </div>
                             <p className="mt-2 text-sm">{`Generated ${progress} of ${numVariations}`}</p>
                         </div>
                    )}
                    {error && <p className="text-sm text-red-400 bg-red-900/50 border border-red-500/50 rounded-md p-3">{error}</p>}
                </aside>

                {/* --- Gallery Column --- */}
                <section className="flex-1 min-w-0">
                    <AnimatePresence>
                        {generatedImages.length > 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
                            >
                                {generatedImages.map((image) => (
                                    <ImageCard key={image.id} image={image} onDownload={handleDownload} />
                                ))}
                            </motion.div>
                        ) : (
                            <div className="flex items-center justify-center h-full min-h-[50vh] text-neutral-500 text-center border-2 border-dashed border-neutral-800 rounded-2xl p-8">
                                <p>Generated images will appear here.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </section>
            </div>
        </main>
    );
}

export default App;
