# HRV Analysis App - Next.js 15

A modern Heart Rate Variability (HRV) analysis application built with Next.js 15, TypeScript, and Tailwind CSS. Features real-time HRV monitoring with Polar H10 device support via Web Bluetooth API.

## ✨ Features

- **Real-time HRV Analysis** - Live RMSSD, SDNN, pNN50, and Mean HR calculations
- **Polar H10 Support** - Connect via Web Bluetooth API for accurate heart rate data
- **Demo Mode** - Test the app without hardware using simulated data
- **Session Management** - Save and track HRV sessions with detailed metrics
- **Progress Tracking** - Visual milestone progress bar with modern animations
- **User Authentication** - Google OAuth and guest mode support
- **Reports Dashboard** - View session history and analytics
- **Dark Mode** - Beautiful light/dark theme toggle
- **Responsive Design** - Works on desktop, tablet, and mobile devices

## 🚀 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Appwrite (self-hosted)
- **Authentication:** Appwrite Auth with Google OAuth
- **Database:** Appwrite Database
- **Deployment:** Vercel-ready

## 📦 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker (for Appwrite)
- Modern browser with Web Bluetooth support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hrv
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Appwrite configuration
   ```

4. **Start Appwrite (if using self-hosted)**
   ```bash
   # Appwrite setup instructions in appwrite/ directory
   docker-compose up -d
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
hrv/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   ├── auth/           # Authentication pages
│   │   └── reports/        # Reports page
│   ├── components/         # React components
│   │   ├── auth/          # Authentication components
│   │   ├── session/       # Session-related components
│   │   └── ui/            # UI components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── public/                # Static assets
├── appwrite/             # Appwrite configuration
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with:

```env
# Appwrite Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id

# App Configuration
NEXT_PUBLIC_APP_TITLE=HRV Analysis App
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG_MODE=true

# API Configuration
APPWRITE_API_KEY=your-api-key
```

### Appwrite Setup

1. Follow the setup instructions in the `appwrite/` directory
2. Configure authentication providers (Google OAuth)
3. Set up database collections for users and sessions

## 📱 Usage

### Starting a Session

1. **Connect Device** (optional): Click "Start Session" to connect your Polar H10
2. **Demo Mode**: Click "Start Demo" to test with simulated data
3. **Monitor Progress**: Watch real-time HRV metrics and progress bar
4. **End Session**: Click "End Session" to view summary and save data

### Viewing Reports

- Navigate to the Reports page to view session history
- See average metrics across all sessions
- Track your HRV progress over time

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Components

- **`useHrvSession`** - Manages HRV session state and calculations
- **`useBluetooth`** - Handles Web Bluetooth API for Polar H10
- **`useAuth`** - Manages user authentication with Appwrite
- **`MilestoneProgressBar`** - Modern progress visualization
- **`SessionSummaryModal`** - Displays session results

## 🔬 HRV Metrics

The app calculates standard HRV metrics:

- **RMSSD** - Root Mean Square of Successive Differences
- **SDNN** - Standard Deviation of NN intervals
- **pNN50** - Percentage of successive RR intervals that differ by more than 50ms
- **Mean HR** - Average heart rate during session

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Docker

```bash
# Build the Docker image
docker build -t hrv-app .

# Run the container
docker run -p 3000:3000 hrv-app
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This application is for informational and research purposes only. It is not a medical device and should not be used for medical diagnosis or treatment. Always consult with healthcare professionals for medical advice.

## 🙏 Acknowledgments

- Polar for the H10 heart rate monitor and Web Bluetooth support
- Appwrite for the excellent backend-as-a-service platform
- Next.js team for the amazing React framework
- Tailwind CSS for the utility-first CSS framework