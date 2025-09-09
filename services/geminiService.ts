/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Fix: Add Type to imports for JSON schema support
import { GoogleGenAI, Modality, GenerateContentResponse, Part, Type } from "@google/genai";

// --- Gemini API Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper Functions ---
const fileToGenerativePart = (dataUrl: string): Part => {
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL format');
    return { inlineData: { data: match[2], mimeType: match[1] } };
};

const extractImageData = (response: GenerateContentResponse): string => {
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    if (response.candidates[0].finishReason !== 'STOP' && response.candidates[0].finishReason !== 'MAX_TOKENS') {
         throw new Error(`Image generation stopped due to: ${response.candidates[0].finishReason}. Check safety ratings.`);
    }
    throw new Error("No image was generated. The model may have refused the request.");
};

// Fix: Add generic helper for image model calls to reduce repetition
// Generic function for making image generation calls
async function callGeminiImageModel(parts: Part[]): Promise<GenerateContentResponse> {
    return ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
}

// --- Main Generation Service ---
interface PoseGuidance {
    text?: string;
    referenceImage?: string;
    sketchImage?: string;
}

export async function generatePosedVariation(modelImage: string, guidance: PoseGuidance): Promise<string> {
    const parts: Part[] = [];
    let prompt = `Your task is to regenerate the person from the provided primary model image.

**CRITICAL INSTRUCTIONS (MUST be followed):**
1.  **Preserve Identity & Outfit:** The person's face, body, and clothing in the generated image MUST be 100% identical to the primary model image (the first image provided). This is the most important rule.
2.  **Apply New Pose/Angle:** Change the person's pose and the camera angle according to the specific guidance provided below.
3.  **Vary Background & Style:** The background should be new, diverse, and photorealistic, complementing the new pose. The overall photographic style (e.g., lighting, mood) can also be varied creatively.
`;

    // The model image is always the first part
    parts.push(fileToGenerativePart(modelImage));

    if (guidance.referenceImage) {
        parts.push(fileToGenerativePart(guidance.referenceImage));
        prompt += `\n**Pose Guidance:** The second image provided is a pose reference. Re-create the person from the primary model image in the exact pose shown in the reference image. The identity and clothing must come from the primary model image; ONLY the pose comes from the reference image.`;
    } else if (guidance.sketchImage) {
        parts.push(fileToGenerativePart(guidance.sketchImage));
        prompt += `\n**Pose Guidance:** The second image provided is a sketch. Re-create the person from the primary model image following the pose and composition outlined in the sketch. The identity and clothing must come from the primary model image.`;
    } else if (guidance.text) {
        prompt += `\n**Pose Guidance:** Re-create the person in this specific pose/style: "${guidance.text}"`;
    }

    // Add refinement prompt if it exists and we're in an image-guidance mode
    if ((guidance.referenceImage || guidance.sketchImage) && guidance.text && guidance.text.trim() !== '') {
        prompt += `\n**Refinement:** Additionally, apply the following style: "${guidance.text}".`;
    }
    
    parts.push({ text: prompt });

    // Fix: Use generic helper function
    const response = await callGeminiImageModel(parts);
    
    return extractImageData(response);
}

