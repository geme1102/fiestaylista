# Reglas de Desarrollo — Fiesta y Lista

## 1. No borrar código funcional
No puedes borrar código que está funcionando en la app. Solo se actualiza y mejora, nunca se elimina sin reemplazo equivalente o superior.

## 2. No modificar procesos que funcionan
No puedes modificar o borrar procesos que estén sirviendo perfectamente. Solo se permiten mejoras y actualizaciones justificadas.

## 3. Analizar consecuencias antes de cambiar
Siempre revisa los cambios y analiza qué consecuencias tienen: si dañan la app o la mejoran. Cada cambio debe pasar typecheck, lint y tests antes de commit.
