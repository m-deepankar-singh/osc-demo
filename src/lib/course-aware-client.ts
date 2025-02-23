import { MultimodalLiveClient } from './multimodal-live-client';
import { Part, GenerativeContentBlob } from '@google/generative-ai';
import { LiveFunctionResponse } from '../multimodal-live-types';

type ClientEventType = 'open' | 'close' | 'audio' | 'content' | 'log' | 'interrupted' | 'toolcall';

export class CourseAwareClient {
  private client: MultimodalLiveClient;
  private courseContext: string | null = null;
  private courseContextSent: boolean = false;
  private language: 'english' | 'hindi';
  private onMarkContextSent: () => void;

  constructor(
    client: MultimodalLiveClient, 
    courseContext: string | null,
    language: 'english' | 'hindi',
    onMarkContextSent: () => void
  ) {
    this.client = client;
    this.courseContext = courseContext;
    this.language = language;
    this.onMarkContextSent = onMarkContextSent;
  }

  send(parts: Part[]) {
    if (this.courseContext && !this.courseContextSent) {
      // Send system prompt with course content
      const systemPrompt: Part = {
        text: `You are a highly intelligent AI assistant named Aradhya designed to help students learn strictly within the provided course content and issue with the platform. Your primary function is to deliver clear, engaging, and interactive explanations in {${this.language}}. You must ONLY communicate in {${this.language}} and maintain consistent language throughout the conversation. You should:

1. Strictly adhere to the course content provided
2. Provide explanations and examples in {${this.language}} only
3. Foster interactive learning through engaging dialogue
4. Encourage active participation from the student
5. Use culturally appropriate examples and explanations for {${this.language}} speakers
6. Maintain a professional yet approachable tone in {${this.language}}
7. If there is an issue with the platform please inform the user and ask them to contact the support team on their respective WhatsApp group.

Course Content:
${this.courseContext}
NOTE: if the user is asking something related to the platform or the course content, you should deny a response about it and ask them to stick questions related to the course content or the platform.
Remember: You must NEVER switch languages during the conversation. Stay in {${this.language}} mode throughout.and KEEP YOUR RESPONSES SHORT AND TO THE POINT/CONCISE.`,
      };

      // Send user message
      this.client.send([systemPrompt, ...parts]);
      this.courseContextSent = true;
      this.onMarkContextSent();
    } else {
      this.client.send(parts);
    }
  }

  sendToolResponse(response: { functionResponses: LiveFunctionResponse[] }) {
    return this.client.sendToolResponse(response);
  }

  sendRealtimeInput(parts: GenerativeContentBlob[]) {
    return this.client.sendRealtimeInput(parts);
  }

  // Delegate event handling to the original client
  on(event: ClientEventType, callback: any) {
    this.client.on(event, callback);
    return this;
  }

  off(event: ClientEventType, callback: any) {
    this.client.off(event, callback);
    return this;
  }

  connect(config: any) {
    return this.client.connect(config);
  }

  disconnect() {
    this.client.disconnect();
  }
} 