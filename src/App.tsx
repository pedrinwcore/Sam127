import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ErrorBoundary from './components/ErrorBoundary';

// Auth Pages
import Login from './pages/auth/Login';

// Dashboard Pages
import Dashboard from './pages/dashboard/Dashboard';
import IniciarTransmissao from './pages/dashboard/IniciarTransmissao';
import DadosConexao from './pages/dashboard/DadosConexao';
import Configuracoes from './pages/dashboard/Configuracoes';
import Players from './pages/dashboard/Players';
import GerenciarVideos from './pages/dashboard/GerenciarVideos';
import Playlists from './pages/dashboard/Playlists';
import Agendamentos from './pages/dashboard/Agendamentos';
import Comerciais from './pages/dashboard/Comerciais';
import DownloadYoutube from './pages/dashboard/DownloadYoutube';
import MigrarVideosFTP from './pages/dashboard/MigrarVideosFTP';
import Espectadores from './pages/dashboard/Espectadores';
import RelayRTMP from './pages/dashboard/RelayRTMP';
import ConversaoVideos from './pages/dashboard/ConversaoVideos';
import AppMultiplataforma from './pages/dashboard/AppMultiplataforma';
import AppAndroid from './pages/dashboard/AppAndroid';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { StreamProvider } from './context/StreamContext';
import PrivateRoute from './components/PrivateRoute';

// Componente que redireciona baseado na autenticação
const RedirectToProperPlace = () => {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} />;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <StreamProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/" element={<AuthLayout />}>
                <Route index element={<RedirectToProperPlace />} />
                <Route path="login" element={<Login />} />
              </Route>

              {/* Dashboard Routes */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <ErrorBoundary>
                      <DashboardLayout />
                    </ErrorBoundary>
                  </PrivateRoute>
                }
              >
                <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="iniciar-transmissao" element={<ErrorBoundary><IniciarTransmissao /></ErrorBoundary>} />
                <Route path="dados-conexao" element={<ErrorBoundary><DadosConexao /></ErrorBoundary>} />
                <Route path="configuracoes" element={<ErrorBoundary><Configuracoes /></ErrorBoundary>} />
                <Route path="players" element={<ErrorBoundary><Players /></ErrorBoundary>} />
                <Route path="gerenciarvideos" element={<ErrorBoundary><GerenciarVideos /></ErrorBoundary>} />
                <Route path="playlists" element={<ErrorBoundary><Playlists /></ErrorBoundary>} />
                <Route path="agendamentos" element={<ErrorBoundary><Agendamentos /></ErrorBoundary>} /> 
                <Route path="comerciais" element={<ErrorBoundary><Comerciais /></ErrorBoundary>} />
                <Route path="downloadyoutube" element={<ErrorBoundary><DownloadYoutube /></ErrorBoundary>} />
                <Route path="migrar-videos-ftp" element={<ErrorBoundary><MigrarVideosFTP /></ErrorBoundary>} />
                <Route path="espectadores" element={<ErrorBoundary><Espectadores /></ErrorBoundary>} />
                <Route path="relayrtmp" element={<ErrorBoundary><RelayRTMP /></ErrorBoundary>} />
                <Route path="conversao-videos" element={<ErrorBoundary><ConversaoVideos /></ErrorBoundary>} />
                <Route path="app-multiplataforma" element={<ErrorBoundary><AppMultiplataforma /></ErrorBoundary>} />
                <Route path="app-android" element={<ErrorBoundary><AppAndroid /></ErrorBoundary>} />
              </Route>

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
            <ToastContainer position="top-right" autoClose={3000} theme="colored" />
          </StreamProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;