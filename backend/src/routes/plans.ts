import { Router } from 'express';

const router = Router();

const PLANS = [
  {
    tier: 'free',
    name: 'Gratis',
    price: 0,
    currency: 'COP',
    interval: 'month',
    popular: false,
    prices: { month: 0, year: 0 },
    features: [
      '2 Eventos',
      'Hasta 10 regalos por evento',
      'Hasta 3 fotos por evento',
      'Enlace público para compartir',
      'Cash fund / Lluvia de sobres (comisión 5%)',
      'Event Boost disponible ($49,900 COP/evento)',
      'Recordatorios por email',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 49900,
    yearlyPrice: 499900,
    currency: 'COP',
    interval: 'month',
    popular: true,
    prices: { month: 49900, year: 499900 },
    features: [
      'Hasta 20 eventos',
      'Hasta 50 regalos por evento',
      'Hasta 15 fotos por evento',
      'Subida de fotos',
      'Estadísticas',
      'Cash fund / Lluvia de sobres (comisión 5%)',
      'Event Boost incluido',
      'Sin marca de agua',
      'Soporte prioritario',
    ],
  },
];

router.get('/plans', (_req, res) => {
  res.json({ plans: PLANS });
});

export default router;
