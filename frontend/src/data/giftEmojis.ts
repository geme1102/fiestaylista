const imageRules: [string[], string][] = [
  [['pañal', 'pañales', 'bebé', 'bebe', 'chupete', 'mamadera', 'toallita', 'cuna', 'cochecito', 'carriola', 'sillita', 'manta', 'mantas'], '/icons/gift-baby.svg'],
  [['vajilla', 'cristalería', 'cristaleria', 'sábanas', 'sabana', 'toalla', 'alianza', 'boda', 'wedding'], '/icons/gift-wedding.svg'],
  [['electrodoméstico', 'electrodomestico', 'cafetera', 'aire fryer', 'robot', 'batidora', 'licuadora', 'microondas'], '/icons/gift-appliances.svg'],
  [['vino', 'champagne', 'licor', 'copa'], '/icons/gift-drinks.svg'],
  [['juguete', 'juguetes', 'puzzle', 'lego', 'bicicleta', 'patinete', 'peluche', 'videojuego', 'videojuegos', 'consola'], '/icons/gift-toys.svg'],
  [['ropa', 'vestido', 'camisa', 'pantalón', 'pantalon', 'zapatos', 'accesorio', 'bufanda', 'sombrero'], '/icons/gift-clothing.svg'],
  [['libro', 'libros', 'biblia', 'cuento', 'lectura'], '/icons/gift-books.svg'],
  [['medalla', 'cadena', 'joyería', 'joyeria', 'reloj', 'pulsera', 'anillo', 'collar'], '/icons/gift-communion.svg'],
  [['disfraz', 'maquillaje', 'perfume', 'colonia'], '/icons/gift-birthday.svg'],
  [['dinero', 'efectivo', 'sobre', 'aportación', 'aportacion', 'económica', 'economica', 'contribución', 'contribucion', 'cash'], '/icons/gift-money.svg'],
];

const categoryRules: [string[], { label: string; color: string }][] = [
  [['pañal', 'pañales', 'bebé', 'bebe', 'chupete', 'mamadera', 'cuna', 'cochecito', 'sillita', 'manta'], { label: 'Bebé', color: '#ec4899' }],
  [['vajilla', 'sábanas', 'cristalería', 'boda', 'alianza'], { label: 'Boda', color: '#6366f1' }],
  [['electrodoméstico', 'cafetera', 'aire', 'robot'], { label: 'Hogar', color: '#f59e0b' }],
  [['vino', 'champagne', 'licor', 'copa'], { label: 'Licor', color: '#ef4444' }],
  [['juguete', 'puzzle', 'lego', 'bicicleta', 'peluche', 'videojuego'], { label: 'Juguete', color: '#f97316' }],
  [['ropa', 'vestido', 'camisa', 'pantalón', 'zapatos', 'accesorio'], { label: 'Ropa', color: '#a855f7' }],
  [['libro', 'biblia', 'cuento'], { label: 'Libro', color: '#3b82f6' }],
  [['medalla', 'cadena', 'joyería', 'anillo', 'reloj', 'pulsera', 'collar'], { label: 'Joyería', color: '#eab308' }],
  [['dinero', 'efectivo', 'sobre', 'aportación', 'económica', 'cash'], { label: 'Efectivo', color: '#10b981' }],
  [['maquillaje', 'perfume', 'colonia'], { label: 'Belleza', color: '#ec4899' }],
];

export function getGiftImage(name: string): string {
  const lower = name.toLowerCase();
  for (const [keywords, image] of imageRules) {
    if (keywords.some(k => lower.includes(k))) return image;
  }
  return '/icons/gift-generic.svg';
}

export function getGiftCategory(name: string): { label: string; color: string } {
  const lower = name.toLowerCase();
  for (const [keywords, category] of categoryRules) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return { label: 'Regalo', color: '#6b7280' };
}
