# HRV Analysis and Tracking App

A comprehensive Heart Rate Variability (HRV) analysis and tracking application that connects to Polar H10 devices via Bluetooth to provide real-time HRV metrics and data visualization.

## 🚀 Features

- **Real-time HRV Monitoring**: Connect to Polar H10 devices via Web Bluetooth API
- **Live Metrics Display**: View RMSSD, SDNN, pNN50, and Mean HR in real-time
- **Interactive Charts**: Visualize RR intervals with responsive line charts
- **Dark Mode**: Toggle between light and dark themes
- **Data Export**: Save HRV sessions as CSV files
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with React, Tailwind CSS, and Recharts

## 📊 HRV Metrics Explained

- **RMSSD (Root Mean Square of Successive Differences)**: Key measure of short-term heart rate variability
- **SDNN (Standard Deviation of NN intervals)**: Reflects overall heart rate variability
- **pNN50**: Percentage of successive intervals that differ by more than 50ms
- **Mean HR**: Average heart rate calculated from RR intervals

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite (Build tool)
- Tailwind CSS (Styling)
- Recharts (Data visualization)
- Web Bluetooth API

### Backend
- Node.js
- Express.js
- CORS enabled
- Helmet (Security)
- Morgan (Logging)

## 📁 Project Structure

```
hrv/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── App.jsx          # Main application component
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles
│   ├── package.json         # Frontend dependencies
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   ├── env.development      # Development environment variables
│   └── env.production       # Production environment variables
├── backend/                  # Node.js backend API
│   ├── server.js            # Express server setup
│   ├── package.json         # Backend dependencies
│   ├── env.development      # Development environment variables
│   └── env.production       # Production environment variables
├── package.json             # Root workspace configuration
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Polar H10 device (or compatible heart rate monitor)
- Modern browser with Web Bluetooth support (Chrome, Edge, Opera)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hrv
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   - Copy `frontend/env.development` to `frontend/.env.development`
   - Copy `backend/env.development` to `backend/.env.development`
   - Update the URLs and settings as needed

### Development

1. **Start both frontend and backend in development mode**
   ```bash
   npm run dev
   ```

2. **Or start them separately**
   ```bash
   # Frontend only (port 3001)
   npm run dev:frontend
   
   # Backend only (port 5000)
   npm run dev:backend
   ```

3. **Open your browser**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:5000/api/health

### Production Build

1. **Build both applications**
   ```bash
   npm run build
   ```

2. **Start production servers**
   ```bash
   # Frontend
   cd frontend && npm run preview
   
   # Backend
   cd backend && npm start
   ```

## 🔗 Connecting to Polar H10

1. **Ensure your device is paired** with your computer via Bluetooth
2. **Click "Connect"** in the app
3. **Select your Polar H10** from the Bluetooth device list
4. **Grant permissions** when prompted
5. **Start monitoring** - the app will display real-time HRV metrics

## 📱 Browser Compatibility

The app requires Web Bluetooth API support, which is available in:
- Chrome 56+
- Edge 79+
- Opera 43+
- Samsung Internet 7.0+

**Note**: Web Bluetooth requires HTTPS or localhost for security reasons.

## 🔧 Configuration

### Environment Variables

#### Frontend
- `VITE_APP_TITLE`: Application title
- `VITE_API_BASE_URL`: Backend API base URL
- `VITE_ENVIRONMENT`: Current environment
- `VITE_DEBUG_MODE`: Enable/disable debug mode
- `VITE_ENABLE_LOGGING`: Enable/disable logging

#### Backend
- `NODE_ENV`: Node.js environment
- `PORT`: Server port
- `CORS_ORIGIN`: Allowed CORS origins
- `LOG_LEVEL`: Logging level
- `DATABASE_URL`: Database connection string

## 🧪 Testing

The app includes comprehensive HRV calculation functions that have been tested with real Polar H10 data. The Bluetooth connection has been verified to work with:

- Polar H10 chest strap
- Compatible heart rate monitors with RR interval support

## 📈 Data Export

The app allows you to export HRV sessions as CSV files containing:
- Timestamp for each RR interval
- RR interval values in milliseconds
- Session metadata

## 🔒 Security

- HTTPS required for Web Bluetooth API
- CORS configured for secure cross-origin requests
- Helmet.js for security headers
- Environment-specific configurations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This application is for informational and educational purposes only. It is not a medical device and should not be used for medical diagnosis or treatment. Always consult with healthcare professionals for medical advice.

## 🆘 Troubleshooting

### Common Issues

1. **Bluetooth not working**
   - Ensure you're on HTTPS or localhost
   - Check browser compatibility
   - Verify device pairing

2. **No RR interval data**
   - Ensure your device supports RR intervals
   - Check device connection status
   - Try reconnecting the device

3. **Build errors**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify all environment variables are set

### Support

For issues and questions, please check the troubleshooting section above or create an issue in the repository. 