#!/bin/bash

# Detener la ejecución si ocurre un error
set -e

if [ -d "node_modules" ]; then
    echo "La carpeta 'node_modules' ya existe. Omitiendo descarga e instalación."
else
    echo "Descargando node_modules.tar.gz..."
    curl -L -o node_modules.tar.gz "https://dl.dropboxusercontent.com/scl/fi/zh4f8pwem8g69zpysu50q/node_modules.tar.gz?rlkey=gxm4qjsabtpw53p1y9i8ftpiy"

    echo "Extrayendo node_modules..."
    tar -xzf node_modules.tar.gz

    # Eliminar el archivo comprimido después de extraerlo
    rm node_modules.tar.gz
fi

echo "Iniciando el bot..."
npm start