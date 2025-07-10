import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import LessonPage from './pages/LessonPage';
import UserDashboardPage from './pages/UserDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import AuthLayout from './components/layout/AuthLayout';
import { SpeechCoordinationProvider } from './hooks/useSpeechCoordination.jsx';
import { ConversationManagerProvider } from './hooks/useConversationManager.jsx';


function App() {
  return (
    <SpeechCoordinationProvider>
      <ConversationManagerProvider>
        <div className='app'>
          <Routes>
            {/* --- Public Routes --- */}
            {/* These routes are accessible to everyone */}
            <Route path="/" element={<HomePage />} /> 
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* --- Protected Routes --- */}
            {/* These routes require authentication */}
            <Route element={<AuthLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/lesson/:lessonId" element={<LessonPage />} />
              <Route path="/profile" element={<UserDashboardPage />} />
            </Route>

            {/* Add a catch-all route for 404 Not Found pages */}
            <Route path="*" element={<NotFoundPage />} />

          </Routes>
        </div>
      </ConversationManagerProvider>
    </SpeechCoordinationProvider>
  )
}

export default App