// Fix: Implement and export missing functions
export async function extractOutfitFromImage(imageUrl: string, instructions?: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageUrl)];
    let prompt = `Your task is to meticulously isolate the complete outfit (all clothing items) worn by the person in the provided image.

**CRITICAL REQUIREMENTS:**
1.  **Remove the Person:** The final image must NOT contain any part of the person (skin, hair, etc.).
2.  **Transparent Background:** The output MUST be a PNG image with a completely transparent background.
3.  **Preserve the Outfit:** The clothing should be clean, complete, and retain its original colors, textures, and details. It should be presented as if on an invisible mannequin.`;

    if (instructions) {
        prompt += `\n\n**Additional Instructions:** ${instructions}`;
    }

    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generateStyledImage(prompt: string, imageUrls: string[], additionalInstructions?: string): Promise<string> {
    const parts: Part[] = imageUrls.map(url => fileToGenerativePart(url));
    let finalPrompt = prompt;
    if (additionalInstructions) {
        finalPrompt += `\n\n**Additional Instructions:** ${additionalInstructions}`;
    }
    parts.push({ text: finalPrompt });

    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function fillMaskedImage(prompt: string, maskedImageUrl: string, instructions?: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(maskedImageUrl)];
    let finalPrompt = `The provided image has a transparent (or masked) area. Your task is to inpaint this area based on the following instruction: "${prompt}". The result should be a seamless, photorealistic image.`;
    if (instructions) {
        finalPrompt += `\n\n**Refinement:** ${instructions}`;
    }
    parts.push({ text: finalPrompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function removeObjectFromImage(maskedImageUrl: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(maskedImageUrl)];
    const prompt = `The provided image has a transparent (or masked) area. Your task is to inpaint this area, seamlessly removing any object that might have been there. The result should be a photorealistic image where the background is naturally filled in.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function removeBackgroundFromImageAtPoint(imageUrl: string, x: number, y: number): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageUrl)];
    const prompt = `Your task is to remove the background from this image. The primary foreground subject is located at the normalized coordinate (${x.toFixed(2)}, ${y.toFixed(2)}).
    
    **CRITICAL REQUIREMENTS:**
    1.  Precisely identify and isolate the foreground object at the given coordinate.
    2.  The output MUST be a PNG image with a completely transparent background.
    3.  The edges of the foreground object must be clean and sharp.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function swapFacesInImage(imageToModify: string, faceToUse: string, targetFaceCoords?: { x: number; y: number }, instructions?: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageToModify), fileToGenerativePart(faceToUse)];
    let prompt = `Your task is to perform a face swap.
    -   The **first image** is the target image where the face will be replaced.
    -   The **second image** contains the source face to use.

    **CRITICAL REQUIREMENTS:**
    1.  Take the face from the person in the second image and seamlessly blend it onto the person in the first image.
    2.  The skin tone, lighting, and angle must be adjusted to match the target image perfectly for a photorealistic result.
    3.  Preserve the hair, body, and clothing from the first (target) image.`;
    
    if (instructions) {
        prompt += `\n\n**Refinement:** ${instructions}`;
    }

    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generatePhotoBoothImage(imageUrl: string, count: number): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageUrl)];
    const prompt = `Create a photobooth-style image strip.
    
    **CRITICAL REQUIREMENTS:**
    1.  The strip must contain exactly ${count} square panels arranged vertically.
    2.  Each panel must feature the person from the provided image.
    3.  **Vary the Pose:** Each panel must show a different, fun, and expressive photobooth-style pose (e.g., smiling, laughing, winking, surprised, making a funny face).
    4.  **Maintain Identity:** The person's identity and clothing must be consistent across all panels.
    5.  The background should be a simple, consistent photobooth-style backdrop (e.g., a solid color or curtain).
    6.  The final image should be a single, tall image representing the entire strip.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generateCloneEffectImage(imageUrl: string, instructions?: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageUrl)];
    let prompt = `Analyze the provided image and identify the main person in it. Your task is to create a "clone effect" image.
    
    **CRITICAL REQUIREMENTS:**
    1.  Create multiple copies (clones) of the person within the original scene.
    2.  Each clone should be in a slightly different but plausible position and pose.
    3.  The clones should appear to be interacting with each other or the environment in a creative, seamless, and photorealistic way.
    4.  The background and lighting must be consistent and realistic for the composition.`;

    if (instructions) {
        prompt += `\n\n**Refinement:** ${instructions}`;
    }

    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generateBackgroundFromConcept(conceptImageUrl: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(conceptImageUrl)];
    const prompt = `From the provided image, extract the background scene. Your task is to remove any prominent foreground subjects (like people or specific objects) and intelligently fill in the space to create a clean, complete background image. The result should be a photorealistic scene that could be used as a backdrop.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generatePoseFromImage(imageUrl: string, boneNames: string[], instructions?: string): Promise<Record<string, { x: number, y: number, z: number }>> {
    const parts: Part[] = [fileToGenerativePart(imageUrl)];
    let prompt = `Analyze the pose of the person in the image. Provide the XYZ Euler rotations in radians for the following bones: ${boneNames.join(', ')}. The output must be a valid JSON object.`;

    if (instructions) {
        prompt += `\n\n**Refinement:** ${instructions}`;
    }
    
    parts.push({ text: prompt });

    const boneSchema: { [key: string]: any } = {};
    boneNames.forEach(name => {
        boneSchema[name] = {
            type: Type.OBJECT,
            properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                z: { type: Type.NUMBER }
            },
            required: ['x', 'y', 'z'],
        };
    });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: boneSchema,
            }
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
}


export async function generateDepthMap(imageUrl: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageUrl)];
    const prompt = `Generate a high-quality, detailed grayscale depth map for this image. In the output depth map, white should represent objects closest to the camera, and black should represent objects farthest away. The result should be an image.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generateGraphicFromPrompt(prompt: string): Promise<string> {
    const parts: Part[] = [];
    const finalPrompt = `Create a cool, modern, minimalist vector-style graphic suitable for a T-shirt based on this theme: "${prompt}".
    
    **CRITICAL REQUIREMENTS:**
    1.  The graphic must be isolated on a completely transparent background.
    2.  The style should be clean and suitable for printing on apparel.
    3.  The output must be a PNG with a transparent background.`;

    parts.push({ text: finalPrompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}

export async function generateApparelMockup(designUrl: string, apparelPrompt: string): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(designUrl)];
    const prompt = `Create a photorealistic apparel mockup.
    
    **Apparel Details:** ${apparelPrompt}.
    
    **Task:** Place the graphic from the provided image onto the apparel. The graphic should appear naturally on the fabric, with realistic lighting, shadows, and wrinkles. The background should be a simple, clean studio setting.`;

    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function recolorImageWithPaletteImage(imageUrl: string, paletteUrl: string, dimensions: { width: number, height: number }): Promise<string> {
    const parts: Part[] = [fileToGenerativePart(imageUrl), fileToGenerativePart(paletteUrl)];
    const prompt = `Your task is to recolor the first image using the color palette from the second image.
    
    **CRITICAL REQUIREMENTS:**
    1.  Preserve all shapes, details, textures, and lighting from the first image.
    2.  Intelligently apply the colors from the second image's palette to the first image to create a harmonious, visually appealing result.
    3.  The final output image MUST have the exact same dimensions as the original: ${dimensions.width}px wide by ${dimensions.height}px tall.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}


export async function generateTypographicIllustration(phrase: string): Promise<string> {
    const parts: Part[] = [];
    const prompt = `Create a visually stunning, intricate illustration that depicts the scene or concept described by the phrase: "${phrase}".
    
    **CRITICAL AND NON-NEGOTIABLE RULE:** The entire illustration MUST be constructed exclusively using the letters that appear in the phrase "${phrase}". No other shapes, lines, or elements are allowed. The letters themselves should form all the objects, textures, and backgrounds in the image. The style should be creative and artistic. The background should be a solid, light color.`;
    parts.push({ text: prompt });
    const response = await callGeminiImageModel(parts);
    return extractImageData(response);
}