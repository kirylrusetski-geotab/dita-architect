import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Message } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const DITA_SYSTEM_INSTRUCTION = `
You are "DITA-Bot," an expert DITA XML technical writer and editor. Your goal is to help users create, migrate, and edit DITA content.

Capabilities:
1. MIGRATION: If the user provides unstructured text, convert it into valid DITA XML. Automatically detect the best topic type (Concept, Task, Reference). Wrap content in appropriate tags.
2. ASSISTANCE: Answer questions about DITA, provide tutorials, and fix XML errors.
3. EDITING: Help the user refine their content.
4. ANALYSIS: Provide insights on the content's readability if available in the context.

Rules for Interaction:
- **Be Conversational**: Use natural language. Be helpful and friendly.
- **Use Markdown**: Format your responses using Markdown (lists, code blocks, bold). **DO NOT use headers** (e.g., #, ##, ###); use **bold** text for section titles instead.
- **Consult First, Edit Later**: Do NOT generate the full XML edit immediately unless the user explicitly commands it (e.g., "Fix this", "Apply changes", "Change X to Y"). 
- **Propose Changes**: If the user asks a vague question or discusses an improvement, explain *what* you would do. Ask if they want you to apply the changes to the editor.
- **Readability**: If the user asks about readability, complexity, or "score", refer STRICTLY to the [READABILITY METRICS] provided in the context. Quote the numeric Flesch Score and the difficulty label.
- **Generating XML**: 
  - When you DO generate DITA XML (after confirmation or explicit command), append it at the very end of your response inside a \`\`\`xml code block.
  - Ensure the XML is valid DITA.
  - **Links**: If the input text contains hyperlinks, convert them into <xref href="URL">text</xref> tags within the DITA content.
  - **UI Elements**: If the text mentions buttons, labels, menus, or window titles, wrap them in <uicontrol>text</uicontrol> tags.
  - **Emphasis**: Use <b> for bolding and <i> for italics where appropriate.
- **Migration**: When performing a direct MIGRATION task (converting raw text provided without conversation), return ONLY the raw XML string.
`;

export interface MigrationOptions {
  topicType: 'concept' | 'task' | 'reference' | 'auto';
  title?: string;
  shortDesc?: string;
  additionalInstructions?: string;
  autoShortDesc?: boolean;
}

export const extractDitaMetadata = async (text: string): Promise<{ title: string; shortDesc: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following text and extract a suitable Title and Short Description for a DITA topic.
      
      Text to analyze:
      ${text}
      
      Return JSON format: { "title": "string", "shortDesc": "string" }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            shortDesc: { type: Type.STRING }
          }
        }
      }
    });

    const json = JSON.parse(response.text || '{}');
    return {
      title: json.title || 'Untitled Topic',
      shortDesc: json.shortDesc || ''
    };
  } catch (error) {
    console.error("Metadata extraction error:", error);
    return { title: 'Untitled Topic', shortDesc: '' };
  }
};

export const migrateToDita = async (htmlContent: string, options?: MigrationOptions): Promise<string> => {
  try {
    const typeInstruction = options?.topicType && options.topicType !== 'auto' 
      ? `FORCE the output to be a DITA <${options.topicType}>.` 
      : 'Determine if it is a Concept, Task, or Reference based on the content.';
    
    const titleInstruction = options?.title ? `Use exactly this title: "${options.title}"` : '';
    const shortDescInstruction = options?.shortDesc ? `Use exactly this shortdesc: "${options.shortDesc}"` : (options?.autoShortDesc ? 'Generate a concise shortdesc.' : '');
    const userInstruction = options?.additionalInstructions ? `Additional user instructions: ${options.additionalInstructions}` : '';

    const prompt = `Convert the following HTML content into a valid DITA XML topic. 
    ${typeInstruction}
    ${titleInstruction}
    ${shortDescInstruction}
    ${userInstruction}
    
    IMPORTANT RULES:
    1. The input content is HTML. Parse it to extract structure and text.
    2. Convert hyperlinks (<a> tags) into <xref href="URL">text</xref> tags.
    3. Detect UI elements (often in <code>, <kbd>, or styled <span> tags) and wrap their text in <uicontrol>text</uicontrol> tags.
    4. Convert <strong>/<b> tags to <b> and <em>/<i> tags to <i>.
    5. Convert <h1>, <h2> etc. to a main <title> and nested <section>s with <title>s where appropriate.
    6. Convert <ul>/<ol> into DITA lists.
    7. If it is a Task topic, use <steps> with nested <cmd>, <info>, and <substeps> where appropriate.
    8. Return ONLY the raw XML code without Markdown formatting or explanations.
    
    HTML Content to convert:
    ${htmlContent}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: DITA_SYSTEM_INSTRUCTION,
      }
    });

    const output = response.text || '';
    // Clean up any potential markdown code blocks if the model ignores the "no markdown" instruction
    return output.replace(/^```xml\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
  } catch (error) {
    console.error("Migration error:", error);
    throw new Error("Failed to migrate content to DITA.");
  }
};

export const chatWithDitaBot = async (
  history: Message[], 
  newMessage: string, 
  currentContent?: string,
  readabilityContext?: { score: number; label: string }
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: DITA_SYSTEM_INSTRUCTION,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
    });

    let messageToSend = newMessage;
    
    // Construct rich context
    if (currentContent) {
      messageToSend += `\n\n[CONTEXT - CURRENT EDITOR CONTENT]:\n${currentContent}`;
      
      if (readabilityContext) {
        messageToSend += `\n\n[CONTEXT - READABILITY METRICS]:\nFlesch Reading Ease Score: ${readabilityContext.score}/100\nDifficulty Level: ${readabilityContext.label}`;
      }
    }

    const response: GenerateContentResponse = await chat.sendMessage({
      message: messageToSend
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Chat error:", error);
    throw new Error("I'm having trouble connecting to the DITA services right now.");
  }
};