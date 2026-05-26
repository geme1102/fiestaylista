import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { showToast } from '../hooks/useToast';

type Lang = 'es' | 'en';

const ES = {
  title: 'Derechos ARCO',
  subtitle: 'Acceso, Rectificación, Cancelación y Oposición',
  intro: 'De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013, puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO) sobre tus datos personales.',
  access: {
    title: 'Acceso a mis datos',
    desc: 'Solicita una copia completa de todos los datos personales que tenemos almacenados sobre ti.',
    btn: 'Solicitar mis datos',
    loading: 'Descargando...',
  },
  rectify: {
    title: 'Rectificar datos',
    desc: '¿Encontraste información incorrecta? Solicita su corrección.',
    btn: 'Solicitar rectificación',
  },
  cancel: {
    title: 'Cancelar cuenta',
    desc: 'Solicita la eliminación de tu cuenta y todos los datos asociados de forma permanente.',
    btn: 'Eliminar mi cuenta',
    confirm: '¿Estás seguro? Esta acción eliminará permanentemente tu cuenta, eventos, listas de regalos y todos los datos asociados. No se puede deshacer.',
    deleting: 'Eliminando cuenta...',
  },
  oppose: {
    title: 'Oposición',
    desc: 'Si crees que tus datos están siendo tratados para fines que no autorizaste, presenta tu oposición.',
    btn: 'Solicitar oposición',
  },
  form: {
    requestType: 'Tipo de solicitud',
    details: 'Detalles',
    placeholder: 'Describe tu solicitud en detalle...',
    submit: 'Enviar solicitud',
    submitting: 'Enviando...',
    success: 'Solicitud enviada correctamente. Te contactaremos en un plazo máximo de 15 días hábiles.',
  },
  history: 'Historial de solicitudes',
  noHistory: 'No tienes solicitudes ARCO previas.',
  status: 'Estado',
  date: 'Fecha',
  loginRequired: 'Inicia sesión para ejercer tus derechos ARCO.',
};

const EN = {
  title: 'ARCO Rights',
  subtitle: 'Access, Rectification, Cancellation and Opposition',
  intro: 'In accordance with Colombian Law 1581 of 2012 and Decree 1377 of 2013, you may exercise your rights of Access, Rectification, Cancellation and Opposition (ARCO) over your personal data.',
  access: {
    title: 'Access my data',
    desc: 'Request a complete copy of all personal data we have stored about you.',
    btn: 'Request my data',
    loading: 'Downloading...',
  },
  rectify: {
    title: 'Rectify data',
    desc: 'Found incorrect information? Request its correction.',
    btn: 'Request rectification',
  },
  cancel: {
    title: 'Cancel account',
    desc: 'Request permanent deletion of your account and all associated data.',
    btn: 'Delete my account',
    confirm: 'Are you sure? This action will permanently delete your account, events, gift lists, and all associated data. This cannot be undone.',
    deleting: 'Deleting account...',
  },
  oppose: {
    title: 'Opposition',
    desc: 'If you believe your data is being processed for purposes you did not authorize, submit your opposition.',
    btn: 'Submit opposition',
  },
  form: {
    requestType: 'Request type',
    details: 'Details',
    placeholder: 'Describe your request in detail...',
    submit: 'Submit request',
    submitting: 'Submitting...',
    success: 'Request submitted successfully. We will contact you within a maximum of 15 business days.',
  },
  history: 'Request history',
  noHistory: 'You have no previous ARCO requests.',
  status: 'Status',
  date: 'Date',
  loginRequired: 'Log in to exercise your ARCO rights.',
};

export default function ArcoRights() {
  const [lang, setLang] = useState<Lang>('es');
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'rectify' | 'oppose' | null>(null);
  const [formDetails, setFormDetails] = useState('');

  const content = lang === 'es' ? ES : EN;

  const handleDownloadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: any }>('/api/auth/arco/my-data');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mis-datos-fiestaylista-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Datos descargados correctamente', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al descargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(content.cancel.confirm)) return;
    setLoading(true);
    try {
      await apiClient.del('/api/auth/arco/my-account');
      showToast('Cuenta eliminada permanentemente', 'success');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar cuenta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formType) return;
    setLoading(true);
    try {
      await apiClient.post('/api/auth/arco/request', {
        requestType: formType,
        details: formDetails,
      });
      showToast(content.form.success, 'success');
      setShowForm(false);
      setFormDetails('');
      setShowRequests(true);
      loadRequests();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al enviar solicitud', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const res = await apiClient.get<{ requests: any[] }>('/api/auth/arco/requests');
      setRequests(res.requests);
    } catch {}
  };

  const openForm = (type: 'rectify' | 'oppose') => {
    setFormType(type);
    setFormDetails('');
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-pink-600 hover:text-pink-700 dark:text-pink-400 text-sm font-medium">
              ← {lang === 'es' ? 'Volver' : 'Back'}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{content.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{content.subtitle}</p>
          </div>
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {lang === 'es' ? 'English' : 'Español'}
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-2xl p-8 text-center" style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.4)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
          }}>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{content.loginRequired}</p>
            <Link to="/login" className="inline-flex px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
              {lang === 'es' ? 'Iniciar Sesión' : 'Log In'}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-8">{content.intro}</p>

            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <button onClick={handleDownloadData} disabled={loading}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                }}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{content.access.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{content.access.desc}</p>
                <span className="text-pink-600 font-medium text-sm">
                  {loading ? content.access.loading : content.access.btn}
                </span>
              </button>

              <button onClick={() => openForm('rectify')}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                }}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{content.rectify.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{content.rectify.desc}</p>
                <span className="text-pink-600 font-medium text-sm">{content.rectify.btn}</span>
              </button>

              <button onClick={handleDeleteAccount} disabled={loading}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                }}>
                <h3 className="text-lg font-semibold text-red-600 mb-2">{content.cancel.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{content.cancel.desc}</p>
                <span className="text-red-600 font-medium text-sm">
                  {loading ? content.cancel.deleting : content.cancel.btn}
                </span>
              </button>

              <button onClick={() => openForm('oppose')}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                }}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{content.oppose.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{content.oppose.desc}</p>
                <span className="text-pink-600 font-medium text-sm">{content.oppose.btn}</span>
              </button>
            </div>

            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
                <form
                  onSubmit={handleSubmitRequest}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {formType === 'rectify' ? content.rectify.title : content.oppose.title}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {content.form.details}
                      </label>
                      <textarea
                        value={formDetails}
                        onChange={(e) => setFormDetails(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                        placeholder={content.form.placeholder}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {lang === 'es' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !formDetails}
                      className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                      {loading ? content.form.submitting : content.form.submit}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-2xl p-6 sm:p-8" style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            }}>
              <button
                onClick={() => { setShowRequests(!showRequests); if (!showRequests) loadRequests(); }}
                className="flex items-center justify-between w-full"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{content.history}</h2>
                <span className="text-pink-600 text-sm">{showRequests ? '▲' : '▼'}</span>
              </button>

              {showRequests && (
                <div className="mt-4">
                  {requests.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{content.noHistory}</p>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{req.requestType}</span>
                            {req.details && <p className="text-xs text-gray-500 mt-0.5">{req.details}</p>}
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              req.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : req.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {req.status}
                            </span>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
