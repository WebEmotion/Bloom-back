# Bloom #
Proyecto con nodejs, express y typeorm 


## Instalacion y compilación
1. Usar comando `npm install` para instalar dependencias
2. Crear archivo `local.env` apartir del archivo `example.env`
3. Usar comando `tsc` para compilar proyecto
4. usar comando `node build/index.js` para ejecutar proyecto

## Migraciones

Borrar el build del proyecto
Borrar la carpeta migrations
NO OLVIDAR RESPALDAR REGISTROS DE LA BASE DE DATOS

1. Generar migracion con `npm run typeorm migration:create -- -n 'Nombre de la migración'`
2. Compliar migración con `tsc`
3. Generar migracion con `npm run typeorm migration:generate -- -n 'Nombre de la migración'`
4. Compliar migración con `tsc`
5. Correr migración con `npm run typeorm migration:run`