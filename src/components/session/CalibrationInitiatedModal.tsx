'use client';

import React from 'react';
import { Zap, X, ChevronRight, Activity, Calendar } from 'lucide-react';

interface CalibrationInitiatedModalProps {
    onViewResults: () => void;
    onClose: () => void;
    currentDay?: number; // 1, 2, or 3
}

const CalibrationInitiatedModal: React.FC<CalibrationInitiatedModalProps> = ({
    onViewResults,
    onClose,
    currentDay = 1,
}) => {
    return (
        <div className="calibration-modal-overlay">
            <div className="calibration-modal-container">
                {/* Top Branding/Close */}
                <div className="calibration-modal-header">
                    <div className="calibration-badge">
                        <Zap size={14} className="calibration-badge-icon" />
                        <span className="calibration-badge-text">Level 1: Calibration</span>
                    </div>
                    <button onClick={onClose} className="calibration-close-btn">
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="calibration-modal-content">
                    {/* Header */}
                    <div className="calibration-header-section">
                        <h2 className="calibration-title">
                            Congrats!<br />Calibration Initiated.
                        </h2>
                        <p className="calibration-subtitle">
                            You&apos;ve just taken the first step toward a precise HRV profile.
                        </p>
                    </div>

                    {/* Informational Cards */}
                    <div className="calibration-cards">
                        <div className="calibration-card calibration-card-blue">
                            <div className="calibration-card-icon">
                                <Activity className="calibration-icon-blue" size={24} />
                            </div>
                            <p className="calibration-card-text">
                                <span className="calibration-bold">Personalized for you.</span> Global HRV normals are unreliable because your biology is unique.
                            </p>
                        </div>

                        <div className="calibration-card calibration-card-amber">
                            <div className="calibration-card-icon">
                                <Calendar className="calibration-icon-amber" size={24} />
                            </div>
                            <div className="calibration-card-content">
                                <p className="calibration-card-text">
                                    We form your baseline after <span className="calibration-highlight">3 days</span> of recording.
                                </p>

                                {/* Visual 3-Day Progress Indicator */}
                                <div className="calibration-progress-row">
                                    <div className={`calibration-progress-bar ${currentDay >= 1 ? 'active' : ''}`} />
                                    <div className={`calibration-progress-bar ${currentDay >= 2 ? 'active' : ''}`} />
                                    <div className={`calibration-progress-bar ${currentDay >= 3 ? 'active' : ''}`} />
                                    <span className="calibration-progress-label">Day {currentDay} of 3</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="calibration-reminder">
                        Please take at least one session per day for the next 3 days.
                    </p>

                    {/* Action Button */}
                    <button onClick={onViewResults} className="calibration-action-btn">
                        View Results
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <style jsx>{`
        .calibration-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(12px);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .calibration-modal-container {
          background: white;
          width: 100%;
          max-width: 28rem;
          border-radius: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          animation: slideIn 0.5s ease-out;
        }

        .calibration-modal-header {
          padding: 2rem 2rem 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .calibration-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          background: #fffbeb;
          border-radius: 9999px;
        }

        .calibration-badge-icon {
          color: #d97706;
          fill: #d97706;
        }

        .calibration-badge-text {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #b45309;
        }

        .calibration-close-btn {
          padding: 0.5rem;
          color: #cbd5e1;
          border: none;
          background: transparent;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .calibration-close-btn:hover {
          color: #0f172a;
          background: #f1f5f9;
        }

        .calibration-modal-content {
          padding: 1.5rem 2rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .calibration-header-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .calibration-title {
          font-size: 1.875rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin: 0;
        }

        .calibration-subtitle {
          font-size: 1.125rem;
          color: #475569;
          line-height: 1.6;
          margin: 0;
        }

        .calibration-cards {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 0.5rem 0;
        }

        .calibration-card {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: 1.5rem;
        }

        .calibration-card-blue {
          background: #f8fafc;
          border: 1px solid #f1f5f9;
        }

        .calibration-card-amber {
          background: rgba(255, 251, 235, 0.5);
          border: 1px solid rgba(254, 243, 199, 0.5);
        }

        .calibration-card-icon {
          flex-shrink: 0;
          width: 3rem;
          height: 3rem;
          border-radius: 1rem;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .calibration-icon-blue {
          color: #3b82f6;
        }

        .calibration-icon-amber {
          color: #f59e0b;
        }

        .calibration-card-text {
          font-size: 0.9375rem;
          color: #475569;
          line-height: 1.4;
          margin: 0;
        }

        .calibration-card-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .calibration-bold {
          font-weight: 700;
          color: #0f172a;
        }

        .calibration-highlight {
          font-weight: 700;
          color: #0f172a;
          text-decoration: underline;
          text-decoration-color: #fcd34d;
          text-underline-offset: 2px;
        }

        .calibration-progress-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .calibration-progress-bar {
          height: 0.5rem;
          width: 3rem;
          background: #e2e8f0;
          border-radius: 9999px;
          transition: background 0.3s;
        }

        .calibration-progress-bar.active {
          background: #f59e0b;
        }

        .calibration-progress-label {
          font-size: 10px;
          font-weight: 700;
          color: #d97706;
          margin-left: 0.25rem;
        }

        .calibration-reminder {
          font-size: 0.875rem;
          color: #64748b;
          font-weight: 500;
          text-align: center;
          margin: 0;
        }

        .calibration-action-btn {
          width: 100%;
          background: #0f172a;
          color: white;
          font-size: 1.125rem;
          font-weight: 700;
          padding: 1.25rem;
          border-radius: 1.5rem;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 10px 15px -3px rgba(226, 232, 240, 1);
        }

        .calibration-action-btn:hover {
          background: black;
        }

        .calibration-action-btn:active {
          transform: scale(0.97);
        }
      `}</style>
        </div>
    );
};

export default CalibrationInitiatedModal;
