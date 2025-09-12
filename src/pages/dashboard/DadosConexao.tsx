import React, { useState, useEffect } from 'react';
import { ChevronLeft, Copy, Server, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const DadosConexao: React.FC = () => {
  const { user } = useAuth();
  const [showFtpPassword, setShowFtpPassword] = useState(false);

  const userLogin = user?.usuario || (user?.email ? user.email.split('@')[0] : `user_${user?.id || 'usuario'}`);

  // Dados de conexão FTP reais baseados no código PHP
  const ftpData = {
    servidor: 'stmv1.udicast.com', // Domínio do servidor Wowza
    usuario: userLogin, // Login do usuário baseado no email
    senha: 'Adr1an@2024!', // Senha real do sistema
    porta: '21' // Porta padrão FTP
  };

  // Dados do servidor FMS/RTMP real
  const fmsData = {
    servidor: 'stmv1.udicast.com',
    porta: '1935', // Porta RTMP correta
    aplicacao: 'samhost',
    rtmpUrl: 'rtmp://stmv1.udicast.com:1935/samhost',
    usuario: userLogin,
    streamKey: `${userLogin}_live`,
    hlsUrl: `https://stmv1.udicast.com:1935/samhost/${userLogin}_live/playlist.m3u8`
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="flex items-center text-primary-600 hover:text-primary-800">
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>

      <div className="flex items-center space-x-3">
        <Server className="h-8 w-8 text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">Dados de Conexão</h1>
      </div>

      {/* Dados de Conexão FTP */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Server className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-800">Dados de Conexão FTP</h2>
        </div>

        {/* Tabela estilizada como no código PHP original */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody className="bg-gray-50">
              {/* Servidor/Server/Host */}
              <tr className="border-b border-gray-200">
                <td className="w-40 h-8 px-3 py-2 text-left font-medium text-gray-700 bg-gray-100">
                  Servidor/Server/Host
                </td>
                <td className="px-3 py-2 text-left">
                  <div className="flex items-center">
                    <span
                      id="dados_ftp_url"
                      className="text-gray-900 font-mono text-sm"
                    >
                      {ftpData.servidor}
                    </span>
                    <button
                      className="ml-2 text-primary-600 hover:text-primary-800"
                      onClick={() => copyToClipboard(ftpData.servidor, 'Servidor FTP')}
                      title="Copiar/Copy"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>

              {/* Usuário */}
              <tr className="border-b border-gray-200">
                <td className="w-40 h-8 px-3 py-2 text-left font-medium text-gray-700 bg-gray-100">
                  Usuário
                </td>
                <td className="px-3 py-2 text-left">
                  <div className="flex items-center">
                    <span
                      id="dados_ftp_login"
                      className="text-gray-900 font-mono text-sm"
                    >
                      {ftpData.usuario}
                    </span>
                    <button
                      className="ml-2 text-primary-600 hover:text-primary-800"
                      onClick={() => copyToClipboard(ftpData.usuario, 'Usuário FTP')}
                      title="Copiar/Copy"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>

              {/* Senha */}
              <tr className="border-b border-gray-200">
                <td className="w-40 h-8 px-3 py-2 text-left font-medium text-gray-700 bg-gray-100">
                  Senha
                </td>
                <td className="px-3 py-2 text-left">
                  <div className="flex items-center">
                    <div className="relative">
                      <span
                        id="dados_ftp_senha"
                        className="text-gray-900 font-mono text-sm mr-2"
                      >
                        {showFtpPassword ? ftpData.senha : '••••••••••••'}
                      </span>
                      <button
                        onClick={() => setShowFtpPassword(!showFtpPassword)}
                        className="text-gray-400 hover:text-gray-600 mr-2"
                        title={showFtpPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showFtpPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <button
                      className="text-primary-600 hover:text-primary-800"
                      onClick={() => copyToClipboard(ftpData.senha, 'Senha FTP')}
                      title="Copiar/Copy"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>

              {/* Porta FTP */}
              <tr>
                <td className="w-40 h-8 px-3 py-2 text-left font-medium text-gray-700 bg-gray-100">
                  Porta FTP
                </td>
                <td className="px-3 py-2 text-left">
                  <span className="text-gray-900 font-mono text-sm">
                    {ftpData.porta}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Informações adicionais */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium text-blue-900 mb-2">📋 Informações de Acesso FTP</h3>
          <div className="text-blue-800 text-sm space-y-1">
            <p>• Use estes dados para conectar via cliente FTP (FileZilla, WinSCP, etc.)</p>
            <p>• Também pode ser usado na ferramenta de migração de vídeos</p>
            <p>• Porta padrão: 21 (FTP não seguro)</p>
            <p>• Servidor: {ftpData.servidor}</p>
          </div>
        </div>
      </div>
    </div >
  );
};

export default DadosConexao;