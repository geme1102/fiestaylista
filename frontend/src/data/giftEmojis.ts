export function getGiftImage(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('pañal') || lower.includes('pañales')) return '/icons/gift-baby.svg';
  if (lower.includes('bebé') || lower.includes('bebe') || lower.includes('chupete') || lower.includes('mamadera') || lower.includes('toallita') || lower.includes('cuna') || lower.includes('cochecito') || lower.includes('carriola') || lower.includes('sillita') || lower.includes('manta') || lower.includes('mantas')) return '/icons/gift-baby.svg';
  if (lower.includes('vajilla') || lower.includes('cristalería') || lower.includes('cristaleria') || lower.includes('sábanas') || lower.includes('sabana') || lower.includes('toalla')) return '/icons/gift-wedding.svg';
  if (lower.includes('anillo') || lower.includes('alianza') || lower.includes('boda') || lower.includes('wedding')) return '/icons/gift-wedding.svg';
  if (lower.includes('electrodoméstico') || lower.includes('electrodomestico') || lower.includes('cafetera') || lower.includes('aire fryer') || lower.includes('robot') || lower.includes('batidora') || lower.includes('licuadora') || lower.includes('microondas')) return '/icons/gift-appliances.svg';
  if (lower.includes('vino') || lower.includes('champagne') || lower.includes('licor') || lower.includes('copa')) return '/icons/gift-drinks.svg';
  if (lower.includes('juguete') || lower.includes('juguetes') || lower.includes('puzzle') || lower.includes('lego') || lower.includes('bicicleta') || lower.includes('patinete') || lower.includes('peluche') || lower.includes('videojuego') || lower.includes('videojuegos') || lower.includes('consola')) return '/icons/gift-toys.svg';
  if (lower.includes('ropa') || lower.includes('vestido') || lower.includes('camisa') || lower.includes('pantalón') || lower.includes('pantalon') || lower.includes('zapatos') || lower.includes('accesorio') || lower.includes('bufanda') || lower.includes('sombrero')) return '/icons/gift-clothing.svg';
  if (lower.includes('libro') || lower.includes('libros') || lower.includes('biblia') || lower.includes('cuento') || lower.includes('lectura')) return '/icons/gift-books.svg';
  if (lower.includes('medalla') || lower.includes('cadena') || lower.includes('joyería') || lower.includes('joyeria') || lower.includes('reloj') || lower.includes('pulsera') || lower.includes('anillo') || lower.includes('collar')) return '/icons/gift-communion.svg';
  if (lower.includes('disfraz') || lower.includes('maquillaje') || lower.includes('perfume') || lower.includes('colonia')) return '/icons/gift-birthday.svg';
  if (lower.includes('dinero') || lower.includes('efectivo') || lower.includes('sobre') || lower.includes('aportación') || lower.includes('aportacion') || lower.includes('económica') || lower.includes('economica') || lower.includes('contribución') || lower.includes('contribucion') || lower.includes('cash')) return '/icons/gift-money.svg';
  return '/icons/gift-generic.svg';
}

export function getGiftCategory(name: string): { label: string; color: string } {
  const lower = name.toLowerCase();
  if (lower.includes('pañal') || lower.includes('pañales') || lower.includes('bebé') || lower.includes('bebe') || lower.includes('chupete') || lower.includes('mamadera') || lower.includes('cuna') || lower.includes('cochecito') || lower.includes('sillita') || lower.includes('manta')) return { label: 'Bebé', color: '#ec4899' };
  if (lower.includes('vajilla') || lower.includes('sábanas') || lower.includes('cristalería') || lower.includes('boda') || lower.includes('alianza') || lower.includes('anillo')) return { label: 'Boda', color: '#6366f1' };
  if (lower.includes('electrodoméstico') || lower.includes('cafetera') || lower.includes('aire') || lower.includes('robot')) return { label: 'Hogar', color: '#f59e0b' };
  if (lower.includes('vino') || lower.includes('champagne') || lower.includes('licor') || lower.includes('copa')) return { label: 'Licor', color: '#ef4444' };
  if (lower.includes('juguete') || lower.includes('puzzle') || lower.includes('lego') || lower.includes('bicicleta') || lower.includes('peluche') || lower.includes('videojuego')) return { label: 'Juguete', color: '#f97316' };
  if (lower.includes('ropa') || lower.includes('vestido') || lower.includes('camisa') || lower.includes('pantalón') || lower.includes('zapatos') || lower.includes('accesorio')) return { label: 'Ropa', color: '#a855f7' };
  if (lower.includes('libro') || lower.includes('biblia') || lower.includes('cuento')) return { label: 'Libro', color: '#3b82f6' };
  if (lower.includes('medalla') || lower.includes('cadena') || lower.includes('joyería') || lower.includes('reloj') || lower.includes('pulsera') || lower.includes('collar')) return { label: 'Joyería', color: '#eab308' };
  if (lower.includes('dinero') || lower.includes('efectivo') || lower.includes('sobre') || lower.includes('aportación') || lower.includes('económica') || lower.includes('cash')) return { label: 'Efectivo', color: '#10b981' };
  if (lower.includes('maquillaje') || lower.includes('perfume') || lower.includes('colonia')) return { label: 'Belleza', color: '#ec4899' };
  return { label: 'Regalo', color: '#6b7280' };
}
