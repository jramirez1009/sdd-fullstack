import bcrypt from 'bcrypt';

// bcrypt incorpora sal por diseño y su coste es ajustable. 10 es el equilibrio
// habitual entre resistencia a fuerza bruta y latencia del login.
const COSTE_BCRYPT = 10;

export function hashearPassword(password) {
  return bcrypt.hash(password, COSTE_BCRYPT);
}

export function compararPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export { COSTE_BCRYPT };
