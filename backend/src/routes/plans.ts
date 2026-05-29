import { Router } from 'express';

const router = Router();

const PLANS = [
  {
    tier: 'free',
    name: 'Gratis',
    price: 0,
    currency: 'USD',
    interval: 'month',
    popular: false,
    prices: { month: 0, year: 0 },
    features: [
      '1 evento',
      'Hasta 20 regalos por evento',
      'Hasta 5 fotos por evento',
      'Enlace público para compartir',
      'Cash fund / Lluvia de sobres (comisión 4%)',
      'Event Boost disponible ($4.99/evento)',
      'Recordatorios por email',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 24.99,
    yearlyPrice: 288.00,
    currency: 'USD',
    interval: 'month',
    popular: true,
    prices: { month: 24.99, year: 288.00 },
    features: [
      'Hasta 20 eventos',
      'Hasta 500 regalos por evento',
      'Hasta 200 fotos por evento',
      'Subida de fotos',
      'Estadísticas',
      'Cash fund / Lluvia de sobres (comisión 2%)',
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
