import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

interface ArcoRequest {
  id: number;
  requestType: string;
  details?: string;
  status: string;
  createdAt: string;
}

export default function ArcoRights() {
  const [lang, setLang] = useState<Lang>('es');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ArcoRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'rectify' | 'oppose' | null>(null);
  const [formDetails, setFormDetails] = useState('');

  const content = lang === 'es' ? ES : EN;

  const handleDownloadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Record<string, unknown> }>('/api/auth/arco/my-data');
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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await apiClient.post('/api/auth/arco/delete-account', { password: deletePassword });
      showToast('Cuenta eliminada permanentemente', 'success');
      setShowDeleteModal(false);
      setDeletePassword('');
      setTimeout(() => { navigate('/'); }, 2000);
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
      const res = await apiClient.get<{ requests: ArcoRequest[] }>('/api/auth/arco/requests');
      setRequests(res.requests);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[ArcoRights] loadRequests error:', err);
    }
  };

  const openForm = (type: 'rectify' | 'oppose') => {
    setFormType(type);
    setFormDetails('');
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-fixed/10 via-surface to-surface">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-primary hover:text-primary-fixed-dim text-sm font-medium">
              ← {lang === 'es' ? 'Volver' : 'Back'}
            </Link>
            <h1 className="text-3xl font-bold text-on-surface mt-2">{content.title}</h1>
            <p className="text-sm text-on-surface-variant mt-1">{content.subtitle}</p>
          </div>
          <button
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant bg-surface border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors"
          >
            {lang === 'es' ? 'English' : 'Español'}
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-2xl p-8 text-center glass-card-premium">
            <p className="text-on-surface-variant mb-4">{content.loginRequired}</p>
            <Link to="/login" className="inline-flex px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-semibold hover:shadow-lg transition-all">
              {lang === 'es' ? 'Iniciar Sesión' : 'Log In'}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-on-surface-variant mb-8">{content.intro}</p>

            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <button onClick={handleDownloadData} disabled={loading}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all disabled:opacity-50 glass-card-premium">
                <h3 className="text-lg font-semibold text-on-surface mb-2">{content.access.title}</h3>
                <p className="text-sm text-on-surface-variant mb-4">{content.access.desc}</p>
                <span className="text-primary font-medium text-sm">
                  {loading ? content.access.loading : content.access.btn}
                </span>
              </button>

              <button onClick={() => openForm('rectify')}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all glass-card-premium">
                <h3 className="text-lg font-semibold text-on-surface mb-2">{content.rectify.title}</h3>
                <p className="text-sm text-on-surface-variant mb-4">{content.rectify.desc}</p>
                <span className="text-primary font-medium text-sm">{content.rectify.btn}</span>
              </button>

              <button onClick={() => setShowDeleteModal(true)} disabled={loading}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all disabled:opacity-50 glass-card-premium">
                <h3 className="text-lg font-semibold text-red-600 mb-2">{content.cancel.title}</h3>
                <p className="text-sm text-on-surface-variant mb-4">{content.cancel.desc}</p>
                <span className="text-red-600 font-medium text-sm">
                  {loading ? content.cancel.deleting : content.cancel.btn}
                </span>
              </button>

              <button onClick={() => openForm('oppose')}
                className="rounded-2xl p-6 text-left hover:shadow-lg transition-all glass-card-premium">
                <h3 className="text-lg font-semibold text-on-surface mb-2">{content.oppose.title}</h3>
                <p className="text-sm text-on-surface-variant mb-4">{content.oppose.desc}</p>
                <span className="text-primary font-medium text-sm">{content.oppose.btn}</span>
              </button>
            </div>

            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
                <form
                  onSubmit={handleSubmitRequest}
                  className="bg-surface rounded-2xl p-8 w-full max-w-md shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-bold text-on-surface mb-4">
                    {formType === 'rectify' ? content.rectify.title : content.oppose.title}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                        {content.form.details}
                      </label>
                      <textarea
                        id="arco-details"
                        value={formDetails}
                        onChange={(e) => setFormDetails(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none"
                        placeholder={content.form.placeholder}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-3 text-on-surface-variant bg-surface-container-high rounded-xl font-medium hover:bg-surface-container-highest transition-colors"
                    >
                      {lang === 'es' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !formDetails}
                      className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                      {loading ? content.form.submitting : content.form.submit}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-2xl p-6 sm:p-8 glass-card-premium">
              <button
                onClick={() => { setShowRequests(!showRequests); if (!showRequests) loadRequests(); }}
                className="flex items-center justify-between w-full"
              >
                <h2 className="text-lg font-semibold text-on-surface">{content.history}</h2>
                <span className="material-symbols-outlined text-primary">{showRequests ? 'expand_less' : 'expand_more'}</span>
              </button>

              {showRequests && (
                <div className="mt-4">
                  {requests.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">{content.noHistory}</p>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl">
                          <div>
                            <span className="text-sm font-medium text-on-surface capitalize">{req.requestType}</span>
                            {req.details && <p className="text-xs text-on-surface-variant mt-0.5">{req.details}</p>}
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              req.status === 'completed' ? 'bg-green-100 text-green-700'
                              : req.status === 'pending' ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                              {req.status}
                            </span>
                            <p className="text-xs text-surface-variant mt-1">
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-red-600">{content.cancel.title}</h3>
            <p className="text-sm text-on-surface-variant">{content.cancel.confirm}</p>
            <input
              id="arco-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Tu contraseña"
              className="w-full px-4 py-3 border border-outline-variant rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/50"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); }} className="flex-1 py-3 text-on-surface-variant font-medium rounded-xl bg-surface-container-high">
                Cancelar
              </button>
              <button onClick={handleDeleteAccount} disabled={!deletePassword || loading} className="flex-1 py-3 bg-red-500 text-white font-medium rounded-xl disabled:opacity-50">
                {loading ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
