import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import RoleProtectedRoute from './components/layout/RoleProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ConnectorsPage from './pages/ConnectorsPage'
import AdvisorPage from './pages/AdvisorPage'
import SettingsPage from './pages/SettingsPage'
import UploadPage from './pages/UploadPage'
import LogsPage from './pages/LogsPage'
import AIOpsPage from './pages/AIOpsPage'
import ObservabilityPage from './pages/ObservabilityPage'
import OntologyVisualizerPage from './pages/OntologyVisualizerPage'
import QAWorkspacePage from './pages/QAWorkspacePage'
import UserManagementPage from './pages/settings/UserManagementPage'
import RoleManagementPage from './pages/settings/RoleManagementPage'
import SchedulerPage from './pages/SchedulerPage'
import DevChatbotPage from './pages/DevChatbotPage'
import OntologyDataLoaderPage from './pages/OntologyDataLoaderPage'
import ReverseEngineeringPage from './pages/ReverseEngineeringPage'

function RootRedirect() {
  const token = useAuthStore((s) => s.token)
  return <Navigate to={token ? '/dashboard' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RoleProtectedRoute>
              <AppShell />
            </RoleProtectedRoute>
          }
        >
          <Route path="/dashboard"      element={<RoleProtectedRoute permission="dashboard"><DashboardPage /></RoleProtectedRoute>} />
          <Route path="/qa/*"           element={<RoleProtectedRoute permission="qa_workspace"><QAWorkspacePage /></RoleProtectedRoute>} />
          <Route path="/aiops"          element={<RoleProtectedRoute permission="aiops"><AIOpsPage /></RoleProtectedRoute>} />
          <Route path="/observability"  element={<RoleProtectedRoute permission="observability"><ObservabilityPage /></RoleProtectedRoute>} />
          <Route path="/ontology"       element={<RoleProtectedRoute permission="ontology"><OntologyVisualizerPage /></RoleProtectedRoute>} />
          <Route path="/connectors"     element={<RoleProtectedRoute permission="connectors"><ConnectorsPage /></RoleProtectedRoute>} />
          <Route path="/advisor"        element={<RoleProtectedRoute permission="advisor"><AdvisorPage /></RoleProtectedRoute>} />
          <Route path="/settings"       element={<RoleProtectedRoute permission="settings"><SettingsPage /></RoleProtectedRoute>} />
          <Route path="/settings/users" element={<RoleProtectedRoute permission="user_management"><UserManagementPage /></RoleProtectedRoute>} />
          <Route path="/settings/roles" element={<RoleProtectedRoute permission="role_management"><RoleManagementPage /></RoleProtectedRoute>} />
          <Route path="/upload"         element={<RoleProtectedRoute permission="upload"><UploadPage /></RoleProtectedRoute>} />
          <Route path="/logs"           element={<RoleProtectedRoute permission="logs"><LogsPage /></RoleProtectedRoute>} />
          <Route path="/scheduler"      element={<RoleProtectedRoute permission="scheduler"><SchedulerPage /></RoleProtectedRoute>} />
          <Route path="/dev-chat"       element={<RoleProtectedRoute permission="dev_workspace"><DevChatbotPage /></RoleProtectedRoute>} />
          <Route path="/reverse-engineering" element={<RoleProtectedRoute permission="dev_workspace"><ReverseEngineeringPage /></RoleProtectedRoute>} />
<Route path="/ontology/data-loader" element={<RoleProtectedRoute permission="ontology_maintain"><OntologyDataLoaderPage /></RoleProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
