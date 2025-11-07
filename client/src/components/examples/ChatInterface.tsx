import { ChatInterface } from '../ChatInterface';

export default function ChatInterfaceExample() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <ChatInterface onAuthSuccess={() => console.log('Authentication successful!')} />
    </div>
  );
}
