import { ChatMessage } from '../ChatMessage';

export default function ChatMessageExample() {
  return (
    <div className="p-8 max-w-2xl">
      <ChatMessage 
        role="ai" 
        content="Welcome! To verify your identity, please tell me a story about a memorable moment from your childhood." 
        timestamp="2:30 PM"
      />
      <ChatMessage 
        role="user" 
        content="I remember when I was seven, my family took a trip to the lake. We rented a small blue rowboat and my father taught me how to fish. The morning mist was still on the water, and I could hear loons calling in the distance." 
        timestamp="2:31 PM"
      />
      <ChatMessage 
        role="ai" 
        content="Thank you for sharing that memory. I'm analyzing the narrative patterns, emotional authenticity, and linguistic markers..." 
        timestamp="2:31 PM"
      />
    </div>
  );
}
