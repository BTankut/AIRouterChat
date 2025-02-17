# AI Router Chat

A modern AI chat interface that enables real-time conversations with various AI models using the OpenRouter API. The application supports both single-model and connected-model modes for enhanced interaction capabilities.

## Key Features

- Real-time text streaming with SSE
- Dynamic model selection and switching
- Connected model mode for AI-to-AI interactions
- Per-model pricing display
- Modern and responsive UI
- Secure API key management
- Chat history management

## Operating Modes

### Single Model Mode
- Independent chat with each selected model
- Separate input fields for each model
- Direct model responses without cross-model interaction
- Real-time streaming of responses
- Individual chat history for each model

### Connected Model Mode
- Two models interact with each other
- Single input field for user messages
- Models respond in sequence (up to 5 iterations)
- Model1 responds to user input
- Model2 sees Model1's response and generates its own
- Full conversation context maintained
- Real-time streaming of both models' responses

## Technology Stack

### Frontend
- React 18
- TypeScript
- TanStack Query for API management
- Tailwind CSS for styling
- shadcn/ui for UI components
- Server-Sent Events (SSE) for streaming

### Backend
- Express.js
- Node.js
- OpenRouter API integration
- Environment variable management with dotenv
- Error handling middleware

## Installation

1. Clone the repository
```bash
git clone https://github.com/BTankut/AIRouterChat.git
cd AIRouterChat
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory:
```env
OPENROUTER_API_KEY=your_api_key_here
PORT=5000 # Optional, defaults to 5000
```

4. Start the development server
```bash
npm run dev
```

The application will be available at `http://localhost:5000` by default.

## Dependencies

### Core Dependencies
- React ^18.2.0
- TypeScript ^5.0.2
- Express ^4.18.2
- @tanstack/react-query ^5.0.0
- tailwindcss ^3.3.0
- shadcn/ui components

### Development Dependencies
- Vite ^4.4.5
- ESLint
- Node.js >= 16.0.0

## API Endpoints

- `/api/models` - Get available models
- `/api/chat/stream` - Stream chat messages
- `/api/test-openrouter` - Test OpenRouter API connection

## Environment Variables

| Variable | Description | Required |
|----------|-------------|-----------|
| OPENROUTER_API_KEY | OpenRouter API key. Get it from [OpenRouter](https://openrouter.ai/docs) | Yes |
| PORT | Server port (default: 5000) | No |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Links

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [React Documentation](https://react.dev)
- [Express.js Documentation](https://expressjs.com)
