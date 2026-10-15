import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const original = fs.readFileSync('/tmp/last_uploaded_blueprint.png');
  const annotated = fs.readFileSync('/tmp/annotated_blueprint.png');
  const wallData = fs.readFileSync('/tmp/wall_data.txt', 'utf-8');
  
  const prompt = `
You are a computer vision architect evaluating a wall detection algorithm on a residential blueprint.
I am providing two images:
1. The original blueprint.
2. The annotated blueprint where detected walls are drawn as bright green lines and labeled with their wall ID in red text.

Here is the coordinate data for the 18 detected walls:
${wallData}

Please create a clear validation report.
For every detected wall, state:
- wall ID
- whether it corresponds to a visible structural wall in the uploaded blueprint
- what region/room it belongs to
- whether it is a complete wall or a fragmented piece

Then, identify:
- Which detected walls correspond to the actual exterior walls.
- Which detected walls correspond to actual interior walls.
- Any false-positive walls caused by stairs
- Any false-positive walls caused by cabinets/furniture
- Any false-positive walls caused by text
- Any false-positive walls caused by dimensions
- Any actual structural walls that are missing (look closely at the perimeter and internal dividers, especially gaps not covered by green lines)
- Any walls that are incorrectly merged
- Any walls that are incorrectly split
- Which walls are still fragmented.
- Final wall count.
- Whether the final overlay is accurate enough for conversion to 3D.

End your response with a conclusion of EXACTLY one of the following two options, based on whether the structural representation perfectly aligns with the thick black walls in the drawing and avoids thin details:
READY FOR MILESTONE 3
or
NOT READY — NEEDS ONE MORE DETECTION REFINEMENT
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: original.toString('base64'), mimeType: 'image/png' } },
            { inlineData: { data: annotated.toString('base64'), mimeType: 'image/png' } },
            { text: prompt }
          ]
        }
      ]
    });
    console.log(response.text);
  } catch (e) {
    console.error(e);
  }
}

main();
