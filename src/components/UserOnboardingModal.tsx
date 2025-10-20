import React, { useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { User } from '@/types';

interface FormData {
  name: string;
  age: string;
  gender: string;
  weight: string;
  height: string;
  purpose: string;
}

interface UserOnboardingModalProps {
  darkMode: boolean;
  user: User;
  onComplete: (profileData: FormData) => void;
  onClose: () => void;
}

const UserOnboardingModal: React.FC<UserOnboardingModalProps> = ({ darkMode, user, onComplete, onClose }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    name: user?.name || '',
    age: '',
    gender: '',
    weight: '',
    height: '',
    purpose: 'medical' // Preselect medical option
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateStep1 = (): string | null => {
    const { name, age, gender, weight, height } = formData;
    if (!name.trim()) return 'Name is required';
    if (!age || parseInt(age) < 1 || parseInt(age) > 120) return 'Please enter a valid age (1-120)';
    if (!gender) return 'Please select your gender';
    if (!weight || parseFloat(weight) < 20 || parseFloat(weight) > 300) return 'Please enter a valid weight (20-300 kg)';
    if (!height || parseFloat(height) < 100 || parseFloat(height) > 250) return 'Please enter a valid height (100-250 cm)';
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!formData.purpose) return 'Please select your primary purpose';
    return null;
  };

  const handleNext = () => {
    const error = validateStep1();
    if (error) {
      setError(error);
      return;
    }
    setError('');
    setStep(2);
  };

  const handleBack = () => {
    setError('');
    setStep(1);
  };

  const handleSubmit = async () => {
    const error = validateStep2();
    if (error) {
      setError(error);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update user profile directly with PocketBase
      await pb.collection('users').update(user.$id, {
        name: formData.name.trim(),
        age: parseInt(formData.age),
        gender: formData.gender,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        purpose: formData.purpose,
        profileCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });

      console.log('User profile updated successfully');
      onComplete(formData);
    } catch (err: unknown) {
      console.error('Error updating user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const purposeOptions = [
    {
      id: 'fitness',
      title: 'Fitness / Performance',
      description: 'Track workouts, calories, heart rate zones, and training load to improve endurance, strength, and recovery.',
      icon: '💪',
      disabled: true,
      comingSoon: true
    },
    {
      id: 'medical',
      title: 'Medical / Heart Health',
      description: 'Monitor resting heart rate, stress, and heart rhythm patterns to support health tracking and recovery. Not a medical device—consult your doctor for diagnosis.',
      icon: '❤️',
      disabled: false,
      comingSoon: false
    },
    {
      id: 'research',
      title: 'Research / Biofeedback',
      description: 'Explore detailed HRV metrics, stress-recovery balance, and raw data for breathing practice, stress studies, or scientific analysis.',
      icon: '🔬',
      disabled: true,
      comingSoon: true
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Complete Your Profile</h2>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Step {step} of 2 - Help us personalize your HRV experience
              </p>
            </div>
            <div className="flex space-x-2">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                    placeholder="25"
                    min="1"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Weight (kg) *</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                    placeholder="70"
                    min="20"
                    max="300"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Height (cm) *</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                    placeholder="175"
                    min="100"
                    max="250"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">What&apos;s your primary purpose?</h3>
              <p className={`text-sm mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                This helps us customize your experience and provide relevant insights.
              </p>
              
              <div className="space-y-3">
                {purposeOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => !option.disabled && handleInputChange('purpose', option.id)}
                    className={`p-4 border-2 rounded-lg transition-all relative ${
                      option.disabled
                        ? 'opacity-60 cursor-not-allowed'
                        : 'cursor-pointer hover:shadow-md'
                    } ${
                      formData.purpose === option.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : darkMode
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{option.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg">{option.title}</h4>
                          {option.comingSoon && (
                            <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 rounded-full">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {option.description}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        formData.purpose === option.id
                          ? 'border-blue-500 bg-blue-500'
                          : option.disabled
                          ? 'border-gray-300 opacity-50'
                          : 'border-gray-300'
                      }`}>
                        {formData.purpose === option.id && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-between`}>
          <div>
            {step === 2 && (
              <button
                onClick={handleBack}
                className={`px-4 py-2 rounded-lg font-medium ${
                  darkMode
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                Back
              </button>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium ${
                darkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              Skip for now
            </button>
            
            {step === 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserOnboardingModal;
