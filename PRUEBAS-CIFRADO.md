# Plan de pruebas controladas — Control de Horas

## Alcance
Esta rama es una copia aislada del piloto de cifrado local. No fusionar con `main` ni cambiar la fuente de GitHub Pages de producción durante las pruebas.

## Antes de empezar
- Confirmar que la URL de prueba pertenece a un despliegue separado.
- No introducir contraseñas ni códigos de recuperación en chats, capturas o incidencias.
- Conservar una copia de seguridad previa de los datos originales.
- No borrar datos del navegador ni desinstalar la PWA durante las pruebas.

## Casos de prueba
1. **Primera apertura:** verificar que se ofrece crear una contraseña de al menos 12 caracteres y repetirla.
2. **Código de recuperación:** guardar el código fuera del dispositivo; comprobar que la pantalla exige confirmar que se ha guardado antes de continuar.
3. **Cifrado en reposo:** tras cerrar la aplicación, comprobar en el almacenamiento del sitio que los tres almacenes de datos de la aplicación no aparecen como texto legible y que existe el contenedor cifrado.
4. **Desbloqueo:** cerrar y volver a abrir; verificar que la contraseña correcta permite acceder y una incorrecta no.
5. **Operaciones:** añadir un servicio realizado, añadir uno pendiente, editarlo, marcarlo realizado, marcar un registro cobrado y eliminar un registro de prueba. Tras cada operación, recargar y comprobar que el resultado persiste.
6. **Bloqueo por inactividad:** dejar la aplicación sin actividad durante cinco minutos; comprobar que vuelve a solicitar desbloqueo y conserva los últimos cambios.
7. **Recuperación:** cerrar la aplicación y desbloquear con el código de recuperación. Verificar que los datos siguen intactos.
8. **Copia cifrada:** exportar una copia; comprobar que no contiene los registros en texto claro. Restaurarla en un perfil de prueba separado y comprobar los datos.
9. **Copia incorrecta:** probar un archivo manipulado o contraseña incorrecta; la aplicación debe rechazarlo sin sustituir los datos existentes.
10. **CSV:** verificar que la exportación informa claramente de que el CSV no está cifrado.

## Criterios de aceptación
- Ningún cambio confirmado desaparece tras recargar.
- La contraseña incorrecta y un código incorrecto no desbloquean los datos.
- La recuperación y restauración conservan exactamente los registros, tarifas y servicios programados.
- Los errores de escritura se muestran al usuario y no se presentan como guardados correctos.
- No se prueba con los datos reales hasta superar primero los casos con datos ficticios.

## Limitaciones
Estas pruebas manuales no sustituyen una auditoría independiente ni un pentest. El cifrado local no protege frente a código malicioso publicado en el propio sitio, dispositivo comprometido o datos visibles mientras la aplicación está desbloqueada.
